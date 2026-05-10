import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/metadata
 *
 * Updates metadata on an Icecast/SHOUTcast server via the admin API.
 */
export async function POST(request: NextRequest) {
  try {
    const { host, port, password, mount, title, artist, serverType } = await request.json();

    if (!host || !port) {
      return NextResponse.json({ error: "Host and port are required" }, { status: 400 });
    }

    const song = artist && title ? `${artist} - ${title}` : title || artist || "";

    if (serverType === "icecast") {
      const url = `http://${host}:${port}/admin/metadata?mount=${encodeURIComponent(mount || "/live")}&mode=updinfo&song=${encodeURIComponent(song)}`;
      const auth = Buffer.from(`source:${password}`).toString("base64");

      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return NextResponse.json({ success: true, message: "Metadata updated" });
      } else {
        return NextResponse.json(
          { error: `Icecast returned HTTP ${response.status}` },
          { status: 502 }
        );
      }
    } else {
      const url = `http://${host}:${port}/admin.cgi?mode=updinfo&song=${encodeURIComponent(song)}&pass=${encodeURIComponent(password)}`;

      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return NextResponse.json({ success: true, message: "Metadata updated" });
      } else {
        return NextResponse.json(
          { error: `SHOUTcast returned HTTP ${response.status}` },
          { status: 502 }
        );
      }
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update metadata" },
      { status: 500 }
    );
  }
}
