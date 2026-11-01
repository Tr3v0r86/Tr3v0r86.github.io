import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import {parseNow, resolveBusy} from '../public/shadesofbkk/demo.mjs';
import {busyFromEvents, isClosedDay, dayOf, weekdayOf} from '../public/shadesofbkk/slots.mjs';
import {WA_URL} from '../public/shadesofbkk/demo.mjs';

const {salon} = JSON.parse(await readFile(new URL('../public/shadesofbkk/menu.placeholder.json', import.meta.url), 'utf8'));
const rows = JSON.parse(await readFile(new URL('../public/shadesofbkk/busy.placeholder.json', import.meta.url), 'utf8'));
const T = (day, hhmm) => Date.parse(`${day}T${hhmm}:00+07:00`);

test('demo clock: ?now pins it, otherwise real time', () => {
  assert.equal(parseNow('?now=2026-11-03T09:00:00%2B07:00', 1), T('2026-11-03', '09:00'));
  assert.equal(parseNow('', 123), 123);
  assert.equal(parseNow('?now=garbage', 123), 123);
});

test('placeholder events resolve from the pinned day and behave under the busy rule', () => {
  const events = resolveBusy(rows, '2026-11-03', salon);
  const day = (e) => (e.start.date || dayOf(Date.parse(e.start.dateTime)));
  assert.equal(events.find((e) => e.summary === 'Closed' && e.start.date).start.date, '2026-11-04');
  const studio = events.find((e) => e.start.date && e.transparency === 'transparent');
  assert(isClosedDay({day: studio.start.date, salon, events}), 'transparent all-day still closes the day');
  const reminder = events.find((e) => e.summary === 'Reminder');
  assert.equal(busyFromEvents([reminder], day(reminder)).length, 0, 'timed transparent does not block');
  const timedClosed = events.find((e) => e.summary === 'Closed' && e.start.dateTime);
  assert.equal(timedClosed.transparency, 'transparent');
  assert.equal(busyFromEvents([timedClosed], day(timedClosed)).length, 1, 'timed Closed blocks its hours');
  assert(!isClosedDay({day: day(timedClosed), salon, events}), 'timed Closed leaves the day open');
});

test('offsets count rostered days: no event ever lands on the closed weekday, from any starting day', () => {
  for (let i = 0; i < 14; i++) {
    const today = dayOf(T('2026-11-01', '12:00') + i * 864e5);
    const events = resolveBusy(rows, today, salon);
    for (const e of events) assert.notEqual(weekdayOf(e.start.date || dayOf(Date.parse(e.start.dateTime))), 1, today);
    assert.equal(new Set(events.filter((e) => e.start.date).map((e) => e.start.date)).size, events.filter((e) => e.start.date).length);
  }
});

test('font files stay inside the 180 KB budget', async () => {
  const dir = new URL('../public/shadesofbkk/fonts/', import.meta.url);
  const sizes = await Promise.all((await readdir(dir)).filter((f) => f.endsWith('.woff2')).map(async (f) => (await stat(new URL(f, dir))).size));
  assert.equal(sizes.length, 2);
  assert(sizes.reduce((a, b) => a + b, 0) < 180000);
});

test('the hard-coded WhatsApp links in index.html (footer, noscript) match WA_URL', async () => {
  const html = await readFile(new URL('../public/shadesofbkk/index.html', import.meta.url), 'utf8');
  assert.equal(html.split(`href="${WA_URL}"`).length - 1, 2);
});

test('the owner is James everywhere', async () => {
  const dir = new URL('../public/shadesofbkk/', import.meta.url);
  for (const f of ['index.html', 'owner.html', 'state.mjs', 'slots.mjs', 'demo.mjs', 'menu.placeholder.json', 'style.css']) {
    assert(!new RegExp('\\b' + ['Ji', 'm'].join('') + '\\b').test(await readFile(new URL(f, dir), 'utf8')), f);
  }
  assert.equal(salon.owner_name, 'James');
});
