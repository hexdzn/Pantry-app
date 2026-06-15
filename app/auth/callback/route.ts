import { NextRequest, NextResponse } from "next/server";
// Simple passthrough - implicit flow handles session via URL hash automatically
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`);
}
