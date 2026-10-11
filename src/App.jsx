import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchNews, isRelevantArticle } from "./api.js";
import { storyText, mergeStories } from "./stories.js";
import logo from "./assets/frame-logo.png";

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function ArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false);
  const [failedImage, setFailedImage] = useState(null);
  const imageUrl = safeUrl(article.image_url);
  const url = safeUrl(article.link);
  const source = article.source_name || article.source_id || "News source";
  const { summary, details, expandable } = storyText(article);
  const date = new Date(
    article.pubDate?.replace(" ", "T") +
      (article.pubDate?.includes("Z") ? "" : "Z"),
  );
  const dateLabel = Number.isNaN(date.getTime())
    ? "Recent story"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <article className="post">
      <header className="post-header">
        <span className="source-avatar" aria-hidden="true">
          {source.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <strong>{source}</strong>
          <span>{dateLabel} · Published news</span>
        </div>
        {url && (
          <a
            className="post-mark"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read full story: ${article.title} (opens in a new tab)`}
            title="Read full story"
          >
            ↗
          </a>
        )}
      </header>
      <div className="post-copy">
        <h2>{article.title}</h2>
        {!expanded && <p className="post-summary">{summary}</p>}
        {expanded && (
          <section className="story-details" aria-label="Story details">
            <h3>More from the report</h3>
            <ul>
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
            <p className="excerpt-note">
              Excerpts from the original report. Read the original for the full
              report.
            </p>
          </section>
        )}
        {expandable && (
          <button
            className="expand-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>
      {imageUrl && failedImage !== imageUrl && (
        <img
          className="post-image"
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailedImage(imageUrl)}
        />
      )}
    </article>
  );
}

export default function App() {
  const menu = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  function closeMenu() {
    menu.current?.close();
    setMenuOpen(false);
  }
  const [section, setSection] = useState("general");
  const [topic, setTopic] = useState("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [articles, setArticles] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const controller = useRef(null);
  const sentinel = useRef(null);
  const paging = useRef(false);
  const uniqueArticles = useMemo(
    () =>
      mergeStories([], articles).filter((article) =>
        isRelevantArticle(article, section, topic),
      ),
    [articles, section, topic],
  );

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(async () => {
      paging.current = false;
      setLoading(true);
      setError("");
      setArticles([]);
      setNextPage(null);
      try {
        const result = await fetchNews({
          section,
          topic,
          search,
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;
        setArticles(mergeStories([], result.articles));
        setNextPage(result.nextPage);
      } catch (failure) {
        if (!abort.signal.aborted) setError(failure.message);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      abort.abort();
      controller.current?.abort();
    };
  }, [section, topic, search, revision]);

  function changeSection(value) {
    closeMenu();
    if (value === section) return;
    controller.current?.abort();
    setLoading(true);
    setArticles([]);
    setError("");
    setSection(value);
    setTopic("all");
    setDraft("");
    setSearch("");
  }

  const loadMore = useCallback(async () => {
    if (paging.current || !nextPage) return;
    paging.current = true;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    try {
      const result = await fetchNews({
        section,
        topic,
        search,
        page: nextPage,
        signal: abort.signal,
      });
      if (abort.signal.aborted) return;
      setArticles((previous) => mergeStories(previous, result.articles));
      setNextPage(result.nextPage === nextPage ? null : result.nextPage);
    } catch (failure) {
      if (!abort.signal.aborted) setError(failure.message);
    } finally {
      if (!abort.signal.aborted) {
        setLoading(false);
        paging.current = false;
      }
    }
  }, [section, topic, search, nextPage]);

  useEffect(() => {
    if (!nextPage || loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [nextPage, loading, error, loadMore]);

  return (
    <>
      <a className="skip-link" href="#news">
        Skip to feed
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="menu-toggle"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls="feed-menu"
            onClick={() => {
              menu.current.showModal();
              setMenuOpen(true);
            }}
          >
            ☰
          </button>
          <a className="wordmark" href="./">
            <img src={logo} alt="FRAME" />
          </a>
          <span className="header-badge">AI NEWS, IN FOCUS</span>
        </div>
      </header>
      <dialog
        id="feed-menu"
        className="menu-drawer"
        ref={menu}
        aria-labelledby="menu-title"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === menu.current) {
            const bounds = menu.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              closeMenu();
          }
        }}
      >
        <aside className="sidebar">
          <div className="drawer-heading">
            <h2 id="menu-title">Your feeds</h2>
            <button
              className="menu-close"
              aria-label="Close navigation"
              onClick={closeMenu}
            >
              ×
            </button>
          </div>
          <nav aria-label="News sections">
            <button
              aria-pressed={section === "general"}
              onClick={() => changeSection("general")}
            >
              <span aria-hidden="true">✳</span> All AI
            </button>
            <button
              aria-pressed={section === "film"}
              onClick={() => changeSection("film")}
            >
              <span aria-hidden="true">▣</span> AI & Film
            </button>
          </nav>

          <a
            className="provider"
            href="https://worldnewsapi.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by World News API ↗
          </a>
        </aside>
      </dialog>
      <main className="feed-layout">
        <section id="news" className="feed-column" aria-labelledby="feed-title">
          <div className="feed-heading">
            <p className="nav-label">THE LATEST</p>
            <h1 id="feed-title">
              {section === "general" ? "Your AI feed" : "AI & Film"}
              <span>.</span>
            </h1>
          </div>
          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(draft.trim());
            }}
          >
            <label className="sr-only" htmlFor="search">
              Search news
            </label>
            <input
              id="search"
              type="search"
              maxLength={45}
              placeholder={
                section === "film" ? "Search AI & film…" : "Search AI news…"
              }
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          {section === "film" && (
            <div className="topic-filters" aria-label="Film topics">
              {[
                ["all", "All stories"],
                ["tools", "Tools & releases"],
                ["opportunities", "Competitions & prizes"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={topic === value}
                  onClick={() => {
                    if (topic !== value || search) {
                      controller.current?.abort();
                      setLoading(true);
                      setArticles([]);
                      setTopic(value);
                      setSearch("");
                      setDraft("");
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {search && (
            <div className="search-summary">
              Results for “{search}”{" "}
              <button
                onClick={() => {
                  setSearch("");
                  setDraft("");
                }}
              >
                Clear ×
              </button>
            </div>
          )}

          <div className="posts" aria-busy={loading}>
            {uniqueArticles.map((article, index) => (
              <ArticleCard
                key={article.article_id || article.link || index}
                article={article}
              />
            ))}
          </div>
          {loading && articles.length === 0 && (
            <div className="skeleton" aria-hidden="true">
              <span />
              <span />
              <div />
            </div>
          )}
          <div role="status" className="loading-status">
            {loading ? "Finding your next read…" : ""}
          </div>
          {error && (
            <div className="message-panel" role="alert">
              <h2>We hit a little pause.</h2>
              <p>{error}</p>
              <button
                className="solid-button"
                onClick={() =>
                  articles.length
                    ? loadMore()
                    : setRevision((value) => value + 1)
                }
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && articles.length === 0 && (
            <div className="message-panel">
              <h2>No stories just yet.</h2>
              <p>
                Try a broader search or another topic. This feed covers recent
                reporting.
              </p>
              <button
                className="solid-button"
                onClick={() => {
                  setSearch("");
                  setDraft("");
                  setTopic("all");
                }}
              >
                Show all stories
              </button>
            </div>
          )}
          {nextPage && !error && (
            <div ref={sentinel} className="feed-sentinel">
              <button disabled={loading} onClick={loadMore}>
                {loading ? "Loading more stories…" : "Load more stories ↓"}
              </button>
            </div>
          )}
          {!nextPage && !loading && !error && articles.length > 0 && (
            <div className="end-of-feed">
              <span aria-hidden="true">✓</span>
              <h2>You’re all caught up.</h2>
              <p>
                That’s the end of the feed for now.
                <br />
                Check back later for more news.
              </p>
            </div>
          )}
          <footer className="feed-footer">
            Stay curious. You’re in good company.
          </footer>
        </section>
      </main>
    </>
  );
}
