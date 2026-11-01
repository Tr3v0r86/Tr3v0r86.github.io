// Demo-only helpers for the Stage 0 pages. Not part of the engine: Stage 1 does not copy this file.
import {addDays, dayOf, isRostered} from './slots.mjs';

/**
 * Demo clock. `?now=<ISO>` pins it (spec and manual review); otherwise the real time.
 * @param {string} search location.search @param {number} real Date.now()
 */
export function parseNow(search, real) {
  const raw = new URLSearchParams(search).get('now');
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? real : t;
}

/**
 * Placeholder busy rows -> Google events. `dayOffset` counts rostered days: 0 is today if the salon opens,
 * 1 the next open day, and so on, so demo events never land on the salon's closed weekday.
 * Row: {id?, dayOffset, allDay?, start?, end?, summary, transparent?, status?}
 * @param {Array<Record<string,any>>} rows @param {string} today Bangkok day @param {import('./slots.mjs').Salon} salon
 * @returns {import('./slots.mjs').CalEvent[]}
 */
export function resolveBusy(rows, today, salon) {
  const openDay = (n) => {
    let day = today, left = n;
    if (!isRostered(day, salon)) { left += 1; }
    while (left > 0) { day = addDays(day, 1); if (isRostered(day, salon)) left -= 1; }
    return day;
  };
  return rows.map((r, i) => {
    const day = openDay(r.dayOffset);
    /** @type {import('./slots.mjs').CalEvent} */
    const e = {
      id: r.id || 'placeholder-' + i,
      summary: r.summary,
      transparency: r.transparent ? 'transparent' : 'opaque',
      start: r.allDay ? {date: day} : {dateTime: `${day}T${r.start}:00+07:00`},
      end: r.allDay ? {date: addDays(day, 1)} : {dateTime: `${day}T${r.end}:00+07:00`},
    };
    if (r.status) e.extendedProperties = {private: {status: r.status}};
    return e;
  });
}

// Placeholder contact and place details. Every line is replaced at the owner sit-down; the launch gate removes this block with the demo banner.
export const WA_NUMBER = '66800000000'; // [placeholder]
export const WA_URL = 'https://wa.me/' + WA_NUMBER; // [placeholder]
export const AREA = 'Sathorn'; // [placeholder]
export const ADDRESS = '12 Soi Example, Sathorn, Bangkok 10120'; // [placeholder]
export const LOOK_FOR = 'the green door next to the coffee cart, second floor'; // [placeholder]
export const MAP_URL = 'https://maps.google.com/?q=Bangkok'; // [placeholder]
export const IG_URL = 'https://www.instagram.com/shadesofbkk/'; // [placeholder]
