import { MEALS, METRICS, validateState } from './model.mjs';

export function sameState(first, second) {
  return JSON.stringify(canonical(first)) === JSON.stringify(canonical(second));
}

function canonical(state) {
  const clean = validateState(state);
  return {
    ...clean,
    days: Object.fromEntries(Object.keys(clean.days).sort().map(date => [date,
      Object.fromEntries(MEALS.filter(meal => clean.days[date][meal.id]).map(meal => [meal.id, clean.days[date][meal.id]])),
    ])),
  };
}

export function mergeJournal(base, local, remote) {
  base = validateState(base);
  local = validateState(local);
  remote = validateState(remote);
  const conflicts = [];
  const choose = (before, here, there, key) => {
    if (JSON.stringify(here) === JSON.stringify(before)) return there;
    if (JSON.stringify(there) === JSON.stringify(before) || JSON.stringify(here) === JSON.stringify(there)) return here;
    conflicts.push(key);
    return here;
  };
  const state = { version: 1, days: {}, targets: [] };
  const dates = new Set([...Object.keys(base.days), ...Object.keys(local.days), ...Object.keys(remote.days)]);
  for (const date of dates) {
    const day = {};
    for (const { id } of MEALS) {
      const values = Object.fromEntries(METRICS.map(metric => [metric, choose(
        base.days[date]?.[id]?.[metric] ?? null,
        local.days[date]?.[id]?.[metric] ?? null,
        remote.days[date]?.[id]?.[metric] ?? null,
        `${date}/${id}/${metric}`,
      )]));
      if (METRICS.some(metric => values[metric] !== null)) day[id] = values;
    }
    if (Object.keys(day).length) state.days[date] = day;
  }
  const targetDates = new Set([...base.targets, ...local.targets, ...remote.targets].map(target => target.from));
  for (const date of targetDates) {
    const target = choose(
      base.targets.find(item => item.from === date) ?? null,
      local.targets.find(item => item.from === date) ?? null,
      remote.targets.find(item => item.from === date) ?? null,
      `${date}/targets`,
    );
    if (target) state.targets.push(target);
  }
  return { state: validateState(state), conflicts };
}