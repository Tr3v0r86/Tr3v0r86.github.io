// Slot engine for the Shades booking front-end (Stage 0). Pure: no DOM, no imports.
// Instants are epoch ms; days are Bangkok "YYYY-MM-DD" strings.
//
// BUSY RULE (final, ADR-0004 §8 as amended in review):
//   - an all-day event, whatever its title or transparency, closes the whole day;
//   - a timed event titled "Closed" blocks its own hours, whatever its transparency (it does not close the day);
//   - any other timed event blocks unless transparent;
//   - bookings follow status: pending, proposed and confirmed block; declined, expired and cancelled do not.
// Stage 1 copies this file verbatim into apps/booking (see stage0-task-plan.md).

const BKK = 7 * 3600e3; // ponytail: no DST in Asia/Bangkok, so a fixed offset; labels come from tables, not Intl, so ICU versions cannot change them
const MIN = 60e3;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * @typedef {{start:number,end:number}} Interval
 * @typedef {{id?:string,summary?:string,status?:string,transparency?:string,
 *   start:{date?:string,dateTime?:string},end:{date?:string,dateTime?:string},
 *   extendedProperties?:{private?:Record<string,string>}}} CalEvent  Google events.list item shape
 * @typedef {{open_hours:Record<string,string[][]>,slot_step_min:number,buffer_min:number,
 *   min_notice_min:number,min_notice_unknown_min:number,max_days_ahead:number,
 *   hold_hours:number,confirm_lead_min:number,owner_name:string}} Salon
 * @typedef {{start:number,label:string,ok:boolean}} Slot
 * @typedef {{day:string,salon:Salon,events:CalEvent[],totalMinutes:number,now:number,known:boolean,excludeId?:string}} SlotArgs
 */

/** Epoch ms of 00:00 Bangkok on `day`. @param {string} day */
export const dayStart = (day) => Date.parse(day + 'T00:00:00Z') - BKK;

/** Bangkok day of an instant. @param {number} ms */
export const dayOf = (ms) => new Date(ms + BKK).toISOString().slice(0, 10);

/** @param {string} day @param {number} n */
export const addDays = (day, n) => dayOf(dayStart(day) + n * 864e5 + 12 * 3600e3);

/** 0 = Sunday. @param {string} day */
export const weekdayOf = (day) => new Date(day + 'T00:00:00Z').getUTCDay();

/** "13:30" in Bangkok time. @param {number} ms */
export const timeLabel = (ms) => new Date(ms + BKK).toISOString().slice(11, 16);

/** "Wed 4 Nov". @param {string} day */
export function dayLabel(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(day)]} ${d} ${MONTHS[m - 1]}`;
}

/** "1 h 45", "40 min", "2 h". @param {number} minutes */
export function durationLabel(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}

/** "฿1,200". @param {number} thb */
export const thbLabel = (thb) => '฿' + thb.toLocaleString('en-US');

/** The next `n` Bangkok days starting with today. @param {number} now @param {number} n */
export function nextDays(now, n) {
  const first = dayOf(now);
  return Array.from({length: n}, (_, i) => addDays(first, i));
}

const isClosedTitle = (e) => (e.summary || '').trim().toLowerCase() === 'closed';

/** Statuses that no longer hold a slot. Events without a status (plain calendar entries) are live. @param {CalEvent} e */
const inactive = (e) => e.status === 'cancelled' || ['declined', 'expired'].includes(e.extendedProperties?.private?.status || '');

/** True when the salon has a rostered window on `day`'s weekday. @param {string} day @param {Salon} salon */
export const isRostered = (day, salon) => windowsFor(day, salon).length > 0;

/**
 * True when the whole day is shut: no rostered window, or an all-day event (any title).
 * @param {{day:string,salon:Salon,events:CalEvent[]}} a
 */
export function isClosedDay({day, salon, events}) {
  if (!isRostered(day, salon)) return true;
  const d0 = dayStart(day), d1 = d0 + 864e5;
  return events.some((e) => !inactive(e) && !!e.start.date
    && Date.parse(e.start.date + 'T00:00:00Z') - BKK < d1 && Date.parse(e.end.date + 'T00:00:00Z') - BKK > d0);
}

/** @param {string} day @param {Salon} salon @returns {Interval[]} */
function windowsFor(day, salon) {
  const d0 = dayStart(day), at = (hhmm) => d0 + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * MIN;
  return (salon.open_hours[weekdayOf(day)] || []).map(([a, b]) => ({start: at(a), end: at(b)}));
}

/**
 * Busy intervals on `day`, clipped to it, per the busy rule at the top of this file.
 * @param {CalEvent[]} events @param {string} day @returns {Interval[]}
 */
export function busyFromEvents(events, day) {
  const d0 = dayStart(day), d1 = d0 + 864e5, out = [];
  for (const e of events) {
    if (inactive(e)) continue;
    let s, t;
    if (e.start.date) {
      s = Date.parse(e.start.date + 'T00:00:00Z') - BKK;
      t = Date.parse(e.end.date + 'T00:00:00Z') - BKK;
    } else {
      if (e.transparency === 'transparent' && !isClosedTitle(e)) continue;
      s = Date.parse(e.start.dateTime);
      t = Date.parse(e.end.dateTime);
    }
    s = Math.max(s, d0);
    t = Math.min(t, d1);
    if (t > s) out.push({start: s, end: t});
  }
  return out;
}

/** Merge overlapping and adjacent intervals. @param {Interval[]} list @returns {Interval[]} */
export function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a.start - b.start), out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({...i});
  }
  return out;
}

/** True when [start,end) overlaps none of `intervals`. Touching is free. @param {number} start @param {number} end @param {Interval[]} intervals */
export const isFree = (start, end, intervals) => !intervals.some((i) => start < i.end && end > i.start);

/**
 * Every stepped start that leaves room for the job plus buffer inside a window, flagged `ok`
 * when the time is free and past the minimum notice. A closed day has no slots.
 * ponytail: [] reads "Closed"; a solid-booked open day returns slots that are all ok:false ("Fully booked").
 * @param {SlotArgs} a @returns {Slot[]}
 */
export function computeSlots({day, salon, events, totalMinutes, now, known, excludeId}) {
  const live = events.filter((e) => e.id !== excludeId);
  if (isClosedDay({day, salon, events: live})) return [];
  const busy = mergeIntervals(busyFromEvents(live, day));
  const earliest = now + (known ? salon.min_notice_min : salon.min_notice_unknown_min) * MIN;
  const span = (totalMinutes + salon.buffer_min) * MIN, step = salon.slot_step_min * MIN, out = [];
  for (const w of windowsFor(day, salon)) {
    for (let s = w.start; s + span <= w.end; s += step) {
      out.push({start: s, label: timeLabel(s), ok: isFree(s, s + span, busy) && s >= earliest});
    }
  }
  return out;
}

/**
 * The first `n` ok starts after `fromStart`, looking up to max_days_ahead from today.
 * @param {Omit<SlotArgs,'day'>} args @param {number} fromStart @param {number} [n]
 */
export function nextFits(args, fromStart, n = 3) {
  const out = [];
  for (const day of nextDays(args.now, args.salon.max_days_ahead + 1)) {
    for (const s of computeSlots({...args, day})) {
      if (s.ok && s.start > fromStart) out.push(s);
      if (out.length === n) return out;
    }
  }
  return out;
}

/** Hold expiry: the earlier of hold_hours from now and confirm_lead_min before the start. @param {number} now @param {number} start @param {Salon} salon */
export const expiresAt = (now, start, salon) => Math.min(now + salon.hold_hours * 3600e3, start - salon.confirm_lead_min * MIN);
