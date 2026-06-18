import { describe, expect, it } from 'vitest';
import type { HeadMotionEvent } from './types';
import { countHeadMotionEventsByType, filterHeadMotionEvents } from './uxResearchFilters';

const events: HeadMotionEvent[] = [
  { type: 'nod', time_start: 1, time_end: 1.4, magnitude: 11 },
  { type: 'shake', time_start: 2, time_end: 2.7, magnitude: 14 },
  { type: 'tilt', time_start: 3, time_end: 3.3, magnitude: 18 },
  { type: 'nod', time_start: 4, time_end: 4.5, magnitude: 9 },
];

describe('UX research head motion filters', () => {
  it('filters head motion events by selected motion type', () => {
    expect(filterHeadMotionEvents(events, 'all')).toEqual(events);
    expect(filterHeadMotionEvents(events, 'nod')).toEqual([events[0], events[3]]);
    expect(filterHeadMotionEvents(events, 'shake')).toEqual([events[1]]);
    expect(filterHeadMotionEvents(events, 'tilt')).toEqual([events[2]]);
  });

  it('counts events for filter chips', () => {
    expect(countHeadMotionEventsByType(events)).toEqual({
      all: 4,
      nod: 2,
      shake: 1,
      tilt: 1,
    });
  });
});
