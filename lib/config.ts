import fs from "fs";
import path from "path";

export type CameraConfig = {
  camera_id: string;
  visible_spots: string[];
  alignment_hint: string;
};

const configPath = process.env.CAMERA_CONFIG_PATH || path.join(process.cwd(), "config", "cameras.json");

let cachedConfigs: Record<string, CameraConfig> | null = null;

export function loadCameraConfigs(): Record<string, CameraConfig> {
  if (cachedConfigs) return cachedConfigs;
  const data = fs.readFileSync(configPath, "utf-8");
  cachedConfigs = JSON.parse(data) as Record<string, CameraConfig>;
  return cachedConfigs;
}

export function getCameraConfig(key: string): CameraConfig | undefined {
  const cfgs = loadCameraConfigs();
  return cfgs[key];
}
