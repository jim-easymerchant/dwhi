/**
 * Verifies the lazy + env-driven init of the Supabase client.
 *   - No env vars  → returns null + describes Local only.
 *   - With env vars → returns a real client object.
 */

const getSupabaseUrl = jest.fn();
const getSupabaseAnonKey = jest.fn();
const isSupabaseConfigured = jest.fn();

jest.mock('@/services/env', () => ({
  getSupabaseUrl: (...args: unknown[]) => getSupabaseUrl(...args),
  getSupabaseAnonKey: (...args: unknown[]) => getSupabaseAnonKey(...args),
  isSupabaseConfigured: (...args: unknown[]) => isSupabaseConfigured(...args),
}));

const createClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

import {
  __resetSupabaseClientForTests,
  describeSupabaseStatus,
  getSupabaseClient,
} from '../supabaseClient';

beforeEach(() => {
  jest.clearAllMocks();
  __resetSupabaseClientForTests();
});

describe('getSupabaseClient', () => {
  test('returns null when env vars are missing', () => {
    getSupabaseUrl.mockReturnValue(null);
    getSupabaseAnonKey.mockReturnValue(null);
    isSupabaseConfigured.mockReturnValue(false);

    expect(getSupabaseClient()).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  test('returns a real client when both env vars are present', () => {
    getSupabaseUrl.mockReturnValue('https://abc.supabase.co');
    getSupabaseAnonKey.mockReturnValue('ey...anon');
    isSupabaseConfigured.mockReturnValue(true);
    const fakeClient = { auth: {} };
    createClient.mockReturnValue(fakeClient);

    expect(getSupabaseClient()).toBe(fakeClient);
    expect(createClient).toHaveBeenCalledWith(
      'https://abc.supabase.co',
      'ey...anon',
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
        }),
      }),
    );
  });

  test('caches the client across calls', () => {
    getSupabaseUrl.mockReturnValue('https://abc.supabase.co');
    getSupabaseAnonKey.mockReturnValue('ey...anon');
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockReturnValue({ auth: {} });

    getSupabaseClient();
    getSupabaseClient();
    getSupabaseClient();

    expect(createClient).toHaveBeenCalledTimes(1);
  });
});

describe('describeSupabaseStatus', () => {
  test('reports Local only when env vars are missing', () => {
    isSupabaseConfigured.mockReturnValue(false);
    expect(describeSupabaseStatus()).toMatch(/local only/i);
  });

  test('reports "client ready" when configured and built successfully', () => {
    getSupabaseUrl.mockReturnValue('https://abc.supabase.co');
    getSupabaseAnonKey.mockReturnValue('ey...anon');
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockReturnValue({ auth: {} });

    expect(describeSupabaseStatus()).toMatch(/client ready|sign-in/i);
  });
});
