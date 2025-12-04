import { NextResponse } from "next/server";
import { loadCameraConfigs } from "../../../lib/config";

export function GET() {
  const configs = loadCameraConfigs();
  const list = Object.entries(configs).map(([key, cfg]) => ({
    key,
    camera_id: cfg.camera_id,
    visible_spots: cfg.visible_spots,
    alignment_hint: cfg.alignment_hint,
  }));
  return NextResponse.json({ configs: list });
}
