/**
 * Centralized AI Provider Configuration and Request Execution Engine
 *
 * Supports two providers behind one request function:
 *  - "anthropic": Anthropic Messages API
 *  - "groq": Groq's OpenAI-compatible chat completions API
 *
 * Enforces unified model naming, timeouts via AbortController, and transient retry policies
 * (retrying only transient network errors, rate limits 429, and provider 5xx, never 4xx client errors).
 */

import { DEFAULT_ANTHROPIC_MODEL } from './defaultModel';

export type AiProvider = 'anthropic' | 'groq';

/**
 * Groq retires models over time (llama-3.3-70b-versatile is no longer offered on all accounts),
 * so this is only a default: override with GROQ_MODEL. List what your key can use with
 * GET https://api.groq.com/openai/v1/models.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

type EnvLike = Record<string, string | undefined>;

/**
 * Picks the provider: AI_PROVIDER wins; otherwise whichever key is present
 * (Anthropic first); otherwise Anthropic (reported as unconfigured).
 */
export function resolveAiProvider(env: EnvLike = process.env): AiProvider {
  const explicit = env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === 'anthropic' || explicit === 'groq') return explicit;
  if (env.ANTHROPIC_API_KEY?.trim()) return 'anthropic';
  if (env.GROQ_API_KEY?.trim()) return 'groq';
  return 'anthropic';
}

/** API key for the active provider, or undefined when none is configured. */
export function getAiApiKey(env: EnvLike = process.env): string | undefined {
  const key = resolveAiProvider(env) === 'groq' ? env.GROQ_API_KEY : env.ANTHROPIC_API_KEY;
  return key?.trim() || undefined;
}

export function isAiConfigured(env: EnvLike = process.env): boolean {
  return Boolean(getAiApiKey(env));
}

/** Env var name that must be set for the active provider (for error/warning messages). */
export function getAiKeyEnvName(env: EnvLike = process.env): 'GROQ_API_KEY' | 'ANTHROPIC_API_KEY' {
  return resolveAiProvider(env) === 'groq' ? 'GROQ_API_KEY' : 'ANTHROPIC_API_KEY';
}

function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AI_CONFIG = {
  get provider(): AiProvider {
    return resolveAiProvider();
  },
  get model(): string {
    return resolveAiProvider() === 'groq'
      ? process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
      : process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  },
  apiVersion: '2023-06-01',
  get endpoint(): string {
    return resolveAiProvider() === 'groq'
      ? process.env.GROQ_BASE_URL?.trim() || GROQ_ENDPOINT
      : ANTHROPIC_ENDPOINT;
  },
  timeouts: {
    singlePassMs: 4500,
    simpoMs: 12000,
    latsBranchMs: 15000,
    latsWallClockMs: 10000,
    reflexionMs: 12000,
    resumeAnalysisMs: 18000,
  },
  maxTokens: {
    singlePass: 1000,
    simpo: 1200,
    lats: 1500,
    reflexion: 1000,
    resumeAnalysis: 2000,
  },
  temperatureDefaults: {
    evaluationCot: 0.7,
    simpoContrastive: 0.25,
    latsBranching: 0.7,
    reflexionSelfCritique: 0.3,
    resumeExtraction: 0.1,
  },
  retry: {
    get maxAttempts(): number {
      return resolveAiProvider() === 'groq' ? 3 : 2;
    },
    baseDelayMs: 600,
    /** Longest Retry-After we are willing to wait before retrying a rate-limited call. */
    maxRetryAfterMs: 8000,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
  lats: {
    /**
     * MCTS rounds per follow-up. Free-tier Groq limits are per-minute token budgets, so the
     * default there is one round (about a third of the calls); override with AI_LATS_ROUNDS.
     */
    get rounds(): number {
      return positiveIntEnv('AI_LATS_ROUNDS', resolveAiProvider() === 'groq' ? 1 : 3);
    },
    c_puct: 1.414,
  },
  /** Max simultaneous in-flight requests per server instance (Groq only). */
  get maxConcurrentRequests(): number {
    return resolveAiProvider() === 'groq' ? positiveIntEnv('AI_MAX_CONCURRENCY', 2) : Number.POSITIVE_INFINITY;
  },
};

export interface AnthropicRequestOptions {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  apiKey?: string;
  /** Ask the provider for a JSON object (Groq JSON mode). Defaults to true; ignored for Anthropic. */
  jsonMode?: boolean;
}

export type AiRequestOptions = AnthropicRequestOptions;

export interface AnthropicResponseResult {
  success: boolean;
  text?: string;
  latencyMs: number;
  modelId: string;
  status: 'live' | 'timeout' | 'rate_limited' | 'unconfigured' | 'error';
  error?: string;
  httpStatus?: number;
}

export type AiResponseResult = AnthropicResponseResult;

// ── Concurrency limiter (keeps bursts of parallel calls under provider rate limits) ──────────
class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  async acquire(limit: number): Promise<void> {
    if (this.active < limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active += 1;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }
}

const requestSemaphore = new Semaphore();

function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number.parseFloat(headerValue);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 1000) : undefined;
}

function providerLabel(provider: AiProvider): string {
  return provider === 'groq' ? 'Groq' : 'Anthropic';
}

/**
 * Executes a resilient, latency-bounded AI request (Anthropic or Groq, per AI_PROVIDER)
 * with AbortController timeout, Retry-After aware backoff and per-instance concurrency limiting.
 */
export async function executeAnthropicRequest(
  options: AnthropicRequestOptions
): Promise<AnthropicResponseResult> {
  const startTime = performance.now();
  const provider = resolveAiProvider();
  const apiKey = options.apiKey || getAiApiKey();

  if (!apiKey) {
    return {
      success: false,
      latencyMs: 0,
      modelId: AI_CONFIG.model,
      status: 'unconfigured',
      error: `${getAiKeyEnvName()} is not configured`,
    };
  }

  const label = providerLabel(provider);
  const timeoutMs = options.timeoutMs || AI_CONFIG.timeouts.singlePassMs;
  const maxAttempts = AI_CONFIG.retry.maxAttempts;
  const concurrencyLimit = AI_CONFIG.maxConcurrentRequests;
  let useJsonMode = provider === 'groq' && options.jsonMode !== false;

  let lastError = 'Unknown error';
  let lastStatus: AnthropicResponseResult['status'] = 'error';
  let lastHttpStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const limited = Number.isFinite(concurrencyLimit);
    if (limited) await requestSemaphore.acquire(concurrencyLimit);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let retryDelayMs = AI_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1);

    try {
      const res =
        provider === 'groq'
          ? await fetch(AI_CONFIG.endpoint, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: AI_CONFIG.model,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                messages: [{ role: 'system', content: options.system }, ...options.messages],
                ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
                // gpt-oss models "think" before answering; keep that short so it does not eat the
                // token budget or latency. Override with GROQ_REASONING_EFFORT (low|medium|high).
                ...(AI_CONFIG.model.startsWith('openai/gpt-oss')
                  ? { reasoning_effort: process.env.GROQ_REASONING_EFFORT?.trim() || 'low' }
                  : {}),
              }),
            })
          : await fetch(AI_CONFIG.endpoint, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': AI_CONFIG.apiVersion,
              },
              body: JSON.stringify({
                model: AI_CONFIG.model,
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature ?? 0.7,
                system: options.system,
                messages: options.messages,
              }),
            });

      clearTimeout(timeoutId);
      lastHttpStatus = res.status;

      if (res.ok) {
        const data = await res.json();
        const text: string =
          provider === 'groq'
            ? data?.choices?.[0]?.message?.content ?? ''
            : data?.content?.[0]?.text ?? '';
        return {
          success: true,
          text,
          latencyMs: Math.round(performance.now() - startTime),
          modelId: AI_CONFIG.model,
          status: 'live',
          httpStatus: res.status,
        };
      }

      if (res.status === 429) {
        lastStatus = 'rate_limited';
        lastError = `${label} rate limit exceeded (HTTP 429)`;
        const retryAfter = parseRetryAfterMs(res.headers?.get?.('retry-after') ?? null);
        if (retryAfter !== undefined) {
          retryDelayMs = Math.min(retryAfter, AI_CONFIG.retry.maxRetryAfterMs);
        }
      } else if (res.status === 400 && provider === 'groq' && useJsonMode) {
        // JSON mode can reject output the model could not format as JSON: retry once in plain mode.
        const bodyText = await res.text().catch(() => '');
        lastError = `${label} API error: HTTP 400`;
        if (/json_validate_failed|response_format|json/i.test(bodyText)) {
          useJsonMode = false;
          retryDelayMs = 0;
          if (attempt < maxAttempts) continue;
        }
        break;
      } else {
        // Include a short provider message (e.g. "model not found") to make misconfiguration obvious.
        const detail = provider === 'groq' ? (await res.text().catch(() => '')).slice(0, 160) : '';
        lastError = `${label} API error: HTTP ${res.status}${detail ? ` - ${detail}` : ''}`;
      }

      // Check if status is transient/retryable
      const isRetryable = (AI_CONFIG.retry.retryableStatusCodes as readonly number[]).includes(res.status);
      if (!isRetryable || attempt === maxAttempts) {
        break;
      }

      await new Promise((r) => setTimeout(r, retryDelayMs));
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError' || controller.signal.aborted) {
        lastStatus = 'timeout';
        lastError = `${label} request timed out after ${timeoutMs}ms`;
      } else {
        lastError = err.message || 'Network fetch failure';
      }

      // If aborted/timeout or on last attempt, break
      if (attempt === maxAttempts || err.name === 'AbortError') {
        break;
      }

      await new Promise((r) => setTimeout(r, AI_CONFIG.retry.baseDelayMs));
    } finally {
      if (limited) requestSemaphore.release();
    }
  }

  const latencyMs = Math.round(performance.now() - startTime);
  return {
    success: false,
    latencyMs,
    modelId: AI_CONFIG.model,
    status: lastStatus,
    error: lastError,
    httpStatus: lastHttpStatus,
  };
}

/** Provider-neutral alias; the Anthropic-named export is kept for existing callers. */
export const executeAiRequest = executeAnthropicRequest;
