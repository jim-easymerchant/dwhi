/**
 * Verifies that copyToClipboard delegates to expo-clipboard, never
 * throws, never leaks the copied value into logs, and produces a
 * structured result the UI can branch on.
 */

const setStringAsync = jest.fn();
jest.mock('expo-clipboard', () => ({
  setStringAsync: (...args: unknown[]) => setStringAsync(...args),
}));

import { copyToClipboard } from '../clipboardService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('copyToClipboard', () => {
  test('refuses empty input without hitting the native module', async () => {
    const r = await copyToClipboard('', 'invite-code');
    expect(r.ok).toBe(false);
    expect(setStringAsync).not.toHaveBeenCalled();
  });

  test('passes the exact value through to expo-clipboard', async () => {
    setStringAsync.mockResolvedValue(undefined);
    const r = await copyToClipboard('ABC123DEF456', 'invite-code');
    expect(r.ok).toBe(true);
    expect(setStringAsync).toHaveBeenCalledTimes(1);
    expect(setStringAsync).toHaveBeenCalledWith('ABC123DEF456');
  });

  test('returns ok:false with a message when the native call rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setStringAsync.mockRejectedValue(new Error('Clipboard access denied'));
    const r = await copyToClipboard('ABC123DEF456', 'invite-code');
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Clipboard access denied');
    warn.mockRestore();
  });

  test('logs the tag and the length but never the value', async () => {
    const logs: string[] = [];
    const log = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.map(String).join(' '));
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      logs.push(args.map(String).join(' '));
    });
    setStringAsync.mockResolvedValue(undefined);
    await copyToClipboard('TOPSECRETCODE', 'invite-code');
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain('TOPSECRETCODE');
    }
    // And the log line includes both the tag and the length so the
    // diagnostic is still useful.
    const diag = logs.find(l => l.includes('invite-code'));
    expect(diag).toBeDefined();
    expect(diag).toContain('length=13');
    log.mockRestore();
    warn.mockRestore();
  });

  test('never throws even when the failure is logged', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setStringAsync.mockRejectedValue('weird non-error');
    await expect(copyToClipboard('ABC', 'invite-code')).resolves.toMatchObject({
      ok: false,
    });
    warn.mockRestore();
  });
});
