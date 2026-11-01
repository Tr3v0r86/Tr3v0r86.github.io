// Slot engine for the Shades booking front-end (Stage 0). Pure: no DOM, no imports.
// Instants are epoch ms; days are Bangkok "YYYY-MM-DD" strings.
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

/**
 * Demo clock. `?now=<ISO>` pins it (spec and manual review); otherwise the real time.
 * @param {string} search location.search @param {number} real Date.now()
 */
export function parseNow(search, real) {
  const raw = new URLSearchParams(search).get('now');
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? real : t;
}

/** The next `n` Bangkok days starting with today. @param {number} now @param {number} n */
export function nextDays(now, n) {
  const first = dayOf(now);
  return Array.from({length: n}, (_, i) => addDays(first, i));
}

const isClosedTitle = (e) => (e.summary || '').trim().toLowerCase() === 'closed';

/**
 * Placeholder busy rows -> Google events. Rows carry day offsets from "today" so the demo never goes stale.
 * Row: {id?, dayOffset, allDay?, start?, end?, summary, transparent?, status?}
 * @param {Array<Record<string,any>>} rows @param {string} today Bangkok day
 * @returns {CalEvent[]}
 */
export function resolveBusy(rows, today) {
  return rows.map((r, i) => {
    const day = addDays(today, r.dayOffset);
    /** @type {CalEvent} */
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

/**
 * True when the whole day is shut: an all-day event, an event titled "Closed", or no rostered window.
 * @param {{day:string,salon:Salon,events:CalEvent[]}} a
 */
export function isClosedDay({day, salon, events}) {
  if (!windowsFor(day, salon).length) return true;
  const d0 = dayStart(day), d1 = d0 + 864e5;
  return events.some((e) => {
    if (e.status === 'cancelled') return false;
    if (e.start.date) return Date.parse(e.start.date + 'T00:00:00Z') - BKK < d1 && Date.parse(e.end.date + 'T00:00:00Z') - BKK > d0;
    return isClosedTitle(e) && Date.parse(e.start.dateTime) < d1 && Date.parse(e.end.dateTime) > d0;
  });
}

/** @param {string} day @param {Salon} salon @returns {Interval[]} */
function windowsFor(day, salon) {
  const d0 = dayStart(day), at = (hhmm) => d0 + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))) * MIN;
  return (salon.open_hours[weekdayOf(day)] || []).map(([a, b]) => ({start: at(a), end: at(b)}));
}

/**
 * Busy intervals on `day`, clipped to it. All-day and "Closed" events are busy whatever their
 * transparency; other timed events are busy unless transparent.
 * @param {CalEvent[]} events @param {string} day @returns {Interval[]}
 */
export function busyFromEvents(events, day) {
  const d0 = dayStart(day), d1 = d0 + 864e5, out = [];
  for (const e of events) {
    if (e.status === 'cancelled') continue;
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
