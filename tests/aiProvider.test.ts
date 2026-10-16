/**
 * AI provider switch (Anthropic / Groq) in src/lib/ai/aiConfig.ts
 */

import {
  AI_CONFIG,
  DEFAULT_GROQ_MODEL,
  executeAnthropicRequest,
  getAiApiKey,
  getAiKeyEnvName,
  isAiConfigured,
  resolveAiProvider,
} from '../src/lib/ai/aiConfig';
import { validateEnvironment } from '../src/lib/server/env';

const ENV_KEYS = [
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'GROQ_BASE_URL',
  'AI_LATS_ROUNDS',
  'AI_MAX_CONCURRENCY',
] as const;
const originalEnv: Record<string, string | undefined> = {};
const originalFetch = global.fetch;

beforeEach(() => {
  ENV_KEYS.forEach((k) => {
    originalEnv[k] = process.env[k];
    delete process.env[k];
  });
});

afterEach(() => {
  ENV_KEYS.forEach((k) => {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  });
  global.fetch = originalFetch;
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const groqOk = (content: string) => json(200, { choices: [{ message: { content } }] });

describe('provider resolution', () => {
  it('honours AI_PROVIDER', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'groq' })).toBe('groq');
    expect(resolveAiProvider({ AI_PROVIDER: 'Anthropic', GROQ_API_KEY: 'x'.repeat(20) })).toBe('anthropic');
  });

  it('falls back to whichever key exists, preferring Anthropic', () => {
    expect(resolveAiProvider({ GROQ_API_KEY: 'gsk_abc' })).toBe('groq');
    expect(resolveAiProvider({ ANTHROPIC_API_KEY: 'sk-ant-abc', GROQ_API_KEY: 'gsk_abc' })).toBe('anthropic');
    expect(resolveAiProvider({})).toBe('anthropic');
  });

  it('returns the key for the active provider only', () => {
    const env = { AI_PROVIDER: 'groq', GROQ_API_KEY: ' gsk_key ', ANTHROPIC_API_KEY: 'sk-ant' };
    expect(getAiApiKey(env)).toBe('gsk_key');
    expect(getAiKeyEnvName(env)).toBe('GROQ_API_KEY');
    expect(isAiConfigured({ AI_PROVIDER: 'groq', ANTHROPIC_API_KEY: 'sk-ant' })).toBe(false);
    expect(isAiConfigured({})).toBe(false);
  });
});

describe('AI_CONFIG per provider', () => {
  it('uses Groq model, endpoint and a lighter default search', () => {
    process.env.AI_PROVIDER = 'groq';
    expect(AI_CONFIG.provider).toBe('groq');
    expect(AI_CONFIG.model).toBe(DEFAULT_GROQ_MODEL);
    expect(AI_CONFIG.endpoint).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(AI_CONFIG.lats.rounds).toBe(1);
    expect(AI_CONFIG.maxConcurrentRequests).toBe(2);

    process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
    process.env.AI_LATS_ROUNDS = '2';
    expect(AI_CONFIG.model).toBe('llama-3.1-8b-instant');
    expect(AI_CONFIG.lats.rounds).toBe(2);
  });

  it('keeps the Anthropic defaults unchanged', () => {
    expect(AI_CONFIG.provider).toBe('anthropic');
    expect(AI_CONFIG.endpoint).toBe('https://api.anthropic.com/v1/messages');
    expect(AI_CONFIG.lats.rounds).toBe(3);
    expect(AI_CONFIG.retry.maxAttempts).toBe(2);
    expect(AI_CONFIG.maxConcurrentRequests).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('executeAnthropicRequest with Groq', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk_test_key_123456';
  });

  it('sends an OpenAI-style request and parses choices[0].message.content', async () => {
    const fetchMock = jest.fn(async (_url: string, _init: RequestInit) => groqOk('{"ok":true}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await executeAnthropicRequest({
      system: 'Return JSON.',
      messages: [{ role: 'user', content: 'hello' }],
      maxTokens: 300,
      temperature: 0.2,
    });

    expect(result).toMatchObject({ success: true, text: '{"ok":true}', status: 'live', modelId: DEFAULT_GROQ_MODEL });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test_key_123456');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(DEFAULT_GROQ_MODEL);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Return JSON.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(body.max_tokens).toBe(300);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('can disable JSON mode', async () => {
    const fetchMock = jest.fn(async (_url: string, _init: RequestInit) => groqOk('plain text'));
    global.fetch = fetchMock as unknown as typeof fetch;
    await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }], jsonMode: false });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).response_format).toBeUndefined();
  });

  it('retries a 429 after honouring Retry-After', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json(429, { error: { message: 'slow down' } }, { 'retry-after': '0' }))
      .mockResolvedValueOnce(groqOk('{"ok":1}'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] });
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports rate_limited when 429 persists', async () => {
    global.fetch = jest.fn(async () => json(429, {}, { 'retry-after': '0' })) as unknown as typeof fetch;
    const result = await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] });
    expect(result).toMatchObject({ success: false, status: 'rate_limited', httpStatus: 429 });
    expect(result.error).toMatch(/Groq/);
  });

  it('retries once without JSON mode when Groq rejects the JSON output', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(json(400, { error: { code: 'json_validate_failed', message: 'Failed to generate JSON' } }))
      .mockResolvedValueOnce(groqOk('not strictly json but usable'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] });
    expect(result).toMatchObject({ success: true, text: 'not strictly json but usable' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).response_format).toBeDefined();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).response_format).toBeUndefined();
  });

  it('does not retry other 4xx errors', async () => {
    const fetchMock = jest.fn(async () => json(401, { error: { message: 'bad key' } }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] });
    expect(result).toMatchObject({ success: false, httpStatus: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('limits simultaneous requests', async () => {
    process.env.AI_MAX_CONCURRENCY = '2';
    let inFlight = 0;
    let peak = 0;
    global.fetch = jest.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight -= 1;
      return groqOk('{}');
    }) as unknown as typeof fetch;

    const results = await Promise.all(
      Array.from({ length: 6 }, () => executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] }))
    );
    expect(results.every((r) => r.success)).toBe(true);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('is unconfigured without a Groq key even if an Anthropic key exists', async () => {
    delete process.env.GROQ_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-unused-key';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const result = await executeAnthropicRequest({ system: 's', messages: [{ role: 'user', content: 'u' }] });
    expect(result).toMatchObject({ success: false, status: 'unconfigured', error: 'GROQ_API_KEY is not configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('executeAnthropicRequest with Anthropic (unchanged)', () => {
  it('uses x-api-key and parses content[0].text', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-123';
    const fetchMock = jest.fn(async (_url: string, _init: RequestInit) =>
      json(200, { content: [{ text: 'hi' }] })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await executeAnthropicRequest({ system: 'sys', messages: [{ role: 'user', content: 'u' }] });
    expect(result).toMatchObject({ success: true, text: 'hi' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test-key-123');
    const body = JSON.parse(init.body as string);
    expect(body.system).toBe('sys');
    expect(body.response_format).toBeUndefined();
  });
});

describe('environment validation is provider-aware', () => {
  it('asks for GROQ_API_KEY when Groq is the provider', () => {
    const result = validateEnvironment({ NODE_ENV: 'development', AI_PROVIDER: 'groq' });
    expect(result.warnings.join(' ')).toContain('GROQ_API_KEY');
    expect(result.warnings.join(' ')).not.toContain('ANTHROPIC_API_KEY');
  });

  it('flags a browser-exposed Groq key', () => {
    const result = validateEnvironment({ NODE_ENV: 'development', NEXT_PUBLIC_GROQ_API_KEY: 'gsk_leak' });
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors)).toContain('NEXT_PUBLIC_GROQ_API_KEY');
  });

  it('treats a configured Groq key as production ready', () => {
    const result = validateEnvironment({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(30),
      AI_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk_' + 'x'.repeat(30),
    });
    expect(result.isProductionReady).toBe(true);
  });
});
