import { initialState, MEALS, shiftDate, STORAGE_KEY, validateState } from './model.mjs';

export function previewState(date, populated = true) {
  const state = initialState();
  if (!populated) return state;
  const samples = [
    [[370, 26], [530, 37], [180, 14], [480, 36]],
    [[320, 23], [580, 41], [140, 12], [510, 35]],
    null,
    [[400, 28], [550, 38], [190, 16], [490, 34]],
    [[360, 25], [510, 36], [170, 13], [470, 35]],
    [[340, 24], [540, 39], [180, 15], [460, 34]],
    [[350, 22.5], [510, 35], [160, 12.5], [null, null]],
  ];
  samples.forEach((meals, index) => {
    if (!meals) return;
    state.days[shiftDate(date, index - samples.length + 1)] = Object.fromEntries(meals.map((values, mealIndex) => [MEALS[mealIndex].id, { calories: values[0], protein: values[1] }]));
  });
  return validateState(state);
}

export function createPreviewStorage(date) {
  let content = JSON.stringify(previewState(date));
  return {
    getItem(key) { return key === STORAGE_KEY ? content : null; },
    setItem(key, value) {
      if (key !== STORAGE_KEY) throw new Error('Clé inconnue dans l’aperçu.');
      content = value;
    },
  };
}