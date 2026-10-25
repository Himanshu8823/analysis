import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Subject } from './subjects.service';

/**
 * A subject as it is actually taught — one subject offered in one class
 * context (branch + semester + scheme).
 *
 * This is the unit a teacher is allocated to, so it is the unit the
 * assignments screen picks from.
 */
export interface SubjectOfferingOption {
  /** The offering id — what `POST /teacher-allocations` expects. */
  id: string;
  /** The subject's own id, when the backend exposes one. */
  subjectId: string;
  code: string;
  name: string;
  /**
   * The branch the offering belongs to.
   *
   * Optional because the split `Subject` model has no branch of its own —
   * only the offering carries it. A row read from the pre-split model
   * always has one.
   */
  branchId?: string;
  semester?: number;
  schemeId?: string;
  /** The curriculum year the offering belongs to (1, 2, 3, 4). */
  year?: number;
  academicYearId?: string | null;
}

/**
 * A row as the dedicated `GET /subject-offerings` resource returns it.
 *
 * The subject's code and name may travel either joined (`subject`) or flat on
 * the row, so both are read.
 */
interface OfferingRow {
  id: string;
  subjectId?: string;
  code?: string;
  name?: string;
  branchId: string;
  semester: number;
  schemeId: string;
  year?: number;
  academicYearId?: string | null;
  subject?: { id?: string; code?: string; name?: string };
}

/**
 * A subject row that may already carry its offerings.
 *
 * The backend is splitting `Subject` into `Subject` (identity) and
 * `SubjectOffering` (branch + semester + scheme). Until that split lands, a
 * subject row IS an offering; after it, the same row carries an `offerings`
 * array. Both shapes are read here so the caller never has to care which one
 * the server is speaking.
 */
interface SubjectWithOfferings extends Subject {
  offerings?: Array<{
    id: string;
    subjectId?: string;
    branchId: string;
    semester: number;
    schemeId: string;
    year?: number;
    academicYearId?: string | null;
    subject?: { id?: string; code: string; name: string };
  }>;
  /** Present on the split model — the offering id may travel on the subject. */
  subjectOfferingId?: string;
}

export interface SubjectOfferingFilters {
  branchId?: string;
  semester?: number;
  schemeId?: string;
  academicYearId?: string;
}

/**
 * Normalises a subject row into the offerings it represents.
 *
 * A subject that carries `offerings` expands into one option per offering; a
 * subject without them is itself an offering (the pre-split shape) and
 * becomes a single option keyed by its own id.
 */
function toOfferingOptions(subject: SubjectWithOfferings): SubjectOfferingOption[] {
  if (Array.isArray(subject.offerings) && subject.offerings.length > 0) {
    return subject.offerings.map((offering) => ({
      id: offering.id,
      subjectId: offering.subjectId ?? subject.id,
      code: offering.subject?.code ?? subject.code,
      name: offering.subject?.name ?? subject.name,
      branchId: offering.branchId,
      semester: offering.semester,
      schemeId: offering.schemeId,
      year: offering.year,
      academicYearId: offering.academicYearId ?? null,
    }));
  }

  // Pre-split shape: the subject row is the offering. The offering id falls
  // back to the subject id, and to the explicit `subjectOfferingId` when the
  // backend supplies one alongside the subject.
  return [
    {
      id: subject.subjectOfferingId ?? subject.id,
      subjectId: subject.id,
      code: subject.code,
      name: subject.name,
      branchId: subject.branchId,
      semester: subject.semester,
      schemeId: subject.schemeId,
      year: subject.year,
      academicYearId: null,
    },
  ];
}

export const subjectOfferingsService = {
  /**
   * Lists the subject offerings available to allocate.
   *
   * Two sources are read, in order:
   *
   * 1. `GET /subject-offerings` — the dedicated resource, available once the
   *    Subject/SubjectOffering split has landed.
   * 2. `GET /subjects` — the pre-split catalogue, where a subject row *is*
   *    an offering. Used as the fallback so the picker still works against a
   *    backend that has not migrated.
   *
   * Both are normalised to the same `SubjectOfferingOption` shape, so the
   * caller never has to care which one answered.
   */
  list: async (filters?: SubjectOfferingFilters): Promise<SubjectOfferingOption[]> => {
    const offerings = await listFromOfferingsEndpoint(filters);
    if (offerings.length > 0) return offerings;

    const res = await apiClient.get(ENDPOINTS.SUBJECTS.LIST, { params: filters });
    const subjects = (res.data.data ?? []) as SubjectWithOfferings[];

    return subjects
      .flatMap(toOfferingOptions)
      .filter((offering) => {
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
        return true;
      });
  },
};

/**
 * Reads the dedicated `GET /subject-offerings` resource.
 *
 * The route does not exist on a backend that has not migrated yet, so a 404
 * is treated as "not available" rather than as an error — the caller falls
 * back to the catalogue. Any other failure is propagated so the screen can
 * show a real error rather than silently showing an empty list.
 */
async function listFromOfferingsEndpoint(
  filters?: SubjectOfferingFilters,
): Promise<SubjectOfferingOption[]> {
  try {
    const res = await apiClient.get(ENDPOINTS.SUBJECT_OFFERINGS.LIST, { params: filters });
    const rows = res.data?.data as OfferingRow[] | undefined;
    if (!Array.isArray(rows)) return [];

    return rows.map((row) => ({
      id: row.id,
      subjectId: row.subjectId ?? row.subject?.id ?? row.id,
      code: row.subject?.code ?? row.code ?? '',
      name: row.subject?.name ?? row.name ?? '',
      branchId: row.branchId,
      semester: row.semester,
      schemeId: row.schemeId,
      year: row.year,
      academicYearId: row.academicYearId ?? null,
    }));
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404) return [];
    throw error;
  }
}
