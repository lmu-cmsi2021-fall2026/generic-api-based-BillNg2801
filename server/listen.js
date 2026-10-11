import { createServer } from "node:http";
import { handleNews } from "./news.js";

const port = Number(process.env.PORT) || 8080;

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  if (
    req.method === "GET" &&
    (url.pathname === "/" || url.pathname === "/health")
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname !== "/api/news") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found." }));
    return;
  }
  try {
    const request = new Request(url, { method: req.method });
    const response = await handleNews(request, process.env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "The news service is unavailable." }));
  }
});

server.listen(port, "0.0.0.0");
