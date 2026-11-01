import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {busyFromEvents, mergeIntervals, computeSlots, isFree, nextFits, expiresAt, nextDays, timeLabel, dayLabel, dayOf, isClosedDay, durationLabel, thbLabel, tooLong, nextVisit} from '../public/shadesofbkk/slots.mjs';

const menu = JSON.parse(await readFile(new URL('../public/shadesofbkk/menu.placeholder.json', import.meta.url), 'utf8'));
const salon = menu.salon;
const T = (day, hhmm) => Date.parse(`${day}T${hhmm}:00+07:00`);
const timed = (day, a, b, extra = {}) => ({id: a + b, summary: 'x', start: {dateTime: `${day}T${a}:00+07:00`}, end: {dateTime: `${day}T${b}:00+07:00`}, ...extra});
const allDay = (day, end, extra = {}) => ({id: 'ad' + day, summary: 'x', start: {date: day}, end: {date: end}, ...extra});
const NOW = T('2026-11-03', '09:00'); // Tue
const base = {salon, now: NOW, known: true, totalMinutes: 45};

test('an all-day event (any title) and an unrostered weekday close the day; no slots', () => {
  const day = '2026-11-05'; // Thu
  assert.deepEqual(computeSlots({...base, day, events: [allDay(day, '2026-11-06', {summary: 'Closed'})]}), []);
  assert.deepEqual(computeSlots({...base, day, events: [allDay(day, '2026-11-06', {summary: 'Studio day'})]}), []);
  assert.deepEqual(computeSlots({...base, day: '2026-11-09', events: []}), []); // Monday: no window
  assert(isClosedDay({day: '2026-11-09', salon, events: []}));
  assert(isClosedDay({day, salon, events: [allDay(day, '2026-11-06', {transparency: 'transparent'})]}));
  assert(!isClosedDay({day, salon, events: [timed(day, '14:00', '15:00')]}));
});

test('a timed "Closed" event blocks only its own hours, whatever its transparency', () => {
  const day = '2026-11-05';
  for (const extra of [{}, {transparency: 'transparent'}]) {
    const events = [timed(day, '15:00', '19:00', {summary: ' CLOSED ', ...extra})];
    assert(!isClosedDay({day, salon, events}));
    const slots = computeSlots({...base, day, now: T('2026-11-01', '09:00'), events});
    assert.equal(slots.find((s) => s.label === '10:00').ok, true, 'morning stays open');
    assert.equal(slots.find((s) => s.label === '15:00').ok, false);
  }
});

test('busy follows booking status: pending, proposed, confirmed block; declined and expired do not', () => {
  const day = '2026-11-04', held = (status) => timed(day, '12:00', '13:00', {extendedProperties: {private: {status}}});
  for (const status of ['pending', 'proposed', 'confirmed']) assert.equal(busyFromEvents([held(status)], day).length, 1, status);
  for (const status of ['declined', 'expired']) assert.equal(busyFromEvents([held(status)], day).length, 0, status);
  assert(!isClosedDay({day, salon, events: [allDay(day, '2026-11-05', {extendedProperties: {private: {status: 'expired'}}})]}));
});

test('a 90-minute job at 12:00 fails only because of the 15-minute buffer', () => {
  const day = '2026-11-04', events = [timed(day, '13:30', '15:00')], args = {...base, day, totalMinutes: 90, now: T('2026-11-01', '09:00'), events};
  const at = (slots, hhmm) => slots.find((s) => s.label === hhmm).ok;
  assert.equal(at(computeSlots(args), '12:00'), false); // 12:00 + 90 = 13:30 touches, + buffer overlaps
  assert.equal(at(computeSlots(args), '11:30'), true);
  assert.equal(at(computeSlots({...args, salon: {...salon, buffer_min: 0}}), '12:00'), true);
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
  assert.equal(busyFromEvents([timed(day, '11:00', '12:00', {transparency: 'transparent', summary: 'Closed'}), allDay(day, '2026-11-05')], day).length, 2);
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
  assert(next[0].start < next[1].start && next[1].start < next[2].start, 'suggestions ascend');
});

test('tooLong: a job plus buffer must fit the longest window', () => {
  assert.equal(tooLong(45, salon), false);
  assert.equal(tooLong(525, salon), false); // 9 h window: 525 + 15 fits exactly
  assert.equal(tooLong(600, salon), true);
});

test('nextFits(...,1) gives the first ok start: 11:00 known, 15:00 unknown, and skips a closed day', () => {
  const args = {...base, events: []};
  assert.equal(nextFits({...args, known: true}, NOW, 1)[0].label, '11:00');
  assert.equal(nextFits({...args, known: false}, NOW, 1)[0].label, '15:00');
  const closedTue = [allDay('2026-11-03', '2026-11-04')];
  const first = nextFits({...args, events: closedTue}, NOW, 1)[0];
  assert.equal(dayOf(first.start), '2026-11-04');
  assert.equal(first.label, '10:00');
});

test('nextVisit: longest interval wins, falls back to 6 weeks, and a closed Monday lands on Tuesday', () => {
  assert.equal(nextVisit(['cut', 'colour_full'], '2026-11-03', salon), '2026-12-29'); // +8 w, a Tuesday
  assert.equal(nextVisit(['cut', 'treatment'], '2026-11-03', salon), '2026-12-15'); // +6 w
  assert.equal(nextVisit(['toner'], '2026-11-03', salon), '2026-12-15'); // no interval: 6 w
  assert.equal(nextVisit(['cut'], '2026-11-02', salon), '2026-12-15'); // Mon 2 Nov +6 w = Mon 14 Dec, closed -> Tue 15
});

test('thbLabel: a null price reads as quoted on the day', () => {
  assert.equal(thbLabel(null), 'Quoted on the day');
  assert.equal(thbLabel(1200), '฿1,200');
});
