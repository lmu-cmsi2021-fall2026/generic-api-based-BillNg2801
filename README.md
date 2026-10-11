# FRAME — AI news feed

A responsive React feed for general AI news and AI filmmaking, with search, tool and competition filters, automatic pagination, duplicate grouping, and expandable article excerpts.

## Run locally

1. Install Node.js 22.12+ and run `npm install`.
2. Set `WORLD_NEWS_API_KEY` in `.env.local` (see `.env.example`).
3. Run `npm run dev` and visit the printed URL.

Vite provides a local `/api/news` server endpoint. The key stays on the server and is never embedded in the frontend. Restart Vite after changing environment variables. `npm run preview` also provides this endpoint locally.

## Data and behavior

[World News API documentation](https://worldnewsapi.com/docs/search-news/) describes the search endpoint. The free plan allows 50 points per day and resets at midnight UTC. The server pulls 20 stories once each day at 5:30 PM Pacific, stores that edition, and serves it until the next refresh. Visits, search, and reloads read the saved edition and do not call the API. Article bodies, images, summaries, source URLs, and publication dates are normalized in `src/api.js`. All browser network calls are exported async functions in that non-React module. `server/edition.js` stores the edition and `server/news.js` remains the direct request helper.

Posts use up to 100 words of article text for their preview and up to 300 words for expanded sentence bullets. These are excerpts, not generated summaries. Short articles remain short. Likely duplicate stories are grouped across pages; this heuristic cannot guarantee perfect event matching. No persistent article cache is used.

The app includes responsive Grid and Flexbox layouts, a gradient background, a styled title, article images (missing or broken images are omitted), transitions, keyboard focus, loading feedback, empty states, and error/retry handling.

## Checks

- `npm run lint`
- `npm test`
- `npm run format:check`
- `npm run build`

## Deployment

GitHub Pages hosts the frontend. The news API runs on Railway with `npm start`, which launches `server/listen.js`. That server calls `server/news.js`. `WORLD_NEWS_API_KEY` and `ALLOWED_ORIGIN` stay on Railway. The Pages build reads the Actions variable `VITE_NEWS_API_URL`. No API key belongs in the Pages build.

**API:** https://generic-api-based-billng2801-production.up.railway.app/api/news

**Deployment URL:** https://lmu-cmsi2021-fall2026.github.io/generic-api-based-BillNg2801/
