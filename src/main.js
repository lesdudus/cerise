import './style.css';
import cherryPhoto from './assets/cherries.jpg';
import { createIcons, Cherry, Sunrise, Sun, Apple, Moon, ChevronLeft, ChevronRight, CalendarDays, Settings2, X, Download, Upload, Check, Sparkles, Heart, ArrowUpRight, ChartNoAxesCombined, NotebookPen, History, ArrowLeft, RotateCw, ShieldCheck } from 'lucide';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip } from 'chart.js';
import { MEALS, STORAGE_KEY, localDate, shiftDate, validDate, initialState, parseAmount, setEntry, setTargets, targetsFor, daySummary, periodSummary, importState, createRepository } from './model.mjs';
import { messageFor } from './messages.mjs';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip);
const icons = { Cherry, Sunrise, Sun, Apple, Moon, ChevronLeft, ChevronRight, CalendarDays, Settings2, X, Download, Upload, Check, Sparkles, Heart, ArrowUpRight, ChartNoAxesCombined, NotebookPen, History, ArrowLeft, RotateCw, ShieldCheck };
const icon = name => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const number = value => value === null ? '–' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dateLabel = (date, options = { day: 'numeric', month: 'long' }) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', options);
const repository = createRepository({ getItem: key => window.localStorage.getItem(key), setItem: (key, value) => window.localStorage.setItem(key, value) });
let state = initialState();
let blocked = false;
let pending = [];
let selectedDate = localDate();
let today = selectedDate;
let view = 'today';
let historyMonth = today.slice(0, 7);
let duration = 7;
let metric = 'calories';
let chart;
let status = 'Sur cet appareil';
let announcementTimer;
try { state = repository.load(); }
catch { blocked = true; }

document.querySelector('#app').innerHTML = `
  <a class="skip-link" href="#main">Aller au journal</a>
  <header class="site-header"><div class="header-inner">
    <a class="brand" href="#" aria-label="Cerise, accueil">${icon('cherry')}<span>cerise<span class="brand-dot">.</span></span></a>
    <nav aria-label="Navigation principale">
      <button data-view="today" aria-current="page">${icon('notebook-pen')}<span>Aujourd’hui</span></button>
      <button data-view="history">${icon('history')}<span>Historique</span></button>
      <button data-view="trends">${icon('chart-no-axes-combined')}<span>Tendances</span></button>
    </nav>
    <button id="open-settings" class="icon-button" aria-label="Paramètres" title="Paramètres">${icon('settings-2')}</button>
  </div></header>
  <div class="page-wrap">
    <div id="storage-warning" role="alert" ${blocked ? '' : 'hidden'}>Les données de cet appareil sont illisibles ou inaccessibles. Elles n’ont pas été écrasées. Ouvre les paramètres pour exporter ou restaurer une sauvegarde.</div>
    <main id="main" tabindex="-1"></main>
    <footer class="page-footer"><span>${icon('heart')} À ton rythme. Toujours.</span><span id="save-status">${icon('shield-check')} Sur cet appareil</span><button id="retry-save" class="text-button" hidden>${icon('rotate-cw')} Réessayer</button></footer>
  </div>
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>
  <dialog id="settings-dialog" aria-labelledby="settings-title">
    <div class="dialog-header"><div><p class="eyebrow">À TA MESURE</p><h2 id="settings-title">Tes paramètres</h2></div><button class="icon-button" id="close-settings" aria-label="Fermer les paramètres" title="Fermer">${icon('x')}</button></div>
    <form id="targets-form" novalidate>
      <h3>Objectifs quotidiens</h3><p class="muted">Applicables à partir d’aujourd’hui. Ton historique garde ses objectifs.</p>
      <div class="settings-fields"><label>Calories<span class="input-wrap"><input id="target-calories" name="calories" inputmode="decimal" autocomplete="off" required aria-describedby="targets-error"><span>kcal</span></span></label><label>Protéines<span class="input-wrap"><input id="target-protein" name="protein" inputmode="decimal" autocomplete="off" required aria-describedby="targets-error"><span>g</span></span></label></div>
      <p id="targets-error" class="field-error" role="alert"></p><button type="submit" class="primary-button">${icon('check')} Enregistrer les objectifs</button>
    </form>
    <section class="backup-section"><h3>Ton historique, à garder</h3><div class="backup-actions"><button id="export-data" class="secondary-button">${icon('download')} Exporter</button><button id="import-data" class="secondary-button">${icon('upload')} Importer</button><input type="file" id="backup-file" accept=".json,application/json" hidden></div><p class="muted">Données enregistrées uniquement dans ce navigateur, sans synchronisation. Une sauvegarde les protège si tu effaces les données du navigateur.</p></section>
    <p id="settings-status" role="status"></p>
    <div class="dialog-note">${icon('shield-check')} <span>Ton journal n’est pas publié sur GitHub.</span></div>
  </dialog>`;

const main = document.querySelector('#main');
const dialog = document.querySelector('#settings-dialog');
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.7 } });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function announce(message) {
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { document.querySelector('#announcement').textContent = message; }, 450);
}

function updateSaveStatus() {
  document.querySelector('#save-status').innerHTML = `${icon(pending.length ? 'rotate-cw' : 'shield-check')} ${escape(status)}`;
  document.querySelector('#retry-save').hidden = !pending.length;
  refreshIcons();
}

function commit(change) {
  if (blocked) return false;
  if (change) { state = change(state); pending.push(change); }
  try {
    state = repository.update(latest => pending.reduce((current, update) => update(current), latest));
    pending = [];
    status = 'Enregistré sur cet appareil';
    document.querySelector('#storage-warning').hidden = true;
    announce(status);
    updateSaveStatus();
    return true;
  } catch {
    status = 'Non enregistré';
    const warning = document.querySelector('#storage-warning');
    warning.textContent = 'Enregistrement impossible. Garde cette page ouverte : réessaie ou exporte ton journal dans les paramètres avant de quitter.';
    warning.hidden = false;
    updateSaveStatus();
    return false;
  }
}

function canNavigate() {
  const invalid = main.querySelector('[aria-invalid="true"]');
  if (!invalid) return true;
  invalid.focus();
  announce('Corrige ou efface cette valeur avant de changer de vue.');
  return false;
}

function dateControls() {
  return `<div class="date-controls"><button class="icon-button" data-date-offset="-1" aria-label="Jour précédent" title="Jour précédent" ${selectedDate === '1970-01-01' ? 'disabled' : ''}>${icon('chevron-left')}</button><label class="date-picker">${icon('calendar-days')}<span>${dateLabel(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })}</span><input id="journal-date" type="date" value="${selectedDate}" min="1970-01-01" max="${today}" aria-label="Choisir une date"></label><button class="icon-button" data-date-offset="1" aria-label="Jour suivant" title="Jour suivant" ${selectedDate >= today ? 'disabled' : ''}>${icon('chevron-right')}</button></div>`;
}

function summaryMarkup() {
  const summary = daySummary(state, selectedDate);
  const targets = targetsFor(state, selectedDate);
  return ['calories', 'protein'].map(key => {
    const { total, count } = summary[key];
    const target = targets[key];
    const unit = key === 'calories' ? 'kcal' : 'g';
    const difference = total === null ? null : Math.round((target - total) * 100) / 100;
    const caption = difference === null ? 'Pas encore de saisie' : difference >= 0 ? `${number(difference)} ${unit} jusqu’à l’objectif` : `${number(-difference)} ${unit} au-dessus du repère`;
    return `<section class="metric-card ${key}" aria-label="${key === 'calories' ? 'Calories' : 'Protéines'}"><div class="metric-label"><span class="metric-dot"></span>${key === 'calories' ? 'Calories' : 'Protéines'}<span class="target-label">objectif ${number(target)} ${unit}</span></div><div class="metric-total"><strong>${number(total)}</strong><span>${unit}</span></div><div class="progress-track" role="meter" aria-label="${key === 'calories' ? 'Calories' : 'Protéines'} enregistrées" aria-valuemin="0" aria-valuemax="${Math.max(target, total ?? 0)}" aria-valuenow="${total ?? 0}" aria-valuetext="${total === null ? 'Aucune saisie' : `${number(total)} sur ${number(target)} ${unit}, ${count} repas renseignés`}"><span style="width:${Math.min(100, ((total ?? 0) / target) * 100)}%"></span></div><p class="metric-caption">${caption}</p><p class="metric-completeness">${count}/4 repas renseignés${count > 0 && count < 4 ? ' · total partiel' : ''}</p></section>`;
  }).join('');
}

function mealMarkup(meal, index) {
  const values = state.days[selectedDate]?.[meal.id];
  return `<fieldset class="meal-row"><legend class="sr-only">${meal.label}</legend><div class="meal-name"><span class="meal-icon meal-${index}">${icon(meal.icon)}</span><div><h3>${meal.label}</h3><p>${meal.time}</p></div></div><div class="meal-fields">${['calories', 'protein'].map(key => {
    const fieldId = `${meal.id}-${key}`;
    const value = values?.[key];
    return `<div class="field"><label for="${fieldId}">${key === 'calories' ? 'Calories' : 'Protéines'}</label><span class="input-wrap"><input id="${fieldId}" data-meal="${meal.id}" data-metric="${key}" inputmode="decimal" autocomplete="off" maxlength="12" value="${value === null || value === undefined ? '' : String(value).replace('.', ',')}" placeholder="–" aria-describedby="${fieldId}-error" ${blocked ? 'disabled' : ''}><span>${key === 'calories' ? 'kcal' : 'g'}</span></span><span id="${fieldId}-error" class="field-error"></span></div>`;
  }).join('')}</div></fieldset>`;
}

function renderToday() {
  const isToday = selectedDate === today;
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">${isToday ? 'TON PETIT RENDEZ-VOUS QUOTIDIEN' : dateLabel(selectedDate, { weekday: 'long' }).toLocaleUpperCase('fr-FR')}</p><h1>${isToday ? 'Une journée à toi.' : dateLabel(selectedDate)}</h1></div>${dateControls()}</div>
    ${!isToday ? `<button class="text-button return-today" data-action="return-today">${icon('arrow-left')} Revenir à aujourd’hui</button>` : ''}
    <div class="journal-layout"><section class="meals-section" aria-labelledby="meals-title"><div class="section-heading"><h2 id="meals-title">Au fil des repas<span class="small-dot">.</span></h2><span class="subtle-label">${dateLabel(selectedDate, { weekday: 'long' })}</span></div><form id="meals-form" novalidate>${MEALS.map(mealMarkup).join('')}</form></section>
    <aside class="day-aside"><div class="section-heading"><h2>Le point du jour</h2><span class="small-tag">${isToday ? 'Aujourd’hui' : dateLabel(selectedDate)}</span></div><div id="day-summary" class="day-summary">${summaryMarkup()}</div>
    <section class="daily-note" aria-label="La pensée du jour"><p class="eyebrow">${icon('sparkles')} LA TOUCHE CERISE</p><div class="quote-layout"><blockquote>${escape(messageFor(today))}</blockquote><img src="${cherryPhoto}" alt="Deux cerises rouges" width="800" height="532"></div><p class="note-signature">Un peu de suivi. Beaucoup de douceur.</p></section></aside></div>`;
  main.querySelector('#meals-form').addEventListener('submit', event => event.preventDefault());
  main.querySelectorAll('[data-meal]').forEach(input => {
    input.addEventListener('input', () => {
      try {
        const amount = parseAmount(input.value);
        input.removeAttribute('aria-invalid');
        document.getElementById(`${input.id}-error`).textContent = '';
        const date = selectedDate;
        const meal = input.dataset.meal;
        const key = input.dataset.metric;
        commit(current => setEntry(current, date, meal, key, amount));
        main.querySelector('#day-summary').innerHTML = summaryMarkup();
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        document.getElementById(`${input.id}-error`).textContent = error.message;
      }
    });
    input.addEventListener('blur', () => {
      if (!input.hasAttribute('aria-invalid') && input.value.trim()) input.value = String(parseAmount(input.value)).replace('.', ',');
    });
  });
  main.querySelector('#journal-date').addEventListener('change', event => {
    if (validDate(event.target.value) && event.target.value <= today && canNavigate()) { selectedDate = event.target.value; render(); }
    else event.target.value = selectedDate;
  });
}

function renderHistory() {
  const dates = Object.keys(state.days).filter(date => date.startsWith(historyMonth)).sort().reverse();
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">LES JOURS QUI COMPTENT</p><h1>Ton histoire, au fil des jours.</h1></div><label class="month-picker">${icon('calendar-days')}<input type="month" id="history-month" value="${historyMonth}" min="1970-01" max="${today.slice(0, 7)}" aria-label="Mois de l’historique"></label></div>
    <div class="section-heading"><h2>${dateLabel(`${historyMonth}-01`, { month: 'long', year: 'numeric' })}</h2><span class="subtle-label">${dates.length} journée${dates.length > 1 ? 's' : ''} renseignée${dates.length > 1 ? 's' : ''}</span></div>
    ${dates.length ? `<div class="history-list">${dates.map(date => {
      const summary = daySummary(state, date);
      return `<button class="history-row" data-open-date="${date}" aria-label="Ouvrir le ${dateLabel(date)}"><span class="history-date"><strong>${dateLabel(date, { day: 'numeric' })}</strong><span>${dateLabel(date, { weekday: 'long', month: 'long' })}</span></span><span class="history-value"><strong>${number(summary.calories.total)} <small>kcal</small></strong><span>${summary.calories.count}/4 repas</span></span><span class="history-value protein-text"><strong>${number(summary.protein.total)} <small>g</small></strong><span>${summary.protein.count}/4 repas</span></span>${icon('arrow-up-right')}</button>`;
    }).join('')}</div>` : `<section class="empty-state">${icon('notebook-pen')}<h2>Une page encore blanche.</h2><p>Aucune saisie pour ce mois-ci.</p><button class="primary-button" data-action="return-today">Ouvrir le journal ${icon('arrow-up-right')}</button></section>`}`;
  main.querySelector('#history-month').addEventListener('change', event => {
    if (/^\d{4}-\d{2}$/.test(event.target.value) && validDate(`${event.target.value}-01`) && event.target.value <= today.slice(0, 7)) { historyMonth = event.target.value; render(); }
  });
}

function renderTrends() {
  const period = periodSummary(state, today, duration);
  const details = period.metrics[metric];
  const hasData = details.logged > 0;
  main.innerHTML = `<div class="page-heading"><div><p class="eyebrow">UN PEU DE RECUL</p><h1>La vue d’ensemble.</h1></div><div class="segmented" aria-label="Période">${[7, 30].map(days => `<button data-duration="${days}" aria-pressed="${duration === days}">${days} jours</button>`).join('')}</div></div>
    <p class="period-label">Du ${dateLabel(period.days[0].date)} au ${dateLabel(today, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <div class="trend-kpis"><section><span>Calories moyennes</span><strong>${number(period.metrics.calories.average)} <small>kcal / jour</small></strong><p>${period.metrics.calories.logged} jour(s) saisi(s), dont ${period.metrics.calories.partial} partiel(s)</p></section><section><span>Protéines moyennes</span><strong class="protein-text">${number(period.metrics.protein.average)} <small>g / jour</small></strong><p>${period.metrics.protein.logged} jour(s) saisi(s), dont ${period.metrics.protein.partial} partiel(s)</p></section><section><span>Journées renseignées</span><strong>${period.loggedDays} <small>/ ${duration}</small></strong><p>Chaque petit rendez-vous compte.</p></section></div>
    <section class="chart-section"><div class="section-heading"><h2>Les apports enregistrés</h2><div class="segmented metric-switch" aria-label="Indicateur"><button data-metric-view="calories" aria-pressed="${metric === 'calories'}">Calories</button><button data-metric-view="protein" aria-pressed="${metric === 'protein'}">Protéines</button></div></div>
    ${hasData ? `<div class="chart-legend"><span><i class="legend-solid ${metric}"></i>Apports saisis</span><span><i class="legend-dashed"></i>Objectif du jour</span></div><div class="chart-wrap"><canvas id="trend-chart" role="img" aria-label="Évolution des ${metric === 'calories' ? 'calories' : 'protéines'} sur ${duration} jours. Valeurs disponibles dans le tableau ci-dessous."></canvas></div>` : `<div class="empty-state chart-empty">${icon('chart-no-axes-combined')}<h3>Les tendances prendront forme ici.</h3><p>Aucune donnée pour cet indicateur sur cette période.</p></div>`}
    <details class="data-details"><summary>Les chiffres, jour par jour</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Détail quotidien des apports"><table><caption>Totaux saisis ; jours non renseignés exclus des moyennes.</caption><thead><tr><th scope="col">Date</th><th scope="col">Calories</th><th scope="col">Protéines</th></tr></thead><tbody>${[...period.days].reverse().map(day => `<tr><th scope="row">${dateLabel(day.date)}</th><td>${number(day.calories.total)} kcal <small>${day.calories.count}/4 repas</small></td><td>${number(day.protein.total)} g <small>${day.protein.count}/4 repas</small></td></tr>`).join('')}</tbody></table></div></details></section>
    <section class="meal-breakdown"><div class="section-heading"><h2>Au fil des repas</h2><span class="subtle-label">Total sur ${duration} jours · ${metric === 'calories' ? 'kcal' : 'g'}</span></div><div class="breakdown-grid">${details.byMeal.map((item, index) => `<div><span class="meal-icon meal-${index}">${icon(MEALS[index].icon)}</span><span>${MEALS[index].label}</span><strong>${number(item.total)}</strong></div>`).join('')}</div></section>`;
  if (hasData) {
    const styles = getComputedStyle(document.documentElement);
    const color = styles.getPropertyValue(metric === 'calories' ? '--cp-accent' : '--cp-link').trim();
    const muted = styles.getPropertyValue('--cp-text-muted').trim();
    const border = styles.getPropertyValue('--cp-border').trim();
    chart = new Chart(main.querySelector('#trend-chart'), {
      type: 'line',
      data: { labels: period.days.map(day => dateLabel(day.date, { day: 'numeric', month: 'short' })), datasets: [
        { label: metric === 'calories' ? 'Calories saisies' : 'Protéines saisies', data: period.days.map(day => day[metric].total), borderColor: color, backgroundColor: color, borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, tension: 0.2, spanGaps: false },
        { label: 'Objectif du jour', data: period.days.map(day => day.targets[metric]), borderColor: muted, borderDash: [5, 5], borderWidth: 1, pointRadius: 0, stepped: true },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: reducedMotion ? false : { duration: 350 }, locale: 'fr-FR', interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { label: context => `${context.dataset.label} : ${number(context.raw)} ${metric === 'calories' ? 'kcal' : 'g'}${context.datasetIndex === 0 ? ` (${period.days[context.dataIndex][metric].count}/4 repas)` : ''}` } } }, scales: { x: { grid: { display: false }, ticks: { color: muted, maxTicksLimit: 7, maxRotation: 0 }, border: { display: false } }, y: { beginAtZero: true, grid: { color: border }, ticks: { color: muted, maxTicksLimit: 5 }, border: { display: false } } } },
    });
  }
}

function render() {
  chart?.destroy();
  chart = undefined;
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (view === 'today') renderToday();
  else if (view === 'history') renderHistory();
  else renderTrends();
  refreshIcons();
}

document.querySelector('.brand').addEventListener('click', event => {
  event.preventDefault();
  if (canNavigate()) { selectedDate = today; view = 'today'; render(); }
});
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  if (!canNavigate()) return;
  view = button.dataset.view;
  if (view === 'today') selectedDate = today;
  render();
}));
main.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button || !canNavigate()) return;
  if (button.dataset.dateOffset) selectedDate = shiftDate(selectedDate, Number(button.dataset.dateOffset));
  else if (button.dataset.action === 'return-today') { selectedDate = today; view = 'today'; }
  else if (button.dataset.openDate) { selectedDate = button.dataset.openDate; view = 'today'; }
  else if (button.dataset.duration) duration = Number(button.dataset.duration);
  else if (button.dataset.metricView) metric = button.dataset.metricView;
  else return;
  const focusAttribute = button.dataset.dateOffset ? ['data-date-offset', button.dataset.dateOffset] : button.dataset.duration ? ['data-duration', button.dataset.duration] : button.dataset.metricView ? ['data-metric-view', button.dataset.metricView] : null;
  render();
  if (focusAttribute) main.querySelector(`[${focusAttribute[0]}="${focusAttribute[1]}"]`)?.focus({ preventScroll: true });
  else main.focus({ preventScroll: true });
});

document.querySelector('#open-settings').addEventListener('click', () => {
  const targets = targetsFor(state, today);
  document.querySelector('#target-calories').value = String(targets.calories).replace('.', ',');
  document.querySelector('#target-protein').value = String(targets.protein).replace('.', ',');
  document.querySelector('#targets-error').textContent = '';
  document.querySelector('#settings-status').textContent = '';
  document.querySelector('#targets-form button').disabled = blocked;
  dialog.showModal();
});
document.querySelector('#close-settings').addEventListener('click', () => dialog.close());
document.querySelector('#targets-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const calories = parseAmount(document.querySelector('#target-calories').value);
    const protein = parseAmount(document.querySelector('#target-protein').value);
    if (!(calories > 0) || !(protein > 0)) throw new Error('Indique deux objectifs supérieurs à zéro.');
    const effectiveDate = today;
    const saved = commit(current => setTargets(current, effectiveDate, calories, protein));
    document.querySelector('#targets-error').textContent = '';
    document.querySelector('#settings-status').textContent = saved ? 'Tes objectifs sont enregistrés pour aujourd’hui et les jours suivants.' : 'Enregistrement impossible. Réessaie avant de quitter.';
    if (canNavigate()) render();
  } catch (error) { document.querySelector('#targets-error').textContent = error.message; }
});

document.querySelector('#retry-save').addEventListener('click', () => { commit(); if (canNavigate()) render(); });
document.querySelector('#export-data').addEventListener('click', () => {
  try {
    const content = blocked ? window.localStorage.getItem(STORAGE_KEY) : JSON.stringify(state, null, 2);
    if (!content) throw new Error('Aucune donnée accessible à exporter.');
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cerise-${today}${blocked ? '-original' : ''}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.querySelector('#settings-status').textContent = 'Sauvegarde téléchargée. Garde-la dans un endroit sûr.';
  } catch (error) { document.querySelector('#settings-status').textContent = error.message; }
});
document.querySelector('#import-data').addEventListener('click', () => document.querySelector('#backup-file').click());
document.querySelector('#backup-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Le fichier dépasse 5 Mo.');
    const imported = importState(await file.text());
    const count = Object.keys(imported.days).length;
    if (!window.confirm(`Remplacer tout le journal de ce navigateur par cette sauvegarde (${count} journée(s)) ? Les données actuelles, y compris les saisies non enregistrées, seront remplacées. Exporte-les d’abord si tu souhaites les conserver.`)) return;
    const saved = repository.save(imported);
    state = saved;
    pending = [];
    blocked = false;
    status = 'Sauvegarde restaurée';
    document.querySelector('#storage-warning').hidden = true;
    document.querySelector('#targets-form button').disabled = false;
    const targets = targetsFor(state, today);
    document.querySelector('#target-calories').value = String(targets.calories).replace('.', ',');
    document.querySelector('#target-protein').value = String(targets.protein).replace('.', ',');
    document.querySelector('#settings-status').textContent = `${count} journée(s) restaurée(s).`;
    render();
    updateSaveStatus();
  } catch (error) { document.querySelector('#settings-status').textContent = `Import impossible : ${error.message}`; }
  finally { event.target.value = ''; }
});

window.addEventListener('beforeunload', event => {
  if (pending.length || main.querySelector('[aria-invalid="true"]')) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || pending.length || main.querySelector('[aria-invalid="true"]')) return;
  try { state = repository.load(); render(); }
  catch { announce('Les données ont changé dans un autre onglet et ne peuvent pas être lues.'); }
});
function checkNewDay() {
  const next = localDate();
  if (next === today) return;
  const wasToday = selectedDate === today;
  today = next;
  if (wasToday && !main.querySelector('[aria-invalid="true"]')) selectedDate = next;
  if (!main.querySelector('[aria-invalid="true"]')) render();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
window.addEventListener('focus', checkNewDay);
setInterval(checkNewDay, 30000);
render();