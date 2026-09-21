import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { STORAGE_KEY, shiftDate } from '../src/model.mjs';
import { previewState } from '../src/theme-preview.mjs';
import { THEME_IDS, THEME_KEY } from '../src/theme-preferences.mjs';

const palettes = THEME_IDS;
const themeState = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), THEME_KEY);
const seedJournal = page => page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(previewState('2026-09-21')) });
async function selectPalette(page, id) {
  await page.locator('#open-settings').click();
  await page.locator('.theme-option').filter({ has: page.locator(`input[value="${id}"]`) }).click();
  await page.keyboard.press('Escape');
}

async function assertAccessible(page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T12:00:00+02:00') });
});

for (const width of [1440, 390]) {
  for (const palette of palettes) {
    test(`${palette} à ${width}px : contrastes, états, paramètres et graphiques`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 950 });
      await seedJournal(page);
      await page.goto('/');
      await selectPalette(page, palette);
      await expect(page.locator('html')).toHaveAttribute('data-theme', palette === 'original' ? 'light' : 'dark');
      await expect(page.locator('.calories .metric-total strong')).toHaveText(/1\s020/);
      await expect(page.locator('.protein .metric-total strong')).toHaveText('70');
      await expect(page.locator('.quote-layout img')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-populated.png`), fullPage: true });
      await assertAccessible(page);
      const contrastChecks = await page.evaluate(() => {
        if (document.documentElement.dataset.palette === 'original') return [];
        const style = getComputedStyle(document.documentElement);
        const luminance = token => {
          const hex = style.getPropertyValue(token).trim().slice(1);
          const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
        };
        return [
          ['--cp-focus', '--cp-surface'], ['--cp-focus', '--cp-bg'], ['--cp-header-text', '--cp-header'],
          ['--cp-input-border', '--cp-surface'], ['--cp-accent', '--cp-surface-soft'], ['--cp-link', '--cp-surface-soft'],
          ['--cp-meal-0-fg', '--cp-meal-0-bg'], ['--cp-meal-1-fg', '--cp-meal-1-bg'], ['--cp-meal-2-fg', '--cp-meal-2-bg'], ['--cp-meal-3-fg', '--cp-meal-3-bg'],
        ].map(([foreground, background]) => {
          const light = luminance(foreground);
          const dark = luminance(background);
          return { foreground, background, ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) };
        });
      });
      expect(contrastChecks.filter(check => check.ratio < 3)).toEqual([]);
      for (const input of await page.locator('[data-meal]').all()) await input.fill('');
      await expect(page.locator('.calories .metric-total strong')).toHaveText('–');
      await expect(page.locator('#breakfast-calories')).toHaveValue('');
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-empty.png`), fullPage: true });
      await assertAccessible(page);
      await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
      await page.getByRole('dialog').screenshot({ path: testInfo.outputPath(`${palette}-${width}-settings.png`) });
      expect(await page.locator('#theme-settings').evaluate(element => element.getBoundingClientRect().top < document.querySelector('#targets-form').getBoundingClientRect().top)).toBe(true);
      expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await assertAccessible(page);
      await page.locator('#target-calories').fill('0');
      await page.getByRole('button', { name: 'Enregistrer les objectifs' }).click();
      await expect(page.locator('#targets-error')).toBeVisible();
      await assertAccessible(page);
      await page.keyboard.press('Escape');
      await page.locator('#breakfast-calories').fill('350');
      await page.locator('#breakfast-protein').fill('22,5');
      await page.locator('[data-view="trends"]').click();
      const painted = await page.locator('canvas').evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
      });
      expect(painted).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-trends.png`), fullPage: true });
      await assertAccessible(page);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth, controls: [...document.querySelectorAll('.theme-option, .metric-card, .section-heading')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className) }));
      expect(overflow).toEqual({ page: false, controls: [] });
    });
  }
}

test('Les couleurs ne modifient pas le journal ni ses sauvegardes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#dinner-calories').fill('643');
  const personal = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  for (const palette of palettes) {
    await selectPalette(page, palette);
    await expect(page.locator('#dinner-calories')).toHaveValue('643');
  }
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(personal);
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported).toEqual(JSON.parse(personal));
});

test('Mise en page, typographie et graphiques restent identiques entre palettes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const chartModuleResponse = page.waitForResponse(response => response.url().includes('/chart__js.js?v='));
  await seedJournal(page);
  await page.goto('/');
  const chartModuleUrl = (await chartModuleResponse).url();
  const geometry = () => page.evaluate(() => {
    const origin = document.querySelector('#main').getBoundingClientRect();
    return [...document.querySelectorAll('#main h1, #main h2, #main h3, #main .meal-row, #main .metric-card, #main input, #main blockquote')].map(element => {
      const bounds = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      return { left: bounds.left, top: bounds.top - origin.top, width: bounds.width, height: bounds.height, font: styles.fontFamily, size: styles.fontSize, weight: styles.fontWeight };
    });
  });
  const original = await geometry();
  for (const palette of palettes) {
    await selectPalette(page, palette);
    expect(await geometry()).toEqual(original);
  }
  await page.locator('[data-view="trends"]').click();
  const chartDetails = () => page.evaluate(async moduleUrl => {
    const { Chart } = await import(moduleUrl);
    const chart = Chart.getChart(document.querySelector('canvas'));
    return { values: chart.data.datasets.map(dataset => dataset.data), color: chart.data.datasets[0].borderColor, secondary: getComputedStyle(document.documentElement).getPropertyValue('--cp-link').trim() };
  }, chartModuleUrl);
  const before = await chartDetails();
  const colors = new Set();
  for (const palette of palettes) {
    await selectPalette(page, palette);
    const details = await chartDetails();
    expect(details.values).toEqual(before.values);
    colors.add(details.color);
  }
  expect(colors.size).toBe(6);
  await page.locator('[data-metric-view="protein"]').click();
  for (const palette of palettes) {
    await selectPalette(page, palette);
    const details = await chartDetails();
    expect(details.color).toBe(details.secondary);
  }
});

test('Choix au clavier et paramètres sur petit écran', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/');
  await selectPalette(page, 'cerise');
  await page.locator('#open-settings').click();
  await page.locator('[name="color-theme"][value="cerise"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'petrole');
  expect((await themeState(page)).current).toBe('petrole');
  await page.locator('#daily-theme').focus();
  await page.keyboard.press('Space');
  expect((await themeState(page)).daily).toBe(false);
  expect(await page.getByRole('dialog').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await assertAccessible(page);
});

test.describe('Production', () => {
  test.use({ baseURL: 'http://127.0.0.1:5213' });

  test('Rotation quotidienne, rechargement, cycle complet, choix manuel et mode fixe', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('#theme-review')).toHaveCount(0);
    await expect(page.locator('[name="color-theme"]')).toHaveCount(6);
    await page.locator('#dinner-calories').fill('643');
    const personal = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const first = await themeState(page);
    expect(first.daily).toBe(true);
    await page.reload();
    expect(await themeState(page)).toEqual(first);
    const seen = [first.current];
    for (let offset = 1; offset < 6; offset += 1) {
      await page.clock.setSystemTime(new Date(`${shiftDate('2026-09-21', offset)}T12:00:00+02:00`));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const state = await themeState(page);
      expect(state.remaining.length).toBe(5 - offset);
      seen.push(state.current);
    }
    expect(new Set(seen).size).toBe(6);
    await selectPalette(page, 'petrole');
    expect((await themeState(page)).remaining.sort()).toEqual(palettes.filter(id => id !== 'petrole').sort());
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'petrole');
    await page.clock.setSystemTime(new Date('2026-09-26T23:59:45+02:00'));
    await page.clock.runFor(45000);
    expect((await themeState(page)).remaining.length).toBe(4);
    await expect(page.locator('html')).not.toHaveAttribute('data-palette', 'petrole');
    await page.locator('#open-settings').click();
    await page.locator('#daily-theme').uncheck();
    await page.keyboard.press('Escape');
    await selectPalette(page, 'original');
    await page.clock.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'original');
    const other = await context.newPage();
    await other.clock.install({ time: new Date('2026-10-26T12:00:00+01:00') });
    await other.goto('/');
    await selectPalette(other, 'studio');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'studio');
    expect((await themeState(page)).daily).toBe(false);
    await page.locator('#open-settings').click();
    await page.locator('#daily-theme').check();
    await page.keyboard.press('Escape');
    await page.clock.setSystemTime(new Date('2026-10-27T12:00:00+01:00'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('html')).not.toHaveAttribute('data-palette', 'studio');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(personal);
  });

  test('Stockage de thème défaillant et préférences invalides ne bloquent pas le journal', async ({ page }) => {
    await page.addInitScript(key => {
      localStorage.setItem(key, '{invalid');
      const originalSet = Storage.prototype.setItem;
      window.restoreThemeStorage = () => { Storage.prototype.setItem = originalSet; };
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error('Quota');
        return originalSet.call(this, name, value);
      };
    }, THEME_KEY);
    await page.goto('/');
    await page.locator('#dinner-calories').fill('643');
    const personal = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await selectPalette(page, 'matcha');
    await page.locator('#open-settings').click();
    await expect(page.locator('#theme-status')).toContainText('non enregistrée');
    await page.evaluate(() => window.restoreThemeStorage());
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.locator('#theme-status')).toBeHidden();
    expect((await themeState(page)).current).toBe('matcha');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(personal);
  });
});