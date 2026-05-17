/**
 * Verifies the background task handler is bulletproof: never throws,
 * never logs raw coordinates, only inserts when shouldStoreLocation
 * agrees.
 */

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

const getLatestLocationEvent = jest.fn();
const insertLocationEvent = jest.fn();
jest.mock('@/repositories/locationEventRepository', () => ({
  getLatestLocationEvent: (...args: unknown[]) => getLatestLocationEvent(...args),
  insertLocationEvent: (...args: unknown[]) => insertLocationEvent(...args),
}));

import { handleLocationUpdate } from '../backgroundLocationTask';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleLocationUpdate', () => {
  test('does nothing when payload has no locations', async () => {
    await expect(
      handleLocationUpdate({ data: { locations: [] } }),
    ).resolves.toBeUndefined();
    expect(insertLocationEvent).not.toHaveBeenCalled();
  });

  test('does nothing when data is missing entirely', async () => {
    await expect(handleLocationUpdate({})).resolves.toBeUndefined();
    expect(insertLocationEvent).not.toHaveBeenCalled();
  });

  test('reports platform errors and returns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await handleLocationUpdate({ error: { message: 'gps off' } });
    expect(insertLocationEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('platform error'));
    warn.mockRestore();
  });

  test('first point ever is stored', async () => {
    getLatestLocationEvent.mockResolvedValue(null);
    insertLocationEvent.mockResolvedValue({});
    await handleLocationUpdate({
      data: {
        locations: [
          {
            coords: { latitude: 40, longitude: -74, accuracy: 50 },
            timestamp: Date.parse('2026-05-17T12:00:00Z'),
          },
        ],
      },
    });
    expect(insertLocationEvent).toHaveBeenCalledTimes(1);
    const arg = insertLocationEvent.mock.calls[0][0];
    expect(arg.source).toBe('background');
    expect(arg.capturedAt).toBe('2026-05-17T12:00:00.000Z');
  });

  test('drops sample with missing coords without throwing', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await handleLocationUpdate({
      data: { locations: [{ coords: { latitude: null, longitude: null } }] },
    });
    expect(insertLocationEvent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropping sample'));
    warn.mockRestore();
  });

  test('repository read failure is treated as no-previous and still tries to store', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getLatestLocationEvent.mockRejectedValue(new Error('boom'));
    insertLocationEvent.mockResolvedValue({});
    await handleLocationUpdate({
      data: {
        locations: [
          {
            coords: { latitude: 40, longitude: -74, accuracy: 50 },
            timestamp: Date.parse('2026-05-17T12:00:00Z'),
          },
        ],
      },
    });
    expect(insertLocationEvent).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('insert failure is swallowed; later samples still attempt to store', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getLatestLocationEvent.mockResolvedValue(null);
    insertLocationEvent
      .mockRejectedValueOnce(new Error('disk full'))
      .mockResolvedValueOnce({});
    await handleLocationUpdate({
      data: {
        locations: [
          {
            coords: { latitude: 40, longitude: -74, accuracy: 50 },
            timestamp: Date.parse('2026-05-17T12:00:00Z'),
          },
          {
            coords: { latitude: 41, longitude: -75, accuracy: 50 },
            timestamp: Date.parse('2026-05-17T12:00:30Z'),
          },
        ],
      },
    });
    expect(insertLocationEvent).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  test('skips storage when the decision says too-close', async () => {
    getLatestLocationEvent.mockResolvedValue({
      latitude: 40,
      longitude: -74,
      accuracy: 30,
      capturedAt: '2026-05-17T11:59:30Z',
    });
    await handleLocationUpdate({
      data: {
        locations: [
          {
            coords: { latitude: 40 + 0.00005, longitude: -74, accuracy: 30 },
            timestamp: Date.parse('2026-05-17T12:00:00Z'),
          },
        ],
      },
    });
    expect(insertLocationEvent).not.toHaveBeenCalled();
  });

  test('logs never contain raw coordinates', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getLatestLocationEvent.mockResolvedValue(null);
    insertLocationEvent.mockResolvedValue({});
    await handleLocationUpdate({
      data: {
        locations: [
          {
            coords: { latitude: 40.7128, longitude: -74.006, accuracy: 50 },
            timestamp: Date.parse('2026-05-17T12:00:00Z'),
          },
        ],
      },
    });
    const allCalls = [...log.mock.calls, ...warn.mock.calls].flat().map(String);
    for (const line of allCalls) {
      expect(line).not.toContain('40.7128');
      expect(line).not.toContain('-74.006');
    }
    log.mockRestore();
    warn.mockRestore();
  });

  test('outer try/catch keeps the task alive even when handler itself crashes', async () => {
    // Force shouldStoreLocation to throw by handing it data that causes
    // an unexpected path: make the latest-event read return a value
    // whose property access surfaces a getter that throws.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    getLatestLocationEvent.mockResolvedValue({
      get latitude(): number {
        throw new Error('boom');
      },
      longitude: -74,
      accuracy: 20,
      capturedAt: '2026-05-17T11:59:00Z',
    } as unknown as null);
    insertLocationEvent.mockResolvedValue({});

    await expect(
      handleLocationUpdate({
        data: {
          locations: [
            {
              coords: { latitude: 40, longitude: -74, accuracy: 50 },
              timestamp: Date.parse('2026-05-17T12:00:00Z'),
            },
          ],
        },
      }),
    ).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
