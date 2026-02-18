import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { fetchSampleSeed } from "./adapters/sample_seed.mjs";
import { fetchBeatport } from "./adapters/beatport.mjs";
import { fetch1001Tracklists } from "./adapters/tracklists1001.mjs";
import { fetchYouTube } from "./adapters/youtube.mjs";
import { fetchAppleMusicRss } from "./adapters/apple_music_rss.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.resolve(projectRoot, "data");
const dbPath = path.resolve(dataDir, "edm_popularity.sqlite");
const lastUpdatePath = path.resolve(dataDir, "last_update.json");

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function makeTrackKey(title, artist) {
  return `${normalizeText(title)}::${normalizeText(artist)}`;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rankToPoints(rank, maxRank = 100) {
  if (!Number.isFinite(rank)) return null;
  const safeMaxRank = Math.max(1, Number(maxRank) || 100);
  const safeRank = Math.max(1, Math.min(safeMaxRank, Math.round(rank)));
  return clampScore(((safeMaxRank + 1 - safeRank) / safeMaxRank) * 100);
}

function metricToUnitScale(metric, value) {
  if (!Number.isFinite(value)) return null;

  switch (metric) {
    case "youtube_views_m":
      return Math.min(100, value * 2);
    case "playlist_mentions":
    case "dj_support":
      return Math.max(0, Math.min(100, value));
    default:
      return Math.max(0, Math.min(100, value));
  }
}

function calculateScore(metricMap) {
  const effectiveMetrics = { ...metricMap };
  if (!Number.isFinite(effectiveMetrics.chart_points) && Number.isFinite(effectiveMetrics.chart_rank)) {
    effectiveMetrics.chart_points = rankToPoints(effectiveMetrics.chart_rank);
  }

  const weights = {
    chart_points: 0.55,
    youtube_views_m: 0.2,
    playlist_mentions: 0.35,
    dj_support: 0.45
  };

  let weightedSum = 0;
  let appliedWeight = 0;

  for (const [metric, weight] of Object.entries(weights)) {
    const scaled = metricToUnitScale(metric, effectiveMetrics[metric]);
    if (scaled == null) continue;
    weightedSum += scaled * weight;
    appliedWeight += weight;
  }

  if (appliedWeight === 0) return 0;
  return clampScore(weightedSum / appliedWeight);
}

function ensureSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apple_song_id TEXT UNIQUE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      normalized_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'adapter',
      source_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL,
      source_id INTEGER NOT NULL,
      observed_at TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      details_json TEXT,
      FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scores (
      track_id INTEGER PRIMARY KEY,
      score INTEGER NOT NULL,
      computed_at TEXT NOT NULL,
      method TEXT NOT NULL,
      FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_key ON tracks(normalized_key);
    CREATE INDEX IF NOT EXISTS idx_tracks_apple_song_id ON tracks(apple_song_id);
    CREATE INDEX IF NOT EXISTS idx_observations_track_metric ON observations(track_id, metric);
    CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score);
  `);
}

function tableCounts(db) {
  const tables = ["tracks", "sources", "observations", "scores"];
  const out = {};

  for (const table of tables) {
    out[table] = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  }

  return out;
}

async function main() {
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(dbPath);
  ensureSchema(db);

  const upsertSource = db.prepare(`
    INSERT INTO sources(name, source_type, source_url, updated_at)
    VALUES (@name, @source_type, @source_url, datetime('now'))
    ON CONFLICT(name) DO UPDATE SET
      source_url = excluded.source_url,
      updated_at = datetime('now')
  `);

  const selectSourceId = db.prepare("SELECT id FROM sources WHERE name = ?");

  const insertTrack = db.prepare(`
    INSERT INTO tracks(apple_song_id, title, artist, normalized_key, updated_at)
    VALUES (@apple_song_id, @title, @artist, @normalized_key, datetime('now'))
  `);

  const updateTrackById = db.prepare(`
    UPDATE tracks
    SET apple_song_id = @apple_song_id,
        title = @title,
        artist = @artist,
        normalized_key = @normalized_key,
        updated_at = datetime('now')
    WHERE id = @id
  `);

  const selectTrackByKey = db.prepare(
    "SELECT id, apple_song_id, normalized_key FROM tracks WHERE normalized_key = ?"
  );
  const selectTrackByAppleSongId = db.prepare(
    "SELECT id, apple_song_id, normalized_key FROM tracks WHERE apple_song_id = ?"
  );

  const insertObservation = db.prepare(`
    INSERT INTO observations(track_id, source_id, observed_at, metric, value, details_json)
    VALUES (@track_id, @source_id, @observed_at, @metric, @value, @details_json)
  `);

  const upsertScore = db.prepare(`
    INSERT INTO scores(track_id, score, computed_at, method)
    VALUES (@track_id, @score, @computed_at, @method)
    ON CONFLICT(track_id) DO UPDATE SET
      score = excluded.score,
      computed_at = excluded.computed_at,
      method = excluded.method
  `);

  const allAdapters = [
    fetchSampleSeed,
    fetchAppleMusicRss,
    fetchBeatport,
    fetch1001Tracklists,
    fetchYouTube
  ];
  const onlyAppleRss = process.argv.includes("--only-apple-rss");
  const adapters = onlyAppleRss ? [fetchAppleMusicRss] : allAdapters;

  const sourceRuns = [];
  const nowIso = new Date().toISOString();
  const beforeCounts = tableCounts(db);

  for (const adapter of adapters) {
    let payload;

    try {
      payload = await adapter();
    } catch (error) {
      sourceRuns.push({
        source: adapter.name,
        status: "error",
        error: String(error?.message || error)
      });
      continue;
    }

    const sourceName = payload?.sourceName || adapter.name;
    const sourceUrl = payload?.sourceUrl || null;
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];

    upsertSource.run({
      name: sourceName,
      source_type: "adapter",
      source_url: sourceUrl
    });

    const sourceId = selectSourceId.get(sourceName)?.id;
    if (!sourceId) {
      sourceRuns.push({ source: sourceName, status: "error", error: "missing source id" });
      continue;
    }

    let insertedObservations = 0;
    let processedTracks = 0;

    const ingest = db.transaction(() => {
      for (const track of tracks) {
        const title = String(track?.title || "").trim();
        const artist = String(track?.artist || "").trim();
        if (!title || !artist) continue;

        const normalizedKey = makeTrackKey(title, artist);
        const appleSongId = track?.apple_song_id ? String(track.apple_song_id) : null;
        const keyRow = selectTrackByKey.get(normalizedKey);
        let row = null;

        if (appleSongId) {
          const appleRow = selectTrackByAppleSongId.get(appleSongId);
          if (appleRow?.id) {
            const safeKey =
              keyRow?.id && keyRow.id !== appleRow.id ? appleRow.normalized_key : normalizedKey;
            updateTrackById.run({
              id: appleRow.id,
              apple_song_id: appleSongId,
              title,
              artist,
              normalized_key: safeKey
            });
            row = { id: appleRow.id };
          } else if (keyRow?.id) {
            updateTrackById.run({
              id: keyRow.id,
              apple_song_id: appleSongId,
              title,
              artist,
              normalized_key: normalizedKey
            });
            row = { id: keyRow.id };
          } else {
            insertTrack.run({
              apple_song_id: appleSongId,
              title,
              artist,
              normalized_key: normalizedKey
            });
            row = selectTrackByAppleSongId.get(appleSongId) || selectTrackByKey.get(normalizedKey);
          }
        } else if (keyRow?.id) {
          updateTrackById.run({
            id: keyRow.id,
            apple_song_id: keyRow.apple_song_id ? String(keyRow.apple_song_id) : null,
            title,
            artist,
            normalized_key: normalizedKey
          });
          row = { id: keyRow.id };
        } else {
          insertTrack.run({
            apple_song_id: null,
            title,
            artist,
            normalized_key: normalizedKey
          });
          row = selectTrackByKey.get(normalizedKey);
        }

        if (!row?.id) continue;

        processedTracks += 1;

        const signals = track?.signals || {};
        for (const [metric, value] of Object.entries(signals)) {
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) continue;

          insertObservation.run({
            track_id: row.id,
            source_id: sourceId,
            observed_at: nowIso,
            metric,
            value: numericValue,
            details_json: JSON.stringify({
              adapter: sourceName,
              ...(track?.signal_context &&
              typeof track.signal_context === "object" &&
              !Array.isArray(track.signal_context)
                ? track.signal_context
                : {})
            })
          });
          insertedObservations += 1;
        }
      }
    });

    ingest();

    sourceRuns.push({
      source: sourceName,
      status: "ok",
      tracks_seen: tracks.length,
      tracks_processed: processedTracks,
      observations_inserted: insertedObservations
    });
  }

  const metricRows = db
    .prepare(`
      SELECT track_id, metric, AVG(value) AS avg_value
      FROM observations
      GROUP BY track_id, metric
    `)
    .all();

  const metricMapByTrack = new Map();
  for (const row of metricRows) {
    if (!metricMapByTrack.has(row.track_id)) metricMapByTrack.set(row.track_id, {});
    metricMapByTrack.get(row.track_id)[row.metric] = Number(row.avg_value);
  }

  const scoreTx = db.transaction(() => {
    for (const [trackId, metrics] of metricMapByTrack.entries()) {
      const score = calculateScore(metrics);
      upsertScore.run({
        track_id: trackId,
        score,
        computed_at: nowIso,
        method: "weighted_v1"
      });
    }
  });

  scoreTx();

  const afterCounts = tableCounts(db);

  const updateSummary = {
    updated_at: nowIso,
    database_path: dbPath,
    delta: {
      tracks: afterCounts.tracks - beforeCounts.tracks,
      sources: afterCounts.sources - beforeCounts.sources,
      observations: afterCounts.observations - beforeCounts.observations,
      scores: afterCounts.scores - beforeCounts.scores
    },
    counts: afterCounts,
    source_runs: sourceRuns,
    adapters_used: adapters.map((adapter) => adapter.name)
  };

  fs.writeFileSync(lastUpdatePath, `${JSON.stringify(updateSummary, null, 2)}\n`, "utf8");

  db.close();

  console.log("[update-db] done", JSON.stringify(updateSummary));
}

main().catch((error) => {
  console.error("[update-db] failed", error);
  process.exitCode = 1;
});
