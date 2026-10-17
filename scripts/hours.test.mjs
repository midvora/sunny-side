import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, hoursRows, hoursSummary, statusAt } from '../src/lib/hours.ts';

const hours = {
  tz: 'America/Chicago',
  days: {
    mon: ['07:00', '18:00'], tue: ['07:00', '18:00'], wed: ['07:00', '18:00'], thu: ['07:00', '18:00'], fri: ['07:00', '18:00'],
    sat: ['08:00', '14:00'], sun: null,
  },
};
const at = (iso) => statusAt(new Date(iso), hours);

test('formats times compactly and fully', () => {
  assert.equal(formatTime('07:00'), '7 AM');
  assert.equal(formatTime('13:30'), '1:30 PM');
  assert.equal(formatTime('00:00'), '12 AM');
  assert.equal(formatTime('12:00'), '12 PM');
  assert.equal(formatTime('07:00', false), '7:00 AM');
});

test('summarizes consecutive days with the same hours', () => {
  assert.equal(hoursSummary(hours), 'Mon–Fri 7 AM–6 PM · Sat 8 AM–2 PM · Sun closed');
});

test('lists seven rows and marks Sunday closed', () => {
  const rows = hoursRows(hours);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[6], { key: 'sun', name: 'Sunday', short: 'Sun', text: 'Closed', open: false });
  assert.equal(rows[0].text, '7:00 AM – 6:00 PM');
});

test('open on a weekday morning (Monday 10:00 CDT)', () => {
  assert.deepEqual(at('2026-10-19T15:00:00Z'), { open: true, text: 'Open now · closes 6 PM' });
});

test('closed before opening reads "opens today"', () => {
  assert.deepEqual(at('2026-10-19T11:30:00Z'), { open: false, text: 'Closed · opens 7 AM today' });
});

test('closing time itself is closed; the next day is "tomorrow"', () => {
  assert.deepEqual(at('2026-10-19T22:59:00Z'), { open: true, text: 'Open now · closes 6 PM' }); // 17:59
  assert.deepEqual(at('2026-10-19T23:00:00Z'), { open: false, text: 'Closed · opens 7 AM tomorrow' }); // 18:00
});

test('Saturday after close skips closed Sunday and names Monday', () => {
  assert.deepEqual(at('2026-10-24T20:00:00Z'), { open: false, text: 'Closed · opens 7 AM Monday' });
});

test('Sunday (closed all day) points at Monday as tomorrow', () => {
  assert.deepEqual(at('2026-10-25T17:00:00Z'), { open: false, text: 'Closed · opens 7 AM tomorrow' });
});

test('handles the end of daylight saving time (Nov 1, 2026)', () => {
  // After the change Chicago is UTC-6, so 13:00Z is 7:00 AM and 12:59Z is 6:59 AM.
  assert.deepEqual(at('2026-11-02T13:00:00Z'), { open: true, text: 'Open now · closes 6 PM' });
  assert.deepEqual(at('2026-11-02T12:59:00Z'), { open: false, text: 'Closed · opens 7 AM today' });
});

test('uses the business time zone, not the viewer’s', () => {
  // 02:00 UTC Tuesday is still Monday evening in Chicago, and after close.
  assert.equal(at('2026-10-20T02:00:00Z').open, false);
  assert.equal(at('2026-10-20T02:00:00Z').text, 'Closed · opens 7 AM tomorrow');
});
