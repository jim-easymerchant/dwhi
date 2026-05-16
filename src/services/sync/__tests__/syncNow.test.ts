/**
 * Verifies the orchestrator's branching: it must never accidentally call
 * Supabase when the app is in Local only mode, and it must surface a
 * friendly message in each state.
 */

const getSyncMode = jest.fn();
const countPendingChanges = jest.fn();
const getSupabaseClient = jest.fn();
const pushPending = jest.fn();
const pullChanges = jest.fn();

jest.mock('../syncStatus', () => ({
  getSyncMode: () => getSyncMode(),
  countPendingChanges: () => countPendingChanges(),
}));
jest.mock('@/services/supabaseClient', () => ({
  getSupabaseClient: () => getSupabaseClient(),
  describeSupabaseStatus: () => 'stub',
  __resetSupabaseClientForTests: jest.fn(),
}));
jest.mock('../outboundSync', () => ({
  pushPending: (...args: unknown[]) => pushPending(...args),
}));
jest.mock('../inboundSync', () => ({
  pullChanges: (...args: unknown[]) => pullChanges(...args),
}));

import { syncNow } from '../syncNow';

beforeEach(() => {
  jest.clearAllMocks();
  countPendingChanges.mockResolvedValue({ total: 0, byTable: {} });
  pushPending.mockResolvedValue({ pushed: 0, errors: [] });
  pullChanges.mockResolvedValue({ pulled: 0, errors: [] });
});

describe('syncNow', () => {
  test('local-only mode returns a friendly "not configured" result without touching Supabase', async () => {
    getSyncMode.mockResolvedValue('local-only');

    const r = await syncNow();

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/not configured|local only/i);
    expect(r.pushed).toBe(0);
    expect(r.pulled).toBe(0);
    expect(pushPending).not.toHaveBeenCalled();
    expect(pullChanges).not.toHaveBeenCalled();
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  test('configured-signed-out asks the user to sign in', async () => {
    getSyncMode.mockResolvedValue('configured-signed-out');

    const r = await syncNow();

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/sign in/i);
    expect(pushPending).not.toHaveBeenCalled();
    expect(pullChanges).not.toHaveBeenCalled();
  });

  test('configured-signed-in fires push + pull and aggregates the result', async () => {
    getSyncMode.mockResolvedValue('configured-signed-in');
    getSupabaseClient.mockReturnValue({});
    pushPending.mockResolvedValue({ pushed: 3, errors: [] });
    pullChanges.mockResolvedValue({ pulled: 5, errors: [] });

    const r = await syncNow();

    expect(r.ok).toBe(true);
    expect(r.pushed).toBe(3);
    expect(r.pulled).toBe(5);
    expect(r.message).toMatch(/Pushed 3, pulled 5/);
    expect(pushPending).toHaveBeenCalledTimes(1);
    expect(pullChanges).toHaveBeenCalledTimes(1);
  });

  test('errors in either leg are accumulated into the result', async () => {
    getSyncMode.mockResolvedValue('configured-signed-in');
    getSupabaseClient.mockReturnValue({});
    pushPending.mockRejectedValue(new Error('boom'));
    pullChanges.mockResolvedValue({ pulled: 0, errors: ['rls denied'] });

    const r = await syncNow();

    expect(r.ok).toBe(false);
    expect(r.errors.length).toBe(2);
    expect(r.errors[0]).toMatch(/outbound: boom/);
    expect(r.errors[1]).toMatch(/rls denied/);
  });

  test('configured-signed-in but client missing → safe local-only message', async () => {
    getSyncMode.mockResolvedValue('configured-signed-in');
    getSupabaseClient.mockReturnValue(null);

    const r = await syncNow();

    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/client missing|local only/i);
    expect(pushPending).not.toHaveBeenCalled();
  });
});
