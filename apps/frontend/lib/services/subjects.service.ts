import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { ExamType } from '@result-analysis/shared-types';

/**
 * Subjects — the catalogue the Exam Cell defines and the teacher fills in.
 *
 * CONTRACT NOTE (single place to update)
 * --------------------------------------
 * The backend is splitting `Subject` into two records:
 *
 *   `Subject`         identity only — code, name, credits, maxMarks,
 *                     passingMarks, components (JSON), isActive.
 *   `SubjectOffering` the per-semester assignment — subjectId, branchId,
 *                     semester, schemeId, year, academicYearId.
 *
 * This service is written against the **new split**. The backend's
 * `CreateSubjectDto` already carries only the identity fields, and the
 * global `ValidationPipe` runs with `forbidNonWhitelisted: true` — so
 * sending a `branchId` to `POST /subjects` is a hard 400, not a warning.
 *
 * The OLD shape (branchId / schemeId / semester / year on the subject row)
 * is still *read* defensively — `Subject.branchId` etc. are optional, so a
 * backend that has not migrated yet still renders — but they are never
 * *written* to `POST /subjects` / `PUT /subjects/:id`.
 *
 * To move back to the old shape, the only edits needed are:
 *   1. `SubjectPayload` — add the branch/semester/scheme/year fields back.
 *   2. `buildSubjectPayload` — copy them into the body.
 *   3. `listOfferings` — read `GET /subjects` instead of
 *      `GET /subject-offerings` (the fallback path already does this).
 */

/** The exam types a subject's component breakdown may use. */
export const EXAM_TYPES: readonly ExamType[] = [
  'CA1',
  'CA2',
  'MID_SEM',
  'WRITTEN',
  'PRACTICAL',
  'ORAL',
] as const;

/** Narrows an arbitrary string to a known exam type. */
export function isExamType(value: string): value is ExamType {
  return (EXAM_TYPES as readonly string[]).includes(value);
}

/**
 * One exam component of a subject — how its total splits.
 *
 * This is the *template*: it says what each part is worth, never what a
 * student scored.
 *
 * `type` is a free string because the backend's DTO types it as one: the
 * known exam types are the `ExamType` union, but the server accepts any
 * label, and a subject edited in the exam cell must not lose a component
 * the app does not recognise.
 */
export interface SubjectComponent {
  type: string;
  maxMarks: number;
  /** Optional — a component may have no explicit pass mark. */
  passingMarks?: number;
  weightage?: number;
}

/**
 * The subject catalogue entry — identity only.
 *
 * This is the shape the backend is moving to: a subject says *what* it is
 * (code, name, credits, marks ceiling, assessment template) and nothing
 * about where it is taught. Where it is taught lives on the offering.
 *
 * The placement fields are carried as optional so a backend that has not
 * migrated yet still type-checks and still renders — they are simply absent
 * in the new shape.
 */
export interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
  /** Marks required to pass the subject. */
  passingMarks: number;
  components?: SubjectComponent[];
  isActive?: boolean;
  /**
   * Legacy placement fields — present only while the backend still returns
   * the pre-split shape, where the subject row *was* the offering.
   */
  branchId?: string;
  schemeId?: string;
  semester?: number;
  year?: number;
}

/**
 * The identity fields `POST /subjects` accepts.
 *
 * Deliberately excludes branch/semester/scheme — those belong to the
 * offering, and the backend rejects unknown properties.
 */
export interface SubjectPayload {
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
  components?: SubjectComponent[];
  isActive?: boolean;
}

/** Kept as an alias so existing imports of `CreateSubjectPayload` still work. */
export type CreateSubjectPayload = SubjectPayload;

export interface SubjectListFilters {
  branchId?: string;
  schemeId?: string;
  semester?: number;
  isActive?: boolean;
  /** Free-text search over code and name. */
  search?: string;
}

/**
 * The per-semester assignment of a subject.
 *
 * A subject is a catalogue entry; an offering is the statement "this subject
 * is taught to this branch, in this semester, under this scheme".
 */
export interface SubjectOffering {
  id: string;
  subjectId: string;
  branchId: string;
  semester: number;
  schemeId: string;
  /** The curriculum year the offering belongs to. */
  year: number;
  academicYearId: string;
  isActive?: boolean;
  /** Joined for display — the backend may or may not include these. */
  subject?: Pick<Subject, 'id' | 'code' | 'name' | 'credits' | 'maxMarks' | 'passingMarks'>;
  branch?: { id: string; code: string; name: string };
  scheme?: { id: string; name: string };
}

export interface SubjectOfferingFilters {
  branchId?: string;
  semester?: number;
  schemeId?: string;
  academicYearId?: string;
  subjectId?: string;
}

/** The body `POST /subject-offerings` accepts. */
export interface SubjectOfferingPayload {
  subjectId: string;
  branchId: string;
  semester: number;
  schemeId: string;
  year: number;
  academicYearId: string;
}

/**
 * Normalises the component list off a subject row.
 *
 * The `components` column is a JSON blob, so a row that has never been given
 * a breakdown comes back as `null`, `[]` or an array of loosely-shaped
 * objects depending on how it was written. Everything downstream — the list
 * table, the editor, the sum check — reads it through this one function.
 *
 * A component whose `type` is not one of the known exam types is *kept*, not
 * dropped: the backend's DTO types `type` as a free string, so an unknown
 * value is data the exam cell entered, and silently discarding it would lose
 * that on the next save.
 */
export function normalizeComponents(raw: unknown): SubjectComponent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): SubjectComponent | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const record = entry as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type : '';
      const maxMarks = Number(record.maxMarks);
      if (!type || !Number.isFinite(maxMarks)) return null;
      const component: SubjectComponent = {
        type: type as ExamType,
        maxMarks,
      };
      const passing = Number(record.passingMarks);
      if (Number.isFinite(passing)) component.passingMarks = passing;
      const weightage = Number(record.weightage);
      if (Number.isFinite(weightage)) component.weightage = weightage;
      return component;
    })
    .filter((entry): entry is SubjectComponent => entry !== null);
}

/**
 * Builds the body for `POST /subjects` / `PUT /subjects/:id`.
 *
 * The offering fields are stripped on purpose: the new `CreateSubjectDto`
 * whitelists only the identity fields and the global validation pipe runs
 * with `forbidNonWhitelisted: true`, so an extra key is a hard 400.
 *
 * `undefined` values are dropped rather than sent — a `PUT` that includes
 * `name: undefined` is a different request from one that omits `name`, and
 * the class-validator whitelist would reject the key outright.
 *
 * To go back to the pre-split backend, add the four placement keys to
 * `SubjectPayload` and copy them into `body` here. That is the whole
 * switchover on the write path.
 */
function buildSubjectPayload(payload: Partial<SubjectPayload>): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (payload.code !== undefined) body.code = payload.code;
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.credits !== undefined) body.credits = payload.credits;
  if (payload.maxMarks !== undefined) body.maxMarks = payload.maxMarks;
  if (payload.passingMarks !== undefined) body.passingMarks = payload.passingMarks;
  if (payload.components !== undefined) {
    body.components = normalizeComponents(payload.components);
  }
  if (payload.isActive !== undefined) body.isActive = payload.isActive;

  return body;
}

export const subjectsService = {
  /** The backend returns a plain array for subjects (no pagination). */
  list: async (filters?: SubjectListFilters): Promise<Subject[]> => {
    const res = await apiClient.get(ENDPOINTS.SUBJECTS.LIST, { params: filters });
    const data = res.data?.data;
    return Array.isArray(data) ? data : [];
  },

  /** A single subject by id — used by the edit flow. */
  get: async (id: string): Promise<Subject> => {
    const res = await apiClient.get(ENDPOINTS.SUBJECTS.GET(id));
    return res.data.data;
  },

  create: async (payload: SubjectPayload): Promise<Subject> => {
    const res = await apiClient.post(ENDPOINTS.SUBJECTS.CREATE, buildSubjectPayload(payload));
    return res.data.data;
  },

  /** The backend exposes `PUT /subjects/:id`, not `PATCH`. */
  update: async (id: string, payload: Partial<SubjectPayload>): Promise<Subject> => {
    const res = await apiClient.put(
      ENDPOINTS.SUBJECTS.UPDATE(id),
      buildSubjectPayload(payload),
    );
    return res.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.SUBJECTS.DELETE(id));
  },

  /**
   * The subject offerings — which subject is taught where, in which semester.
   *
   * Reads `GET /subject-offerings`. When that route does not exist yet the
   * request 404s, and the offerings are read off the subject rows instead —
   * under the pre-split model a subject row *is* an offering. The fallback
   * keeps the offerings view working before and after the split lands.
   */
  listOfferings: async (filters?: SubjectOfferingFilters): Promise<SubjectOffering[]> => {
    try {
      const res = await apiClient.get(ENDPOINTS.SUBJECT_OFFERINGS.LIST, {
        params: filters,
      });
      const data = res.data?.data;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 404 && status !== 405) throw error;
      return subjectsService.listOfferingsFromSubjects(filters);
    }
  },

  /**
   * Reads the offerings off the subject rows.
   *
   * Under the pre-split model each subject row carries its own branch,
   * semester and scheme, so the row is the offering. Under the split model a
   * subject row may carry an `offerings` array instead — both are handled.
   */
  listOfferingsFromSubjects: async (
    filters?: SubjectOfferingFilters,
  ): Promise<SubjectOffering[]> => {
    const subjects = (await subjectsService.list()) as Array<
      Subject & {
        offerings?: SubjectOffering[];
        academicYearId?: string;
      }
    >;

    const offerings: SubjectOffering[] = [];
    for (const subject of subjects) {
      if (Array.isArray(subject.offerings) && subject.offerings.length > 0) {
        offerings.push(...subject.offerings);
        continue;
      }
      if (subject.branchId && subject.schemeId && subject.semester !== undefined) {
        offerings.push({
          id: subject.id,
          subjectId: subject.id,
          branchId: subject.branchId,
          semester: subject.semester,
          schemeId: subject.schemeId,
          year: subject.year ?? 1,
          academicYearId: subject.academicYearId ?? '',
          subject: {
            id: subject.id,
            code: subject.code,
            name: subject.name,
            credits: subject.credits,
            maxMarks: subject.maxMarks,
            passingMarks: subject.passingMarks,
          },
        });
      }
    }

    return offerings.filter((offering) => {
      if (filters?.branchId && offering.branchId !== filters.branchId) return false;
      if (filters?.semester !== undefined && offering.semester !== filters.semester) {
        return false;
      }
      if (filters?.schemeId && offering.schemeId !== filters.schemeId) return false;
      if (
        filters?.academicYearId &&
        offering.academicYearId &&
        offering.academicYearId !== filters.academicYearId
      ) {
        return false;
      }
      if (filters?.subjectId && offering.subjectId !== filters.subjectId) return false;
      return true;
    });
  },

  createOffering: async (payload: SubjectOfferingPayload): Promise<SubjectOffering> => {
    const res = await apiClient.post(
      ENDPOINTS.SUBJECT_OFFERINGS.CREATE,
      payload,
    );
    return res.data.data;
  },

  /**
   * Removes an offering.
   *
   * The backend does not guarantee a `DELETE /subject-offerings/:id` route
   * exists yet, so the route is only called when the id is present.
   */
  deleteOffering: async (id: string): Promise<void> => {
    await apiClient.delete(ENDPOINTS.SUBJECT_OFFERINGS.DELETE(id));
  },
};
