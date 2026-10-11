import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  editionKey,
  filterEdition,
  handleCachedNews,
  refreshIfDue,
  shouldAttempt,
  writeEdition,
} from "./edition.js";

const before = new Date("2026-10-12T00:29:00Z");
const atRefresh = new Date("2026-10-12T00:30:00Z");
const morning = new Date("2026-10-11T15:00:00Z");
const winterRefresh = new Date("2026-01-16T01:30:00Z");
const winterBefore = new Date("2026-01-16T01:29:00Z");

test("the edition rolls at 5:30 PM Pacific", () => {
  assert.equal(editionKey(before), "2026-10-10");
  assert.equal(editionKey(atRefresh), "2026-10-11");
  assert.equal(editionKey(morning), "2026-10-10");
  assert.equal(editionKey(winterBefore), "2026-01-14");
  assert.equal(editionKey(winterRefresh), "2026-01-15");
});

test("a missing edition waits until 5:30 PM Pacific", () => {
  assert.equal(shouldAttempt(undefined, morning), false);
  assert.equal(shouldAttempt(undefined, atRefresh), true);
  assert.equal(shouldAttempt("2026-10-11", atRefresh), false);
  assert.equal(shouldAttempt("2026-10-10", atRefresh), true);
  assert.equal(shouldAttempt("2026-10-10", morning), false);
});

test("search filters the saved edition and does not require a new pull", () => {
  const news = [
    { title: "Anthropic releases a model", summary: "AI research" },
    { title: "Studio adopts AI filmmaking", summary: "cinema tools" },
  ];
  assert.equal(filterEdition(news, "artificial intelligence").length, 2);
  assert.equal(filterEdition(news, "AI filmmaking").length, 2);
  assert.equal(
    filterEdition(news, "artificial intelligence Anthropic")[0].title,
    "Anthropic releases a model",
  );
});

test("a due edition is pulled once and then served", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "frame-news-"));
  const env = {
    NEWS_CACHE_PATH: path.join(dir, "news.json"),
    WORLD_NEWS_API_KEY: "test",
    ALLOWED_ORIGIN: "https://example.com",
  };
  try {
    const saved = await refreshIfDue(env, atRefresh, async () => [
      {
        id: 1,
        title: "Anthropic ships a model",
        summary: "AI",
        text: "Details",
        url: "https://example.com/a",
      },
    ]);
    assert.equal(saved.edition, "2026-10-11");
    const again = await refreshIfDue(env, atRefresh, async () => {
      throw new Error("should not pull twice");
    });
    assert.equal(again.news.length, 1);
    await writeEdition(env, {
      edition: editionKey(new Date()),
      news: saved.news,
    });
    const response = await handleCachedNews(
      new Request(
        "http://127.0.0.1/api/news?text=artificial+intelligence&offset=0",
      ),
      env,
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.news.length, 1);
    assert.equal(body.available, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
