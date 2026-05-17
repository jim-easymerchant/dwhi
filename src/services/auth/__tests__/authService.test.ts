/**
 * Verifies that the auth service short-circuits cleanly when Supabase is
 * not configured, and that it routes signInWithOtp / verifyOtp to the
 * client when it is.
 */

/**
 * `signUp` is intentionally present on the mock so that any drift toward
 * the wrong API (the spec explicitly says we must NOT call signUp)
 * shows up as a failed expectation rather than a silent miss.
 */
const mockSupabase = {
  auth: {
    signInWithOtp: jest.fn(),
    verifyOtp: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    signUp: jest.fn(),
  },
};

const getSupabaseClient = jest.fn();
jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => getSupabaseClient(),
}));

import {
  getCurrentEmail,
  getCurrentSession,
  requestEmailOtp,
  signOut,
  verifyEmailOtp,
} from '../authService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('when Supabase is not configured', () => {
  beforeEach(() => getSupabaseClient.mockReturnValue(null));

  test('requestEmailOtp → ok=false with unconfigured message', async () => {
    const r = await requestEmailOtp('a@b.co');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not configured/i);
  });

  test('verifyEmailOtp → ok=false with unconfigured message', async () => {
    const r = await verifyEmailOtp('a@b.co', '123456');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not configured/i);
  });

  test('signOut → ok=false with unconfigured message', async () => {
    const r = await signOut();
    expect(r.ok).toBe(false);
  });

  test('getCurrentSession → null without throwing', async () => {
    expect(await getCurrentSession()).toBeNull();
  });

  test('getCurrentEmail → null', async () => {
    expect(await getCurrentEmail()).toBeNull();
  });
});

describe('when Supabase is configured', () => {
  beforeEach(() => getSupabaseClient.mockReturnValue(mockSupabase));

  test('requestEmailOtp passes through to signInWithOtp', async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });
    const r = await requestEmailOtp('  a@b.co  ');
    expect(r.ok).toBe(true);
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      options: { shouldCreateUser: true },
    });
  });

  test('requestEmailOtp never calls signUp (regression guard)', async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });
    await requestEmailOtp('a@b.co');
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  test('requestEmailOtp does NOT set emailRedirectTo (regression guard)', async () => {
    // If we ever set emailRedirectTo, Supabase renders the magic-link
    // variant of the email pointed at that URL. The whole point of OTP
    // on mobile is to keep the user OFF a link, so this must stay unset.
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });
    await requestEmailOtp('a@b.co');
    const call = mockSupabase.auth.signInWithOtp.mock.calls[0][0];
    expect(call.options).not.toHaveProperty('emailRedirectTo');
    // Belt + braces: the serialized payload also must not contain the
    // string "localhost" or "redirectTo" anywhere.
    expect(JSON.stringify(call).toLowerCase()).not.toContain('localhost');
    expect(JSON.stringify(call).toLowerCase()).not.toContain('redirectto');
  });

  test('requestEmailOtp success message points the user at the code, not the link', async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ error: null });
    const r = await requestEmailOtp('a@b.co');
    expect(r.message.toLowerCase()).toContain('6-digit code');
    expect(r.message.toLowerCase()).toContain('not the link');
  });

  test('requestEmailOtp surfaces auth errors', async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({
      error: { message: 'Invalid email' },
    });
    const r = await requestEmailOtp('a@b.co');
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Invalid email');
  });

  test('verifyEmailOtp passes through with type:email and returns the session', async () => {
    const session = { user: { id: 'u1', email: 'a@b.co' } };
    mockSupabase.auth.verifyOtp.mockResolvedValue({
      data: { session },
      error: null,
    });
    const r = await verifyEmailOtp('a@b.co', '123456');
    expect(r.ok).toBe(true);
    expect(r.data).toBe(session);
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      token: '123456',
      type: 'email', // NOT 'magiclink' — those are different verify paths.
    });
  });

  test('verifyEmailOtp surfaces an invalid-code error verbatim', async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValue({
      data: null,
      error: { message: 'Token has expired or is invalid' },
    });
    const r = await verifyEmailOtp('a@b.co', '000000');
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Token has expired or is invalid');
  });

  test('verifyEmailOtp with no session in response → asks for a new code', async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const r = await verifyEmailOtp('a@b.co', '123456');
    expect(r.ok).toBe(false);
    expect(r.message.toLowerCase()).toContain('try requesting a new code');
  });

  test('verifyEmailOtp short-circuits on empty inputs', async () => {
    const r = await verifyEmailOtp('', '');
    expect(r.ok).toBe(false);
    expect(mockSupabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  test('getCurrentEmail returns the email when there is a session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { email: 'a@b.co' } } },
    });
    expect(await getCurrentEmail()).toBe('a@b.co');
  });

  test('getCurrentEmail returns null when getSession throws', async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error('offline'));
    expect(await getCurrentEmail()).toBeNull();
  });
});
