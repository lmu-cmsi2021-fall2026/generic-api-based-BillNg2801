export async function handleNews(request, env) {
  const origin = env.ALLOWED_ORIGIN || "http://127.0.0.1:5173";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Cache-Control": "no-store",
  };
  const reply = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method !== "GET")
    return reply({ message: "Method not allowed." }, 405);
  if (!env.WORLD_NEWS_API_KEY)
    return reply({ message: "The news service key is not configured." }, 503);
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
  const query = new URLSearchParams({
    text,
    language: "en",
    number: "10",
    offset: String(offset),
    sort: "publish-time",
    "sort-direction": "DESC",
  });
  try {
    const response = await fetch(
      `https://api.worldnewsapi.com/search-news?${query}`,
      {
        headers: { "x-api-key": env.WORLD_NEWS_API_KEY },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      return reply(
        {
          message:
            response.status === 402 || response.status === 429
              ? "The free daily news allowance has been reached. Please try again tomorrow."
              : "The news provider could not complete this request. Please try again later.",
        },
        response.status === 402 ? 429 : response.status,
      );
    return reply(await response.json());
  } catch {
    return reply(
      { message: "The news service is taking too long. Please try again." },
      502,
    );
  }
}

export default { fetch: handleNews };
