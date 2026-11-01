import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The spec always pins the demo clock: Tue 3 Nov 2026, 09:00 Bangkok. Day offsets in busy.placeholder.json resolve from it:
// Wed 4 closed all-day, Thu 5 Mia + Alex hold, Fri 6 transparent all-day (still blocks), Sat 7 transparent timed (free), Sun 8 pairs.
const NOW = '?now=' + encodeURIComponent('2026-11-03T09:00:00+07:00');
const CLIENT = '/shadesofbkk/index.html' + NOW;
const OWNER = '/shadesofbkk/owner.html' + NOW;
const KNOWN = '081 234 5678', UNKNOWN = '089 999 0000';
const WA = 'a[href^="https://wa.me/"]';

async function screenOk(page, label) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished')); // axe reads colour mid-fade otherwise
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, label + ' horizontal scroll').toBeLessThanOrEqual(1);
  const small = await page.evaluate(() => [...document.querySelectorAll('a, button, summary, textarea, input:not([type=checkbox]):not([type=radio]):not([type=hidden]), label:has(input[type=checkbox]), label:has(input[type=radio])')]
    .map((el) => ({el, r: el.getBoundingClientRect()}))
    .filter(({r}) => r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5))
    .map(({el, r}) => `${el.tagName}#${el.id}.${el.className} "${(el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(small, label + ' tap targets under 44 px').toEqual([]);
  const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => ({id: v.id, nodes: v.nodes.map((n) => n.target)})), label).toEqual([]);
}

async function openDemo(page) {
  const details = page.locator('details.demo-controls');
  if (!(await details.evaluate((el) => el.open))) await details.locator('summary').click();
}

async function fillPhone(page, phone) {
  await page.getByLabel('WhatsApp number').fill(phone);
  await page.getByLabel('WhatsApp number').blur();
}

async function fillAndBook(page, phone, {email = true} = {}) {
  await fillPhone(page, phone);
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await expect(page.locator('#addon-rows')).toBeVisible();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.locator('#slotbox input:not(:disabled)').first().check();
  const chosen = page.locator('#slotbox input:checked + .vis');
  await expect(chosen).toHaveCSS('background-color', 'rgb(196, 137, 74)');
  await expect(chosen).toHaveCSS('color', 'rgb(43, 29, 24)');
  await page.getByLabel('Name').fill('Alex');
  if (email) await page.getByLabel('Email').fill('alex@example.com');
  await page.getByRole('button', {name: phone === KNOWN ? /^Book \d\d:\d\d$/ : /^Request \d\d:\d\d$/}).click();
}

const bookingId = (page) => new URL(page.url()).searchParams.get('booking');
const stored = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('shadesofbkk.booking')));

test.use({viewport: {width: 375, height: 812}});

test('book as a known client, as a new client, and confirm as the owner', async ({page}) => {
  await page.goto(CLIENT);
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await expect(page.getByRole('img', {name: /Photo of James/})).toBeVisible();
  await expect(page.getByText(/^Hi, I'm James\. One chair in .*, Bangkok\./)).toBeVisible();
  await screenOk(page, 'client form');
  const swatches = await page.locator('.strip span').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  expect(swatches).toHaveLength(6);
  expect(swatches.every((c) => c !== 'rgba(0, 0, 0, 0)')).toBe(true);

  await fillAndBook(page, KNOWN, {email: false}); // a known number may leave the email empty
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText('James knows you, so no waiting.')).toBeVisible();
  await expect(page.getByText('James will send the details on WhatsApp.')).toBeVisible();
  await expect(page.getByText(/What to look for:/)).toBeVisible();
  await expect(page.getByRole('link', {name: 'Open in Maps'})).toBeVisible();
  expect(bookingId(page)).toBeTruthy();
  await screenOk(page, 'confirmation');
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();

  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await fillAndBook(page, UNKNOWN);
  await expect(page.getByRole('heading', {name: 'Request received.'})).toBeVisible();
  await expect(page.getByText(/held until/)).toBeVisible();
  await expect(page.getByText(/What to look for:/)).toBeVisible();
  await screenOk(page, 'held');
  expect(await page.locator('a[href*="owner"]').count(), 'no owner link on a client screen').toBe(0);

  await page.goto(OWNER);
  await expect(page.getByRole('heading', {level: 1, name: /^Alex wants Sat 7 Nov, 10:00\.$/})).toBeVisible();
  await screenOk(page, 'owner');
  // the primary action is on screen without scrolling
  const box = await page.getByRole('button', {name: 'Confirm', exact: true}).boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(812);
  await page.getByRole('button', {name: 'Confirm', exact: true}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Confirm', exact: true})).toHaveCount(0);
});

test('phone comes first, a known number moves times earlier, a personal link fills the form', async ({page}) => {
  await page.goto(CLIENT);
  const phoneFirst = await page.evaluate(() => !!(document.querySelector('#phone').compareDocumentPosition(document.querySelector('#mains')) & Node.DOCUMENT_POSITION_FOLLOWING));
  expect(phoneFirst).toBe(true);
  await expect(page.getByText('Enter your number to see earlier times.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Request'})).toBeVisible();
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await page.getByRole('radio', {name: 'Tue 3 Nov'}).check();
  const first = () => page.locator('#slotbox input:not(:disabled) + .vis').first();
  await expect(first()).toHaveText('15:00'); // unknown number: 6 h notice
  await fillPhone(page, UNKNOWN);
  await expect(page.getByText('Enter your number to see earlier times.')).toBeHidden();
  await expect(page.locator('#recog')).toHaveText(/^New to us\? James confirms new clients on WhatsApp, usually within the hour\.$/);
  await expect(first()).toHaveText('15:00');
  await fillPhone(page, KNOWN);
  await expect(page.locator('#recog')).toHaveText(/^Welcome back\. This number is on James's list/);
  await expect(page.locator('#recog')).not.toContainText('Mia');
  await expect(first()).toHaveText('11:00'); // known: 2 h notice
  await expect(page.getByLabel('Email (optional)')).toBeVisible();

  await page.goto(CLIENT + '&c=demo-mia');
  await expect(page.getByLabel('Name')).toHaveValue('Mia');
  await expect(page.getByLabel('WhatsApp number')).toHaveValue('+66812345678');
  await expect(page.locator('#recog')).toHaveText('Hi Mia. Your details are filled in.');
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.locator('#slotbox input:not(:disabled)').first().check();
  await expect(page.getByRole('button', {name: /^Book \d\d:\d\d$/})).toBeVisible();
  await screenOk(page, 'personal link');
  await page.getByRole('button', {name: /^Book \d\d:\d\d$/}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
});

test('day states, next available, fully booked, too long, lookup failure, and the propose, accept and stale links', async ({page}) => {
  await page.goto(CLIENT);
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await screenOk(page, 'service picked');
  // next available: one tap fills the day and the time (unknown number: 15:00 today)
  const next = page.getByRole('button', {name: /^Next available: Tue 3 Nov, 15:00$/});
  await next.click();
  await expect(page.getByRole('radio', {name: 'Tue 3 Nov'})).toBeChecked();
  await expect(page.locator('#slotbox input:checked')).toHaveValue(/\d+/);
  await expect(page.locator('#ready')).toHaveText('Ready by 15:45');
  for (const day of ['Wed 4 Nov', 'Fri 6 Nov']) {
    await page.getByRole('radio', {name: day}).check();
    await expect(page.locator('#slotbox')).toHaveText('Closed');
  }
  expect(await page.locator('#days .day.closed').count()).toBeGreaterThanOrEqual(4); // Wed, Fri, and both Mondays
  await page.getByRole('radio', {name: 'Mon 9 Nov'}).check();
  await expect(page.locator('#slotbox')).toHaveText('Closed');
  // Sat 7: a timed transparent "Closed" 17:00-19:00 blocks its own hours; the morning stays open.
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await expect(page.locator('#slotbox input:not(:disabled)').first()).toBeVisible();
  expect(await page.locator('#slotbox input:disabled + .vis').allTextContents()).toEqual(expect.arrayContaining(['17:00', '18:00']));
  await page.getByRole('radio', {name: 'Thu 5 Nov'}).check();
  await expect(page.locator('#slotbox input:disabled').first()).toBeVisible();
  await expect(page.locator('#slotbox input[value]:not(:disabled)').first()).toBeVisible();
  // Mia 11:00-12:00 and Alex 13:30-15:30 are struck: 11:00 and 14:00 cannot be chosen.
  const disabledLabels = await page.locator('#slotbox input:disabled + .vis').allTextContents();
  expect(disabledLabels).toEqual(expect.arrayContaining(['11:00', '14:00']));

  // A full-day job (525 min + buffer = the whole window) on Thu 5 is fully booked and offers the next free time.
  for (const name of [/Balayage/, /Highlights/, /Full colour/, /Root touch-up/]) await page.getByRole('checkbox', {name}).check();
  await page.getByRole('checkbox', {name: /Cut & style/}).uncheck();
  await expect(page.locator('#slotbox')).toContainText('Fully booked');
  await screenOk(page, 'fully booked');
  await page.getByRole('button', {name: /^Next free: Tue 10 Nov, 10:00$/}).click();
  await expect(page.getByRole('radio', {name: 'Tue 10 Nov'})).toBeChecked();
  // ...and one more add-on makes it too long for any day.
  await page.getByRole('checkbox', {name: /Treatment/}).check();
  await expect(page.locator('#slotbox')).toContainText('Too long for one day.');
  await expect(page.locator('#slotbox ' + WA)).toBeVisible();
  await expect(page.locator('#slotbox .slots')).toHaveCount(0);
  await screenOk(page, 'too long');

  await openDemo(page);
  await page.getByLabel('Simulate lookup failure').check();
  await expect(page.getByText('Times could not load')).toBeVisible();
  await expect(page.locator('#slotbox ' + WA)).toBeVisible();
  await page.getByLabel('Simulate lookup failure').uncheck();
  await page.getByRole('button', {name: 'Retry'}).click();
  await expect(page.getByText('Too long for one day.')).toBeVisible();

  // Owner proposes twice: only the newest accept link works.
  await page.goto(OWNER);
  await page.getByRole('button', {name: 'Propose another time'}).click();
  await page.locator('#proposals button').first().click();
  const link1 = await page.locator('.linkbox a').getAttribute('href');
  await expect(page.getByRole('heading', {level: 1, name: /^Proposed: \w{3} \d+ Nov, \d\d:\d\d$/})).toBeVisible();
  await expect(page.getByText('Waiting for Alex to accept.')).toBeVisible();
  await page.getByRole('button', {name: 'Propose again'}).click();
  await page.locator('#proposals button').nth(1).click();
  const link2 = await page.locator('.linkbox a').getAttribute('href');
  expect(link2).not.toBe(link1);
  await page.goto('/shadesofbkk/' + link1);
  await expect(page.getByText('This proposal is no longer current.')).toBeVisible();
  await expect(page.locator('#done ' + WA)).toBeVisible();
  await page.goto('/shadesofbkk/' + link2);
  await screenOk(page, 'accept view');
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  expect(bookingId(page)).toBe('demo-alex');

  // Expiry: a fresh pending hold with the clock moved to its expiry reads expired.
  await page.goto(CLIENT);
  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await page.goto(OWNER);
  await openDemo(page);
  await page.getByLabel('Simulate expiry').check();
  await expect(page.getByText(/Expired/)).toBeVisible();
  await expect(page.getByRole('button', {name: 'Confirm', exact: true})).toHaveCount(0);
});

test('every client end state carries the WhatsApp door; footer and noscript too; Book another and a plain revisit show an empty form', async ({page, browser}) => {
  await page.goto(CLIENT);
  await expect(page.locator('.foot ' + WA)).toBeVisible();
  await fillAndBook(page, KNOWN);
  await expect(page.locator('#done ' + WA).first()).toBeVisible();
  await expect(page.getByText('Need to move it?')).toBeVisible();
  await expect(page.locator('.foot ' + WA)).toBeVisible();

  await page.getByRole('link', {name: 'Book another'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('');
  expect(page.url()).toContain('now=');
  await page.goto(CLIENT);
  await expect(page.getByLabel('Name')).toHaveValue(''); // sessionStorage no longer traps the page in the old booking

  // held, then expired (clock moved past the hold)
  await fillAndBook(page, UNKNOWN);
  await expect(page.locator('#done ' + WA).first()).toBeVisible();
  await expect(page.getByText('Need to move it?')).toBeVisible();
  const id = bookingId(page);
  await page.goto(`/shadesofbkk/index.html?booking=${id}&now=${encodeURIComponent('2026-11-04T09:00:00+07:00')}`);
  await expect(page.getByRole('heading', {name: 'Request expired.'})).toBeVisible();
  await expect(page.locator('#done ' + WA)).toBeVisible();
  await expect(page.getByRole('link', {name: 'Book for another time'})).toBeVisible();
  await screenOk(page, 'expired');

  // stale accept link, menu failure
  await page.goto('/shadesofbkk/index.html?accept=nope&now=' + encodeURIComponent('2026-11-03T09:00:00+07:00'));
  await expect(page.getByText('This proposal is no longer current.')).toBeVisible();
  await expect(page.locator('#done ' + WA)).toBeVisible();
  await page.route('**/menu.placeholder.json', (r) => r.abort());
  await page.goto(CLIENT);
  await expect(page.getByRole('heading', {name: 'The menu could not load'})).toBeVisible();
  await expect(page.locator('#flow ' + WA)).toBeVisible();
  await screenOk(page, 'menu failure');

  // no JavaScript (an in-app browser that blocks it): the noscript link
  const ctx = await browser.newContext({javaScriptEnabled: false, viewport: {width: 375, height: 812}});
  const bare = await ctx.newPage();
  await bare.goto(CLIENT);
  await expect(bare.getByRole('link', {name: 'Message James on WhatsApp', exact: true})).toBeVisible();
  await expect(bare.locator(WA)).toHaveCount(2);
  await ctx.close();
});

test('owner Modify on a new request: add a service, off-grid start, +15, price, note, then the accept link and Confirm as changed', async ({page}) => {
  await page.goto(OWNER);
  await page.getByRole('button', {name: 'Modify'}).click();
  await expect(page.getByRole('heading', {name: /^Modify Alex's booking$/})).toBeVisible();
  await screenOk(page, 'modify');
  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:45');
  await page.getByRole('button', {name: '15 minutes longer'}).click();
  await expect(page.locator('#mlen')).toHaveText('2 h 20, runs until 13:05');
  await page.getByLabel(/Price in baht/).fill('1999');
  await expect(page.locator('#mtot')).toHaveText('฿1,999');
  await page.getByLabel(/One line/).fill('Toner added, see you then');
  await page.getByRole('button', {name: 'Send changes'}).click();
  await expect(page.getByRole('heading', {level: 1, name: /^Proposed: Sat 7 Nov, 10:45$/})).toBeVisible();
  const link = await page.locator('.linkbox a').getAttribute('href');
  await screenOk(page, 'proposed after modify');
  await page.goto('/shadesofbkk/' + link);
  await expect(page.getByText('Toner added, see you then')).toBeVisible();
  await expect(page.getByText('฿1,999, 2 h 20')).toBeVisible();
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText('Toner added, see you then')).toBeVisible();

  // Confirm as changed: a fresh sample, the changed total confirmed at once.
  await page.goto(OWNER);
  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('button', {name: 'Confirm as changed'}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByText('฿2,100, 2 h 5')).toBeVisible();
});

test('owner Modify on a confirmed booking: Confirm as changed stays confirmed; Send changes holds the original', async ({page}) => {
  await page.goto(OWNER + '&sample=confirmed');
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('button', {name: 'Confirm as changed'}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByText('฿2,100, 2 h 5')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Wrap up'})).toBeVisible();

  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByRole('checkbox', {name: /Fringe trim/}).check();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('12:00');
  await page.getByRole('button', {name: 'Send changes'}).click();
  await expect(page.getByRole('heading', {level: 1, name: /^Proposed: Sat 7 Nov, 12:00$/})).toBeVisible();
  await expect(page.getByText(/Their confirmed time, Thu 5 Nov, 13:30, stays held/)).toBeVisible();
  await screenOk(page, 'confirmed then proposed');
  const link = await page.locator('.linkbox a').getAttribute('href');
  await page.goto('/shadesofbkk/' + link);
  await expect(page.getByText(/Your current time, Thu 5 Nov, 13:30, stays held/)).toBeVisible();
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText(/Sat 7 Nov, 12:00 to/)).toBeVisible();
});

test('wrap up: private note stays private, next time reaches the client, rebooking takes one tap', async ({page}) => {
  await page.goto(CLIENT);
  await fillAndBook(page, KNOWN);
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await page.goto(OWNER);
  await page.getByRole('button', {name: 'Wrap up'}).click();
  await expect(page.getByRole('heading', {name: 'Wrap up Alex'})).toBeVisible();
  await screenOk(page, 'wrap up');
  await page.getByRole('button', {name: 'Tone next visit'}).click();
  await page.getByLabel('Private note (only you see this)').fill('secret formula 7.1 and 20 vol');
  await expect(page.getByText('Next visit around Sat 19 Dec')).toBeVisible();
  await page.getByRole('button', {name: '+1 week'}).click();
  await expect(page.getByText('Next visit around Sat 26 Dec')).toBeVisible();
  await page.getByRole('button', {name: '\u22121 week'}).click();
  await page.getByRole('button', {name: 'Another day'}).click();
  await expect(page.getByLabel('Pick a day')).toBeVisible();
  await page.getByRole('button', {name: 'Mark done'}).click();
  await expect(page.getByText('Done. Visit logged.')).toBeVisible();
  await expect(page.getByText('secret formula 7.1 and 20 vol')).toBeVisible(); // James sees it
  await page.getByRole('button', {name: 'Rebook'}).click();
  await screenOk(page, 'rebook');
  await page.locator('#rebooks button').first().click();
  await expect(page.getByRole('heading', {name: /^Booked: Fri 18 Dec, 10:00\.$/})).toBeVisible();
  await expect(page.getByText('Invite on its way.')).toBeVisible();
  const b = await stored(page);
  expect(JSON.stringify(b)).not.toContain('secret formula');

  await page.goto(`/shadesofbkk/index.html?booking=${b.id}&now=${encodeURIComponent('2026-11-03T09:00:00+07:00')}`);
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText('Next time: Tone next visit')).toBeVisible();
  expect(await page.content()).not.toContain('secret formula');
});

test('wrap up in two taps: a note chip and a rebook slot, no Mark done needed', async ({page}) => {
  await page.goto(OWNER + '&sample=confirmed&view=wrap');
  await page.getByRole('button', {name: 'Same formula'}).click();
  await page.locator('#rebooks button').nth(1).click();
  await expect(page.getByRole('heading', {name: /^Booked: \w{3} \d+ Dec, 10:00\.$/})).toBeVisible();
  await expect(page.getByText('Next time: Same formula')).toBeVisible();
});

test('fonts: Young Serif for the name and heads, Hanken Grotesk for the rest, baht sign intact', async ({page}) => {
  await page.goto(CLIENT);
  await page.evaluate(() => document.fonts.ready);
  const fam = await page.evaluate(() => ({h1: getComputedStyle(document.querySelector('h1')).fontFamily, body: getComputedStyle(document.body).fontFamily}));
  expect(fam.h1.startsWith('"Young Serif"')).toBe(true);
  expect(fam.body.startsWith('"Hanken Grotesk"')).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px "Hanken Grotesk"'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px "Young Serif"'))).toBe(true);
  await expect(page.locator('.svc .price').first()).toContainText('฿');
});
