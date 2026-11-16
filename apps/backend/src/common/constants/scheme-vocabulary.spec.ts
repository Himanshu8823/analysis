import { COURSE_TYPES as BACKEND_COURSE_TYPES } from './scheme';
import { ASSESSMENT_COMPONENTS as BACKEND_COMPONENTS } from './scheme';
import {
  COURSE_TYPES as SHARED_COURSE_TYPES,
  ASSESSMENT_COMPONENTS as SHARED_COMPONENTS,
} from '@result-analysis/shared-types';

/**
 * The scheme vocabulary is declared twice — once for the backend and once
 * for the frontend — because the backend's runtime does not resolve the
 * shared package (every other import from it is type-only, and TypeScript
 * erases those).
 *
 * Two copies of a list is exactly the kind of thing that drifts apart over
 * time, so these tests hold them to each other. If a course type is added
 * to one and not the other, these fail.
 */
describe('the scheme vocabulary', () => {
  it('names the same course types in both places', () => {
    expect([...BACKEND_COURSE_TYPES].sort()).toEqual([...SHARED_COURSE_TYPES].sort());
  });

  it('names the same assessment components in both places', () => {
    expect([...BACKEND_COMPONENTS].sort()).toEqual([...SHARED_COMPONENTS].sort());
  });

  it('lists every course type the DBATU syllabus uses', () => {
    /**
     * The seven types the syllabus's own legend defines, plus the two the
     * newer regulations add.
     */
    for (const type of ['BSC', 'ESC', 'PCC', 'VSEC', 'CC', 'IKS', 'AEC']) {
      expect(BACKEND_COURSE_TYPES).toContain(type);
    }
  });

  it('lists the three components a scheme table can carry', () => {
    expect(BACKEND_COMPONENTS).toHaveLength(3);
  });
});
