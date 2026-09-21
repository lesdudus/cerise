import { validDate } from './model.mjs';

export const THEME_KEY = 'cerise.themes.v1';
export const THEME_IDS = ['cerise', 'petrole', 'studio', 'matcha', 'cobalt', 'original'];

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function readThemeState(raw) {
  try {
    const state = JSON.parse(raw);
    if (state?.version !== 1 || typeof state.daily !== 'boolean' || !THEME_IDS.includes(state.current) || !validDate(state.date)) return null;
    if (!Array.isArray(state.remaining) || state.remaining.length > 5 || new Set(state.remaining).size !== state.remaining.length) return null;
    if (state.remaining.some(id => !THEME_IDS.includes(id) || id === state.current)) return null;
    return { version: 1, daily: state.daily, current: state.current, date: state.date, remaining: [...state.remaining] };
  } catch { return null; }
}

export function nextThemeDay(state, date, random = Math.random) {
  if (state && (!state.daily || date <= state.date)) return state;
  let remaining = state?.remaining.length ? [...state.remaining] : shuffled(THEME_IDS, random);
  if (!state?.remaining.length && remaining[0] === state?.current) {
    [remaining[0], remaining[1]] = [remaining[1], remaining[0]];
  }
  return { version: 1, daily: true, current: remaining.shift(), date, remaining };
}

export function selectTheme(state, current, date, random = Math.random) {
  if (!THEME_IDS.includes(current)) throw new Error('Unknown theme');
  return { version: 1, daily: state.daily, current, date, remaining: shuffled(THEME_IDS.filter(id => id !== current), random) };
}

export function createThemePreferences(storage, random = Math.random) {
  let cached = null;
  let unsaved = false;
  let previousRaw;
  const update = (date, change = state => state) => {
    let raw;
    let readable = true;
    try { raw = storage.getItem(THEME_KEY); }
    catch { readable = false; }
    const latest = !readable || (unsaved && raw === previousRaw) ? cached : readThemeState(raw);
    cached = change(nextThemeDay(latest, date, random));
    const serialized = JSON.stringify(cached);
    let persisted = readable && raw === serialized;
    if (!persisted) {
      try { storage.setItem(THEME_KEY, serialized); persisted = true; }
      catch { persisted = false; }
    }
    unsaved = !persisted;
    previousRaw = raw;
    return { state: cached, persisted };
  };
  return {
    refresh: date => update(date),
    select: (id, date) => update(date, state => selectTheme(state, id, date, random)),
    setDaily: (daily, date) => update(date, state => ({ ...state, daily, date })),
  };
}