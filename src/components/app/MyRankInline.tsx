import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";

const MyRankLanding = lazy(() => import("@/pages/myrank/MyRankLanding"));
const MyRankTest = lazy(() => import("@/pages/myrank/MyRankTest"));
const MyRankResult = lazy(() => import("@/pages/myrank/MyRankResult"));
const MyRankLeaderboard = lazy(() => import("@/pages/myrank/MyRankLeaderboard"));

/**
 * Renders all MyRank pages inside the app frame using an isolated MemoryRouter.
 * Existing pages keep using `useNavigate("/myrank/...")` and just work — but
 * navigation stays scoped to this subtree instead of swapping the whole app.
 */
const MyRankInline = () => {
  return (
    <MemoryRouter initialEntries={["/myrank"]}>
      <Suspense fallback={<div className="py-20" />}>
        <Routes>
          <Route path="/myrank" element={<MyRankLanding />} />
          <Route path="/myrank/test" element={<MyRankTest />} />
          <Route path="/myrank/result" element={<MyRankResult />} />
          <Route path="/myrank/leaderboard" element={<MyRankLeaderboard />} />
        </Routes>
      </Suspense>
    </MemoryRouter>
  );
};

export default MyRankInline;
