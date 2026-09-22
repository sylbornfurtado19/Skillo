/**
 * Centralized AI Provider Configuration and Request Execution Engine
 *
 * Enforces unified model naming, timeouts via AbortController, and transient retry policies
 * (retrying only transient network errors, rate limits 429, and provider 5xx, never 4xx client errors).
 */

export const AI_CONFIG = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiVersion: '2023-06-01',
  endpoint: 'https://api.anthropic.com/v1/messages',
  timeouts: {
    singlePassMs: 4500,
    simpoMs: 12000,
    latsBranchMs: 15000,
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
    maxAttempts: 2,
    baseDelayMs: 600,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  },
} as const;

export interface AnthropicRequestOptions {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  apiKey?: string;
}

export interface AnthropicResponseResult {
  success: boolean;
  text?: string;
  latencyMs: number;
  modelId: string;
  status: 'live' | 'timeout' | 'rate_limited' | 'unconfigured' | 'error';
  error?: string;
  httpStatus?: number;
}

/**
 * Executes a resilient, latency-bounded Anthropic API request with AbortController timeout
 * and transient retry backoff.
 */
export async function executeAnthropicRequest(
  options: AnthropicRequestOptions
): Promise<AnthropicResponseResult> {
  const startTime = performance.now();
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      latencyMs: 0,
      modelId: AI_CONFIG.model,
      status: 'unconfigured',
      error: 'ANTHROPIC_API_KEY is not configured',
    };
  }

  const timeoutMs = options.timeoutMs || AI_CONFIG.timeouts.singlePassMs;
  const maxAttempts = AI_CONFIG.retry.maxAttempts;

  let lastError = 'Unknown error';
  let lastStatus: AnthropicResponseResult['status'] = 'error';
  let lastHttpStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(AI_CONFIG.endpoint, {
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
        const text = data?.content?.[0]?.text ?? '';
        const latencyMs = Math.round(performance.now() - startTime);
        return {
          success: true,
          text,
          latencyMs,
          modelId: AI_CONFIG.model,
          status: 'live',
          httpStatus: res.status,
        };
      }

      if (res.status === 429) {
        lastStatus = 'rate_limited';
        lastError = 'Anthropic rate limit exceeded (HTTP 429)';
      } else {
        lastError = `Anthropic API error: HTTP ${res.status}`;
      }

      // Check if status is transient/retryable
      const isRetryable = (AI_CONFIG.retry.retryableStatusCodes as readonly number[]).includes(res.status);
      if (!isRetryable || attempt === maxAttempts) {
        break;
      }

      // Backoff delay before retry
      const delay = AI_CONFIG.retry.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError' || controller.signal.aborted) {
        lastStatus = 'timeout';
        lastError = `Anthropic request timed out after ${timeoutMs}ms`;
      } else {
        lastError = err.message || 'Network fetch failure';
      }

      // If aborted/timeout or on last attempt, break
      if (attempt === maxAttempts || err.name === 'AbortError') {
        break;
      }

      await new Promise((r) => setTimeout(r, AI_CONFIG.retry.baseDelayMs));
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
