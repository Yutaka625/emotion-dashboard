import { describe, expect, it } from 'vitest';
import { buildAcademicDynamicsCompare } from './academicDynamics';
import type { AffectDynamics } from './types';

function dynamics(partial: Partial<AffectDynamics>): AffectDynamics {
  return {
    variability_sd: 0,
    instability_mssd: 0,
    inertia_ar1: 0,
    range: 0,
    mean_absolute_change: 0,
    ...partial,
  };
}

describe('buildAcademicDynamicsCompare', () => {
  it('keeps emotions and special indicators visually distinguishable', () => {
    const rows = buildAcademicDynamicsCompare({
      affect_dynamics: {
        joy: dynamics({ variability_sd: 1.2 }),
        engagement: dynamics({ variability_sd: 2.3 }),
        valence: dynamics({ variability_sd: 3.4 }),
      },
    });

    expect(rows.find(row => row.key === 'joy')).toMatchObject({
      kind: 'emotion',
      sd: 1.2,
    });
    expect(rows.find(row => row.key === 'engagement')).toMatchObject({
      kind: 'special',
      sd: 2.3,
    });
    expect(rows.find(row => row.key === 'valence')).toMatchObject({
      kind: 'special',
      sd: 3.4,
    });
  });
});
