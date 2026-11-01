import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The spec always pins the demo clock: Tue 3 Nov 2026, 09:00 Bangkok. Day offsets in busy.placeholder.json resolve from it:
// Wed 4 closed all-day, Thu 5 Mia + Alex hold, Fri 6 transparent all-day (still blocks), Sat 7 transparent timed (free), Sun 8 pairs.
const NOW = '?now=' + encodeURIComponent('2026-11-03T09:00:00+07:00');
const CLIENT = '/shadesofbkk/index.html' + NOW;
const OWNER = '/shadesofbkk/owner.html' + NOW;

async function screenOk(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, label + ' horizontal scroll').toBeLessThanOrEqual(1);
  const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({id: v.id, nodes: v.nodes.map((n) => n.target)})), label).toEqual([]);
}

async function fillAndBook(page, phone) {
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await expect(page.locator('#addons')).toBeVisible();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.locator('#slotbox input:not(:disabled)').first().check();
  await page.getByLabel('Name').fill('Alex');
  await page.getByLabel('WhatsApp number').fill(phone);
  await page.getByLabel('Email').fill('alex@example.com');
  await page.getByRole('button', {name: /^Book \d\d:\d\d$/}).click();
}

test.use({viewport: {width: 375, height: 812}});

test('book as a known client, as a new client, and confirm as the owner', async ({page}) => {
  await page.goto(CLIENT);
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await screenOk(page, 'client form');

  await fillAndBook(page, '081 234 5678');
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await screenOk(page, 'confirmation');
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();

  await page.getByRole('button', {name: 'Reset demo'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await fillAndBook(page, '089 999 0000');
  await expect(page.getByText(/held until/)).toBeVisible();
  expect(await page.locator('a[href*="owner"]').count(), 'no owner link on a client screen').toBe(0);

  await page.goto(OWNER);
  await expect(page.getByRole('heading', {level: 1, name: /^Alex wants Sat 7 Nov, 10:00\.$/})).toBeVisible();
  await screenOk(page, 'owner');
  await page.getByRole('button', {name: 'Confirm'}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Confirm'})).toHaveCount(0);
});

test('day states, lookup failure, and the propose, accept and stale links', async ({page}) => {
  await page.goto(CLIENT);
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  for (const day of ['Wed 4 Nov', 'Fri 6 Nov']) {
    await page.getByRole('radio', {name: day}).check();
    await expect(page.locator('#slotbox')).toHaveText('Closed');
  }
  await page.getByRole('radio', {name: 'Mon 9 Nov'}).check();
  await expect(page.locator('#slotbox')).toHaveText('Closed');
  await page.getByRole('radio', {name: 'Thu 5 Nov'}).check();
  await expect(page.locator('#slotbox input:disabled').first()).toBeVisible();
  await expect(page.locator('#slotbox input[value]:not(:disabled)').first()).toBeVisible();
  // Mia 11:00-12:00 and Alex 13:30-15:30 are struck: 11:00 and 14:00 cannot be chosen.
  const disabledLabels = await page.locator('#slotbox input:disabled + .vis').allTextContents();
  expect(disabledLabels).toEqual(expect.arrayContaining(['11:00', '14:00']));

  await page.getByLabel('Simulate lookup failure').check();
  await expect(page.getByText('Times could not load')).toBeVisible();
  await page.getByLabel('Simulate lookup failure').uncheck();
  await page.getByRole('button', {name: 'Retry'}).click();
  await expect(page.locator('#slotbox input[type=radio]').first()).toBeVisible();

  // Owner proposes twice: only the newest accept link works.
  await page.goto(OWNER);
  await page.getByRole('button', {name: 'Propose another time'}).click();
  await page.locator('#proposals button').first().click();
  const link1 = await page.locator('.linkbox a').getAttribute('href');
  await expect(page.getByText(/Proposed .*waiting for Alex/)).toBeVisible();
  await page.getByRole('button', {name: 'Propose again'}).click();
  await page.locator('#proposals button').nth(1).click();
  const link2 = await page.locator('.linkbox a').getAttribute('href');
  expect(link2).not.toBe(link1);
  await page.goto('/shadesofbkk/' + link1);
  await expect(page.getByText('This proposal is no longer current.')).toBeVisible();
  await page.goto('/shadesofbkk/' + link2);
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();

  // Expiry: a fresh pending hold with the clock moved to its expiry reads expired.
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await page.goto(OWNER);
  await page.getByLabel('Simulate expiry').check();
  await expect(page.getByText(/Expired/)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Confirm'})).toHaveCount(0);
});
