import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { handleNews } from "./server/news.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const middleware = (server) => {
    server.middlewares.use("/api/news", async (req, res) => {
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
      });
      const response = await handleNews(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    });
  };
  return {
    plugins: [
      react(),
      {
        name: "world-news-proxy",
        configureServer: middleware,
        configurePreviewServer: middleware,
      },
    ],
    base: "./",
  };
});
