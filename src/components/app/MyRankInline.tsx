import { lazy, Suspense, useEffect, useState, useCallback } from "react";

const MyRankLanding = lazy(() => import("@/pages/myrank/MyRankLanding"));
const MyRankTest = lazy(() => import("@/pages/myrank/MyRankTest"));
const MyRankResult = lazy(() => import("@/pages/myrank/MyRankResult"));
const MyRankLeaderboard = lazy(() => import("@/pages/myrank/MyRankLeaderboard"));

type View = "landing" | "test" | "result" | "leaderboard";

/**
 * Renders all MyRank pages inline within the app frame.
 *
 * Uses a custom history-event bridge instead of MemoryRouter (which would
 * nest a Router inside the app's BrowserRouter and crash). Sub-pages keep
 * calling `navigate("/myrank/...")` — we intercept the resulting URL change,
 * map it to a local view, and immediately roll the URL back to /app so the
 * outer router state stays clean.
 */
const MyRankInline = () => {
  const [view, setView] = useState<View>("landing");
  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams());

  const routeFromPath = useCallback((path: string, search: string) => {
    if (!path.startsWith("/myrank")) return false;
    const sub = path.replace(/^\/myrank/, "");
    const sp = new URLSearchParams(search || "");
    setParams(sp);
    if (sub === "/test") setView("test");
    else if (sub === "/result") setView("result");
    else if (sub === "/leaderboard") setView("leaderboard");
    else setView("landing");
    return true;
  }, []);

  useEffect(() => {
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;

    const handleNav = (url?: string | URL | null) => {
      if (!url) return false;
      try {
        const u = new URL(String(url), window.location.origin);
        if (u.pathname.startsWith("/myrank")) {
          routeFromPath(u.pathname, u.search);
          // Roll URL back so BrowserRouter never sees /myrank
          origReplace.call(window.history, {}, "", "/app");
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    window.history.pushState = function (data, unused, url) {
      if (handleNav(url as any)) return;
      return origPush.call(window.history, data, unused, url as any);
    };
    window.history.replaceState = function (data, unused, url) {
      if (handleNav(url as any)) return;
      return origReplace.call(window.history, data, unused, url as any);
    };

    const onPop = () => {
      // Back button while inside MyRank → return to landing
      if (view !== "landing") {
        setView("landing");
        origReplace.call(window.history, {}, "", "/app");
      }
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("popstate", onPop);
    };
  }, [routeFromPath, view]);

  const render = () => {
    switch (view) {
      case "test": return <MyRankTest />;
      case "result": return <MyRankResult />;
      case "leaderboard": return <MyRankLeaderboard />;
      default: return <MyRankLanding />;
    }
  };

  return (
    <Suspense fallback={<div className="py-20" />}>
      {render()}
    </Suspense>
  );
};

export default MyRankInline;
