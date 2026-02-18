import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function fetchSampleSeed() {
  const seedPath = path.resolve(__dirname, "../../data/sample_seed.json");
  const raw = fs.readFileSync(seedPath, "utf8");
  const parsed = JSON.parse(raw);

  return {
    sourceName: parsed.source || "sample_seed",
    sourceUrl: "local://data/sample_seed.json",
    tracks: Array.isArray(parsed.tracks) ? parsed.tracks : []
  };
}
