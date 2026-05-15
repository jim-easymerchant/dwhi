import { manualFallbackSpeechService } from '../manualFallbackSpeechService';
import { selectSpeechService } from '../speechService';

describe('manualFallbackSpeechService', () => {
  test('reports itself as manual + always available', () => {
    expect(manualFallbackSpeechService.kind).toBe('manual');
    expect(manualFallbackSpeechService.isAvailable()).toBe(true);
  });

  test('requestPermission resolves true (no real OS prompt)', async () => {
    expect(await manualFallbackSpeechService.requestPermission()).toBe(true);
  });

  test('start() rejects with an unsupported error', async () => {
    let caught: unknown = null;
    try {
      await manualFallbackSpeechService.start({
        onFinal: () => {},
        onError: () => {},
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).not.toBeNull();
    expect((caught as { code?: string }).code).toBe('unsupported');
  });

  test('describeMode returns a user-facing hint', () => {
    expect(manualFallbackSpeechService.describeMode()).toMatch(/unavailable|type/i);
  });
});

describe('selectSpeechService', () => {
  test('in the Jest env (no native binary), selects the manual fallback', () => {
    const svc = selectSpeechService();
    expect(svc.kind).toBe('manual');
    expect(svc).toBe(manualFallbackSpeechService);
  });
});
