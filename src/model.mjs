export const MEALS = [
  { id: 'breakfast', label: 'Petit-déjeuner', icon: 'sunrise', time: 'Le matin' },
  { id: 'lunch', label: 'Déjeuner', icon: 'sun', time: 'À la mi-journée' },
  { id: 'snack', label: 'Collation', icon: 'apple', time: 'La petite pause' },
  { id: 'dinner', label: 'Dîner', icon: 'moon', time: 'Le soir' },
];
export const METRICS = ['calories', 'protein'];
export const STORAGE_KEY = 'cerise.journal.v1';
export const BASE_DATE = '1970-01-01';

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < BASE_DATE) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDate(new Date(year, month - 1, day, 12)) === value;
}

export function shiftDate(value, offset) {
  const [year, month, day] = value.split('-').map(Number);
  return localDate(new Date(year, month - 1, day + offset, 12));
}

export function initialState() {
  return { version: 1, days: {}, targets: [{ from: BASE_DATE, calories: 1500, protein: 115 }] };
}

export function parseAmount(raw) {
  if (raw.trim() === '') return null;
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Saisis un nombre positif, avec deux décimales maximum.');
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount > 1000000) throw new Error('Ce nombre est trop grand.');
  return amount;
}

function validAmount(value, nullable = true) {
  return (nullable && value === null) || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateState(input) {
  const invalid = () => { throw new Error('Sauvegarde Cerise invalide ou incompatible. Aucune donnée n’a été remplacée.'); };
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.days) || !Array.isArray(input.targets) || !input.targets.length) invalid();
  const clean = { version: 1, days: {}, targets: [] };
  for (const [date, meals] of Object.entries(input.days)) {
    if (!validDate(date) || !isRecord(meals)) invalid();
    const day = {};
    for (const [meal, values] of Object.entries(meals)) {
      if (!MEALS.some(item => item.id === meal) || !isRecord(values)) invalid();
      if (!METRICS.every(metric => validAmount(values[metric]))) invalid();
      if (values.calories !== null || values.protein !== null) day[meal] = { calories: values.calories, protein: values.protein };
    }
    if (Object.keys(day).length) clean.days[date] = day;
  }
  const dates = new Set();
  for (const target of input.targets) {
    if (!isRecord(target) || !validDate(target.from) || dates.has(target.from)) invalid();
    if (!METRICS.every(metric => validAmount(target[metric], false) && target[metric] > 0)) invalid();
    dates.add(target.from);
    clean.targets.push({ from: target.from, calories: target.calories, protein: target.protein });
  }
  clean.targets.sort((first, second) => first.from.localeCompare(second.from));
  if (clean.targets[0].from !== BASE_DATE) invalid();
  return clean;
}

export function importState(text) {
  if (text.length > 5 * 1024 * 1024) throw new Error('Le fichier dépasse 5 Mo.');
  try { return validateState(JSON.parse(text)); }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error('Ce fichier n’est pas un JSON valide.');
    throw error;
  }
}

export function setEntry(state, date, meal, metric, value) {
  if (!validDate(date) || !MEALS.some(item => item.id === meal) || !METRICS.includes(metric) || !validAmount(value)) throw new Error('Saisie invalide.');
  const next = structuredClone(state);
  next.days[date] ??= {};
  next.days[date][meal] ??= { calories: null, protein: null };
  next.days[date][meal][metric] = value;
  if (METRICS.every(key => next.days[date][meal][key] === null)) delete next.days[date][meal];
  if (!Object.keys(next.days[date]).length) delete next.days[date];
  return next;
}

export function targetsFor(state, date) {
  return state.targets.findLast(target => target.from <= date) ?? state.targets[0];
}

export function setTargets(state, date, calories, protein) {
  const next = structuredClone(state);
  next.targets = next.targets.filter(target => target.from !== date);
  next.targets.push({ from: date, calories, protein });
  return validateState(next);
}

export function daySummary(state, date) {
  const day = state.days[date] ?? {};
  const summary = {};
  for (const metric of METRICS) {
    const values = MEALS.map(meal => day[meal.id]?.[metric]).filter(value => typeof value === 'number');
    summary[metric] = { total: values.length ? Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100 : null, count: values.length };
  }
  return summary;
}

export function periodSummary(state, endDate, length) {
  const days = Array.from({ length }, (_, index) => {
    const date = shiftDate(endDate, index - length + 1);
    return { date, ...daySummary(state, date), targets: targetsFor(state, date) };
  });
  const metrics = {};
  for (const metric of METRICS) {
    const logged = days.filter(day => day[metric].total !== null);
    metrics[metric] = {
      average: logged.length ? logged.reduce((total, day) => total + day[metric].total, 0) / logged.length : null,
      logged: logged.length,
      partial: logged.filter(day => day[metric].count < MEALS.length).length,
      byMeal: MEALS.map(meal => {
        const values = days.map(day => state.days[day.date]?.[meal.id]?.[metric]).filter(value => typeof value === 'number');
        return { meal: meal.id, total: values.length ? values.reduce((total, value) => total + value, 0) : null };
      }),
    };
  }
  return { days, metrics, loggedDays: days.filter(day => METRICS.some(metric => day[metric].total !== null)).length };
}

export function createRepository(storage) {
  return {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      return raw === null ? initialState() : importState(raw);
    },
    save(state) {
      const clean = validateState(state);
      storage.setItem(STORAGE_KEY, JSON.stringify(clean));
      return clean;
    },
    update(change) { return this.save(change(this.load())); },
  };
}