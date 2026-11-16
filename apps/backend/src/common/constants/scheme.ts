/**
 * The scheme vocabulary.
 *
 * These are the values the scheme reader uses at runtime — the list of
 * course types a syllabus may name, and the list of assessment components
 * a scheme table may have.
 *
 * They are declared here rather than imported from the shared package
 * because the backend's runtime does not resolve that package (it is
 * type-only in every other place, and TypeScript erases those imports). A
 * *value* import would survive the compile and fail at run time, so the
 * values the backend actually needs live here.
 *
 * The shared package holds the same list for the frontend. The two are
 * checked against each other by `scheme-vocabulary.spec.ts`, so they
 * cannot drift apart.
 */

/**
 * The kinds of course a syllabus may name.
 */
export const COURSE_TYPES = [
  'BSC',
  'ESC',
  'PCC',
  'VSEC',
  'AEC',
  'CC',
  'IKS',
  'MDC',
  'MIC',
] as const;

/**
 * One kind of course.
 */
export type CourseType = (typeof COURSE_TYPES)[number];

/**
 * The assessment components a scheme table may have.
 *
 * `CA` — Continuous Assessment.
 * `MSE` — Mid-Semester Examination.
 * `ESE` — End-Semester Examination.
 */
export const ASSESSMENT_COMPONENTS = ['CA', 'MSE', 'ESE'] as const;

/**
 * One assessment component.
 */
export type AssessmentComponent = (typeof ASSESSMENT_COMPONENTS)[number];

/**
 * Narrows an arbitrary string to a course type.
 *
 * A type the system does not know is not a type — it is a reading that
 * went wrong, and it must not become a category.
 */
export function isCourseType(value: string): value is CourseType {
  return (COURSE_TYPES as readonly string[]).includes(value);
}

/**
 * Narrows an arbitrary string to an assessment component.
 */
export function isAssessmentComponent(value: string): value is AssessmentComponent {
  return (ASSESSMENT_COMPONENTS as readonly string[]).includes(value);
}
