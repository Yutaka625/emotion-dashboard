import type { HeadMotionEvent } from './types';

export type HeadMotionFilter = 'all' | HeadMotionEvent['type'];

export function filterHeadMotionEvents(
  events: HeadMotionEvent[],
  filter: HeadMotionFilter,
): HeadMotionEvent[] {
  if (filter === 'all') return events;
  return events.filter(event => event.type === filter);
}

export function countHeadMotionEventsByType(events: HeadMotionEvent[]): Record<HeadMotionFilter, number> {
  return {
    all: events.length,
    nod: events.filter(event => event.type === 'nod').length,
    shake: events.filter(event => event.type === 'shake').length,
    tilt: events.filter(event => event.type === 'tilt').length,
  };
}
