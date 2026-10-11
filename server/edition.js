import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASES = new Set([
  "artificial intelligence",
  "ai filmmaking",
  "ai video tools",
  "ai film competition",
]);

export function cacheFile(env = process.env) {
  if (env.NEWS_CACHE_PATH) return env.NEWS_CACHE_PATH;
  if (env.RAILWAY_PROJECT_ID) return "/data/news.json";
  return path.join(process.cwd(), "server", ".cache", "news.json");
}

export function pacificParts(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function previousDay(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function pastRefresh(now) {
  const parts = pacificParts(now);
  return parts.hour > 17 || (parts.hour === 17 && parts.minute >= 30);
}

export function editionKey(now) {
  const parts = pacificParts(now);
  if (pastRefresh(now))
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  return previousDay(parts.year, parts.month, parts.day);
}

export function shouldAttempt(savedEdition, now) {
  if (savedEdition === editionKey(now)) return false;
  if (!savedEdition && !pastRefresh(now)) return false;
  return true;
}

export function filterEdition(news, text) {
  const raw = text.trim().toLowerCase();
  let extra = "";
  if (raw.startsWith("artificial intelligence "))
    extra = raw.slice("artificial intelligence ".length).trim();
  else if (raw.startsWith("ai filmmaking "))
    extra = raw.slice("ai filmmaking ".length).trim();
  else if (!BASES.has(raw)) extra = raw;
  if (!extra) return news;
  const words = extra.split(/\s+/).filter((word) => word.length > 1);
  return news.filter((article) => {
    const hay =
      `${article.title || ""} ${article.summary || ""} ${article.text || ""}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

export async function readEdition(env = process.env) {
  try {
    const saved = JSON.parse(await readFile(cacheFile(env), "utf8"));
    if (!saved || !Array.isArray(saved.news)) return null;
    return saved;
  } catch {
    return null;
  }
}

export async function writeEdition(env, edition) {
  const file = cacheFile(env);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(edition));
}

export async function fetchEdition(env) {
  const params = new URLSearchParams({
    text: "artificial intelligence",
    language: "en",
    number: "20",
    offset: "0",
    sort: "publish-time",
    "sort-direction": "DESC",
  });
  const response = await fetch(
    `https://api.worldnewsapi.com/search-news?${params}`,
    {
      headers: { "x-api-key": env.WORLD_NEWS_API_KEY },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) {
    const error = new Error("The news edition could not be refreshed.");
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  return Array.isArray(data.news) ? data.news.slice(0, 20) : [];
}

let refreshTask = null;

export async function refreshIfDue(
  env = process.env,
  now = new Date(),
  fetchNews = fetchEdition,
) {
  const saved = await readEdition(env);
  if (!shouldAttempt(saved?.edition, now)) return saved;
  if (!refreshTask) {
    refreshTask = (async () => {
      try {
        if (!env.WORLD_NEWS_API_KEY) return await readEdition(env);
        const news = await fetchNews(env);
        if (!news?.length) return await readEdition(env);
        const edition = { edition: editionKey(now), news: news.slice(0, 20) };
        await writeEdition(env, edition);
        return edition;
      } catch {
        return await readEdition(env);
      } finally {
        refreshTask = null;
      }
    })();
  }
  return refreshTask;
}

export function startEditionScheduler(env = process.env) {
  const run = () => {
    refreshIfDue(env).catch(() => {});
  };
  run();
  const timer = setInterval(run, 60 * 1000);
  timer.unref?.();
}

export async function handleCachedNews(request, env = process.env) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin":
      env.ALLOWED_ORIGIN || "http://127.0.0.1:5173",
    "Cache-Control": "no-store",
  };
  const reply = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "GET")
    return reply({ message: "Method not allowed." }, 405);
  const input = new URL(request.url).searchParams;
  const text = input.get("text")?.trim();
  const offset = Number(input.get("offset") || 0);
  if (
    !text ||
    text.length > 200 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 1000
  )
    return reply({ message: "Invalid search parameters." }, 400);
  if (offset > 0) return reply({ news: [], offset: 0, available: 0 });
  const saved = await refreshIfDue(env);
  if (!saved?.news?.length)
    return reply(
      { message: "Today's 20 stories publish at 5:30 PM Pacific." },
      503,
    );
  const news = filterEdition(saved.news, text);
  return reply({ news, offset: 0, available: news.length });
}
