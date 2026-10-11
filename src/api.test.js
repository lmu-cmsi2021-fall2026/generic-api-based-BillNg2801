import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQuery, normalizeNews, isRelevantArticle } from "./api.js";
test("queries preserve section and user search", () => {
  assert.equal(
    buildQuery("film", "all", "Higgsfield"),
    "AI filmmaking Higgsfield",
  );
  assert.match(buildQuery("film", "opportunities", ""), /competition/);
});
test("World News text is preserved and pagination uses offsets", () => {
  const result = normalizeNews({
    offset: 10,
    available: 25,
    news: [
      {
        id: 1,
        title: "A story",
        text: "Full article text",
        summary: "Short summary",
        url: "https://example.com/story",
      },
    ],
  });
  assert.equal(result.articles[0].full_text, "Full article text");
  assert.equal(result.articles[0].source_name, "example.com");
  assert.equal(result.nextPage, "11");
  assert.equal(
    normalizeNews({ offset: 25, available: 25, news: [] }).nextPage,
    null,
  );
});

test("feed rejects incidental mentions and ambiguous names", () => {
  assert.equal(
    isRelevantArticle({
      title: "Delhi Cops Detain Protesters",
      full_text: "Artificial intelligence is mentioned.",
    }),
    false,
  );
  assert.equal(
    isRelevantArticle({
      title: "Gemini horoscope today",
      full_text: "Astrology news",
    }),
    false,
  );
  assert.equal(isRelevantArticle({ title: "My top AI stock for 2027" }), false);
  assert.equal(
    isRelevantArticle({ title: "Anthropic releases a new reasoning model" }),
    true,
  );
  assert.equal(
    isRelevantArticle({ title: "AI transforms medical research" }, "film"),
    false,
  );
  assert.equal(
    isRelevantArticle(
      { title: "Higgsfield launches AI filmmaking tools" },
      "film",
    ),
    true,
  );
});
