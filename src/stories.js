// Keep publisher text factual: clean and shorten it, never manufacture details.
export function cleanText(value = "") {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(?:39|8217);|&apos;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*(?:\[…\]|\[\.\.\.\])\s*(?:More)?\s*$/i, "")
    .replace(/\s+The post .+ appeared first on .+$/i, "")
    .trim();
}

function shorten(text, limit) {
  const words = text.split(/\s+/);
  if (words.length <= limit) return text;
  const candidate = words.slice(0, limit).join(" ");
  const boundary = candidate.search(/[.!?][^.!?]*$/);
  if (boundary > candidate.length * 0.55)
    return candidate.slice(0, boundary + 1);
  return candidate.replace(/[,;:]$/, "") + "…";
}

export function storyText(article) {
  const text = cleanText(article.full_text || article.description);
  const detail = shorten(text, 300);
  const summary = shorten(text || cleanText(article.title), 100);
  const sentences =
    detail
      .match(/[^.!?]+(?:[.!?]+|$)/g)
      ?.map((part) => part.trim())
      .filter(Boolean) || [];
  return {
    summary,
    details: sentences.length > 1 ? sentences : [detail],
    expandable: detail.length > summary.length + 30,
  };
}

const stop = new Set(
  "a an the and or to of in on for with from by as at is are was were be been will would could should it its this that says said say over after again new ai artificial intelligence news more".split(
    " ",
  ),
);
function tokens(text) {
  return new Set(
    cleanText(text)
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z0-9]+/g)
      ?.filter((word) => word.length > 2 && !stop.has(word)) || [],
  );
}
function overlap(a, b) {
  const common = [...a].filter((word) => b.has(word)).length;
  return { common, ratio: common / Math.max(1, Math.min(a.size, b.size)) };
}
function eventMatch(a, b) {
  const textA = cleanText(a.title + " " + (a.description || ""));
  const textB = cleanText(b.title + " " + (b.description || ""));
  const names = (text) =>
    new Set(
      (text.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g) || []).flatMap(
        (name) => {
          const words = name.toLowerCase().split(" ");
          return words
            .slice(0, -1)
            .map((word, index) => word + " " + words[index + 1]);
        },
      ),
    );
  const sharedName = [...names(a.title)].some((name) =>
    names(b.title).has(name),
  );
  // A shared named subject AND the same event type, not just the same person.
  const events = [
    /waiver|refus\w*|dispute|won[’']?t work|not work|sign.*contract/i,
  ];
  return (
    sharedName && events.some((event) => event.test(textA) && event.test(textB))
  );
}

function sameStory(a, b) {
  if (eventMatch(a, b)) return true;
  if (a.article_id && a.article_id === b.article_id) return true;
  if (a.link && a.link.split("?")[0] === b.link?.split("?")[0]) return true;
  const titles = overlap(tokens(a.title), tokens(b.title));
  if (titles.common >= 4 && titles.ratio >= 0.65) return true;
  const context = overlap(
    tokens(
      a.title +
        " " +
        cleanText(a.description).split(" ").slice(0, 55).join(" "),
    ),
    tokens(
      b.title +
        " " +
        cleanText(b.description).split(" ").slice(0, 55).join(" "),
    ),
  );
  return titles.common >= 2 && context.common >= 6 && context.ratio >= 0.45;
}

export function mergeStories(existing, incoming) {
  const result = [];
  for (const article of [...existing, ...incoming]) {
    const match = result.find((previous) =>
      [previous, ...(previous.relatedStories || [])].some((member) =>
        sameStory(member, article),
      ),
    );
    if (match) {
      match.relatedStories = [...(match.relatedStories || []), article];
    } else {
      result.push({
        ...article,
        relatedStories: [...(article.relatedStories || [])],
      });
    }
  }
  return result;
}
