import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get("size") || "192");

  // Generate a simple SVG-based icon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.1875)}" fill="#0B0F1A"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.352)}" stroke="#00C6ED" stroke-width="${Math.round(size * 0.006)}" stroke-dasharray="${Math.round(size * 0.023)} ${Math.round(size * 0.016)}" opacity="0.3"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.254)}" stroke="#00C6ED" stroke-width="${Math.round(size * 0.006)}" stroke-dasharray="${Math.round(size * 0.02)} ${Math.round(size * 0.012)}" opacity="0.4"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.156)}" stroke="#00C6ED" stroke-width="${Math.round(size * 0.006)}" stroke-dasharray="${Math.round(size * 0.016)} ${Math.round(size * 0.01)}" opacity="0.5"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.059)}" stroke="#00C6ED" stroke-width="${Math.round(size * 0.006)}" opacity="0.7"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${Math.round(size * 0.016)}" fill="#00C6ED"/>
  <line x1="${size / 2}" y1="${size / 2}" x2="${size / 2}" y2="${Math.round(size * 0.14)}" stroke="#00C6ED" stroke-width="${Math.round(size * 0.006)}" stroke-linecap="round" opacity="0.8"/>
  <circle cx="${Math.round(size * 0.625)}" cy="${Math.round(size * 0.273)}" r="${Math.round(size * 0.012)}" fill="#00C6ED" opacity="0.6"/>
  <circle cx="${Math.round(size * 0.352)}" cy="${Math.round(size * 0.352)}" r="${Math.round(size * 0.01)}" fill="#00C6ED" opacity="0.5"/>
  <circle cx="${Math.round(size * 0.684)}" cy="${Math.round(size * 0.586)}" r="${Math.round(size * 0.01)}" fill="#00C6ED" opacity="0.4"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
