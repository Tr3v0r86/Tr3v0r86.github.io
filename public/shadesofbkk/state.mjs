// Booking state machine for the Shades front-end (Stage 0). Pure: no DOM.
// Lifecycle (ADR-0004): pending | proposed -> confirmed | declined | expired; pending and proposed both hold the slot.
// Stage 1: validate() becomes the POST's truth check.
import {busyFromEvents, expiresAt, isFree, dayOf} from './slots.mjs';

/**
 * @typedef {{id:string,name:string,minutes:number,price_thb:number,addon_only:boolean,consult_first:boolean,swatch?:string[]}} Service
 * @typedef {{salon:import('./slots.mjs').Salon,services:Service[]}} Menu
 * @typedef {'pending'|'proposed'|'confirmed'|'declined'|'expired'} Status
 * @typedef {{id:string,services:{id:string,name:string,minutes:number,price_thb:number}[],start:number,end:number,
 *   totalMinutes:number,totalThb:number,name:string,phone:string,email:string,status:Status,
 *   expiresAt:number|null,acceptToken:string,createdAt:number}} Booking
 * @typedef {{selected:string[],day:string|null,slot:number|null,name:string,phone:string,email:string,
 *   errors:Record<string,string>,booking:Booking|null}} State
 */

/** @type {State} */
export const initialState = {selected: [], day: null, slot: null, name: '', phone: '', email: '', errors: {}, booking: null};

/** @param {string[]} selected @param {Menu} menu */
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
 * Per-field errors; empty object = valid.
 * @param {State} state @param {Menu} menu @param {number[]} okStarts
 */
export function validate(state, menu, okStarts) {
  /** @type {Record<string,string>} */
  const e = {};
  const picked = state.selected.map((id) => byId(menu, id));
  if (!picked.length || picked.some((s) => !s) || !picked.some((s) => !s.addon_only) || picked.some((s) => s.consult_first)) {
    e.services = 'Choose at least one service.';
  }
  if (state.slot === null || !okStarts.includes(state.slot)) e.slot = 'Choose a time.';
  if (!state.name.trim()) e.name = 'Enter your name.';
  if (!normalisePhone(state.phone)) e.phone = 'Enter a WhatsApp number, like 081 234 5678.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())) e.email = 'Enter an email address, like name@example.com.';
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
      const errors = validate(state, menu, okStarts);
      if (Object.keys(errors).length) return {...state, errors};
      const phone = /** @type {string} */ (normalisePhone(state.phone));
      const t = totals(state.selected, menu);
      const known = clients.includes(phone), start = /** @type {number} */ (state.slot);
      /** @type {Booking} */
      const booking = {
        id,
        services: state.selected.map((sid) => {
          const s = /** @type {Service} */ (byId(menu, sid));
          return {id: s.id, name: s.name, minutes: s.minutes, price_thb: s.price_thb};
        }),
        start,
        end: start + (t.minutes + salon.buffer_min) * 60e3,
        totalMinutes: t.minutes,
        totalThb: t.thb,
        name: state.name.trim(),
        phone,
        email: state.email.trim(),
        status: known ? 'confirmed' : 'pending',
        expiresAt: known ? null : expiresAt(now, start, salon),
        acceptToken: id + ':' + start,
        createdAt: now,
      };
      return {...state, errors: {}, booking};
    }
    default:
      return state;
  }
}

/** pending/proposed past expiresAt read as expired. @param {Booking} b @param {number} now @returns {Status} */
export const effectiveStatus = (b, now) => ((b.status === 'pending' || b.status === 'proposed') && b.expiresAt !== null && now >= b.expiresAt ? 'expired' : b.status);

/** Overlap check on the booking's own day, ignoring its own calendar event. */
function slotFree(b, start, end, busy) {
  return isFree(start, end, busyFromEvents(busy.filter((e) => e.id !== b.id), dayOf(start)));
}

/**
 * Owner actions: confirm (pending), propose (pending or proposed), decline.
 * Confirm checks overlap and expiry only, never minimum notice (ADR-0004 §6).
 * @param {Booking} b @param {{type:'confirm'|'propose'|'decline',start?:number}} act
 * @param {{now:number,busy:import('./slots.mjs').CalEvent[],salon:import('./slots.mjs').Salon}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'taken'|'noop'}}
 */
export function ownerAct(b, act, {now, busy, salon}) {
  const live = effectiveStatus(b, now);
  if (live !== 'pending' && live !== 'proposed') return {booking: b, outcome: 'noop'};
  if (act.type === 'decline') return {booking: {...b, status: 'declined'}, outcome: 'ok'};
  if (act.type === 'confirm') {
    if (live !== 'pending') return {booking: b, outcome: 'noop'};
    return slotFree(b, b.start, b.end, busy) ? {booking: {...b, status: 'confirmed', expiresAt: null}, outcome: 'ok'} : {booking: b, outcome: 'taken'};
  }
  if (act.type === 'propose' && act.start !== undefined) {
    const end = act.start + b.end - b.start;
    return {
      booking: {
        ...b, start: act.start, end, status: 'proposed', expiresAt: expiresAt(now, act.start, salon),
        acceptToken: b.id + ':' + act.start, // ponytail: Stage 1 = HMAC(secret, eventId+purpose+start)
      },
      outcome: 'ok',
    };
  }
  return {booking: b, outcome: 'noop'};
}

/**
 * Client accepts a proposal. Fails ("stale") if superseded, expired, not proposed or the slot was taken.
 * @param {Booking} b @param {string} token @param {{now:number,busy:import('./slots.mjs').CalEvent[]}} ctx
 * @returns {{booking:Booking,outcome:'ok'|'stale'}}
 */
export function accept(b, token, {now, busy}) {
  if (effectiveStatus(b, now) !== 'proposed' || token !== b.acceptToken || !slotFree(b, b.start, b.end, busy)) return {booking: b, outcome: 'stale'};
  return {booking: {...b, status: 'confirmed', expiresAt: null}, outcome: 'ok'};
}
