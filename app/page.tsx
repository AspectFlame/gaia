"use client";

import { useEffect, useMemo, useState } from "react";
import parkingMap from "../config/parking_map.json";

type CameraConfig = {
  key: string;
  camera_id: string;
  visible_spots: string[];
  alignment_hint: string;
};

type Spot = { spot_number: string; status: string };
type MapSpot = { id: string; points: [number, number][] };

const statusClass: Record<string, string> = {
  OCCUPIED: "border-rose-400/60 text-rose-200",
  VACANT: "border-emerald-400/70 text-emerald-200",
  UNKNOWN: "border-slate-500 text-slate-200",
};
const mapSpots = parkingMap.spots as MapSpot[];



const MAP_DIMENSIONS = (parkingMap as any).metadata?.image_width
  ? { 
      width: (parkingMap as any).metadata.image_width, 
      height: (parkingMap as any).metadata.image_height 
    }
  : { width: 363, height: 899 };
    


export default function Page() {
  const [configs, setConfigs] = useState<CameraConfig[]>([]);
  const [camera, setCamera] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/configs")
      .then((r) => r.json())
      .then((data) => {
        setConfigs(data.configs || []);
        if (data.configs?.length) setCamera(data.configs[0].key);
      })
      .catch(() => setError("Could not load camera configs"));
  }, []);

  const currentConfig = useMemo(() => configs.find((c) => c.key === camera), [configs, camera]);
  const statusBySpot = useMemo(() => {
    const map = new Map<string, string>();
    spots.forEach((s) => map.set(s.spot_number, s.status));
    return map;
  }, [spots]);

  function getSpotColors(status: string | undefined) {
    switch (status) {
      case "OCCUPIED":
        return { fill: "#ef4444", stroke: "#fca5a5" };
      case "VACANT":
        return { fill: "#22c55e", stroke: "#86efac" };
      default:
        return { fill: "#cbd5e1", stroke: "#94a3b8" };
    }
  }

  function getCentroid(points: [number, number][]) {
    const total = points.reduce(
      (acc, [x, y]) => {
        acc.x += x;
        acc.y += y;
        return acc;
      },
      { x: 0, y: 0 }
    );
    return { x: total.x / points.length, y: total.y / points.length };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file || !camera) {
      setError("Select camera and choose an image.");
      return;
    }
    const fd = new FormData();
    fd.append("camera", camera);
    fd.append("image", file);

    setLoading(true);
    setSpots([]);
    setRaw("");
    try {
      const res = await fetch("/api/detect", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSpots(data.spots || []);
      setRaw(data.raw || "");
    } catch (err: any) {
      setError(err.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-100">Gaia Parking</h1>
        <p className="text-slate-300 max-w-3xl">
          Upload a camera frame, pick a camera profile, and get grounded occupancy for the allowed spots.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-xl shadow-black/40">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Camera</label>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-slate-100"
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
              >
                {configs.map((cfg) => (
                  <option key={cfg.key} value={cfg.key}>
                    {cfg.key} — {cfg.alignment_hint.slice(0, 48)}...
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-200">Upload camera image</label>
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-slate-200"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60"
            >
              {loading ? "Detecting..." : "Run detection"}
            </button>
            {error && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {error}
              </div>
            )}
          </form>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-slate-100 mb-3">Reference map</h3>
          <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-900/60">
            <img
              src="/api/reference-image"
              alt="Reference labeled map"
              className="w-full"
            />
            <svg
              viewBox={`0 0 ${MAP_DIMENSIONS.width} ${MAP_DIMENSIONS.height}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {mapSpots.map((spot) => {
                const status = statusBySpot.get(spot.id) || "VACANT";
                const colors = getSpotColors(status);
                const centroid = getCentroid(spot.points);
                return (
                  <g key={spot.id}>
                    <polygon
                      points={spot.points.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={3}
                      fillOpacity={1.0}
                      className="drop-shadow"
                    />
                    <text
                      x={centroid.x}
                      y={centroid.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#0b1224"
                      fontSize="18"
                      fontWeight="700"
                      paintOrder="stroke"
                      stroke="#e2e8f0"
                      strokeWidth={1.2}
                    >
                      {spot.id}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-xl shadow-black/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Results</h3>
          {spots.length > 0 && (
            <span className="text-xs text-slate-400">Showing {spots.length} detected spots</span>
          )}
        </div>
        {spots.length === 0 && <div className="text-slate-400 text-sm">No results yet.</div>}
        <div className="flex flex-wrap gap-2">
          {spots.map((s) => (
            <span
              key={s.spot_number}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass[s.status] || ""}`}
            >
              {s.spot_number}: {s.status}
            </span>
          ))}
        </div>
        {raw && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">Raw model output</div>
            <pre className="whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-200">
              {raw}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}