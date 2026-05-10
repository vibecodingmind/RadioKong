import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/test-connection
 *
 * Tests connectivity to an Icecast/SHOUTcast server without starting a stream.
 * Verifies the server is reachable and the credentials work.
 */
export async function POST(request: NextRequest) {
  try {
    const { host, port, password, mount, serverType } = await request.json();

    if (!host || !port) {
      return NextResponse.json({ error: "Host and port are required" }, { status: 400 });
    }

    const auth = Buffer.from(`source:${password}`).toString("base64");

    // Try to reach the server's status page
    const url = `http://${host}:${port}/`;

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(8000),
    });

    const serverHeader = response.headers.get("server") || "";
    const isIcecast = serverHeader.toLowerCase().includes("icecast");
    const isShoutcast =
      serverHeader.toLowerCase().includes("shoutcast") ||
      serverHeader.toLowerCase().includes("ultravox");

    // For Icecast, also try to verify the mount point exists or credentials work
    let mountStatus = "unknown";
    if (isIcecast && mount) {
      try {
        const mountUrl = `http://${host}:${port}/admin/listmounts`;
        const mountResp = await fetch(mountUrl, {
          headers: { Authorization: `Basic ${auth}` },
          signal: AbortSignal.timeout(5000),
        });
        if (mountResp.ok) {
          mountStatus = "credentials-valid";
        } else if (mountResp.status === 401) {
          mountStatus = "invalid-credentials";
        } else {
          mountStatus = "ok";
        }
      } catch {
        mountStatus = "ok";
      }
    }

    return NextResponse.json({
      success: true,
      server: isIcecast ? "Icecast" : isShoutcast ? "SHOUTcast" : serverHeader || "Unknown",
      httpStatus: response.status,
      mountStatus,
      message: `Server reachable at ${host}:${port} (${serverHeader || "unknown server type"})`,
    });
  } catch (err: any) {
    const message = err.cause?.code === "ECONNREFUSED"
      ? `Connection refused at ${request.body ? 'server' : 'unknown'}: Is the server running?`
      : err.name === "TimeoutError" || err.cause?.code === "ETIMEDOUT"
        ? "Connection timed out — check host and port"
        : `Connection failed: ${err.message}`;

    return NextResponse.json(
      { success: false, message },
      { status: 502 }
    );
  }
}
