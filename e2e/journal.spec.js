import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { initialState, setEntry, STORAGE_KEY } from '../src/model.mjs';

const currentDay = '2026-09-21';
const storage = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const upload = (page, content) => page.locator('#backup-file').setInputFiles({ name: 'sauvegarde.json', mimeType: 'application/json', buffer: Buffer.from(content) });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T12:00:00+02:00') });
});

test('Saisies facultatives, décimales, persistance et historique', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-meal]')).toHaveCount(8);
  await expect(page.locator('.calories .metric-total strong')).toHaveText('–');
  await page.locator('#breakfast-calories').fill('350');
  await page.locator('#lunch-protein').fill('25,5');
  await expect(page.locator('.calories .metric-total strong')).toHaveText('350');
  await expect(page.locator('.protein .metric-total strong')).toHaveText('25,5');
  await expect(page.locator('#breakfast-protein')).toHaveValue('');
  expect((await storage(page)).days[currentDay].breakfast.protein).toBeNull();
  await page.reload();
  await expect(page.locator('#lunch-protein')).toHaveValue('25,5');
  await page.getByRole('button', { name: 'Jour précédent', exact: true }).click();
  await page.locator('#dinner-calories').fill('0');
  await page.locator('#dinner-protein').fill('35');
  await page.locator('[data-view="history"]').click();
  await expect(page.locator('.history-row')).toHaveCount(2);
  await page.locator('[data-open-date="2026-09-20"]').click();
  await expect(page.locator('#dinner-calories')).toHaveValue('0');
  await page.locator('#dinner-calories').fill('');
  expect((await storage(page)).days['2026-09-20'].dinner.calories).toBeNull();
  await page.locator('#dinner-protein').fill('');
  expect((await storage(page)).days['2026-09-20']).toBeUndefined();
});

test('Objectifs modifiables sans réécrire le passé et validation de saisie', async ({ page }) => {
  await page.goto('/');
  await page.locator('#breakfast-calories').fill('-10');
  await expect(page.locator('#breakfast-calories')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('[data-view="trends"]').click();
  await expect(page.locator('#meals-form')).toBeVisible();
  await page.locator('#breakfast-calories').fill('');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.locator('#target-calories').fill('0');
  await page.getByRole('button', { name: 'Enregistrer les objectifs' }).click();
  await expect(page.locator('#targets-error')).toContainText('supérieurs à zéro');
  await page.locator('#target-calories').fill('1700');
  await page.locator('#target-protein').fill('120');
  await page.getByRole('button', { name: 'Enregistrer les objectifs' }).click();
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await expect(page.locator('.protein .target-label')).toContainText('120');
  await page.getByRole('button', { name: 'Jour précédent', exact: true }).click();
  await expect(page.locator('.protein .target-label')).toContainText('115');
  await expect(page.locator('.calories .target-label')).toHaveText(/1\s500/);
  expect((await storage(page)).targets).toHaveLength(2);
});

test('Export, import invalide, annulation et restauration confirmée', async ({ page }) => {
  await page.goto('/');
  await page.locator('#breakfast-calories').fill('350');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const download = await downloadPromise;
  const content = await readFile(await download.path(), 'utf8');
  expect(JSON.parse(content)).toEqual(await storage(page));
  await upload(page, '{invalid');
  await expect(page.locator('#settings-status')).toContainText('Import impossible');
  expect((await storage(page)).days[currentDay].breakfast.calories).toBe(350);
  page.once('dialog', prompt => prompt.dismiss());
  await upload(page, JSON.stringify(initialState()));
  await expect(page.locator('#backup-file')).toHaveValue('');
  expect((await storage(page)).days[currentDay].breakfast.calories).toBe(350);
  const imported = setEntry(initialState(), '2026-09-20', 'snack', 'protein', 20);
  page.once('dialog', prompt => prompt.accept());
  await upload(page, JSON.stringify(imported));
  await expect(page.locator('#settings-status')).toContainText('1 journée(s) restaurée(s)');
  expect(await storage(page)).toEqual(imported);
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await page.reload();
  await expect(page.locator('#breakfast-calories')).toHaveValue('');
});

test('Les graphiques excluent les jours absents et restent accessibles', async ({ page }) => {
  await page.goto('/');
  await page.locator('#breakfast-calories').fill('400');
  await page.locator('#breakfast-protein').fill('20');
  await page.getByRole('button', { name: 'Jour précédent', exact: true }).click();
  await page.locator('#lunch-calories').fill('600');
  await page.locator('[data-view="trends"]').click();
  await expect(page.locator('.trend-kpis section').first().locator('strong')).toContainText('500');
  await expect(page.locator('.trend-kpis section').nth(1).locator('strong')).toContainText('20');
  const painted = await page.locator('canvas').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, index) => index % 4 === 3 && value > 0);
  });
  expect(painted).toBe(true);
  await page.locator('[data-duration="30"]').click();
  await page.locator('[data-metric-view="protein"]').click();
  await page.locator('.data-details summary').click();
  await expect(page.locator('tbody tr')).toHaveCount(30);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});

for (const width of [1440, 768, 390, 320]) {
  test(`Responsive, images et accessibilité à ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 940 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.quote-layout img')).toBeVisible();
    expect(await page.locator('.quote-layout img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    if (width === 390) {
      await expect(page.locator('#theme-review')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.querySelector('#app').offsetTop));
      const firstViewport = await page.evaluate(() => ({
        quoteVisible: document.querySelector('.daily-note').getBoundingClientRect().bottom < innerHeight - 72,
        summaryVisible: document.querySelector('#day-summary').getBoundingClientRect().bottom < innerHeight - 72,
        firstEntryVisible: document.querySelector('#breakfast-calories').getBoundingClientRect().bottom < innerHeight - 72,
      }));
      expect(firstViewport).toEqual({ quoteVisible: true, summaryVisible: true, firstEntryVisible: true });
    }
    await page.locator('#breakfast-calories').fill('350');
    await page.locator('#breakfast-protein').fill('22,5');
    await page.locator('#lunch-calories').fill('510');
    await page.locator('#lunch-protein').fill('35');
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      mealOverlaps: [...document.querySelectorAll('.meal-row')].filter(row => {
        const title = row.querySelector('.meal-name').getBoundingClientRect();
        const fields = row.querySelector('.meal-fields').getBoundingClientRect();
        return title.right > fields.left + 1 && title.bottom > fields.top + 1;
      }).length,
      clipped: [...document.querySelectorAll('h1,h2,h3,.metric-card,.date-controls,.input-wrap,.section-heading,blockquote')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className || element.tagName),
    }));
    expect(layout).toEqual({ overflow: false, mealOverlaps: 0, clipped: [] });
    await page.screenshot({ path: testInfo.outputPath(`journal-${width}.png`), fullPage: true });
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
    await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`parametres-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.locator('[data-view="history"]').click();
    await expect(page.locator('.history-row')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-view="trends"]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`tendances-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('Stockage bloqué : les saisies restent exportables et un nouvel essai les sauve', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException('Quota dépassé', 'QuotaExceededError'); };
  });
  await page.locator('#breakfast-calories').fill('450');
  await page.locator('#lunch-protein').fill('30');
  await expect(page.locator('#storage-warning')).toBeVisible();
  await expect(page.locator('#save-status')).toContainText('Non enregistré');
  await page.evaluate(() => window.restoreStorage());
  await page.locator('#retry-save').click();
  await expect(page.locator('#storage-warning')).toBeHidden();
  const saved = await storage(page);
  expect(saved.days[currentDay].breakfast.calories).toBe(450);
  expect(saved.days[currentDay].lunch.protein).toBe(30);
});

test('Un journal corrompu ne sera pas écrasé silencieusement', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '{corrupted'), STORAGE_KEY);
  await page.goto('/');
  await expect(page.locator('#storage-warning')).toBeVisible();
  await expect(page.locator('#breakfast-calories')).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe('{corrupted');
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  page.once('dialog', prompt => prompt.accept());
  await upload(page, JSON.stringify(initialState()));
  await expect(page.locator('#settings-status')).toContainText('restaurée(s)');
  await page.getByRole('button', { name: 'Fermer les paramètres' }).click();
  await expect(page.locator('#breakfast-calories')).toBeEnabled();
});

test('Thème sombre et paramètres accessibles sur mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#lunch-calories').fill('520');
  await page.screenshot({ path: testInfo.outputPath('journal-sombre.png'), fullPage: true });
  const journalAccessibility = await new AxeBuilder({ page }).analyze();
  expect(journalAccessibility.violations.map(item => item.id)).toEqual([]);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const settingsAccessibility = await new AxeBuilder({ page }).analyze();
  expect(settingsAccessibility.violations.map(item => item.id)).toEqual([]);
});

test('La pensée et la journée changent à minuit sans déplacer les anciens repas', async ({ page }) => {
  await page.goto('/');
  const quote = await page.locator('blockquote').textContent();
  await page.locator('#breakfast-calories').fill('300');
  await page.clock.setSystemTime(new Date('2026-09-21T23:59:45+02:00'));
  await page.clock.runFor(45000);
  await expect(page.locator('#journal-date')).toHaveValue('2026-09-22');
  await expect(page.locator('#breakfast-calories')).toHaveValue('');
  await expect(page.locator('blockquote')).not.toHaveText(quote);
  expect((await storage(page)).days[currentDay].breakfast.calories).toBe(300);
});

test('Deux onglets conservent les repas saisis indépendamment', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.clock.install({ time: new Date('2026-09-21T12:00:00+02:00') });
  await other.goto('/');
  await page.locator('#breakfast-calories').fill('300');
  await expect(other.locator('#breakfast-calories')).toHaveValue('300');
  await other.locator('#dinner-protein').fill('40');
  await expect(page.locator('#dinner-protein')).toHaveValue('40');
  expect((await storage(page)).days[currentDay].breakfast.calories).toBe(300);
});