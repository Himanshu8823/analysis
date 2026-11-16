import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { CourseType, SchemeCourse, SchemeWarning } from '@result-analysis/shared-types';

/**
 * The scheme reader — reading a syllabus PDF into reviewable subjects.
 *
 * The flow has three steps, and the middle one is the whole point:
 *
 * ```
 * upload a PDF → the reader proposes the courses → a human checks them →
 * the human confirms → the subjects are written
 * ```
 *
 * Nothing is written by the read. The model proposes; the human disposes.
 * A reading that misreads one course out of thirty must cost the reviewer
 * one correction, not a wrong mark in a result.
 */

/**
 * What the reader found.
 *
 * This mirrors the backend's `SchemeReadResponse` and adds the two things a
 * reviewer needs to trust it: the rows that were *dropped* (with the reason
 * — a dropped row is data that exists and was not understood, and hiding it
 * would be silent data loss) and the guard's verdict on the document.
 */
export interface SchemeReadResult {
  /** The courses the document lists, for review. */
  courses: SchemeCourse[];
  /** The semesters the document covers. */
  semesters: number[];
  /** The pages the document had. */
  pageCount: number;
  /** The pages that were actually read. */
  pagesRead: number;
  /** The model that read the document. */
  model: string;
  /** How long the reading took, in milliseconds. */
  durationMs: number;
  /** The things the reader was unsure about. */
  warnings: SchemeWarning[];
  /** The rows that were dropped, and why. */
  rejected: Array<{ reason: string; data: unknown }>;
  /** What the prompt-injection guard said about the document. */
  guard: {
    isSafe: boolean;
    verdicts: Array<{
      pageNumber: number;
      score: number;
      isSafe: boolean;
      /** Whether the guard could reach the page at all. */
      wasChecked: boolean;
    }>;
    refusedPages: number[];
    /**
     * The pages the guard could not check.
     *
     * They were not refused — nothing was found wrong with them — but they
     * were not defended either.
     */
    uncheckedPages: number[];
  };
}

/**
 * One course, as the reviewer confirmed it.
 *
 * The shape is the write DTO's, not the reader's, because the reviewer's
 * screen posts back exactly what it showed — after the reviewer may have
 * corrected a value on the way.
 *
 * Every optional field is omitted rather than sent as `null`: the global
 * validation pipe runs with `forbidNonWhitelisted: true`, so a key that is
 * not on the DTO is a hard 400.
 */
export interface ConfirmedCourse {
  courseCode: string;
  courseName: string;
  courseType?: CourseType;
  semester?: number;
  theoryHours?: number;
  practicalHours?: number;
  ca?: number;
  mse?: number;
  ese?: number;
  credits?: number;
  options?: string[];
  pageNumber?: number;
}

/**
 * The scope the subjects belong to.
 */
export interface SchemeConfirmPayload {
  branchId: string;
  academicYearId: string;
  schemeId: string;
  courses: ConfirmedCourse[];
}

/**
 * What the write did.
 */
export interface SchemeConfirmResult {
  /** Subjects that did not exist before. */
  created: number;
  /** Subjects that existed and were brought up to date. */
  updated: number;
  /** Rows that could not become a subject and were left out. */
  skipped: number;
  /** Offerings that did not exist before. */
  offeringsCreated: number;
  /** Offerings that existed and were brought up to date. */
  offeringsUpdated: number;
}

/**
 * Whether the automatic reading is available on this system.
 */
export interface SchemeReaderAvailability {
  available: boolean;
  /** What the user is told when it is not, or `null` when it is. */
  message: string | null;
}

export const schemeReaderService = {
  /**
   * Whether the automatic reading is available.
   *
   * The screen asks this before it offers the button, so a system with no AI
   * key shows the manual route on its own rather than failing when the user
   * presses a button that was never going to work.
   */
  availability: async (): Promise<SchemeReaderAvailability> => {
    const res = await apiClient.get(ENDPOINTS.SCHEME_READER.AVAILABILITY);
    return res.data.data;
  },

  /**
   * Uploads a syllabus PDF and reads it into courses for review.
   *
   * The file is sent as multipart form data. The bytes go to this system's
   * own backend, which stores them and reads the text out locally — the
   * document never goes to a third party.
   */
  readFile: async (
    file: File,
    scope: { branchId: string; academicYearId?: string },
  ): Promise<SchemeReadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('branchId', scope.branchId);
    if (scope.academicYearId) {
      formData.append('academicYearId', scope.academicYearId);
    }

    const res = await apiClient.post(ENDPOINTS.SCHEME_READER.READ_FILE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      /**
       * Reading a document is slow — the model has to work through every
       * page — so the request is given far longer than the default. The
       * server throttles the endpoint itself, so the long timeout cannot be
       * used to hammer it.
       */
      timeout: 180000,
    });
    return res.data.data;
  },

  /**
   * Writes the reviewed courses as subjects and their offerings.
   *
   * A course that already exists is updated rather than duplicated — the
   * reviewer is correcting a reading, not creating a second copy.
   */
  confirm: async (payload: SchemeConfirmPayload): Promise<SchemeConfirmResult> => {
    const res = await apiClient.post(ENDPOINTS.SCHEME_READER.CONFIRM, payload);
    return res.data.data;
  },

  /**
   * The address of the sample syllabus PDF.
   *
   * The endpoint needs no authentication and returns the file with a
   * `Content-Disposition: attachment` header, so it is a plain link rather
   * than a fetched blob.
   */
  sampleUrl: (): string =>
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}${ENDPOINTS.SCHEME_READER.SAMPLE}`,
};

/**
 * Turns a read course into the shape the write accepts.
 *
 * The reader returns `null` for a field the document did not print — a dash
 * in the table means "this course has no mid-semester exam", which is not
 * the same as "this course has a mid-semester exam worth zero". So the
 * `null`s are *omitted*, never sent as zero: the backend would otherwise
 * treat "not stated" as "worth nothing" and skip the course.
 *
 * The one exception is `options`, which is an array — an empty array says
 * "this course has no alternatives", which is true, so it is sent.
 */
export function toConfirmedCourse(course: SchemeCourse): ConfirmedCourse {
  const confirmed: ConfirmedCourse = {
    courseCode: course.courseCode,
    courseName: course.courseName,
  };

  if (course.courseType) confirmed.courseType = course.courseType;
  if (course.semester !== null) confirmed.semester = course.semester;
  if (course.theoryHours !== null) confirmed.theoryHours = course.theoryHours;
  if (course.practicalHours !== null) confirmed.practicalHours = course.practicalHours;
  if (course.ca !== null) confirmed.ca = course.ca;
  if (course.mse !== null) confirmed.mse = course.mse;
  if (course.ese !== null) confirmed.ese = course.ese;
  if (course.credits !== null) confirmed.credits = course.credits;
  if (Array.isArray(course.options) && course.options.length > 0) {
    confirmed.options = course.options;
  }
  if (course.pageNumber !== null) confirmed.pageNumber = course.pageNumber;

  return confirmed;
}

/**
 * Drops the courses that cannot become a subject.
 *
 * Two rules, both taken from the server's own write path so that the review
 * screen and the server agree on what will happen:
 *
 *  - A course with no code has nothing to identify it by. It is not sent,
 *    and it is *reported* — the reviewer is told it will be skipped rather
 *    than watching it vanish.
 *  - A course with no marks has nothing to mark. `ca + mse + ese` of zero
 *    means the document did not say, or said zero.
 *
 * Reporting them here matters: the reviewer must be able to see the count
 * of what will not be written, and compare it with the server's own count
 * when the write comes back.
 */
export function partitionConfirmable(
  courses: SchemeCourse[],
): { confirmable: ConfirmedCourse[]; skipped: Array<{ course: SchemeCourse; reason: string }> } {
  const confirmable: ConfirmedCourse[] = [];
  const skipped: Array<{ course: SchemeCourse; reason: string }> = [];

  for (const course of courses) {
    if (!course.courseCode.trim()) {
      skipped.push({
        course,
        reason: 'It has no course code, so there is nothing to identify it by.',
      });
      continue;
    }

    const marks = (course.ca ?? 0) + (course.mse ?? 0) + (course.ese ?? 0);
    if (marks <= 0) {
      skipped.push({
        course,
        reason: 'It carries no marks, so there is nothing to record a score against.',
      });
      continue;
    }

    confirmable.push(toConfirmedCourse(course));
  }

  return { confirmable, skipped };
}
