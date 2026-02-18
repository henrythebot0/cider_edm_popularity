const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const IPC_SCORE_LOOKUP = "cider-edm-popularity:get-score";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function makeTrackKey(title, artist) {
  return `${normalizeText(title)}::${normalizeText(artist)}`;
}

class CiderEdmPopularityPlugin {
  constructor(env) {
    this.env = env;
    this.db = null;
    this.dbPath = path.resolve(__dirname, "data", "edm_popularity.sqlite");
    this.ipcMain = null;
    this.byAppleSongIdStmt = null;
    this.byTrackKeyStmt = null;
  }

  async onReady() {
    this.env.logger?.info?.("[cider-edm-popularity] Backend ready");
    this.initDatabase();
    this.registerIpcHandlers();
  }

  async onRendererReady() {
    this.env.logger?.info?.("[cider-edm-popularity] Renderer ready; loading frontend");
    await this.env.utils.loadJSFrontend("index.frontend.js");
  }

  initDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      this.env.logger?.warn?.(
        `[cider-edm-popularity] SQLite DB not found at ${this.dbPath}; score lookups will return N/A`
      );
      return;
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      this.byAppleSongIdStmt = this.db.prepare(`
        SELECT s.score AS score
        FROM tracks t
        JOIN scores s ON s.track_id = t.id
        WHERE t.apple_song_id = ?
        LIMIT 1
      `);
      this.byTrackKeyStmt = this.db.prepare(`
        SELECT s.score AS score
        FROM tracks t
        JOIN scores s ON s.track_id = t.id
        WHERE t.normalized_key = ?
        LIMIT 1
      `);
      this.env.logger?.info?.(`[cider-edm-popularity] SQLite opened: ${this.dbPath}`);
    } catch (error) {
      this.db = null;
      this.env.logger?.error?.(
        `[cider-edm-popularity] Failed to open SQLite DB: ${String(error?.message || error)}`
      );
    }
  }

  registerIpcHandlers() {
    try {
      this.ipcMain = this.env?.ipcMain || require("electron").ipcMain;
    } catch (error) {
      this.ipcMain = null;
      this.env.logger?.warn?.(
        `[cider-edm-popularity] ipcMain unavailable: ${String(error?.message || error)}`
      );
      return;
    }

    if (!this.ipcMain) return;

    this.ipcMain.removeHandler?.(IPC_SCORE_LOOKUP);
    this.ipcMain.handle(IPC_SCORE_LOOKUP, async (_event, payload = {}) => this.lookupScore(payload));
  }

  lookupScore(payload) {
    if (!this.db || !this.byAppleSongIdStmt || !this.byTrackKeyStmt) {
      return { score: null, reason: "db_missing" };
    }

    const appleSongId = payload?.appleSongId ? String(payload.appleSongId) : "";
    if (appleSongId) {
      const row = this.byAppleSongIdStmt.get(appleSongId);
      if (row) return { score: Number(row.score), reason: "apple_song_id" };
    }

    const lookupKey =
      payload?.trackKey ||
      makeTrackKey(payload?.title || "", payload?.artist || "");

    if (!lookupKey || !lookupKey.includes("::")) {
      return { score: null, reason: "insufficient_metadata" };
    }

    const row = this.byTrackKeyStmt.get(lookupKey);
    if (row) return { score: Number(row.score), reason: "title_artist" };

    return { score: null, reason: "not_found" };
  }
}

module.exports = CiderEdmPopularityPlugin;
