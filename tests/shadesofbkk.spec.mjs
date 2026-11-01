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

// The accept link lives inside the "Send to <name> on WhatsApp" message, as an absolute URL.
async function acceptUrl(page) {
  const href = await page.locator('#sendwa').getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/66800000001\?text=/);
  const text = new URL(href).searchParams.get('text');
  return text.match(/https?:\/\/\S+/)[0];
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
  await expect(page.locator('.when')).toHaveText(/^Sat 7 Nov, \d\d:\d\d$/);
  await expect(page.locator('#done .ready')).toHaveText(/^Ready by \d\d:\d\d$/);
  await expect(page.getByText('+66 81 234 5678')).toBeVisible(); // displayed formatted, stored E.164
  expect(bookingId(page)).toBeTruthy();
  await screenOk(page, 'confirmation');
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();

  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await fillAndBook(page, UNKNOWN);
  await expect(page.getByRole('heading', {name: 'Request received.'})).toBeVisible();
  await expect(page.getByText(/the time is released; please don't come in until it's confirmed/)).toBeVisible();
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
  // no time yet: the CTA is quiet, aria-disabled, still focusable, and says why
  const cta = page.getByRole('button', {name: 'Pick a time'});
  await expect(cta).toHaveAttribute('aria-disabled', 'true');
  await expect(cta).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await cta.focus();
  await expect(cta).toBeFocused();
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await page.getByRole('radio', {name: 'Tue 3 Nov'}).check();
  const first = () => page.locator('#slotbox input:not(:disabled) + .vis').first();
  await expect(first()).toHaveText('15:00'); // unknown number: 6 h notice
  await page.locator('#slotbox input:not(:disabled)').first().check();
  await expect(page.getByRole('button', {name: 'Request 15:00'})).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByRole('button', {name: 'Request 15:00'})).toHaveCSS('background-color', 'rgb(90, 44, 79)');
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

test('day states, next available and next open, fully booked, too long, lookup failure, and the propose, accept and stale links', async ({page}) => {
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
    await expect(page.locator('#slotbox')).toContainText('Closed');
    await expect(page.locator('#slotbox').getByRole('button', {name: /^Next open: /})).toBeVisible();
  }
  expect(await page.locator('#days .day.closed').count()).toBeGreaterThanOrEqual(4); // Wed, Fri, and both Mondays
  await page.getByRole('radio', {name: 'Mon 9 Nov'}).check();
  await expect(page.locator('#slotbox')).toContainText('Closed');
  await page.getByRole('button', {name: /^Next open: Tue 10 Nov, 10:00$/}).click();
  await expect(page.getByRole('radio', {name: 'Tue 10 Nov'})).toBeChecked();
  await expect(page.locator('#slotbox input:checked')).toHaveCount(1);
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
  await expect(page.locator('#nextavail button'), 'the top button hides while the day is fully booked').toHaveCount(0);
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
  const link1 = await acceptUrl(page);
  await expect(page.getByRole('heading', {level: 1, name: /^Proposed: \w{3} \d+ Nov, \d\d:\d\d$/})).toBeVisible();
  await expect(page.getByText('Waiting for Alex to accept.')).toBeVisible();
  await expect(page.getByText(/Offer lapses in/)).toBeVisible();
  await expect(page.locator('.linkbox'), 'no raw accept URL on screen').toHaveCount(0);
  await page.getByRole('button', {name: 'Propose again'}).click();
  await page.locator('#proposals button').nth(1).click();
  const link2 = await acceptUrl(page);
  expect(link2).not.toBe(link1);
  await page.goto(link1);
  await expect(page.getByText('This proposal is no longer current.')).toBeVisible();
  await expect(page.locator('#done ' + WA)).toBeVisible();
  await page.goto(link2);
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

test('owner Decline is a second-tap link, never a tile; the declined screen offers WhatsApp to the client', async ({page}) => {
  await page.goto(OWNER);
  const decline = page.getByRole('button', {name: 'Decline'});
  await expect(decline).toHaveCSS('border-top-width', '0px'); // text weight, not a button tile
  await decline.click();
  await expect(page.getByText('Declined.')).toHaveCount(0); // one tap is not enough
  await page.getByRole('button', {name: 'Tap again to decline'}).click();
  await expect(page.getByText('Declined.')).toBeVisible();
  await expect(page.getByRole('link', {name: 'Message Alex on WhatsApp'}).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/66800000001$/);
  await screenOk(page, 'declined');
});

test('every client end state carries the WhatsApp door; footer and noscript too; Book another and a plain revisit show an empty form', async ({page, browser}) => {
  await page.goto(CLIENT);
  await expect(page.locator('.foot ' + WA)).toBeVisible();
  await fillAndBook(page, KNOWN);
  await expect(page.locator('#done ' + WA).first()).toBeVisible();
  await expect(page.getByText('Need to move it?')).toBeVisible();
  await expect(page.locator('.foot ' + WA)).toBeVisible();
  await expect(page.getByRole('heading', {level: 1})).toBeFocused(); // focus follows the view change

  await page.getByRole('link', {name: 'Book another'}).click();
  await expect(page.getByRole('heading', {name: 'Book your chair.'})).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('');
  expect(page.url()).toContain('now=');
  await page.goto(CLIENT);
  await expect(page.getByLabel('Name')).toHaveValue(''); // sessionStorage no longer traps the page in the old booking
  // the first booking's time (Sat 7, 10:00-11:00 with buffer) is taken for this browser's next booking
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByRole('checkbox', {name: /Cut & style/}).check();
  await expect(page.locator('#slotbox input:disabled + .vis').first()).toHaveText('10:00');

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

  // no JavaScript (an in-app browser that blocks it): the noscript link, and no dead form
  const ctx = await browser.newContext({javaScriptEnabled: false, viewport: {width: 375, height: 812}});
  const bare = await ctx.newPage();
  await bare.goto(CLIENT);
  await expect(bare.getByRole('link', {name: 'Message James on WhatsApp', exact: true})).toBeVisible();
  await expect(bare.locator(WA)).toHaveCount(2);
  await expect(bare.locator('#flow')).toBeHidden();
  await expect(bare.locator('#bar')).toBeHidden();
  await ctx.close();
});

test('owner Modify on a new request: back, labels, warnings, price override, too soon, then the accept link and Save, already agreed', async ({page, context}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(OWNER);
  // Back control and the phone's back gesture both return to the booking without committing
  await page.getByRole('button', {name: 'Modify'}).click();
  await expect(page.getByRole('heading', {name: /^Modify Alex's booking$/})).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('heading', {level: 1, name: /^Alex wants Thu 5 Nov, 13:30\.$/})).toBeVisible();
  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByRole('button', {name: 'Back'}).click();
  await expect(page.getByRole('heading', {level: 1, name: /^Alex wants Thu 5 Nov, 13:30\.$/})).toBeVisible();
  await page.getByRole('button', {name: 'Modify'}).click();
  await expect(page.getByRole('heading', {name: /^Modify Alex's booking$/})).toBeVisible();
  await screenOk(page, 'modify');
  // pending booking: asking the client is the primary outcome
  await expect(page.getByRole('button', {name: 'Ask Alex to accept'})).toHaveCSS('background-color', 'rgb(90, 44, 79)');
  await expect(page.getByRole('button', {name: 'Save, already agreed'})).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:45');
  await page.getByRole('button', {name: '15 minutes longer'}).click();
  await expect(page.locator('#mlen')).toHaveText('2 h 20, runs until 13:05');
  await expect(page.locator('#msub')).toHaveText('Sat 7 Nov, 10:45\u201313:05');
  await page.getByLabel(/Price in baht/).fill('1999');
  await expect(page.locator('#mtot')).toHaveText('฿1,999');
  await expect(page.locator('#pricesum')).toContainText('Your price ฿1,999');
  await expect(page.locator('#pricesum')).toContainText('Menu ฿2,100');
  // a hand-set price belongs to the old services: changing them clears it
  await page.getByRole('checkbox', {name: /Fringe trim/}).check();
  await expect(page.locator('#pricesum')).toHaveText('');
  await expect(page.locator('#mtot')).toHaveText('฿2,300');
  await page.getByRole('checkbox', {name: /Fringe trim/}).uncheck();
  await page.getByLabel(/Price in baht/).fill('1999');
  await page.getByRole('button', {name: 'Use menu price'}).click();
  await expect(page.locator('#mtot')).toHaveText('฿2,100');
  await page.locator('#totbtn').click(); // the bar total is a way to the price field
  await expect(page.getByLabel(/Price in baht/)).toBeFocused();
  await page.getByLabel(/Price in baht/).fill('1999');
  // an off-grid start that stops being valid is cleared (Fri 6 is closed all day)
  await page.getByRole('radio', {name: 'Fri 6 Nov'}).check();
  await expect(page.locator('#msub')).toHaveText('Pick a time');
  await expect(page.getByRole('button', {name: 'Save, already agreed'})).toBeDisabled();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:45');
  // a warning, not a block, when it runs past closing (Sun 8, 17:30 + 2 h 5)
  await page.getByRole('radio', {name: 'Sun 8 Nov'}).check();
  await page.getByLabel('Or type a start').fill('17:30');
  await expect(page.locator('#mwarn')).toHaveText('Runs past closing (19:00)');
  await expect(page.getByRole('button', {name: 'Ask Alex to accept'})).toBeEnabled();
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:45');
  await expect(page.locator('#mwarn')).toHaveText('');
  await page.getByLabel(/One line/).fill('Toner added, see you then');

  // too close to the start for the client to accept: its own outcome, with the way out
  await page.getByRole('radio', {name: 'Tue 3 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:00');
  await page.getByRole('button', {name: 'Ask Alex to accept'}).click();
  await expect(page.locator('#mtaken')).toContainText('Too close to the start for Alex to accept. Use Save, already agreed, or message Alex.');
  await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
  await page.getByLabel('Or type a start').fill('10:45');
  await expect(page.locator('#mtaken')).toContainText('Too close'); // stays until the next try
  await page.getByRole('button', {name: 'Ask Alex to accept'}).click();
  await expect(page.getByRole('heading', {level: 1, name: /^Proposed: Sat 7 Nov, 10:45$/})).toBeVisible();

  // proposed: Send on WhatsApp is the primary, the link is copyable, no raw URL on screen
  const send = page.getByRole('link', {name: 'Send to Alex on WhatsApp'});
  await expect(send).toHaveCSS('background-color', 'rgb(43, 29, 24)');
  const href = await send.getAttribute('href');
  expect(href).toMatch(/^https:\/\/wa\.me\/66800000001\?text=Hi%20Alex/);
  const link = await acceptUrl(page);
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4173\/shadesofbkk\/index\.html\?accept=demo-alex%3A\d+%3A\w+&now=/);
  await page.getByRole('button', {name: 'Copy link'}).click();
  await expect(page.locator('#toast')).toHaveText('Link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await expect(page.getByText('Offer lapses in')).toBeVisible();
  await screenOk(page, 'proposed after modify');
  await page.goto(link);
  await expect(page.getByText('Toner added, see you then')).toBeVisible();
  await expect(page.getByText('฿1,999, 2 h 20')).toBeVisible();
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText('Toner added, see you then')).toBeVisible();

  // Save, already agreed: a fresh sample, the changed total confirmed at once.
  await page.goto(OWNER);
  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('button', {name: 'Save, already agreed'}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByText('฿2,100, 2 h 5')).toBeVisible();
});

test('owner Modify on a confirmed booking: Save stays confirmed; Ask holds the original; Withdraw restores it; the client sees the diff', async ({page}) => {
  await page.goto(OWNER + '&sample=confirmed');
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Modify'})).toHaveCSS('background-color', 'rgb(43, 29, 24)'); // before the start: Modify leads
  await expect(page.getByRole('button', {name: 'Wrap up'})).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('dl.detail dt').first()).toHaveText(/When/); // first row, with the number as a WhatsApp link below it
  await expect(page.getByRole('link', {name: 'Message Alex on WhatsApp'})).toBeVisible();
  await page.getByRole('button', {name: 'Modify'}).click();
  await expect(page.getByRole('button', {name: 'Save, already agreed'})).toHaveCSS('background-color', 'rgb(90, 44, 79)'); // confirmed: Save leads
  await page.getByRole('checkbox', {name: /Toner/}).check();
  await page.getByRole('button', {name: 'Save, already agreed'}).click();
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByText('฿2,100, 2 h 5')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Wrap up'})).toBeVisible();

  const change = async () => {
    await page.getByRole('button', {name: 'Modify'}).click();
    await page.getByRole('checkbox', {name: /Fringe trim/}).check();
    await page.getByRole('radio', {name: 'Sat 7 Nov'}).check();
    await page.getByLabel('Or type a start').fill('12:00');
    await page.getByRole('button', {name: 'Ask Alex to accept'}).click();
    await expect(page.getByRole('heading', {level: 1, name: /^Proposed: Sat 7 Nov, 12:00$/})).toBeVisible();
  };
  await change();
  await expect(page.getByText(/Their confirmed time, Thu 5 Nov, 13:30, stays held/)).toBeVisible();
  await page.getByRole('button', {name: 'Withdraw changes'}).click(); // one tap: it restores, it does not decline
  await expect(page.getByText('Confirmed.')).toBeVisible();
  await expect(page.getByText('Declined.')).toHaveCount(0);
  await expect(page.getByText('Thu 5 Nov, 13:30 to 15:35')).toBeVisible();
  await expect(page.getByText('฿2,100, 2 h 5')).toBeVisible();

  await change();
  await screenOk(page, 'confirmed then proposed');
  const link = await acceptUrl(page);
  // the client's plain revisit: the confirmed booking on top, the suggestion under it
  await page.goto(`/shadesofbkk/index.html?booking=demo-alex&now=${encodeURIComponent('2026-11-03T09:00:00+07:00')}`);
  await expect(page.getByRole('heading', {level: 1, name: 'Confirmed: Thu 5 Nov, 13:30'})).toBeVisible();
  await expect(page.getByText(/What to look for:/)).toBeVisible();
  await expect(page.getByRole('heading', {level: 2, name: 'James suggested a change'})).toBeVisible();
  await expect(page.locator('ul.diff li')).toHaveText(['Added: Fringe trim', 'New time: Sat 7 Nov, 12:00', 'New total: ฿2,300', 'New end: 14:15']);
  await screenOk(page, 'client sees a suggested change');
  // lapsed: the confirmed booking stands
  await page.goto(`/shadesofbkk/index.html?booking=demo-alex&now=${encodeURIComponent('2026-11-04T09:00:00+07:00')}`);
  await expect(page.getByRole('heading', {level: 1, name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText("James's suggested change has lapsed; your booking on Thu 5 Nov, 13:30 stands.")).toBeVisible();
  // the accept page
  await page.goto(link);
  await expect(page.getByRole('heading', {level: 1, name: 'James suggested a change to your booking'})).toBeVisible();
  await expect(page.locator('ul.diff li').first()).toHaveText('Added: Fringe trim');
  await page.getByRole('button', {name: 'Accept'}).click();
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText(/Sat 7 Nov, 12:00/).first()).toBeVisible();
});

test('wrap up: rebook first, services as chips recompute, the private note survives, Undo restores the visit', async ({page}) => {
  await page.goto(CLIENT);
  await fillAndBook(page, KNOWN);
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await page.goto(OWNER);
  await page.getByRole('button', {name: 'Wrap up'}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Wrap up Alex'})).toBeFocused();
  await expect(page.getByRole('heading', {name: 'Rebook', exact: true})).toHaveCount(0);
  await screenOk(page, 'wrap up');
  // rebook is first, and the sticky button does not cover the first row of times
  const first = page.locator('#rebooks button').first();
  const bar = await page.locator('#bar').boundingBox(), slot = await first.boundingBox();
  expect(slot.y + slot.height).toBeLessThanOrEqual(bar.y);
  await expect(page.getByText('Around Sat 19 Dec')).toBeVisible();
  await expect(first).toContainText('45 min');
  await expect(page.getByRole('button', {name: 'Done, no rebook'})).toBeVisible();
  // tick Full colour: 8 weeks, 2 h 45, times follow
  await page.locator('details.wsvc summary').click();
  await page.getByRole('checkbox', {name: 'Full colour'}).check();
  await expect(page.getByText('Around Sat 2 Jan')).toBeVisible();
  await expect(page.locator('#wsum')).toHaveText('Services: Cut & style, Full colour');
  await expect(first).toContainText('2 h 45');
  await page.getByRole('button', {name: 'Tone next visit'}).click();
  await page.getByLabel('Private note (only you see this)').fill('secret formula 7.1 and 20 vol');
  await page.getByRole('radio', {name: 'Fri 1 Jan'}).check();
  await first.click();
  await expect(page.getByRole('heading', {name: /^Booked: Fri 1 Jan, 10:00\.$/})).toBeVisible();
  await expect(page.getByText('Saved your private note.')).toBeVisible();
  await expect(page.getByText('Next time: Tone next visit')).toBeVisible();
  await expect(page.getByText('฿3,300, 2 h 45')).toBeVisible();

  // Undo returns to the finished visit with its private note
  await page.getByRole('button', {name: 'Undo booking'}).click();
  await expect(page.getByText('Done. Visit logged.')).toBeVisible();
  await expect(page.getByText('secret formula 7.1 and 20 vol')).toBeVisible();
  // book again from the done visit; the note is kept under the second key and never reaches the client
  await page.getByRole('button', {name: 'Rebook'}).click();
  await expect(page.getByRole('heading', {level: 1, name: 'Rebook Alex'})).toBeVisible();
  await page.locator('#rebooks button').first().click();
  await expect(page.getByRole('heading', {name: /^Booked: \w{3} \d+ Dec, 10:00\.$/})).toBeVisible();
  const b = await stored(page);
  expect(JSON.stringify(b)).not.toContain('secret formula');
  expect(await page.evaluate(() => sessionStorage.getItem('shadesofbkk.last'))).toContain('secret formula');
  await page.getByRole('button', {name: 'Change this booking'}).click();
  await expect(page.getByRole('heading', {name: /^Modify Alex's booking$/})).toBeVisible();
  await page.getByRole('button', {name: 'Back'}).click();

  await page.goto(`/shadesofbkk/index.html?booking=${b.id}&now=${encodeURIComponent('2026-11-03T09:00:00+07:00')}`);
  await expect(page.getByRole('heading', {name: 'Confirmed.'})).toBeVisible();
  await expect(page.getByText('Next time: Tone next visit')).toBeVisible();
  expect(await page.content()).not.toContain('secret formula');
});

test('wrap up carries a hand-set price over a rebook when the services are unchanged', async ({page}) => {
  await page.goto(OWNER + '&sample=confirmed');
  await page.getByRole('button', {name: 'Modify'}).click();
  await page.getByLabel(/Price in baht/).fill('1500');
  await page.getByRole('button', {name: 'Save, already agreed'}).click();
  await expect(page.getByText('฿1,500, 1 h 45')).toBeVisible();
  await page.getByRole('button', {name: 'Wrap up'}).click();
  await page.locator('#rebooks button').first().click();
  await expect(page.getByRole('heading', {name: /^Booked: /})).toBeVisible();
  await expect(page.getByText('฿1,500, 1 h 45')).toBeVisible();
});

test('from the start time on, Wrap up leads and Modify is quiet', async ({page}) => {
  await page.goto(CLIENT);
  await fillAndBook(page, KNOWN); // Sat 7 Nov, 10:00
  const afterStart = '?now=' + encodeURIComponent('2026-11-07T11:00:00+07:00');
  await page.goto('/shadesofbkk/owner.html' + afterStart);
  await expect(page.getByRole('button', {name: 'Wrap up'})).toHaveCSS('background-color', 'rgb(43, 29, 24)');
  await expect(page.getByRole('button', {name: 'Modify'})).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('wrap up in two taps, and Done, no rebook keeps the private note for James only', async ({page}) => {
  await page.goto(OWNER + '&sample=confirmed&view=wrap');
  await page.getByRole('button', {name: 'Same formula'}).click();
  await page.locator('#rebooks button').first().click();
  await expect(page.getByRole('heading', {name: /^Booked: \w{3} \d+ Dec, 10:00\.$/})).toBeVisible();
  await expect(page.getByText('Next time: Same formula')).toBeVisible();

  await page.goto(OWNER + '&sample=confirmed&view=wrap');
  await openDemo(page);
  await page.getByRole('button', {name: 'Reset demo'}).click();
  await page.goto(OWNER + '&sample=confirmed&view=wrap');
  await page.getByLabel('Private note (only you see this)').fill('only for James');
  await page.getByRole('button', {name: 'Done, no rebook'}).click();
  await expect(page.getByText('Done. Visit logged.')).toBeVisible();
  await expect(page.getByText('only for James')).toBeVisible();
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

test('at 320 px the day chips stay 44 px wide and nothing scrolls sideways', async ({page}) => {
  await page.setViewportSize({width: 320, height: 700});
  await page.goto(CLIENT);
  const w = await page.locator('#days .day').first().evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBeGreaterThanOrEqual(43.9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.goto(OWNER + '&sample=confirmed&view=modify');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', {name: 'Save, already agreed'})).toBeVisible();
});
