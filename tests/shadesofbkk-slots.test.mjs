import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {busyFromEvents, mergeIntervals, computeSlots, isFree, nextFits, expiresAt, nextDays, timeLabel, dayLabel, dayOf, isClosedDay, resolveBusy, parseNow, durationLabel} from '../public/shadesofbkk/slots.mjs';

const menu = JSON.parse(await readFile(new URL('../public/shadesofbkk/menu.placeholder.json', import.meta.url), 'utf8'));
const salon = menu.salon;
const busyRows = JSON.parse(await readFile(new URL('../public/shadesofbkk/busy.placeholder.json', import.meta.url), 'utf8'));
const T = (day, hhmm) => Date.parse(`${day}T${hhmm}:00+07:00`);
const timed = (day, a, b, extra = {}) => ({id: a + b, summary: 'x', start: {dateTime: `${day}T${a}:00+07:00`}, end: {dateTime: `${day}T${b}:00+07:00`}, ...extra});
const allDay = (day, end, extra = {}) => ({id: 'ad' + day, summary: 'x', start: {date: day}, end: {date: end}, ...extra});
const NOW = T('2026-11-03', '09:00'); // Tue
const base = {salon, now: NOW, known: true, totalMinutes: 45};

test('closed all-day, "Closed" title and unrostered weekday are closed days with no slots', () => {
  const day = '2026-11-05'; // Thu
  assert.deepEqual(computeSlots({...base, day, events: [allDay(day, '2026-11-06', {summary: 'Closed'})]}), []);
  assert.deepEqual(computeSlots({...base, day: '2026-11-09', events: []}), []); // Monday: no window
  assert(isClosedDay({day: '2026-11-09', salon, events: []}));
  assert(isClosedDay({day, salon, events: [timed(day, '14:00', '15:00', {summary: ' CLOSED ', transparency: 'transparent'})]}));
  assert(!isClosedDay({day, salon, events: [timed(day, '14:00', '15:00')]}));
});

test('merge overlapping and adjacent intervals', () => {
  const h = (a, b) => ({start: T('2026-11-04', a), end: T('2026-11-04', b)});
  assert.deepEqual(mergeIntervals([h('10:30', '12:00'), h('12:00', '13:00'), h('10:00', '11:00')]), [h('10:00', '13:00')]);
});

test('a slot needs job + buffer to fit before the next busy block and the window end', () => {
  const day = '2026-11-04';
  const slots = computeSlots({...base, day, totalMinutes: 105, now: T('2026-11-01', '09:00'), events: [timed(day, '13:30', '15:15')]});
  const at = (hhmm) => slots.find((s) => s.label === hhmm);
  assert.equal(at('11:30').ok, true);
  assert.equal(at('12:00').ok, false);
  assert.equal(at('17:00').ok, true);
  assert.equal(at('17:30'), undefined);
});

test('minimum notice: known clients 120 min, unknown 360 min', () => {
  const day = '2026-11-03';
  const first = (known) => computeSlots({...base, day, known, events: []}).find((s) => s.ok).label;
  assert.equal(first(true), '11:00');
  assert.equal(first(false), '15:00');
});

test('transparency: all-day blocks, timed transparent is free, timed transparent Closed blocks', () => {
  const day = '2026-11-04';
  assert.equal(busyFromEvents([allDay(day, '2026-11-05', {transparency: 'transparent'})], day).length, 1);
  assert.equal(busyFromEvents([timed(day, '11:00', '12:00', {transparency: 'transparent'})], day).length, 0);
  assert.equal(busyFromEvents([timed(day, '11:00', '12:00', {transparency: 'transparent', summary: 'Closed'})], day).length, 1);
  assert.equal(busyFromEvents([timed(day, '11:00', '12:00', {status: 'cancelled'})], day).length, 0);
});

test('an open day with every start taken is not closed: slots exist, none ok', () => {
  const day = '2026-11-04';
  const slots = computeSlots({...base, day, events: [timed(day, '10:00', '19:00', {summary: 'Private'})]});
  assert(slots.length > 0);
  assert(slots.every((s) => !s.ok));
});

test('excludeId drops the booking being decided from the busy set', () => {
  const day = '2026-11-04', hold = timed(day, '13:30', '15:30', {id: 'demo-alex'});
  const ok = (excludeId) => computeSlots({...base, day, now: T('2026-11-01', '09:00'), events: [hold], excludeId}).find((s) => s.label === '13:30').ok;
  assert.equal(ok(undefined), false);
  assert.equal(ok('demo-alex'), true);
});

test('labels and Bangkok days', () => {
  assert.equal(timeLabel(Date.parse('2026-11-04T06:30:00Z')), '13:30');
  assert.equal(dayLabel('2026-11-04'), 'Wed 4 Nov');
  assert.equal(dayOf(Date.parse('2026-11-03T18:00:00Z')), '2026-11-04');
  const days = nextDays(NOW, 14);
  assert.equal(days.length, 14);
  assert.equal(days[0], '2026-11-03');
  assert.equal(days[13], '2026-11-16');
  assert.equal(durationLabel(105), '1 h 45');
  assert.equal(durationLabel(40), '40 min');
});

test('demo clock: ?now pins it, otherwise real time', () => {
  assert.equal(parseNow('?now=2026-11-03T09:00:00%2B07:00', 1), NOW);
  assert.equal(parseNow('', 123), 123);
  assert.equal(parseNow('?now=garbage', 123), 123);
});

test('placeholder busy rows resolve from day offsets and behave', () => {
  const events = resolveBusy(busyRows, '2026-11-03');
  const closed = events.find((e) => e.summary === 'Closed');
  assert.equal(closed.start.date, '2026-11-04');
  assert(isClosedDay({day: '2026-11-04', salon, events}));
  const transparentAllDay = events.find((e) => e.start.date && e.transparency === 'transparent');
  assert(isClosedDay({day: transparentAllDay.start.date, salon, events}), 'transparent all-day still blocks');
  const timedTransparent = events.find((e) => e.start.dateTime && e.transparency === 'transparent');
  assert.equal(busyFromEvents([timedTransparent], dayOf(Date.parse(timedTransparent.start.dateTime))).length, 0);
});

test('expiresAt takes the earlier of hold and confirm lead', () => {
  assert.equal(expiresAt(NOW, T('2026-11-09', '12:00'), salon), NOW + 12 * 3600e3);
  assert.equal(expiresAt(NOW, T('2026-11-03', '17:00'), salon), T('2026-11-03', '15:00'));
});

test('isFree treats touching as free; nextFits gives three later ok starts', () => {
  const day = '2026-11-04', busy = [{start: T(day, '12:00'), end: T(day, '13:00')}];
  assert.equal(isFree(T(day, '11:00'), T(day, '12:00'), busy), true);
  assert.equal(isFree(T(day, '11:30'), T(day, '12:30'), busy), false);
  const from = T(day, '13:30');
  const next = nextFits({...base, events: [timed(day, '13:30', '15:30')]}, from);
  assert.equal(next.length, 3);
  assert(next.every((s) => s.ok && s.start > from));
  assert(next[0].start < next[1].start && next[1].start < next[2].start);
});
