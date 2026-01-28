import { type NextRequest, NextResponse } from "next/server";

/**
 * Audio proxy endpoint that fetches audio from Vercel Blob and returns it
 * with proper CORS headers for Web Audio API analysis.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow proxying from our Vercel Blob storage
  if (!url.includes("public.blob.vercel-storage.com")) {
    return NextResponse.json({ error: "Invalid audio URL" }, { status: 403 });
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch audio" }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Audio proxy error:", error);
    return NextResponse.json({ error: "Failed to proxy audio" }, { status: 500 });
  }
}
