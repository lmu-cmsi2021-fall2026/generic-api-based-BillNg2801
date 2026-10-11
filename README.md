# FRAME — AI news feed

A responsive React feed for general AI news and AI filmmaking, with search, tool and competition filters, automatic pagination, duplicate grouping, and expandable article excerpts.

## Run locally

1. Install Node.js 22.12+ and run `npm install`.
2. Set `WORLD_NEWS_API_KEY` in `.env.local` (see `.env.example`).
3. Run `npm run dev` and visit the printed URL.

Vite provides a local `/api/news` server endpoint. The key stays on the server and is never embedded in the frontend. Restart Vite after changing environment variables. `npm run preview` also provides this endpoint locally.

## Data and behavior

[World News API documentation](https://worldnewsapi.com/docs/search-news/) describes the search endpoint. The free plan uses a 50-point daily allowance; searches and pagination consume points. Article bodies, images, summaries, source URLs, and publication dates are normalized in `src/api.js`. All browser network calls are exported async functions in that non-React module. `server/news.js` handles the authenticated upstream request, validation, timeouts, and safe errors.

Posts use up to 100 words of article text for their preview and up to 300 words for expanded sentence bullets. These are excerpts, not generated summaries. Short articles remain short. Likely duplicate stories are grouped across pages; this heuristic cannot guarantee perfect event matching. No persistent article cache is used.

The app includes responsive Grid and Flexbox layouts, a gradient background, a styled title, article images (missing or broken images are omitted), transitions, keyboard focus, loading feedback, empty states, and error/retry handling.

## Checks

- `npm run lint`
- `npm test`
- `npm run format:check`
- `npm run build`

## Deployment

GitHub Pages can host the frontend but cannot run the server endpoint. Deploy `server/news.js` as a Cloudflare Worker (its default export is a Worker fetch handler), set its secret `WORLD_NEWS_API_KEY`, and set `ALLOWED_ORIGIN` to the exact GitHub Pages origin. Configure the repository Actions variable `VITE_NEWS_API_URL` with that Worker URL. Before public deployment, configure rate limits on the endpoint to protect the shared free quota. The included Pages workflow builds the frontend using this URL; no API key belongs in the Pages build.

**Deployment URL:** Pending deployment to the assignment repository and hosting of the API endpoint.
