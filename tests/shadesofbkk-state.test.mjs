import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialState, reduce, addonsVisible, totals, validate, normalisePhone, effectiveStatus, ownerAct, accept, proposalOptions, findClient, prefill, tokenFor, modify, wrapUp, rebook, current} from '../public/shadesofbkk/state.mjs';

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

// ---- Stage 0b ----
test('findClient and prefill: by normalised phone or personal-link token', () => {
  assert.equal(findClient(clients, {phone: '081 234 5678'}).name, 'Mia');
  assert.equal(findClient(clients, {phone: '+66 81 234 5678'}).token, 'demo-mia');
  assert.equal(findClient(clients, {token: 'demo-mia'}).name, 'Mia');
  assert.equal(findClient(clients, {phone: '089 999 0000'}), null);
  assert.equal(findClient(clients, {phone: '12'}), null);
  assert.equal(findClient(clients, {}), null);
  assert.deepEqual(prefill(clients, 'demo-mia'), {name: 'Mia', phone: '+66812345678', email: 'mia@example.com'});
  assert.equal(prefill(clients, 'nope'), null);
  assert.equal(prefill(clients, null), null);
});

test('email may be empty only for a known number; a malformed email fails both; the phone error asks for a country code', () => {
  const v = (over, known) => validate(filled(over), menu, [START], known);
  assert(v({email: ''}, false).email);
  assert.equal(v({email: ''}, true).email, undefined);
  assert(v({email: 'nope'}, true).email);
  assert(v({email: 'nope'}, false).email);
  assert.match(v({phone: '12'}).phone, /country code.*\+66 81 234 5678.*\+44 7700 900123/);
  assert.equal(submit(filled({phone: '081 234 5678', email: ''})).booking.status, 'confirmed');
  assert(submit(filled({email: ''})).errors.email);
});

test('the client note round-trips trimmed and capped at 300', () => {
  assert.equal(submit(filled({note: '  corner table please  '})).booking.note, 'corner table please');
  assert.equal(submit(filled({note: 'x'.repeat(400)})).booking.note.length, 300);
  assert.equal(reduce(initialState, {type: 'field', name: 'note', value: 'hi'}).note, 'hi');
  assert.equal(submit(filled()).booking.note, '');
});

test('tokenFor binds id, start and a hash of services, minutes and price', () => {
  const b = submit(filled()).booking;
  assert.equal(b.acceptToken, tokenFor(b));
  assert.match(b.acceptToken, /^b1:\d+:[0-9a-z]+$/);
  assert.notEqual(tokenFor({...b, totalThb: 1}), tokenFor(b));
  assert.notEqual(tokenFor({...b, totalMinutes: 50}), tokenFor(b));
  assert.notEqual(tokenFor({...b, services: [...b.services, b.services[0]]}), tokenFor(b));
  assert.notEqual(tokenFor({...b, start: b.start + 1}), tokenFor(b));
});

const ctx = (extra = {}) => ({now: NOW, busy: [], salon, menu, ...extra});
const mod = (b, over = {}, c = ctx()) => modify(b, {services: b.services.map((s) => s.id), start: b.start, ...over}, c);
const pending = () => submit(filled()).booking;
const confirmed = () => submit(filled({phone: '081 234 5678'})).booking;

test('modify recomputes minutes, price and end when services are added or removed', () => {
  const r = mod(pending(), {services: ['cut', 'toner']});
  assert.equal(r.outcome, 'ok');
  assert.equal(r.booking.status, 'proposed');
  assert.equal(r.booking.totalMinutes, 65);
  assert.equal(r.booking.totalThb, 1200);
  assert.equal(r.booking.end, START + (65 + 15) * 60e3);
  assert.equal(r.booking.expiresAt, Math.min(NOW + 12 * 3600e3, START - 120 * 60e3));
  const smaller = mod(r.booking, {services: ['toner']});
  assert.equal(smaller.outcome, 'ok', 'an add-on alone, and consult-first, are allowed for the owner');
  assert.equal(mod(pending(), {services: ['correction']}).booking.totalMinutes, 240);
  assert.equal(mod(pending(), {services: []}).outcome, 'noop');
  assert.equal(mod(pending(), {services: ['nope']}).outcome, 'noop');
});

test('modify keeps the booking\'s own slot selectable, allows off-grid starts, and moves the end with +15', () => {
  const b = pending();
  const own = [{id: b.id, summary: 'hold', start: {dateTime: '2026-11-07T10:00:00+07:00'}, end: {dateTime: '2026-11-07T11:00:00+07:00'}}];
  assert.equal(mod(b, {}, ctx({busy: own})).outcome, 'ok');
  const off = mod(b, {start: T('2026-11-07', '10:45')});
  assert.equal(off.booking.start, T('2026-11-07', '10:45'));
  const plus = mod(b, {minutes: 60});
  assert.equal(plus.booking.totalMinutes, 60);
  assert.equal(plus.booking.end, START + (60 + 15) * 60e3);
  const clash = [{id: 'x', summary: 'Mia', start: {dateTime: '2026-11-07T11:00:00+07:00'}, end: {dateTime: '2026-11-07T12:00:00+07:00'}}];
  assert.equal(mod(b, {minutes: 60}, ctx({busy: clash})).outcome, 'taken', '60 + 15 min from 10:00 reaches 11:15');
  assert.equal(mod(b, {start: NOW + 3600e3}).outcome, 'taken', 'a hold that would already be over');
});

test('modify price override and consultation, and the note survives accept', () => {
  assert.equal(mod(pending(), {thb: 1999}).booking.totalThb, 1999);
  const consult = mod(pending(), {consult: true, thb: 1999}).booking;
  assert.equal(consult.totalThb, null);
  assert.equal(consult.consult, true);
  const withNote = mod(pending(), {ownerNote: '  Toner added, see you then  '}).booking;
  assert.equal(withNote.ownerNote, 'Toner added, see you then');
  const accepted = accept(withNote, withNote.acceptToken, ctx()).booking;
  assert.equal(accepted.status, 'confirmed');
  assert.equal(accepted.ownerNote, 'Toner added, see you then');
});

test('a second modify with the same start but different services kills the first accept link', () => {
  const m1 = mod(pending(), {services: ['cut', 'toner']}).booking;
  const m2 = mod(m1, {services: ['cut', 'fringe']}).booking;
  assert.equal(m1.start, m2.start);
  assert.equal(accept(m2, m1.acceptToken, ctx()).outcome, 'stale');
  assert.equal(accept(m2, m2.acceptToken, ctx()).outcome, 'ok');
});

test('Confirm as changed confirms at once with the new details', () => {
  const r = mod(pending(), {services: ['cut', 'toner'], confirm: true});
  assert.equal(r.booking.status, 'confirmed');
  assert.equal(r.booking.expiresAt, null);
  assert.equal(r.booking.totalThb, 1200);
  assert.equal(r.booking.acceptToken, tokenFor(r.booking));
});

test('modify on a confirmed booking: Confirm as changed stays confirmed; Send changes proposes and keeps the original held', () => {
  const c = confirmed();
  const same = mod(c, {services: ['cut', 'toner'], confirm: true, ownerNote: 'Toner added'});
  assert.equal(same.booking.status, 'confirmed');
  assert.equal(same.booking.totalMinutes, 65);
  assert.equal(same.booking.ownerNote, 'Toner added');
  assert.equal(same.booking.prior, null);

  const sent = mod(c, {services: ['cut', 'toner'], start: T('2026-11-07', '12:00')});
  assert.equal(sent.outcome, 'ok');
  assert.equal(sent.booking.status, 'proposed');
  assert.equal(sent.booking.prior.status, 'confirmed');
  assert.equal(sent.booking.prior.start, START);
  assert.equal(current(sent.booking, NOW), sent.booking, 'while the proposal is open it is the live booking');
  const lapsed = sent.booking.expiresAt + 1;
  assert.equal(effectiveStatus(sent.booking, lapsed), 'expired');
  assert.equal(current(sent.booking, lapsed), sent.booking.prior, 'on expiry the original confirmed booking stands');
  // a second Send changes keeps the original, not the first proposal
  const again = mod(sent.booking, {services: ['cut'], start: T('2026-11-07', '14:00')}).booking;
  assert.equal(again.prior.start, START);
  const acc = accept(again, again.acceptToken, ctx()).booking;
  assert.equal(acc.status, 'confirmed');
  assert.equal(acc.prior, null);
});

test('modify is a no-op on declined, expired and done bookings', () => {
  const b = pending();
  for (const status of ['declined', 'expired', 'done']) {
    const r = mod({...b, status});
    assert.equal(r.outcome, 'noop', status);
    assert.equal(r.booking.status, status);
  }
  assert.equal(mod(b, {}, ctx({now: b.expiresAt + 1})).outcome, 'noop');
});

test('wrapUp splits the private note from the client-visible next time, and refuses anything but confirmed', () => {
  const c = confirmed();
  const done = wrapUp(c, {note: '  7.1 + 20 vol, 25 min  ', visibleNote: ' Tone next visit '}, {now: NOW});
  assert.equal(done.status, 'done');
  assert.equal(done.visitNote, '7.1 + 20 vol, 25 min');
  assert.equal(done.nextTime, 'Tone next visit');
  assert.equal(done.doneAt, NOW);
  const p = pending();
  assert.equal(wrapUp(p, {note: 'x', visibleNote: 'y'}, {now: NOW}), p);
  assert.equal(wrapUp(done, {note: 'z'}, {now: NOW}), done);
});

test('rebook keeps services and duration, confirms at once, carries nextTime, never the private note', () => {
  const done = wrapUp(mod(confirmed(), {services: ['cut', 'toner'], confirm: true}).booking, {note: 'secret formula', visibleNote: 'Tone next visit'}, {now: NOW});
  const next = T('2026-12-29', '14:00');
  const r = rebook(done, {start: next}, {...ctx(), id: 'b9'});
  assert.equal(r.outcome, 'ok');
  const n = r.booking;
  assert.deepEqual(n.services.map((s) => s.id), ['cut', 'toner']);
  assert.equal(n.totalMinutes, 65);
  assert.equal(n.totalThb, 1200);
  assert.equal(n.end, next + (65 + 15) * 60e3);
  assert.equal(n.status, 'confirmed');
  assert.equal(n.expiresAt, null);
  assert.equal(n.nextTime, 'Tone next visit');
  assert.equal(n.id, 'b9');
  assert.equal(n.phone, done.phone);
  assert.equal(n.note, '');
  assert.equal('visitNote' in n, false);
  assert(!JSON.stringify(n).includes('secret formula'));
  assert.equal(n.acceptToken, tokenFor(n));
  // from a confirmed booking too; services can be overridden
  const c = rebook(confirmed(), {start: next, services: ['blowdry']}, {...ctx(), id: 'b10'});
  assert.equal(c.booking.totalMinutes, 60);
  assert.equal(rebook(pending(), {start: next}, {...ctx(), id: 'b11'}).outcome, 'noop');
});

test('rebook into a taken slot is refused', () => {
  const next = T('2026-12-29', '14:00');
  const clash = [{id: 'x', summary: 'Mia', start: {dateTime: '2026-12-29T14:30:00+07:00'}, end: {dateTime: '2026-12-29T15:30:00+07:00'}}];
  const r = rebook(confirmed(), {start: next}, {...ctx({busy: clash}), id: 'b9'});
  assert.equal(r.outcome, 'taken');
});
