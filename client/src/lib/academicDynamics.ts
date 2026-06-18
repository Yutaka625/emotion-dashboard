import { EMOTION_COLORS, EMOTION_LABELS_JA, NON_NEUTRAL_EMOTIONS, type DashboardData } from './types';

export type AcademicDynamicsKind = 'emotion' | 'special';

export interface AcademicDynamicsRow {
  name: string;
  key: string;
  kind: AcademicDynamicsKind;
  sd: number;
  mssd: number;
  ar1: number;
  mac: number;
  color: string;
}

export function buildAcademicDynamicsCompare(data: Pick<DashboardData, 'affect_dynamics'>): AcademicDynamicsRow[] {
  return [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence'].map(key => ({
    name: EMOTION_LABELS_JA[key] || key,
    key,
    kind: key === 'engagement' || key === 'valence' ? 'special' : 'emotion',
    sd: data.affect_dynamics[key]?.variability_sd || 0,
    mssd: Math.sqrt(data.affect_dynamics[key]?.instability_mssd || 0),
    ar1: data.affect_dynamics[key]?.inertia_ar1 || 0,
    mac: data.affect_dynamics[key]?.mean_absolute_change || 0,
    color: EMOTION_COLORS[key] || (key === 'engagement' ? 'oklch(0.72 0.18 80)' : 'oklch(0.62 0.18 25)'),
  }));
}
