(() => {
  const BADGE_ATTR = "data-edm-popularity-badge";
  const ROW_SIG_ATTR = "data-edm-popularity-signature";
  const IPC_SCORE_LOOKUP = "cider-edm-popularity:get-score";

  const scoreCache = new Map();
  const inFlight = new Map();
  let appendScheduled = false;

  const normalizeText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const makeTrackKey = (title, artist) => `${normalizeText(title)}::${normalizeText(artist)}`;

  const getIpcRenderer = () => {
    try {
      if (typeof window.require === "function") {
        return window.require("electron").ipcRenderer;
      }
    } catch (_error) {
      return null;
    }

    return null;
  };

  const ipcRenderer = getIpcRenderer();

  const injectStyles = () => {
    if (document.querySelector(`style[${BADGE_ATTR}]`)) return;

    const style = document.createElement("style");
    style.setAttribute(BADGE_ATTR, "1");
    style.textContent = `
      .edm-popularity-badge {
        margin-left: 8px;
        padding: 1px 6px;
        border-radius: 999px;
        font-size: 11px;
        line-height: 1.6;
        color: #0f172a;
        background: rgba(34, 197, 94, 0.18);
        border: 1px solid rgba(34, 197, 94, 0.4);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  };

  const createBadge = () => {
    const badge = document.createElement("span");
    badge.className = "edm-popularity-badge";
    badge.setAttribute(BADGE_ATTR, "1");
    badge.textContent = "Score: N/A";
    return badge;
  };

  const findTrackRows = () => {
    const selectors = ['[role="row"]', ".song-item", ".track-item", ".media-item", ".list-item"];

    const rows = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => rows.push(el));
    });

    return Array.from(new Set(rows));
  };

  const extractAppleSongId = (row) => {
    const attrCandidates = [
      row.getAttribute("data-song-id"),
      row.getAttribute("data-track-id"),
      row.getAttribute("data-id"),
      row.dataset?.songId,
      row.dataset?.trackId,
      row.dataset?.id
    ];

    for (const candidate of attrCandidates) {
      const match = String(candidate || "").match(/\b(\d{5,})\b/);
      if (match) return match[1];
    }

    const linkEls = row.querySelectorAll("a[href]");
    for (const link of linkEls) {
      const href = link.getAttribute("href") || "";
      const songMatch = href.match(/\/song\/(\d{5,})/i);
      if (songMatch) return songMatch[1];

      const albumQueryMatch = href.match(/[?&]i=(\d{5,})/i);
      if (albumQueryMatch) return albumQueryMatch[1];
    }

    return null;
  };

  const extractTitleArtist = (row) => {
    const titleEl =
      row.querySelector('[data-testid*="title" i]') ||
      row.querySelector(".title") ||
      row.querySelector(".song-name") ||
      row.querySelector(".song-title");

    const artistEl =
      row.querySelector('[data-testid*="artist" i]') ||
      row.querySelector(".artist") ||
      row.querySelector(".song-artist") ||
      row.querySelector(".subtitle");

    const title = (titleEl?.textContent || "")
      .replace(/Score:\s*(?:N\/A|\d+)/gi, "")
      .trim();
    const artist = (artistEl?.textContent || "").trim();

    return { title, artist };
  };

  const fetchScore = async (meta) => {
    const cacheKey = meta.appleSongId ? `song:${meta.appleSongId}` : `key:${meta.trackKey}`;

    if (scoreCache.has(cacheKey)) {
      return scoreCache.get(cacheKey);
    }

    if (!ipcRenderer) {
      scoreCache.set(cacheKey, null);
      return null;
    }

    if (inFlight.has(cacheKey)) {
      return inFlight.get(cacheKey);
    }

    const request = ipcRenderer
      .invoke(IPC_SCORE_LOOKUP, meta)
      .then((result) => {
        const score = Number.isFinite(Number(result?.score)) ? Number(result.score) : null;
        scoreCache.set(cacheKey, score);
        inFlight.delete(cacheKey);
        return score;
      })
      .catch(() => {
        scoreCache.set(cacheKey, null);
        inFlight.delete(cacheKey);
        return null;
      });

    inFlight.set(cacheKey, request);
    return request;
  };

  const decorateRow = async (badge, meta) => {
    const { appleSongId, title, artist, trackKey } = meta;
    if (!appleSongId && (!title || !artist)) {
      badge.textContent = "Score: N/A";
      return;
    }

    const score = await fetchScore({ appleSongId, title, artist, trackKey });
    badge.textContent = Number.isFinite(score) ? `Score: ${score}` : "Score: N/A";
  };

  const appendBadges = () => {
    const rows = findTrackRows();

    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;

      const appleSongId = extractAppleSongId(row);
      const { title, artist } = extractTitleArtist(row);
      const trackKey = makeTrackKey(title, artist);
      const rowSignature = `${appleSongId || ""}::${trackKey}`;

      if (row.getAttribute(ROW_SIG_ATTR) === rowSignature) return;

      const titleHost =
        row.querySelector('[data-testid*="title" i]') ||
        row.querySelector(".title") ||
        row.querySelector(".song-name") ||
        row;

      let badge = titleHost?.querySelector(`span[${BADGE_ATTR}]`);
      if (!badge && titleHost) {
        badge = createBadge();
        titleHost.appendChild(badge);
      }

      row.setAttribute(ROW_SIG_ATTR, rowSignature);

      if (badge instanceof HTMLElement) {
        decorateRow(badge, { appleSongId, title, artist, trackKey });
      }
    });
  };

  const scheduleAppendBadges = () => {
    if (appendScheduled) return;
    appendScheduled = true;

    const run = () => {
      appendScheduled = false;
      appendBadges();
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  };

  const startObserver = () => {
    const observer = new MutationObserver(() => {
      scheduleAppendBadges();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    appendBadges();
  };

  const init = () => {
    console.log("[cider-edm-popularity] Frontend plugin loaded");
    injectStyles();
    startObserver();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
