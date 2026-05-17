// Jest stub for expo-task-manager. The native module can't load
// outside a real RN runtime. Tests that exercise task registration
// mock this directly with jest.mock('expo-task-manager', ...).
export function defineTask(_name: string, _task: (...args: unknown[]) => unknown): void {
  // no-op
}

export function isTaskDefined(_name: string): boolean {
  return false;
}

export function unregisterTaskAsync(_name: string): Promise<void> {
  return Promise.resolve();
}
