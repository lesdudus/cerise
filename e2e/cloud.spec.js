import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { initialState, setEntry, STORAGE_KEY } from '../src/model.mjs';
import { cloudKey } from '../src/cloud-repository.mjs';
import { THEME_KEY } from '../src/theme-preferences.mjs';

const currentDay = '2026-09-22';
const clockTime = new Date('2026-09-21T23:30:00Z');
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(clockTime);
});

const owner = '11111111-1111-4111-8111-111111111111';
const email = 'cerise-test@example.invalid';
const endpoint = 'https://tmmsfazjravormkwnmji.supabase.co';
const user = { id: owner, email, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;

async function mockCloud(context, server) {
  await context.route(`${endpoint}/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const reply = (body, status = 200) => route.fulfill({ status, headers: { 'X-Supabase-Api-Version': '2024-01-01', 'Access-Control-Expose-Headers': 'X-Supabase-Api-Version' }, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/token')) {
      const body = request.postDataJSON();
      if (body.password === 'incorrect') return reply({ code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      return reply({ access_token: token(), refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'bearer', user });
    }
    if (path.endsWith('/user')) return reply(user);
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    if (server.offline) return route.abort('internetdisconnected');
    if (path.endsWith('/cerise_read_journal')) return reply(server.snapshot);
    if (path.endsWith('/cerise_save_journal')) {
      const body = request.postDataJSON();
      expect(request.headers().authorization).toContain('Bearer ');
      if (body.expected_revision !== server.snapshot.revision) return reply({ code: '40001', message: 'Conflict' }, 409);
      server.snapshot = { revision: server.snapshot.revision + 1, state: body.journal };
      server.saves += 1;
      return reply(server.snapshot);
    }
    return reply({ message: 'Unexpected test request' }, 500);
  });
}

async function login(page) {
  await page.goto('/');
  await page.locator('#open-account').click();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill('test-only-password');
  await page.locator('#login-form button').click();
  await expect(page.locator('#account-state')).toContainText(email);
  await expect(page.locator('#save-status')).toContainText('Synchronisé');
}

for (const width of [1440, 390]) {
  test(`Private login and account UI at ${width}px`, async ({ page, context }, testInfo) => {
    const server = { snapshot: { revision: 0, state: initialState() }, saves: 0 };
    await mockCloud(context, server);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#open-account').click();
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill('incorrect');
    await page.locator('#login-form button').click();
    await expect(page.locator('#auth-status')).toContainText('Adresse e-mail ou mot de passe incorrect');
    await page.locator('#login-password').fill('test-only-password');
    await page.locator('#login-form button').click();
    await expect(page.locator('#account-actions')).toBeVisible();
    await expect(page.locator('#login-password')).toHaveValue('');
    await expect(page.locator('#save-status')).toContainText('Synchronisé');
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
    await page.locator('#settings-dialog').screenshot({ path: testInfo.outputPath(`cloud-settings-${width}.png`) });
    await page.locator('#close-settings').click();
    await page.locator('#breakfast-calories').fill('0');
    await page.locator('#lunch-protein').fill('25,5');
    await page.locator('#open-account').click();
    await page.locator('#sync-now').click();
    await expect.poll(() => server.snapshot.state.days[currentDay]?.lunch?.protein).toBe(25.5);
    expect(server.snapshot.state.days[currentDay].breakfast.calories).toBe(0);
    await page.reload();
    await expect(page.locator('#lunch-protein')).toHaveValue('25,5');
    expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    await page.locator('#open-account').click();
    await page.locator('#sign-out').click();
    await expect(page.locator('#login-form')).toBeVisible();
    await page.locator('#close-settings').click();
    await expect(page.locator('#lunch-protein')).toHaveValue('');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).state.days, cloudKey(owner))).not.toEqual({});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`cloud-journal-${width}.png`), fullPage: true });
  });
}

test('Two devices merge, recover offline edits and require explicit conflict resolution', async ({ browser, context, page }) => {
  const server = { snapshot: { revision: 0, state: initialState() }, saves: 0, offline: false };
  const secondContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5213', timezoneId: 'Europe/Paris' });
  try {
    await mockCloud(context, server);
    await mockCloud(secondContext, server);
    const second = await secondContext.newPage();
    await second.clock.setFixedTime(clockTime);
    await login(page);
    await login(second);
    await page.locator('#close-settings').click();
    await page.locator('#breakfast-calories').fill('400');
    await page.locator('#open-account').click();
    await page.locator('#sync-now').click();
    await expect.poll(() => server.snapshot.state.days[currentDay]?.breakfast?.calories).toBe(400);
    await second.locator('#sync-now').click();
    await expect(second.locator('#breakfast-calories')).toHaveValue('400');
    server.offline = true;
    await page.locator('#close-settings').click();
    await page.locator('#breakfast-calories').fill('500');
    await page.locator('#open-account').click();
    await page.locator('#sync-now').click();
    await expect(page.locator('#save-status')).toContainText('indisponible');
    await page.reload();
    await expect(page.locator('#breakfast-calories')).toHaveValue('500');
    server.snapshot = { revision: server.snapshot.revision + 1, state: setEntry(server.snapshot.state, currentDay, 'breakfast', 'calories', 600) };
    server.offline = false;
    await page.locator('#open-account').click();
    await page.locator('#sync-now').click();
    await expect(page.locator('#cloud-conflict')).toBeVisible();
    await expect(page.locator('#conflict-fields')).toContainText('Cet appareil : 500 kcal · En ligne : 600 kcal');
    expect(server.snapshot.state.days[currentDay].breakfast.calories).toBe(600);
    await page.locator('#close-settings').click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#keep-local').click();
    await page.locator('#open-account').click();
    await page.locator('#sync-now').click();
    await expect.poll(() => server.snapshot.state.days[currentDay].breakfast.calories).toBe(500);
    await second.locator('#sync-now').click();
    await expect(second.locator('#breakfast-calories')).toHaveValue('500');
  } finally { await secondContext.close(); }
});

test('Signing in keeps the local journal and themes separate, and signing out clears every tab', async ({ page, context }) => {
  const server = { snapshot: { revision: 0, state: initialState() }, saves: 0 };
  await mockCloud(context, server);
  await page.goto('/');
  await page.locator('#breakfast-calories').fill('123');
  const local = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  const theme = await page.evaluate(key => localStorage.getItem(key), THEME_KEY);
  await login(page);
  expect(server.snapshot.state).toEqual(initialState());
  expect(server.saves).toBe(0);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(local);
  expect(await page.evaluate(key => localStorage.getItem(key), THEME_KEY)).toBe(theme);
  await page.locator('#close-settings').click();
  await page.locator('#lunch-protein').fill('40');
  await page.locator('#open-account').click();
  await page.locator('#sync-now').click();
  await expect.poll(() => server.saves).toBeGreaterThan(0);
  const second = await context.newPage();
  await second.clock.setFixedTime(clockTime);
  await second.goto('/');
  await expect(second.locator('#lunch-protein')).toHaveValue('40');
  await page.locator('#sign-out').click();
  await expect(second.locator('#lunch-protein')).toHaveValue('');
  await expect(second.locator('#breakfast-calories')).toHaveValue('123');
  await expect(second.locator('#open-account')).toHaveText('Se connecter');
  expect(await second.evaluate(key => localStorage.getItem(key), THEME_KEY)).toBe(theme);
});