import fetch from "node-fetch";

const USER_AGENT = "cider-edm-popularity/0.1 (+https://github.com/henrythebot0)";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

// Curated list of Beatport genres that matter for EDM discovery.
// Each endpoint yields a Top 100 list.
const GENRE_TOP100_URLS = [
  { genre: "tech-house", url: "https://www.beatport.com/genre/tech-house/11/top-100" },
  { genre: "house", url: "https://www.beatport.com/genre/house/5/top-100" },
  { genre: "melodic-house-techno", url: "https://www.beatport.com/genre/melodic-house-techno/90/top-100" },
  { genre: "techno-peak-time-driving", url: "https://www.beatport.com/genre/techno-peak-time-driving/6/top-100" },
  { genre: "techno-raw-deep-hypnotic", url: "https://www.beatport.com/genre/techno-raw-deep-hypnotic/92/top-100" },
  { genre: "trance", url: "https://www.beatport.com/genre/trance/7/top-100" },
  { genre: "drum-bass", url: "https://www.beatport.com/genre/drum-bass/1/top-100" },
  { genre: "dubstep", url: "https://www.beatport.com/genre/dubstep/18/top-100" },
  // electro-house and future-house currently return HTTP 500 from Beatport (as of 2026-02-18); skipping for reliability.
  { genre: "deep-house", url: "https://www.beatport.com/genre/deep-house/12/top-100" },
  { genre: "progressive-house", url: "https://www.beatport.com/genre/progressive-house/15/top-100" },
  { genre: "hard-techno", url: "https://www.beatport.com/genre/hard-techno/2/top-100" },
  { genre: "afro-house", url: "https://www.beatport.com/genre/afro-house/89/top-100" },
  { genre: "minimal-deep-tech", url: "https://www.beatport.com/genre/minimal-deep-tech/14/top-100" }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rankToPoints(rank, maxRank = 100) {
  const safeMaxRank = Math.max(1, Number(maxRank) || 100);
  const safeRank = Math.max(1, Math.min(safeMaxRank, Math.round(Number(rank) || safeMaxRank)));
  return clampScore(((safeMaxRank + 1 - safeRank) / safeMaxRank) * 100);
}

async function fetchTextWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html"
        }
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timeout);
      if (attempt >= retries) throw err;
      await sleep(300 * (attempt + 1));
    }
  }
  throw new Error(`retry loop exhausted for ${url}`);
}

function extractNextData(html) {
  const m = html.match(/__NEXT_DATA__"\s*type="application\/json"[^>]*>(.*?)<\/script>/s);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function findTrackResults(nextData) {
  const queries = nextData?.props?.pageProps?.dehydratedState?.queries || [];
  for (const q of queries) {
    const d = q?.state?.data;
    if (d && Array.isArray(d.results) && d.results[0]?.name && Array.isArray(d.results[0]?.artists)) {
      return d.results;
    }
  }
  return [];
}

export async function fetchBeatport() {
  const tracks = [];

  // Sequential + small delay to be polite.
  for (const entry of GENRE_TOP100_URLS) {
    const html = await fetchTextWithRetry(entry.url);
    const nextData = extractNextData(html);
    const results = findTrackResults(nextData);

    for (let i = 0; i < results.length; i += 1) {
      const t = results[i];
      const rank = i + 1;
      const title = String(t?.name || "").trim();
      const artist = Array.isArray(t?.artists) ? t.artists.map((a) => a?.name).filter(Boolean).join(", ") : "";
      if (!title || !artist) continue;

      tracks.push({
        beatport_track_id: t?.id != null ? String(t.id) : null,
        isrc: t?.isrc ? String(t.isrc) : null,
        title,
        artist,
        signals: {
          beatport_rank: rank,
          beatport_points: rankToPoints(rank, 100)
        },
        signal_context: {
          genre: entry.genre,
          url: entry.url
        }
      });
    }

    await sleep(600);
  }

  return {
    sourceName: "beatport",
    sourceUrl: "https://www.beatport.com",
    tracks
  };
}
