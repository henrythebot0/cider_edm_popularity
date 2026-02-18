import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import Database from "better-sqlite3";

const require = createRequire(import.meta.url);
const CiderEdmPopularityPlugin = require("../index.js");

const IPC_SCORE_LOOKUP = "cider-edm-popularity:get-score";

class MockIpcMain {
  constructor() {
    this.handlers = new Map();
  }

  handle(channel, handler) {
    this.handlers.set(channel, handler);
  }

  removeHandler(channel) {
    this.handlers.delete(channel);
  }

  async invoke(channel, payload) {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`missing handler for ${channel}`);
    return handler({}, payload);
  }
}

function createTestDb(dbFilePath) {
  const db = new Database(dbFilePath);
  db.exec(`
    CREATE TABLE tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apple_song_id TEXT UNIQUE,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      normalized_key TEXT NOT NULL UNIQUE
    );

    CREATE TABLE scores (
      track_id INTEGER PRIMARY KEY,
      score INTEGER NOT NULL,
      computed_at TEXT NOT NULL,
      method TEXT NOT NULL
    );
  `);

  db.prepare(
    "INSERT INTO tracks (apple_song_id, title, artist, normalized_key) VALUES (?, ?, ?, ?)"
  ).run("12345", "Track One", "Artist One", "track one::artist one");

  db.prepare("INSERT INTO scores (track_id, score, computed_at, method) VALUES (?, ?, ?, ?)").run(
    1,
    88,
    new Date().toISOString(),
    "smoke_test"
  );

  db.close();
}

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cider-edm-smoke-"));
  const dbFilePath = path.join(tmpRoot, "edm_popularity.sqlite");

  try {
    createTestDb(dbFilePath);

    const readDb = new Database(dbFilePath, { readonly: true, fileMustExist: true });
    const probe = readDb
      .prepare(
        "SELECT t.normalized_key, s.score FROM tracks t JOIN scores s ON s.track_id=t.id WHERE t.apple_song_id = ?"
      )
      .get("12345");
    readDb.close();

    assert.equal(probe?.normalized_key, "track one::artist one");
    assert.equal(Number(probe?.score), 88);

    const ipcMain = new MockIpcMain();
    const plugin = new CiderEdmPopularityPlugin({
      ipcMain,
      logger: { info() {}, warn() {}, error() {} },
      utils: { loadJSFrontend: async () => {} }
    });

    plugin.dbPath = dbFilePath;
    await plugin.onReady();

    assert.equal(ipcMain.handlers.has(IPC_SCORE_LOOKUP), true);

    const bySongId = await ipcMain.invoke(IPC_SCORE_LOOKUP, { appleSongId: "12345" });
    assert.deepEqual(bySongId, { score: 88, reason: "apple_song_id" });

    const byTitleArtist = await ipcMain.invoke(IPC_SCORE_LOOKUP, {
      title: "Track One",
      artist: "Artist One"
    });
    assert.deepEqual(byTitleArtist, { score: 88, reason: "title_artist" });

    const notFound = await ipcMain.invoke(IPC_SCORE_LOOKUP, {
      title: "Unknown",
      artist: "Unknown"
    });
    assert.deepEqual(notFound, { score: null, reason: "not_found" });

    const insufficient = await ipcMain.invoke(IPC_SCORE_LOOKUP, { trackKey: "invalid" });
    assert.deepEqual(insufficient, { score: null, reason: "insufficient_metadata" });

    console.log("[smoke] OK");
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[smoke] failed", error);
  process.exitCode = 1;
});
