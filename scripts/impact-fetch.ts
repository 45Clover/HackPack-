// Fetches the real numbers behind "Impact projects" and saves them to data/impact-datasets.json.
// Commit that file: the Gemini step (scripts/impact-generate.ts) reads it, so it never depends on the APIs being up.
// Both APIs are public and need no key.
//
//   npx tsx scripts/impact-fetch.ts
//
// If any dataset comes back empty, nothing is written and the old snapshot stays.
import { mkdirSync, writeFileSync } from "node:fs";
import { DATASETS, type Dataset, type Point } from "../lib/impact/datasets";

const LATEST = 16; // points per series: 16 months, 4 years of quarters, or every year up to 16
const WDS = "https://www150.statcan.gc.ca/t1/wds/rest";
const OUT = new URL("../data/impact-datasets.json", import.meta.url);

type WdsPoint = { refPer: string; value: number | null; frequencyCode: number };

// StatCan dates every point by its first day: monthly "2026-10", quarterly "2026 Q2", yearly "2024".
function statcanPeriod(p: WdsPoint) {
  const [y, m] = p.refPer.split("-");
  if (p.frequencyCode === 12) return y;
  if (p.frequencyCode === 9) return `${y} Q${Math.ceil(Number(m) / 3)}`;
  return `${y}-${m}`;
}

async function fetchStatcan(sets: Extract<Dataset, { source: "statcan" }>[]) {
  const res = await fetch(`${WDS}/getDataFromVectorsAndLatestNPeriods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sets.map((d) => ({ vectorId: d.vectorId, latestN: LATEST }))),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`StatCan WDS ${res.status}`);
  const rows = (await res.json()) as { status: string; object: { vectorId: number; vectorDataPoint: WdsPoint[] } }[];
  // The answer comes back in any order, so match by vector ID.
  const byVector = new Map(rows.filter((r) => r.status === "SUCCESS").map((r) => [r.object.vectorId, r.object.vectorDataPoint]));
  return new Map(sets.map((d) => [d.id, (byVector.get(d.vectorId) ?? [])
    .filter((p) => p.value !== null) // early years of some tables are blank
    .map((p): Point => ({ period: statcanPeriod(p), value: p.value! }))]));
}

async function fetchSdg(d: Extract<Dataset, { source: "unsdg" }>): Promise<Point[]> {
  const url = `https://unstats.un.org/sdgapi/v1/sdg/Series/Data?seriesCode=${d.seriesCode}&areaCode=124&pageSize=500`; // 1000 gets a 502
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) }); // the UN API takes ~30 s to answer
  if (!res.ok) throw new Error(`UN SDG ${res.status} for ${d.seriesCode}`);
  const { data } = (await res.json()) as { data: { timePeriodStart: number; value: string; dimensions: Record<string, string> }[] };
  return data
    .filter((r) => Object.entries(d.dims).every(([k, v]) => r.dimensions[k] === v) && r.value !== "" && Number.isFinite(Number(r.value)))
    .map((r) => ({ period: String(r.timePeriodStart), value: Number(r.value) }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-LATEST);
}

async function main() {
  const statcan = await fetchStatcan(DATASETS.filter((d) => d.source === "statcan"));
  const out = [];
  for (const d of DATASETS) {
    const series = d.source === "statcan" ? statcan.get(d.id)! : await fetchSdg(d);
    if (series.length < 2) throw new Error(`${d.id} (${d.title}) returned ${series.length} points. Snapshot not written.`);
    const first = series[0], last = series.at(-1)!;
    console.log(`${d.id.padEnd(14)} ${String(series.length).padStart(2)} pts  ${first.period} ${first.value} -> ${last.period} ${last.value} ${d.unit}  ${d.title}`);
    out.push({ id: d.id, source: d.source, title: d.title, series });
  }
  mkdirSync(new URL(".", OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ fetched_at: new Date().toISOString(), datasets: out }, null, 2) + "\n");
  console.log(`\nWrote ${out.length} datasets to data/impact-datasets.json`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
