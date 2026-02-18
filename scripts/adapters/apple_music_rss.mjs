import fetch from "node-fetch";

const BASE_URL = "https://rss.marketingtools.apple.com/api/v2";
const USER_AGENT = "cider-edm-popularity/0.1 (+https://github.com)";
const REQUEST_TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;

const COUNTRIES = ["us", "gb", "ca", "au"];
const CHARTS = ["most-played", "top-songs"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rankToChartPoints(rank, chartLimit) {
  const safeLimit = Math.max(1, Number(chartLimit) || 100);
  const safeRank = Math.max(1, Math.min(safeLimit, Number(rank) || safeLimit));
  return Math.max(0, Math.min(100, Math.round(((safeLimit + 1 - safeRank) / safeLimit) * 100)));
}

async function fetchJsonWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json"
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);
      if (attempt >= retries) throw error;
      await sleep(250 * (attempt + 1));
    }
  }

  throw new Error(`retry loop exhausted for ${url}`);
}

function buildEndpoint(country, chart, limit) {
  return `${BASE_URL}/${country}/music/${chart}/${limit}/songs.json`;
}

async function fetchChart(country, chart) {
  const preferredLimit = 100;
  const fallbackLimit = 50;
  const errors = [];

  for (const limit of [preferredLimit, fallbackLimit]) {
    const endpoint = buildEndpoint(country, chart, limit);
    try {
      const payload = await fetchJsonWithRetry(endpoint);
      const feedResults = payload?.feed?.results;
      if (!Array.isArray(feedResults)) throw new Error(`unexpected payload shape for ${endpoint}`);
      return { endpoint, limit, results: feedResults };
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }

  throw new Error(`failed chart ${country}/${chart}: ${errors.join("; ")}`);
}

export async function fetchAppleMusicRss() {
  const tracks = [];

  for (const country of COUNTRIES) {
    for (const chart of CHARTS) {
      const { endpoint, limit, results } = await fetchChart(country, chart);

      for (let index = 0; index < results.length; index += 1) {
        const item = results[index];
        const rank = index + 1;
        const title = String(item?.name || "").trim();
        const artist = String(item?.artistName || "").trim();
        const appleSongId = item?.id != null ? String(item.id) : null;
        if (!title || !artist) continue;

        tracks.push({
          apple_song_id: appleSongId,
          title,
          artist,
          url: item?.url || null,
          artwork: item?.artworkUrl100 || null,
          genres: Array.isArray(item?.genres) ? item.genres.map((genre) => genre?.name).filter(Boolean) : [],
          signals: {
            chart_rank: rank,
            chart_points: rankToChartPoints(rank, limit)
          },
          signal_context: {
            country,
            chart,
            endpoint,
            chart_limit: limit
          }
        });
      }
    }
  }

  return {
    sourceName: "apple_music_rss",
    sourceUrl: "https://rss.marketingtools.apple.com",
    tracks
  };
}
