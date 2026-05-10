/**
 * RadioKong Relay Server
 *
 * Receives audio chunks from the browser via WebSocket and forwards them
 * to an Icecast/SHOUTcast server via HTTP PUT (source protocol).
 *
 * Port: 3001 (runs alongside Next.js on port 3000)
 */

import { WebSocketServer } from "ws";
import http from "http";

const PORT = 3001;

/** @type {Map<string, { req: http.ClientRequest, res: http.IncomingMessage | null, wss: WebSocket, connected: boolean }>} */
const streams = new Map();

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  console.log("[Relay] Client connected");

  ws.on("message", (raw, isBinary) => {
    try {
      // Text messages are control commands; binary messages are audio chunks
      if (!isBinary) {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } else {
        // Binary = audio chunk — forward to Icecast
        handleAudioChunk(ws, raw);
      }
    } catch (err) {
      console.error("[Relay] Error processing message:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("[Relay] Client disconnected");
    // Clean up any stream associated with this socket
    for (const [id, stream] of streams) {
      if (stream.ws === ws) {
        closeStream(id, "Client disconnected");
      }
    }
  });

  ws.on("error", (err) => {
    console.error("[Relay] WebSocket error:", err.message);
  });

  // Send ready signal
  ws.send(JSON.stringify({ type: "ready" }));
});

/**
 * Handle control messages from the browser
 */
function handleMessage(ws, msg) {
  switch (msg.type) {
    case "connect": {
      const { id, host, port, password, mount, codec, bitrate, serverType } = msg;
      connectToIcecast(ws, id, { host, port, password, mount, codec, bitrate, serverType });
      break;
    }
    case "disconnect": {
      const { id } = msg;
      closeStream(id, "Client requested disconnect");
      break;
    }
    case "metadata": {
      const { id, title, artist } = msg;
      updateMetadata(id, title, artist);
      break;
    }
    case "test-connection": {
      const { host, port, password, mount, serverType } = msg;
      testConnection(ws, { host, port, password, mount, serverType });
      break;
    }
    default:
      console.warn("[Relay] Unknown message type:", msg.type);
  }
}

/**
 * Open a persistent HTTP PUT connection to Icecast/SHOUTcast
 */
function connectToIcecast(ws, id, config) {
  // Close existing stream if any
  if (streams.has(id)) {
    closeStream(id, "Reconnecting");
  }

  const { host, port, password, mount, codec, bitrate, serverType } = config;

  // Determine Content-Type based on codec
  const contentTypes = {
    mp3: "audio/mpeg",
    ogg: "application/ogg",
    aac: "audio/aac",
    opus: "audio/ogg",
    flac: "audio/flac",
  };
  const contentType = contentTypes[codec] || "audio/mpeg";

  // Icecast source auth: base64("source:password")
  const auth = Buffer.from(`source:${password}`).toString("base64");

  const path = serverType === "shoutcast" ? "/stream" : mount;

  const options = {
    hostname: host,
    port: parseInt(port) || 8000,
    path,
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Authorization: `Basic ${auth}`,
      "Ice-Public": "1",
      "Ice-Name": "RadioKong Live Stream",
      "Ice-Description": "Live stream from RadioKong",
      "Ice-Genre": "Various",
      "Ice-Bitrate": String(bitrate),
      "Ice-Audio-Info": `ice-samplerate=44100;ice-bitrate=${bitrate};ice-channels=2`,
      "Transfer-Encoding": "chunked",
    },
    timeout: 10000,
  };

  console.log(`[Relay] Connecting to ${serverType} at ${host}:${port}${path}`);

  const req = http.request(options, (res) => {
    if (res.statusCode === 100 || res.statusCode === 200 || res.statusCode === 201) {
      console.log(`[Relay] Connected to ${host}:${port} (HTTP ${res.statusCode})`);
      const stream = streams.get(id);
      if (stream) {
        stream.connected = true;
        stream.res = res;
      }
      ws.send(JSON.stringify({ type: "stream-status", status: "connected", id }));
    } else {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        console.error(`[Relay] Icecast returned HTTP ${res.statusCode}: ${body}`);
        ws.send(
          JSON.stringify({
            type: "stream-status",
            status: "error",
            id,
            error: `Server returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`,
          })
        );
        streams.delete(id);
      });
    }
  });

  req.on("error", (err) => {
    console.error(`[Relay] Connection error: ${err.message}`);
    ws.send(
      JSON.stringify({
        type: "stream-status",
        status: "error",
        id,
        error: `Connection failed: ${err.message}`,
      })
    );
    streams.delete(id);
  });

  req.on("timeout", () => {
    console.error("[Relay] Connection timeout");
    ws.send(
      JSON.stringify({
        type: "stream-status",
        status: "error",
        id,
        error: "Connection timed out — check host and port",
      })
    );
    req.destroy();
    streams.delete(id);
  });

  // Store the stream
  streams.set(id, { req, res: null, ws, connected: false });

  // Don't end the request — we'll write chunks to it
  ws.send(JSON.stringify({ type: "stream-status", status: "connecting", id }));
}

/**
 * Forward an audio chunk to the Icecast connection
 */
function handleAudioChunk(ws, chunk) {
  // Find the stream for this WebSocket
  for (const [id, stream] of streams) {
    if (stream.ws === ws && stream.connected) {
      try {
        stream.req.write(chunk);
      } catch (err) {
        console.error(`[Relay] Error writing chunk: ${err.message}`);
        ws.send(
          JSON.stringify({
            type: "stream-status",
            status: "error",
            id,
            error: `Write error: ${err.message}`,
          })
        );
      }
      return;
    }
  }
  // No active stream — ignore the chunk
}

/**
 * Close a stream connection
 */
function closeStream(id, reason) {
  const stream = streams.get(id);
  if (stream) {
    try {
      stream.req.end();
    } catch {}
    streams.delete(id);
    console.log(`[Relay] Stream ${id} closed: ${reason}`);
  }
}

/**
 * Update metadata on Icecast via admin API
 */
function updateMetadata(streamId, title, artist) {
  const stream = streams.get(streamId);
  if (!stream) return;

  // Find config from stream — we need host/port/mount/password
  // We'll send metadata via a separate HTTP GET to the admin endpoint
  // This is handled by the Next.js API route instead
}

/**
 * Test connection to Icecast/SHOUTcast without streaming
 */
function testConnection(ws, config) {
  const { host, port, password, mount, serverType } = config;

  const auth = Buffer.from(`source:${password}`).toString("base64");
  const path = serverType === "shoutcast" ? "/stream" : mount;

  // Try a HEAD request first
  const options = {
    hostname: host,
    port: parseInt(port) || 8000,
    path: "/",
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    timeout: 5000,
  };

  const req = http.request(options, (res) => {
    const serverHeader = res.headers["server"] || "";
    const isIcecast = serverHeader.toLowerCase().includes("icecast");
    const isShoutcast = serverHeader.toLowerCase().includes("shoutcast") || serverHeader.toLowerCase().includes("ultravox");

    ws.send(
      JSON.stringify({
        type: "test-result",
        success: true,
        server: isIcecast ? "Icecast" : isShoutcast ? "SHOUTcast" : serverHeader || "Unknown",
        message: `Server reachable (${serverHeader || "unknown server"}). HTTP ${res.statusCode}`,
      })
    );
    res.resume(); // Consume response
  });

  req.on("error", (err) => {
    ws.send(
      JSON.stringify({
        type: "test-result",
        success: false,
        message: `Cannot reach ${host}:${port} — ${err.message}`,
      })
    );
  });

  req.on("timeout", () => {
    req.destroy();
    ws.send(
      JSON.stringify({
        type: "test-result",
        success: false,
        message: `Connection to ${host}:${port} timed out`,
      })
    );
  });

  req.end();
}

console.log(`[Relay] RadioKong WebSocket relay server running on ws://localhost:${PORT}`);
