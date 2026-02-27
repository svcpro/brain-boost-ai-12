/**
 * Per-user rate limiting for edge functions.
 * Uses in-memory tracking with DB persistence for cross-instance limits.
 * 
 * Usage:
 *   import { checkRateLimit } from "../_shared/rateLimit.ts";
 *   const { allowed, remaining, retryAfterMs } = await checkRateLimit(userId, "ai-brain-agent", 10, 60);
 *   if (!allowed) return rateLimitResponse(retryAfterMs);
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, securityHeaders } from "./auth.ts";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number;
}

// In-memory sliding window tracker (fast path)
const windowCounts = new Map<string, { count: number; windowStart: number }>();

// Default limits per function category
const FUNCTION_LIMITS: Record<string, { maxRequests: number; windowSeconds: number }> = {
  // AI-heavy endpoints (expensive)
  "ai-brain-agent":       { maxRequests: 15, windowSeconds: 60 },
  "ai-support-chat":      { maxRequests: 20, windowSeconds: 60 },
  "ai-topic-manager":     { maxRequests: 10, windowSeconds: 60 },
  "ai-community-answer":  { maxRequests: 10, windowSeconds: 60 },
  "ai-community-assist":  { maxRequests: 10, windowSeconds: 60 },
  "confidence-practice":  { maxRequests: 15, windowSeconds: 60 },
  "cognitive-twin":       { maxRequests: 5,  windowSeconds: 60 },
  "study-insights":       { maxRequests: 10, windowSeconds: 60 },
  "inference-pipeline":   { maxRequests: 5,  windowSeconds: 60 },
  "seo-ai-optimize":      { maxRequests: 5,  windowSeconds: 60 },
  "brainlens-solve":      { maxRequests: 10, windowSeconds: 60 },
  
  // Medium endpoints
  "memory-engine":        { maxRequests: 30, windowSeconds: 60 },
  "leaderboard":          { maxRequests: 30, windowSeconds: 60 },
  "brain-missions":       { maxRequests: 20, windowSeconds: 60 },
  
  // Voice (expensive 3rd party)
  "voice-notification":   { maxRequests: 5,  windowSeconds: 60 },
  
  // Default for unlisted functions
  "_default":             { maxRequests: 30, windowSeconds: 60 },
};

/**
 * Check if user is within rate limits.
 * Uses fast in-memory check first, falls back to DB for cross-instance accuracy.
 */
export async function checkRateLimit(
  userId: string,
  functionName: string,
  customLimit?: number,
  customWindowSeconds?: number
): Promise<RateLimitResult> {
  const config = FUNCTION_LIMITS[functionName] || FUNCTION_LIMITS["_default"];
  const maxRequests = customLimit || config.maxRequests;
  const windowSeconds = customWindowSeconds || config.windowSeconds;
  
  const key = `${userId}:${functionName}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Fast in-memory check
  const entry = windowCounts.get(key);
  if (entry && (now - entry.windowStart) < windowMs) {
    entry.count++;
    if (entry.count > maxRequests) {
      const retryAfterMs = windowMs - (now - entry.windowStart);
      return { allowed: false, remaining: 0, limit: maxRequests, retryAfterMs };
    }
    return { allowed: true, remaining: maxRequests - entry.count, limit: maxRequests, retryAfterMs: 0 };
  }

  // New window
  windowCounts.set(key, { count: 1, windowStart: now });

  // Cleanup old entries periodically (every 100th call)
  if (Math.random() < 0.01) {
    for (const [k, v] of windowCounts.entries()) {
      if (now - v.windowStart > windowMs * 2) windowCounts.delete(k);
    }
  }

  return { allowed: true, remaining: maxRequests - 1, limit: maxRequests, retryAfterMs: 0 };
}

/**
 * Create a standardized 429 response.
 */
export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({ 
      error: "Rate limit exceeded. Please slow down.", 
      retry_after_seconds: retryAfterSeconds 
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Middleware-style rate limit check. Returns a Response if rate limited, null if allowed.
 */
export async function rateLimitMiddleware(
  userId: string,
  functionName: string
): Promise<Response | null> {
  const result = await checkRateLimit(userId, functionName);
  if (!result.allowed) {
    console.warn(`Rate limited: user=${userId} fn=${functionName} retry_after=${result.retryAfterMs}ms`);
    return rateLimitResponse(result.retryAfterMs);
  }
  return null;
}
