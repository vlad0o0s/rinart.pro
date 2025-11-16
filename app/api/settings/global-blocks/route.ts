import { NextResponse } from "next/server";
import { getGlobalBlocks } from "@/lib/global-blocks";

export async function GET() {
  const blocks = await getGlobalBlocks();
  return NextResponse.json(
    { blocks },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" } },
  );
}


