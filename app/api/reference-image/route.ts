import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mime from "mime";

export async function GET() {
  // Keep the reference image co-located with the parking map configuration so
  // coordinates and dimensions stay in sync.
  const referencePath =
    process.env.REFERENCE_IMAGE_PATH || path.join(process.cwd(), "config", "reference_labeled.png");

  if (!fs.existsSync(referencePath)) {
    return NextResponse.json({ error: "Reference image not found" }, { status: 500 });
  }

  const file = fs.readFileSync(referencePath);
  const type = mime.getType(referencePath) || "image/png";
  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=60",
    },
  });
}
