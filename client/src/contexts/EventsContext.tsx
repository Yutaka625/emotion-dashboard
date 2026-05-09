/**
 * EventsContext — イベントアノテーションのグローバル状態管理
 * TimeseriesSection と UXResearchSection で共有するため Context に昇格
 */

import { createContext, useContext, useState } from 'react';

// ---- 型定義（TimeseriesSection から移動） ----

export interface EventAnnotation {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  color: string;
}

export const EVENT_PALETTE = [
  'oklch(0.78 0.14 82)',   /* gold */
  'oklch(0.70 0.14 195)', /* teal */
  'oklch(0.78 0.22 340)', /* hot pink */
  'oklch(0.80 0.18 160)', /* emerald */
  'oklch(0.72 0.22 300)', /* magenta */
  'oklch(0.82 0.22 195)', /* bright cyan */
  'oklch(0.78 0.18 60)',  /* amber */
  'oklch(0.68 0.26 22)',  /* vivid red */
  'oklch(0.88 0.20 82)',  /* bright gold */
  'oklch(0.68 0.20 280)', /* violet */
];

// ---- Context ----

interface EventsContextValue {
  events: EventAnnotation[];
  setEvents: React.Dispatch<React.SetStateAction<EventAnnotation[]>>;
}

const EventsContext = createContext<EventsContextValue>({
  events: [],
  setEvents: () => {},
});

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<EventAnnotation[]>([]);
  return (
    <EventsContext.Provider value={{ events, setEvents }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  return useContext(EventsContext);
}
