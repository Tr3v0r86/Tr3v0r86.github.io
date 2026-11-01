// Booking state machine for the Shades front-end (Stage 0). Pure: no DOM.
// Lifecycle (ADR-0004): pending | proposed -> confirmed | declined | expired; pending and proposed both hold the slot.
// Stage 0b adds: confirmed -> done (wrap-up), and Modify from pending, proposed or confirmed.
// Stage 1: validate() becomes the POST's truth check.
import {busyFromEvents, expiresAt, isFree, dayOf, nextFits} from './slots.mjs';

/**
 * @typedef {{id:string,name:string,minutes:number,price_thb:number,addon_only:boolean,consult_first:boolean,swatch?:string[]}} Service
 * @typedef {{salon:import('./slots.mjs').Salon,services:Service[]}} Menu
 * @typedef {'pending'|'proposed'|'confirmed'|'declined'|'expired'|'done'} Status
 * @typedef {{id:string,services:{id:string,name:string,minutes:number,price_thb:number}[],start:number,end:number,
 *   totalMinutes:number,totalThb:number|null,name:string,phone:string,email:string,status:Status,
 *   expiresAt:number|null,acceptToken:string,createdAt:number,
 *   note?:string,ownerNote?:string,consult?:boolean,visitNote?:string,nextTime?:string,doneAt?:number,prior?:Booking|null}} Booking
 *   note = the client's own note; ownerNote = James to the client; visitNote = private (never client-side); nextTime = client-visible.
 *   prior = the confirmed booking a "Send changes" modify replaced; it stays the live booking until the client accepts or the proposal expires.
 * @typedef {{id?:string,token:string,name:string,phone:string,email:string}} Client
 * @typedef {{selected:string[],day:string|null,slot:number|null,name:string,phone:string,email:string,note:string,
 *   errors:Record<string,string>,booking:Booking|null}} State
 */

/** @type {State} */
export const initialState = {selected: [], day: null, slot: null, name: '', phone: '', email: '', note: '', errors: {}, booking: null};

/** @param {Service} s */
const snap = (s) => ({id: s.id, name: s.name, minutes: s.minutes, price_thb: s.price_thb});

/** @param {Menu} menu @param {string} id */
const byId = (menu, id) => menu.services.find((s) => s.id === id);

/** Add-ons appear once a main service is chosen. @param {string[]} selected @param {Menu} menu */
export const addonsVisible = (selected, menu) => selected.some((id) => {
  const s = byId(menu, id);
  return s && !s.addon_only && !s.consult_first;
});

/** @param {string[]} selected @param {Menu} menu */
export function totals(selected, menu) {
  let minutes = 0, thb = 0;
  for (const id of selected) {
    const s = byId(menu, id);
    if (s) { minutes += s.minutes; thb += s.price_thb; }
  }
  return {minutes, thb};
}

/** E.164 or null. Thai numbers by default. @param {string} raw */
export function normalisePhone(raw) {
  // ponytail: TH-default hand normaliser; libphonenumber-js at Stage 1
  let p = String(raw).replace(/[\s\-.()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('0')) p = '+66' + p.slice(1);
  else if (p.startsWith('66')) p = '+' + p;
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

/**
 * The listed client for a typed number or a personal-link token, else null.
 * @param {Client[]} clients @param {{phone?:string,token?:string}} q
 * @returns {Client|null}
 */
export function findClient(clients, {phone, token}) {
  const p = phone ? normalisePhone(phone) : null;
  return clients.find((c) => (token && c.token === token) || (p && normalisePhone(c.phone) === p)) || null;
}

/** Form fields for a personal link `?c=<token>`, or null. @param {Client[]} clients @param {string|null} token */
export function prefill(clients, token) {
  const c = token ? findClient(clients, {token}) : null;
  return c ? {name: c.name, phone: c.phone, email: c.email} : null;
}

/**
 * Accept-link token: id, start and a hash of what was agreed (services, minutes, price), so a link dies when any of them change.
 * ponytail: Stage 1 = HMAC(secret, eventId+purpose+start+servicesHash)
 * @param {Booking} b
 */
export function tokenFor(b) {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify([b.services.map((s) => s.id), b.totalMinutes, b.totalThb])) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `${b.id}:${b.start}:${h.toString(36)}`;
}

/**
 * Per-field errors; empty object = valid. A known number may leave the email empty.
 * @param {State} state @param {Menu} menu @param {number[]} okStarts @param {boolean} [known]
 */
export function validate(state, menu, okStarts, known = false) {
  /** @type {Record<string,string>} */
  const e = {};
  const picked = state.selected.map((id) => byId(menu, id));
  if (!picked.length || picked.some((s) => !s) || !picked.some((s) => !s.addon_only) || picked.some((s) => s.consult_first)) {
    e.services = 'Choose at least one service.';
  }
  if (state.slot === null || !okStarts.includes(state.slot)) e.slot = 'Choose a time.';
  if (!state.name.trim()) e.name = 'Enter your name.';
  if (!normalisePhone(state.phone)) e.phone = 'Enter your WhatsApp number with country code, like +66 81 234 5678 or +44 7700 900123.';
  if (!(known && !state.email.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = 'Enter an email address, like name@example.com.';
  return e;
}

/**
 * @param {State} state
 * @param {{type:string,[k:string]:any}} action
 * @returns {State}
 */
export function reduce(state, action) {
  switch (action.type) {
    case 'toggle': {
      let selected = state.selected.includes(action.id) ? state.selected.filter((x) => x !== action.id) : [...state.selected, action.id];
      if (!addonsVisible(selected, action.menu)) selected = selected.filter((id) => !byId(action.menu, id)?.addon_only);
      return {...state, selected, slot: null, errors: {...state.errors, services: '', slot: ''}};
    }
    case 'day':
      return {...state, day: action.day, slot: null, errors: {...state.errors, slot: ''}};
    case 'slot':
      return {...state, slot: action.start, errors: {...state.errors, slot: ''}};
    case 'field':
      return {...state, [action.name]: action.value, errors: {...state.errors, [action.name]: ''}};
    case 'submit': {
      if (state.booking) return state; // idempotent: a double click books once
      const {menu, okStarts, clients, now, salon, id} = action;
      const known = !!findClient(clients, {phone: state.phone});
      const errors = validate(state, menu, okStarts, known);
      if (Object.keys(errors).length) return {...state, errors};
      const phone = /** @type {string} */ (normalisePhone(state.phone));
      const t = totals(state.selected, menu);
      const start = /** @type {number} */ (state.slot);
      /** @type {Booking} */
      const booking = {
        id,
        services: state.selected.map((sid) => snap(/** @type {Service} */ (byId(menu, sid)))),
        start,
        end: start + (t.minutes + salon.buffer_min) * 60e3,
        totalMinutes: t.minutes,
        totalThb: t.thb,
        name: state.name.trim(),
        phone,
        email: state.email.trim(),
        note: state.note.trim().slice(0, 300),
        ownerNote: '',
        consult: false,
        status: known ? 'confirmed' : 'pending',
        expiresAt: known ? null : expiresAt(now, start, salon),
        acceptToken: '',
        createdAt: now,
      };
      booking.acceptToken = tokenFor(booking);
      return {...state, errors: {}, booking};
    }
    default:
      return state;
  }
}

/** pending/proposed past expiresAt read as expired. @param {Booking} b @param {number} now @returns {Status} */
export const effectiveStatus = (b, now) => ((b.status === 'pending' || b.status === 'proposed') && b.expiresAt !== null && now >= b.expiresAt ? 'expired' : b.status);

/**
 * The booking as it stands at `now`: a proposal that grew out of a confirmed booking falls back to that
 * confirmed booking when the proposal expires, so the client never loses a time she already had.
 * @param {Booking} b @param {number} now @returns {Booking}
 */
export const current = (b, now) => (b.prior && b.status === 'proposed' && effectiveStatus(b, now) === 'expired' ? b.prior : b);

/** Overlap check on the booking's own day, ignoring its own calendar event. */
function slotFree(b, start, end, busy) {
  return isFree(start, end, busyFromEvents(busy.filter((e) => e.id !== b.id), dayOf(start)));
}

/**
 * Owner actions: confirm (pending or proposed), propose (pending or proposed), decline.
 * Confirm checks overlap and expiry only, never minimum notice (ADR-0004 §6).
 * Propose refuses ("taken") a time that is no longer free or whose hold would already be over at creation.
 * @param {Booking} b @param {{type:'confirm'|'propose'|'decline',start?:number}} act
 * @param {{now:number,busy:import('./slots.mjs').CalEvent[],salon:import('./slots.mjs').Salon}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'taken'|'noop'}}
 */
export function ownerAct(b, act, {now, busy, salon}) {
  const live = effectiveStatus(b, now);
  if (live !== 'pending' && live !== 'proposed') return {booking: b, outcome: 'noop'};
  if (act.type === 'decline') return {booking: {...b, status: 'declined'}, outcome: 'ok'};
  if (act.type === 'confirm') {
    return slotFree(b, b.start, b.end, busy) ? {booking: {...b, status: 'confirmed', expiresAt: null, prior: null}, outcome: 'ok'} : {booking: b, outcome: 'taken'};
  }
  if (act.type === 'propose' && act.start !== undefined) {
    const end = act.start + b.end - b.start, hold = expiresAt(now, act.start, salon);
    if (hold <= now || !slotFree(b, act.start, end, busy)) return {booking: b, outcome: 'taken'};
    return {
      booking: {
        ...b, start: act.start, end, status: 'proposed', expiresAt: hold,
        acceptToken: tokenFor({...b, start: act.start}),
      },
      outcome: 'ok',
    };
  }
  return {booking: b, outcome: 'noop'};
}

/**
 * Next-time suggestions for the owner: later than the current start, in order, and far enough ahead
 * (confirm_lead + 1 h) that a fresh proposal always has an accept window.
 * @param {Booking} b @param {{now:number,busy:import('./slots.mjs').CalEvent[],salon:import('./slots.mjs').Salon}} ctx
 */
export function proposalOptions(b, {now, busy, salon}) {
  const earliest = now + (salon.confirm_lead_min + 60) * 60e3;
  return nextFits({salon, events: busy, totalMinutes: b.totalMinutes, now, known: true, excludeId: b.id}, Math.max(b.start, earliest - 1));
}

/**
 * Client accepts a proposal. Fails ("stale") if superseded, expired, not proposed or the slot was taken.
 * @param {Booking} b @param {string} token @param {{now:number,busy:import('./slots.mjs').CalEvent[]}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'stale'}}
 */
export function accept(b, token, {now, busy}) {
  if (effectiveStatus(b, now) !== 'proposed' || token !== b.acceptToken || !slotFree(b, b.start, b.end, busy)) return {booking: b, outcome: 'stale'};
  return {booking: {...b, status: 'confirmed', expiresAt: null, prior: null}, outcome: 'ok'};
}

/**
 * Owner Modify: new services, start (free-form, off-grid allowed), duration, price, note, consultation flag.
 * Allowed on pending, proposed and confirmed bookings. `confirm:true` ("Confirm as changed") confirms with the new
 * details; otherwise ("Send changes") the booking becomes proposed with a fresh accept link. A confirmed booking
 * sent as changes keeps the old confirmed booking in `prior`, held until accept or expiry.
 * Owner's manual control: no notice or opening-hours check, only overlap and expiry.
 * @param {Booking} b
 * @param {{services:string[],start:number,minutes?:number,thb?:number|null,ownerNote?:string,consult?:boolean,confirm?:boolean}} ch
 * @param {{now:number,busy:import('./slots.mjs').CalEvent[],salon:import('./slots.mjs').Salon,menu:Menu}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'taken'|'noop'}}
 */
export function modify(b, ch, {now, busy, salon, menu}) {
  const live = effectiveStatus(b, now);
  const picked = ch.services.map((id) => byId(menu, id));
  if (!['pending', 'proposed', 'confirmed'].includes(live) || !picked.length || picked.some((s) => !s)) return {booking: b, outcome: 'noop'};
  const services = picked.map((s) => snap(/** @type {Service} */ (s)));
  const sum = services.reduce((n, s) => ({m: n.m + s.minutes, p: n.p + s.price_thb}), {m: 0, p: 0});
  const totalMinutes = ch.minutes ?? sum.m, consult = !!ch.consult;
  const totalThb = consult ? null : (ch.thb ?? sum.p);
  const end = ch.start + (totalMinutes + salon.buffer_min) * 60e3;
  if (!slotFree(b, ch.start, end, busy)) return {booking: b, outcome: 'taken'};
  const next = {
    ...b, services, start: ch.start, end, totalMinutes, totalThb, consult,
    ownerNote: (ch.ownerNote ?? b.ownerNote ?? '').trim().slice(0, 200),
  };
  if (ch.confirm) {
    const booking = {...next, status: /** @type {Status} */ ('confirmed'), expiresAt: null, prior: null};
    return {booking: {...booking, acceptToken: tokenFor(booking)}, outcome: 'ok'};
  }
  const hold = expiresAt(now, ch.start, salon);
  if (hold <= now) return {booking: b, outcome: 'taken'};
  const prior = live === 'confirmed' ? {...b, prior: null} : (b.prior ?? null);
  const booking = {...next, status: /** @type {Status} */ ('proposed'), expiresAt: hold, prior};
  return {booking: {...booking, acceptToken: tokenFor(booking)}, outcome: 'ok'};
}

/**
 * Wrap up a confirmed booking: mark it done with a private visit note and a client-visible "next time".
 * Any other status comes back unchanged.
 * ponytail: Stage 0 keeps the client record on the booking; Stage 1 client table per ADR-0004 revisit
 * @param {Booking} b @param {{note?:string,visibleNote?:string}} n @param {{now:number}} ctx @returns {Booking}
 */
export function wrapUp(b, {note = '', visibleNote = ''}, {now}) {
  if (b.status !== 'confirmed') return b;
  return {...b, status: 'done', visitNote: note.trim(), nextTime: visibleNote.trim(), doneAt: now};
}

/**
 * Book the next visit from a confirmed or done booking: same services unless ids are given, confirmed at once
 * (the client is known by definition). Carries `nextTime` to the client; never the private `visitNote`.
 * @param {Booking} b @param {{start:number,services?:string[]}} r
 * @param {{now:number,busy:import('./slots.mjs').CalEvent[],salon:import('./slots.mjs').Salon,menu:Menu,id:string}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'taken'|'noop'}}
 */
export function rebook(b, {start, services: ids}, {now, busy, salon, menu, id}) {
  if (b.status !== 'confirmed' && b.status !== 'done') return {booking: b, outcome: 'noop'};
  const picked = ids ? ids.map((x) => byId(menu, x)) : null;
  if (picked && (!picked.length || picked.some((s) => !s))) return {booking: b, outcome: 'noop'};
  const services = picked ? picked.map((s) => snap(/** @type {Service} */ (s))) : b.services;
  const totalMinutes = picked ? services.reduce((n, s) => n + s.minutes, 0) : b.totalMinutes;
  const end = start + (totalMinutes + salon.buffer_min) * 60e3;
  if (!isFree(start, end, busyFromEvents(busy, dayOf(start)))) return {booking: b, outcome: 'taken'};
  /** @type {Booking} */
  const booking = {
    id, services, start, end, totalMinutes, totalThb: services.reduce((n, s) => n + s.price_thb, 0),
    name: b.name, phone: b.phone, email: b.email, note: '', ownerNote: '', consult: false, nextTime: b.nextTime || '',
    status: 'confirmed', expiresAt: null, acceptToken: '', createdAt: now,
  };
  booking.acceptToken = tokenFor(booking);
  return {booking, outcome: 'ok'};
}
