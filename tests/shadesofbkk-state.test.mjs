import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState, reduce, addonsVisible, totals, validate, normalisePhone, effectiveStatus, ownerAct, accept, proposalOptions} from '../public/shadesofbkk/state.mjs';

const menu = JSON.parse(await readFile(new URL('../public/shadesofbkk/menu.placeholder.json', import.meta.url), 'utf8'));
const clients = JSON.parse(await readFile(new URL('../public/shadesofbkk/clients.placeholder.json', import.meta.url), 'utf8'));
const salon = menu.salon;
const T = (day, hhmm) => Date.parse(`${day}T${hhmm}:00+07:00`);
const NOW = T('2026-11-03', '09:00');
const START = T('2026-11-07', '10:00');
const toggle = (s, id) => reduce(s, {type: 'toggle', id, menu});
const filled = (over = {}) => ({...initialState, selected: ['cut'], slot: START, name: 'Alex', phone: '089 999 0000', email: 'a@example.com', ...over});
const submit = (s, extra = {}) => reduce(s, {type: 'submit', menu, okStarts: [START], clients, now: NOW, salon, id: 'b1', ...extra});

test('add-ons reveal with a main service and clear when the last main goes', () => {
  let s = toggle(initialState, 'toner');
  assert.equal(addonsVisible(s.selected, menu), false);
  s = toggle(initialState, 'cut');
  assert.equal(addonsVisible(s.selected, menu), true);
  s = toggle(toggle(s, 'toner'), 'fringe');
  assert.deepEqual(s.selected, ['cut', 'toner', 'fringe']);
  s = toggle(s, 'cut');
  assert.deepEqual(s.selected, []);
});

test('any service change and any day change clear the slot', () => {
  const s = {...initialState, selected: ['cut'], slot: START};
  assert.equal(toggle(s, 'toner').slot, null);
  assert.equal(reduce(s, {type: 'day', day: '2026-11-08'}).slot, null);
  assert.equal(reduce(s, {type: 'slot', start: START + 1}).slot, START + 1);
});

test('totals add minutes and price', () => {
  assert.deepEqual(totals(['cut', 'toner'], menu), {minutes: 65, thb: 1200});
  assert.deepEqual(totals([], menu), {minutes: 0, thb: 0});
});

test('validate rejects add-on only, consult-first, slot outside the set, bad phone, bad email', () => {
  const v = (over) => validate(filled(over), menu, [START]);
  assert.deepEqual(v({}), {});
  assert(v({selected: ['toner']}).services);
  assert(v({selected: ['cut', 'correction']}).services);
  assert(v({selected: ['nope']}).services);
  assert(v({slot: START + 1}).slot);
  assert(v({slot: null}).slot);
  assert(v({name: '  '}).name);
  assert(v({phone: '12'}).phone);
  assert(v({email: 'not-an-email'}).email);
});

test('phone normalisation', () => {
  for (const raw of ['081-234 5678', '66812345678', '+66 81 234 5678', '(081) 234.5678', '0066812345678']) assert.equal(normalisePhone(raw), '+66812345678', raw);
  assert.equal(normalisePhone('12'), null);
  assert.equal(normalisePhone(''), null);
});

test('known phone confirms at once; unknown is pending with the hold formula; double submit is idempotent', () => {
  const known = submit(filled({phone: '081 234 5678'})).booking;
  assert.equal(known.status, 'confirmed');
  assert.equal(known.expiresAt, null);
  const pending = submit(filled()).booking;
  assert.equal(pending.status, 'pending');
  assert.equal(pending.expiresAt, Math.min(NOW + 12 * 3600e3, START - 120 * 60e3));
  assert.equal(pending.end, START + (45 + 15) * 60e3);
  assert.equal(pending.phone, '+66899990000');
  const again = submit(submit(filled()), {id: 'b2'});
  assert.equal(again.booking.id, 'b1');
  assert.equal(submit(again), again);
  const bad = submit(filled({name: ''}));
  assert.equal(bad.booking, null);
  assert(bad.errors.name);
});

test('owner actions', () => {
  const pending = submit(filled()).booking;
  const ctx = {now: NOW, busy: [], salon};
  assert.equal(ownerAct(pending, {type: 'confirm'}, ctx).booking.status, 'confirmed');

  const clash = [{id: 'x', summary: 'Mia', start: {dateTime: '2026-11-07T10:30:00+07:00'}, end: {dateTime: '2026-11-07T11:30:00+07:00'}}];
  const taken = ownerAct(pending, {type: 'confirm'}, {...ctx, busy: clash});
  assert.equal(taken.outcome, 'taken');
  assert.equal(taken.booking, pending);
  // its own calendar event never blocks it
  const own = [{...clash[0], id: pending.id}];
  assert.equal(ownerAct(pending, {type: 'confirm'}, {...ctx, busy: own}).booking.status, 'confirmed');

  const late = {...ctx, now: pending.expiresAt + 1};
  assert.equal(effectiveStatus(pending, late.now), 'expired');
  assert.equal(ownerAct(pending, {type: 'confirm'}, late).booking, pending);

  const p1 = ownerAct(pending, {type: 'propose', start: T('2026-11-07', '12:00')}, ctx).booking;
  assert.equal(p1.status, 'proposed');
  assert.equal(p1.start, T('2026-11-07', '12:00'));
  assert.equal(p1.end - p1.start, pending.end - pending.start);
  const p2 = ownerAct(p1, {type: 'propose', start: T('2026-11-07', '14:00')}, ctx).booking;
  assert.equal(accept(p2, p1.acceptToken, ctx).outcome, 'stale');
  assert.equal(accept(p2, p2.acceptToken, ctx).booking.status, 'confirmed');
  assert.equal(accept(p2, p2.acceptToken, {...ctx, now: p2.expiresAt + 1}).outcome, 'stale');
  assert.equal(accept(p2, p2.acceptToken, {...ctx, busy: [{id: 'x', start: {dateTime: '2026-11-07T14:00:00+07:00'}, end: {dateTime: '2026-11-07T15:00:00+07:00'}}]}).outcome, 'stale');
  assert.equal(accept(pending, pending.acceptToken, ctx).outcome, 'stale');

  const declined = ownerAct(pending, {type: 'decline'}, ctx).booking;
  assert.equal(declined.status, 'declined');
  for (const type of ['confirm', 'decline']) assert.equal(ownerAct(declined, {type}, ctx).booking, declined);
});

test('confirm works 3 h before start for an unknown client (notice is not re-applied) and on a proposed booking', () => {
  const start = T('2026-11-07', '14:00');
  const b = submit(filled({slot: start}), {now: start - 4 * 3600e3, okStarts: [start]}).booking;
  assert.equal(b.status, 'pending');
  const r = ownerAct(b, {type: 'confirm'}, {now: start - 3 * 3600e3, busy: [], salon});
  assert.equal(r.outcome, 'ok');
  assert.equal(r.booking.status, 'confirmed');

  const ctx = {now: NOW, busy: [], salon};
  const proposed = ownerAct(submit(filled()).booking, {type: 'propose', start: T('2026-11-07', '12:00')}, ctx).booking;
  assert.equal(ownerAct(proposed, {type: 'confirm'}, ctx).booking.status, 'confirmed');
  assert.equal(ownerAct(proposed, {type: 'confirm'}, {...ctx, now: proposed.expiresAt + 1}).booking, proposed);
});

test('propose is refused for a taken time, an already-expired hold, and a finished booking', () => {
  const pending = submit(filled()).booking, ctx = {now: NOW, busy: [], salon};
  const clash = [{id: 'x', summary: 'Mia', start: {dateTime: '2026-11-07T12:00:00+07:00'}, end: {dateTime: '2026-11-07T13:00:00+07:00'}}];
  const r1 = ownerAct(pending, {type: 'propose', start: T('2026-11-07', '12:30')}, {...ctx, busy: clash});
  assert.equal(r1.outcome, 'taken');
  assert.equal(r1.booking, pending);
  // start 1 h away: hold = start - 2 h is already in the past
  const r2 = ownerAct(pending, {type: 'propose', start: NOW + 3600e3}, ctx);
  assert.equal(r2.outcome, 'taken');
  assert.equal(r2.booking, pending);
  for (const type of ['confirm', 'decline', 'propose']) {
    for (const status of ['confirmed', 'declined', 'expired']) {
      const done = {...pending, status};
      assert.equal(ownerAct(done, {type, start: T('2026-11-07', '12:00')}, ctx).booking, done, type + ' on ' + status);
    }
  }
});

test('next-time suggestions come in order, later than the booking, and at least confirm lead + 1 h ahead', () => {
  const pending = submit(filled({slot: T('2026-11-03', '11:30')}), {okStarts: [T('2026-11-03', '11:30')]}).booking;
  const ctx = {now: NOW, busy: [], salon};
  const opts = proposalOptions(pending, ctx);
  assert.equal(opts.length, 3);
  const earliest = NOW + 3 * 3600e3;
  assert(opts.every((o, i) => o.start >= earliest && o.start > pending.start && (i === 0 || o.start > opts[i - 1].start)));
  assert.equal(opts[0].start, earliest, '12:00 is the first start three hours after 09:00');
  for (const o of opts) assert.equal(ownerAct(pending, {type: 'propose', start: o.start}, ctx).outcome, 'ok');
});
