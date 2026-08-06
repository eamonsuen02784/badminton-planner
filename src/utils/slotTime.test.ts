import { describe, it, expect } from 'vitest';
import { formatSlotTime } from './slotTime.js';

describe('formatSlotTime', () => {
  it('shows a relative offset when there is no session start time', () => {
    expect(formatSlotTime(1, { gameMinutes: 15, sessionStart: '' })).toBe('~0–15m');
    expect(formatSlotTime(3, { gameMinutes: 15, sessionStart: '' })).toBe('~30–45m');
  });

  it('shows clock times relative to the session start', () => {
    expect(formatSlotTime(1, { gameMinutes: 15, sessionStart: '09:00' })).toBe('9:00 AM – 9:15 AM');
    expect(formatSlotTime(2, { gameMinutes: 15, sessionStart: '09:00' })).toBe('9:15 AM – 9:30 AM');
  });

  it('crosses the noon AM/PM boundary correctly', () => {
    expect(formatSlotTime(1, { gameMinutes: 30, sessionStart: '11:45' })).toBe('11:45 AM – 12:15 PM');
  });

  it('crosses midnight back to 12-hour format', () => {
    expect(formatSlotTime(1, { gameMinutes: 30, sessionStart: '23:45' })).toBe('11:45 PM – 12:15 AM');
  });

  it('pads single-digit minutes', () => {
    expect(formatSlotTime(1, { gameMinutes: 5, sessionStart: '10:00' })).toBe('10:00 AM – 10:05 AM');
  });
});
