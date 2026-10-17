// Business-hours helpers. Pure functions (no DOM, no Astro) so they run at build time, in the browser and in node tests.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Window = [string, string] | null;

export interface Hours {
  tz: string;
  days: Record<DayKey, Window>;
}

export const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SUN_FIRST: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DAY_NAMES: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
export const DAY_SHORT: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** "07:00" -> "7 AM" (compact) or "7:00 AM". */
export function formatTime(t: string, compact = true): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return compact && m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface HoursRow {
  key: DayKey;
  name: string;
  short: string;
  text: string;
  open: boolean;
}

export function hoursRows(hours: Hours): HoursRow[] {
  return DAY_ORDER.map((key) => {
    const w = hours.days[key];
    return {
      key,
      name: DAY_NAMES[key],
      short: DAY_SHORT[key],
      open: !!w,
      text: w ? `${formatTime(w[0], false)} – ${formatTime(w[1], false)}` : 'Closed',
    };
  });
}

/** "Mon–Fri 7 AM–6 PM · Sat 8 AM–2 PM · Sun closed" */
export function hoursSummary(hours: Hours): string {
  const runs: { from: DayKey; to: DayKey; w: Window }[] = [];
  for (const key of DAY_ORDER) {
    const w = hours.days[key];
    const last = runs[runs.length - 1];
    if (last && JSON.stringify(last.w) === JSON.stringify(w)) last.to = key;
    else runs.push({ from: key, to: key, w });
  }
  return runs
    .map((r) => {
      const days = r.from === r.to ? DAY_SHORT[r.from] : `${DAY_SHORT[r.from]}–${DAY_SHORT[r.to]}`;
      return `${days} ${r.w ? `${formatTime(r.w[0])}–${formatTime(r.w[1])}` : 'closed'}`;
    })
    .join(' · ');
}

/** The weekday and minutes-since-midnight of an instant in the business's time zone. */
export function zoned(now: Date, tz: string): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const idx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day: SUN_FIRST[idx], minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export interface OpenStatus {
  open: boolean;
  text: string;
}

/** Is the shop open at this instant, and what should the badge say? */
export function statusAt(now: Date, hours: Hours): OpenStatus {
  const { day, minutes } = zoned(now, hours.tz);
  const today = hours.days[day];
  if (today) {
    const open = toMinutes(today[0]);
    const close = toMinutes(today[1]);
    if (minutes >= open && minutes < close) return { open: true, text: `Open now · closes ${formatTime(today[1])}` };
    if (minutes < open) return { open: false, text: `Closed · opens ${formatTime(today[0])} today` };
  }
  const start = DAY_ORDER.indexOf(day);
  for (let i = 1; i <= 7; i++) {
    const key = DAY_ORDER[(start + i) % 7];
    const w = hours.days[key];
    if (w) return { open: false, text: `Closed · opens ${formatTime(w[0])} ${i === 1 ? 'tomorrow' : DAY_NAMES[key]}` };
  }
  return { open: false, text: 'Closed' };
}
