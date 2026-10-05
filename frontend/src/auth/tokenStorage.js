import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@diplomado/auth-tokens-v1';

export async function saveTokens(tokens = {}) {
  const access = tokens.access || null;
  const refresh = tokens.refresh || null;
  if (!access || !refresh) {
    await clearTokens();
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ access, refresh }));
}

export async function loadTokens() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.access || !parsed?.refresh) {
      await clearTokens();
      return null;
    }
    return { access: parsed.access, refresh: parsed.refresh };
  } catch {
    await clearTokens();
    return null;
  }
}

export async function clearTokens() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
