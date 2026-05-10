/**
 * RadioKong Stream Client
 *
 * Connects to the relay server via WebSocket, sends audio chunks,
 * and manages the streaming lifecycle.
 */

const RELAY_URL = `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3001`;

export type StreamStatus = "disconnected" | "connecting" | "connected" | "error";

interface StreamConfig {
  host: string;
  port: number;
  password: string;
  mount: string;
  codec: string;
  bitrate: number;
  serverType: "icecast" | "shoutcast";
}

type StatusCallback = (status: StreamStatus, error?: string) => void;
type TestResultCallback = (success: boolean, message: string) => void;

class StreamClient {
  private ws: WebSocket | null = null;
  private streamId: string;
  private statusCallback: StatusCallback | null = null;
  private testCallback: TestResultCallback | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  constructor() {
    this.streamId = `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  onStatusChange(cb: StatusCallback) {
    this.statusCallback = cb;
  }

  onTestResult(cb: TestResultCallback) {
    this.testCallback = cb;
  }

  private setStatus(status: StreamStatus, error?: string) {
    this.connected = status === "connected";
    this.statusCallback?.(status, error);
  }

  /** Connect to the relay server WebSocket */
  private ensureWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(RELAY_URL);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          console.log("[StreamClient] WebSocket connected to relay");
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch {}
        };

        this.ws.onerror = (event) => {
          console.error("[StreamClient] WebSocket error", event);
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onclose = () => {
          console.log("[StreamClient] WebSocket closed");
          if (this.connected) {
            this.setStatus("error", "Relay server disconnected");
            this.attemptReconnect();
          }
        };
      } catch (err: any) {
        reject(new Error(err.message));
      }
    });
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case "stream-status":
        if (msg.status === "connecting") {
          this.setStatus("connecting");
        } else if (msg.status === "connected") {
          this.setStatus("connected");
        } else if (msg.status === "error") {
          this.setStatus("error", msg.error);
        }
        break;

      case "test-result":
        this.testCallback?.(msg.success, msg.message);
        break;

      case "ready":
        // Relay server is ready
        break;
    }
  }

  private attemptReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureWebSocket().catch(() => {
        // Will retry on next send
      });
    }, 3000);
  }

  /** Connect to Icecast via the relay server */
  async connect(config: StreamConfig): Promise<void> {
    await this.ensureWebSocket();
    this.setStatus("connecting");
    this.ws!.send(
      JSON.stringify({
        type: "connect",
        id: this.streamId,
        ...config,
      })
    );
  }

  /** Send an audio chunk (binary) to the relay server */
  async sendChunk(data: ArrayBuffer | Blob): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.ensureWebSocket();
    }

    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      this.ws!.send(buffer);
    } else {
      this.ws!.send(data);
    }
  }

  /** Update metadata on the streaming server */
  async updateMetadata(title: string, artist: string): Promise<void> {
    await this.ensureWebSocket();
    this.ws!.send(
      JSON.stringify({
        type: "metadata",
        id: this.streamId,
        title,
        artist,
      })
    );
  }

  /** Test connection to a server (without streaming) */
  async testConnection(config: Omit<StreamConfig, "codec" | "bitrate">): Promise<void> {
    await this.ensureWebSocket();
    this.ws!.send(
      JSON.stringify({
        type: "test-connection",
        ...config,
      })
    );
  }

  /** Disconnect from Icecast */
  disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "disconnect",
          id: this.streamId,
        })
      );
    }
    this.setStatus("disconnected");
  }

  /** Clean up everything */
  destroy() {
    this.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton
let instance: StreamClient | null = null;

export function getStreamClient(): StreamClient {
  if (!instance) {
    instance = new StreamClient();
  }
  return instance;
}
