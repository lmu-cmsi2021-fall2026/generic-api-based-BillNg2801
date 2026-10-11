import { test } from "node:test";
import assert from "node:assert/strict";
import { storyText, mergeStories, cleanText } from "./stories.js";

test("long descriptions have bounded previews and details", () => {
  const result = storyText({
    description: Array.from(
      { length: 20 },
      () =>
        "The studio released a video tool for independent filmmakers today.",
    ).join(" "),
  });
  assert.ok(result.summary.split(/\s+/).length <= 100);
  assert.ok(result.details.join(" ").split(/\s+/).length <= 300);
  assert.ok(result.expandable);
});
test("short descriptions do not invent expanded content", () => {
  const result = storyText({ description: "A studio released a new tool." });
  assert.equal(result.expandable, false);
  assert.equal(result.summary, "A studio released a new tool.");
  assert.equal(
    cleanText("Some news. The post Some news appeared first on Example."),
    "Some news.",
  );
});
test("syndicated coverage is merged across pages while different stories survive", () => {
  const original = {
    title: "Nicolas Cage says he won't work with Amazon again over AI dispute",
    description:
      "Nicolas Cage refused to sign an AI waiver for Spider-Noir. He will not work with Amazon again.",
  };
  const duplicate = {
    title:
      "Nicolas Cage Speaks Out Against AI Waiver Demands at New York Comic Con",
    description:
      "Nicolas Cage refused an AI waiver for Spider-Noir and will not work with Amazon again.",
  };
  const unrelated = {
    title: "Nicolas Cage joins new film cast",
    description: "Nicolas Cage joins a new comedy with a different studio.",
  };
  assert.equal(
    mergeStories(
      [original],
      [
        duplicate,
        { ...original, title: original.title + " - Los Angeles Times" },
        unrelated,
      ],
    ).length,
    2,
  );
});

test("different headlines for the same waiver dispute collapse", () => {
  const first = {
    title:
      "Nicolas Cage Speaks Out Against AI Waiver Demands at New York Comic Con Amid Netflix Legal Dispute",
    description:
      "Nicolas Cage revealed at New York Comic Con that he refused to sign an AI waiver for the series Spider-Noir, stating he is not AI-friendly.",
  };
  const second = {
    title: "Nicolas Cage says he won't work with Amazon again over AI dispute",
    description:
      "Nicolas Cage, who recently starred in Spider-Noir, said he will not work with Amazon again after a disagreement over an AI waiver.",
  };
  assert.equal(mergeStories([first], [second]).length, 1);
});

test("waiver and Amazon dispute coverage collapse while unrelated Cage stories survive", () => {
  const stories = [
    {
      title:
        "Nicolas Cage says he won't work with Amazon again over AI dispute",
      description: "An AI waiver disagreement.",
    },
    {
      title:
        "Nicolas Cage Teases True Detective Role After Refusing to Sign AI Waiver for Spider-Noir",
      description: "The actor appeared at Comic Con.",
    },
    {
      title: "Nicolas Cage speaks out against AI waiver demands",
      description: "The actor refused to sign.",
    },
    {
      title: "Nicolas Cage joins new comedy film",
      description: "A new cast announcement.",
    },
  ];
  assert.equal(mergeStories([], stories).length, 2);
  assert.equal(mergeStories(stories, []).length, 2);
  assert.equal(
    storyText({ title: "A title", description: null }).summary,
    "A title",
  );
});
