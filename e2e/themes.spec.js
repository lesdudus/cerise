import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { initialState, setEntry, STORAGE_KEY } from '../src/model.mjs';

const palettes = ['cerise', 'petrole', 'studio', 'matcha', 'cobalt'];
const selectPalette = (page, id) => page.locator(`[name="review-theme"][value="${id}"]`).check();
const selectExample = (page, id) => page.locator(`[name="review-example"][value="${id}"]`).check();

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
      await page.goto('/?themes');
      await selectPalette(page, palette);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('.calories .metric-total strong')).toHaveText(/1\s020/);
      await expect(page.locator('.protein .metric-total strong')).toHaveText('70');
      await expect(page.locator('.quote-layout img')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-populated.png`), fullPage: true });
      await assertAccessible(page);
      const contrastChecks = await page.evaluate(() => {
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
      await selectExample(page, 'empty');
      await expect(page.locator('.calories .metric-total strong')).toHaveText('–');
      await expect(page.locator('#breakfast-calories')).toHaveValue('');
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-empty.png`), fullPage: true });
      await assertAccessible(page);
      await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
      await assertAccessible(page);
      await page.locator('#target-calories').fill('0');
      await page.getByRole('button', { name: 'Enregistrer les objectifs' }).click();
      await expect(page.locator('#targets-error')).toBeVisible();
      await assertAccessible(page);
      await page.keyboard.press('Escape');
      await selectExample(page, 'populated');
      await page.locator('[data-view="trends"]').click();
      const painted = await page.locator('canvas').evaluate(canvas => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return pixels.some((value, index) => index % 4 === 3 && value > 0);
      });
      expect(painted).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${palette}-${width}-trends.png`), fullPage: true });
      await assertAccessible(page);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth > innerWidth, controls: [...document.querySelectorAll('.theme-option, .review-inner, .metric-card, .section-heading')].filter(element => element.scrollWidth > element.clientWidth + 1).map(element => element.className) }));
      expect(overflow).toEqual({ page: false, controls: [] });
    });
  }
}

test('La comparaison ne lit ni ne modifie le journal personnel, même après import et réglages', async ({ page }) => {
  const personal = setEntry(initialState(), '2026-09-21', 'dinner', 'calories', 643);
  const serialized = JSON.stringify(personal);
  await page.addInitScript(({ key, serialized }) => {
    const originalGet = Storage.prototype.getItem;
    const originalSet = Storage.prototype.setItem;
    originalSet.call(localStorage, key, serialized);
    window.previewStorageCalls = [];
    window.readPersonalJournal = () => originalGet.call(localStorage, key);
    Storage.prototype.getItem = function (name) {
      if (this === localStorage) window.previewStorageCalls.push(`read:${name}`);
      return originalGet.call(this, name);
    };
    Storage.prototype.setItem = function (name, value) {
      if (this === localStorage) window.previewStorageCalls.push(`write:${name}`);
      return originalSet.call(this, name, value);
    };
  }, { key: STORAGE_KEY, serialized });
  await page.goto('/?themes');
  await expect(page.locator('#dinner-calories')).toHaveValue('');
  await page.locator('#dinner-calories').fill('420');
  for (const palette of palettes) {
    await selectPalette(page, palette);
    await expect(page.locator('#dinner-calories')).toHaveValue('420');
  }
  await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
  await page.locator('#target-calories').fill('1800');
  await page.getByRole('button', { name: 'Enregistrer les objectifs' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('exemple');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(exported.days['2026-09-21'].dinner.calories).toBe(420);
  page.once('dialog', prompt => prompt.accept());
  await page.locator('#backup-file').setInputFiles({ name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initialState())) });
  await expect(page.locator('#settings-status')).toContainText('restaurée');
  await page.keyboard.press('Escape');
  await selectExample(page, 'empty');
  await selectExample(page, 'populated');
  expect(await page.evaluate(() => window.previewStorageCalls)).toEqual([]);
  expect(await page.evaluate(() => window.readPersonalJournal())).toBe(serialized);
  await page.goto('/');
  await expect(page.locator('#theme-review')).toBeVisible();
  await expect(page.locator('#dinner-calories')).toHaveValue('643');
});

test('Mise en page, typographie et graphiques restent identiques entre palettes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const chartModuleResponse = page.waitForResponse(response => response.url().includes('/chart__js.js?v='));
  await page.goto('/?themes');
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
  for (const palette of [...palettes, 'original']) {
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
  expect(colors.size).toBe(5);
  await page.locator('[data-metric-view="protein"]').click();
  for (const palette of palettes) {
    await selectPalette(page, palette);
    const details = await chartDetails();
    expect(details.color).toBe(details.secondary);
  }
});

test('Choix au clavier, petits écrans et avis', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/?themes');
  await page.locator('[name="review-theme"][value="cerise"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'petrole');
  await page.locator('#review-summary').click();
  await expect(page.locator('#review-description')).toContainText('Compromis');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await assertAccessible(page);
});

test.describe('Production', () => {
  test.use({ baseURL: 'http://127.0.0.1:5213' });

  test('Le sélecteur conserve le journal et sépare les exemples', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[name="review-theme"]')).toHaveCount(6);
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'original');
    await expect(page.locator('[name="review-example"]')).toHaveCount(0);
    await page.locator('#dinner-calories').fill('643');
    const personal = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    await page.evaluate(() => {
      const originalSet = Storage.prototype.setItem;
      window.paletteWrites = [];
      Storage.prototype.setItem = function (key, value) {
        window.paletteWrites.push(key);
        return originalSet.call(this, key, value);
      };
    });
    for (const palette of palettes) {
      await selectPalette(page, palette);
      await expect(page.locator('#dinner-calories')).toHaveValue('643');
    }
    expect(await page.evaluate(() => window.paletteWrites)).toEqual([]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'cobalt');
    await page.getByRole('link', { name: 'Essayer les exemples' }).click();
    await expect(page.locator('#dinner-calories')).toHaveValue('');
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'cobalt');
    await selectExample(page, 'empty');
    await expect(page.locator('#breakfast-calories')).toHaveValue('');
    await selectExample(page, 'populated');
    await page.locator('#dinner-calories').fill('420');
    await selectPalette(page, 'petrole');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(personal);
    await page.getByRole('link', { name: 'Revenir à mon journal' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'petrole');
    await expect(page.locator('#dinner-calories')).toHaveValue('643');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(personal);
  });
});