export function buildQuery(section, topic, search) {
  const term = search
    .trim()
    .replace(/["()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 45);
  if (term)
    return `${section === "film" ? "AI filmmaking" : "artificial intelligence"} ${term}`;
  if (section === "general") return "artificial intelligence";
  if (topic === "tools") return "AI video tools";
  if (topic === "opportunities") return "AI film competition";
  return "AI filmmaking";
}

export function isRelevantArticle(article, section = "general", topic = "all") {
  const title = article.title || "";
  const lead = `${article.description || ""} ${(article.full_text || "").slice(0, 1800)}`;
  const ai =
    /\bAI\b|artificial intelligence|machine learning|\bLLMs?\b|generative|OpenAI|Anthropic|ChatGPT|DeepSeek/i;
  const videoBrand = /\b(Higgsfield|Runway|Sora|Kling)\b/i;
  const film =
    /film|cinema|video|animation|VFX|visual effects|storyboard|director|Hollywood/i;
  const ambiguousBrand = /\b(Claude|Gemini|Runway|Sora|Kling)\b/i;
  const headlineAI =
    ai.test(title) ||
    /Higgsfield/i.test(title) ||
    (ambiguousBrand.test(title) && ai.test(lead));
  if (!headlineAI) return false;
  // Exclude incidental AI mentions and finance stories from this tools/research feed.
  if (
    /\bstocks?\b|earnings|buying opportunity|investors|share price|AI trade/i.test(
      title,
    )
  )
    return false;
  if (
    section === "film" &&
    !(film.test(title) || (videoBrand.test(title) && film.test(lead)))
  )
    return false;
  if (
    section === "film" &&
    topic === "opportunities" &&
    !/contest|competition|prize|award|festival|grant|challenge/i.test(
      title + " " + lead.slice(0, 500),
    )
  )
    return false;
  return true;
}

export function normalizeNews(data) {
  const rows = Array.isArray(data.news) ? data.news : [];
  const articles = rows.map((article) => {
    let source = "News source";
    try {
      source = new URL(article.url).hostname.replace(/^www\./, "");
    } catch {
      /* Invalid links are omitted by the card. */
    }
    return {
      article_id: String(article.id),
      title: article.title,
      description: article.summary || "",
      full_text: article.text || "",
      link: article.url,
      image_url: article.image,
      pubDate: article.publish_date,
      source_name: source,
    };
  });
  const next = Number(data.offset || 0) + rows.length;
  return {
    articles,
    nextPage:
      rows.length && next < Number(data.available) && next <= 1000
        ? String(next)
        : null,
  };
}

export async function fetchNews({ section, topic, search, page, signal }) {
  const endpoint =
    import.meta.env.VITE_NEWS_API_URL || `${import.meta.env.BASE_URL}api/news`;
  const params = new URLSearchParams({
    text: buildQuery(section, topic, search),
    offset: page || "0",
  });
  let response;
  try {
    response = await fetch(`${endpoint}?${params}`, {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(25000)])
        : AbortSignal.timeout(25000),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "We could not connect to the news service. Please try again.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The news endpoint is unavailable. Please check the server configuration.",
    );
  }
  if (!response.ok)
    throw new Error(data.message || "News is temporarily unavailable.");
  const result = normalizeNews(data);
  result.articles = result.articles.filter((article) =>
    isRelevantArticle(article, section, topic),
  );
  return result;
}
