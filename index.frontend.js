(() => {
  const BADGE_ATTR = "data-edm-popularity-badge";
  const ROW_ATTR = "data-edm-popularity-processed";

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
    const selectors = [
      '[role="row"]',
      ".song-item",
      ".track-item",
      ".media-item",
      ".list-item"
    ];

    const rows = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => rows.push(el));
    });

    return Array.from(new Set(rows));
  };

  const appendBadges = () => {
    const rows = findTrackRows();

    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      if (row.hasAttribute(ROW_ATTR)) return;

      const titleHost =
        row.querySelector('[data-testid*="title" i]') ||
        row.querySelector(".title") ||
        row.querySelector(".song-name") ||
        row;

      if (titleHost && !titleHost.querySelector(`span[${BADGE_ATTR}]`)) {
        titleHost.appendChild(createBadge());
      }

      row.setAttribute(ROW_ATTR, "1");
    });
  };

  const startObserver = () => {
    const observer = new MutationObserver(() => {
      appendBadges();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
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
