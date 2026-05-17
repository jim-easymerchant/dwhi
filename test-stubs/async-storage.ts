// Jest stub for @react-native-async-storage/async-storage. Real
// package needs a native module; smoke tests don't read/write storage.
const store: Record<string, string> = {};
const AsyncStorage = {
  getItem: async (key: string) => store[key] ?? null,
  setItem: async (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: async (key: string) => {
    delete store[key];
  },
  clear: async () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};
export default AsyncStorage;
