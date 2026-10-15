/**
 * Provider-aware API authentication (src/lib/server/authenticateRequest.ts)
 *
 * Covers: provider resolution, Bearer parsing, Firebase ID-token verification,
 * Supabase verification, fail-closed behaviour, and the follow-up route no longer
 * serving a canned LATS question when authentication breaks.
 */

const mockGetUser = jest.fn();
const mockVerifyIdToken = jest.fn();

jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } },
}));

jest.mock('@/lib/firebase/admin', () => ({
  isFirebaseAdminConfigured: true,
  getAdminAuth: async () => ({ verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) }),
}));

jest.mock('@/lib/services/rateLimiter.server', () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true, limit: 10, remaining: 9, resetSeconds: 60, store: 'in-memory-fallback' })),
  createRateLimitResponse: jest.fn(),
}));

const runLATSMock = jest.fn();
jest.mock('@/lib/services/latsEngine.server', () => {
  const actual = jest.requireActual('@/lib/services/latsEngine.server');
  return { ...actual, runLATSMCTS: (...args: unknown[]) => runLATSMock(...args) };
});

import {
  authenticateRequest,
  extractBearerToken,
  resolveAuthProvider,
} from '../src/lib/server/authenticateRequest';
import { POST as followupHandler } from '../app/api/interview/followup/route';

function req(headers: Record<string, string> = {}, body?: unknown): Request {
  return new Request('http://localhost:3000/api/interview/followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_BACKEND_PROVIDER;
  delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.FIREBASE_PROJECT_ID;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('resolveAuthProvider', () => {
  it('honours an explicit provider', () => {
    expect(resolveAuthProvider({ NEXT_PUBLIC_BACKEND_PROVIDER: 'firebase' })).toBe('firebase');
    expect(resolveAuthProvider({ NEXT_PUBLIC_BACKEND_PROVIDER: 'SUPABASE' })).toBe('supabase');
  });

  it('auto-detects firebase from client config and defaults to supabase otherwise', () => {
    expect(
      resolveAuthProvider({ NEXT_PUBLIC_FIREBASE_API_KEY: 'abc', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'proj' })
    ).toBe('firebase');
    expect(resolveAuthProvider({})).toBe('supabase');
  });
});

describe('extractBearerToken', () => {
  it('parses a Bearer header and rejects malformed ones', () => {
    expect(extractBearerToken(req({ Authorization: 'Bearer abc.def' }))).toBe('abc.def');
    expect(extractBearerToken(req({ Authorization: 'bearer   xyz ' }))).toBe('xyz');
    expect(extractBearerToken(req({ Authorization: 'Basic abc' }))).toBeNull();
    expect(extractBearerToken(req({ Authorization: 'Bearer ' }))).toBeNull();
    expect(extractBearerToken(req())).toBeNull();
    expect(extractBearerToken(req({ Authorization: `Bearer ${'a'.repeat(9000)}` }))).toBeNull();
  });
});

describe('authenticateRequest: firebase provider', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'firebase';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'skillo-test';
  });

  it('accepts a valid Firebase ID token', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'fb-user-1', email: 'a@b.co' });
    const result = await authenticateRequest(req({ Authorization: 'Bearer good-token' }));
    expect(result).toEqual({ ok: true, user: { id: 'fb-user-1', email: 'a@b.co', provider: 'firebase' } });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('good-token');
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired or invalid Firebase token', async () => {
    mockVerifyIdToken.mockRejectedValue(Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }));
    const result = await authenticateRequest(req({ Authorization: 'Bearer old' }));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('fails closed with 500 on unexpected verification errors', async () => {
    mockVerifyIdToken.mockRejectedValue(Object.assign(new Error('cert fetch failed'), { code: 'auth/network-error' }));
    const result = await authenticateRequest(req({ Authorization: 'Bearer any' }));
    expect(result).toMatchObject({ ok: false, status: 500 });
  });

  it('fails closed with 500 when no Firebase project id is configured', async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const result = await authenticateRequest(req({ Authorization: 'Bearer any' }));
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 without a Bearer token and never calls the SDK', async () => {
    const result = await authenticateRequest(req());
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});

describe('authenticateRequest: supabase provider', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'supabase';
  });

  it('accepts a valid Supabase token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'sb-1', email: 'x@y.z' } }, error: null });
    const result = await authenticateRequest(req({ Authorization: 'Bearer tok' }));
    expect(result).toEqual({ ok: true, user: { id: 'sb-1', email: 'x@y.z', provider: 'supabase' } });
  });

  it('returns 401 when Supabase rejects the token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT', status: 401 } });
    const result = await authenticateRequest(req({ Authorization: 'Bearer bad' }));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('fails closed with 500 when the Supabase client throws (e.g. unconfigured)', async () => {
    mockGetUser.mockImplementation(() => {
      throw new Error('[Supabase Configuration Notice] Supabase is not configured.');
    });
    const result = await authenticateRequest(req({ Authorization: 'Bearer anything' }));
    expect(result).toMatchObject({ ok: false, status: 500 });
  });

  it('fails closed with 500 on a Supabase server-side error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'upstream down', status: 503 } });
    const result = await authenticateRequest(req({ Authorization: 'Bearer tok' }));
    expect(result).toMatchObject({ ok: false, status: 500 });
  });
});

describe('/api/interview/followup auth behaviour', () => {
  const body = {
    question: 'Explain the CAP theorem',
    answerText: 'This is a sufficiently long answer to trigger follow-up generation logic.',
    role: 'Backend Engineer',
  };

  it('returns 401 with no token and does not run LATS', async () => {
    const res = await followupHandler(req({}, body));
    expect(res.status).toBe(401);
    expect(runLATSMock).not.toHaveBeenCalled();
  });

  it('returns 500 (not a canned 200 follow-up) when the auth service throws', async () => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'supabase';
    mockGetUser.mockImplementation(() => {
      throw new Error('Supabase is not configured');
    });
    const res = await followupHandler(req({ Authorization: 'Bearer fake.token' }, body));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.followUpQuestion).toBeUndefined();
    expect(json.needsFollowUp).toBeUndefined();
    expect(runLATSMock).not.toHaveBeenCalled();
  });

  it('returns 500 instead of a generic canned question when LATS itself throws', async () => {
    process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'firebase';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'skillo-test';
    mockVerifyIdToken.mockResolvedValue({ uid: 'fb-user-2', email: null });
    runLATSMock.mockRejectedValue(new Error('engine exploded'));
    const res = await followupHandler(req({ Authorization: 'Bearer good' }, body));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.followUpQuestion).toBeUndefined();
    expect(runLATSMock).toHaveBeenCalledTimes(1);
  });
});
