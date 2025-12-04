import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mime from "mime";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCameraConfig } from "../../../lib/config";

type ModelOutput = { spot_number: string; status: string };

const ALLOWED_STATUS = new Set(["OCCUPIED", "VACANT", "UNKNOWN"]);

function toBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server missing GEMINI_API_KEY" }, { status: 500 });
  }

  const formData = await req.formData();
  const camera = formData.get("camera")?.toString() || "";
  const file = formData.get("image");

  if (!camera || !(file instanceof File)) {
    return NextResponse.json({ error: "camera and image are required" }, { status: 400 });
  }

  const cfg = getCameraConfig(camera);
  if (!cfg) {
    return NextResponse.json({ error: `Unknown camera '${camera}'` }, { status: 400 });
  }

  const refPath =
    process.env.REFERENCE_IMAGE_PATH || path.join(process.cwd(), "config", "reference_labeled.png");
  if (!fs.existsSync(refPath)) {
    return NextResponse.json({ error: "Reference image not found on server" }, { status: 500 });
  }

  const refBuffer = fs.readFileSync(refPath);
  const refMime = mime.getType(refPath) || "image/png";

  const camArrayBuffer = await file.arrayBuffer();
  const camBuffer = Buffer.from(camArrayBuffer);
  const camMime = file.type || "image/jpeg";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  const prompt = [
    "You are a parking enforcement AI. Compare the labeled Reference Map to the Camera View.",
    `Perspective hint: ${cfg.alignment_hint}`,
    `Allowed spots (strict): ${cfg.visible_spots.join(", ")}`,
    "Rules:",
    "- Report only allowed spots.",
    "- Status = OCCUPIED, VACANT, or UNKNOWN (if ambiguous or not visible).",
    "- If alignment fails, return [].",
    "Return JSON array: [{\"spot_number\":\"A0\",\"status\":\"OCCUPIED\"}].",
  ].join("\n");

  const response = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: refMime, data: toBase64(refBuffer) } },
    { inlineData: { mimeType: camMime, data: toBase64(camBuffer) } },
  ]);

  const raw = response.response.text() || "";
  let cleaned: ModelOutput[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cleaned = parsed
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          spot_number: String(x.spot_number || "").trim(),
          status: String(x.status || "").trim().toUpperCase(),
        }))
        .filter((x) => cfg.visible_spots.includes(x.spot_number) && ALLOWED_STATUS.has(x.status));
    }
  } catch {
    cleaned = [];
  }

  return NextResponse.json({ camera_id: cfg.camera_id, spots: cleaned, raw });
}
