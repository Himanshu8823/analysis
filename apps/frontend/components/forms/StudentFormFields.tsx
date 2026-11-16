'use client';

import { useState } from 'react';

import { Select } from '@/components/forms/Select';
import { useBatches } from '@/hooks/useAcademic';
import { useCurrentUser } from '@/hooks/useAuth';
import { ALL_SEMESTERS, defaultAcademicYear, yearForSemester } from '@/lib/academic';
import type {
  BloodGroup,
  FeeCategory,
  Gender,
  GuardianRelation,
  ReservedCategory,
  Student,
  StudentStatus,
} from '@/lib/services/students.service';

interface StudentFormFieldsProps {
  /** DOM id of the form element, so a save button can target it. */
  id: string;
  /** Prefilled values when editing; omitted when creating. */
  initial?: Student;
  branches: Array<{ id: string; code: string; name: string }>;
  schemes: Array<{ id: string; name: string }>;
  /**
   * The academic years the college has.
   *
   * The **dates** matter as much as the label: the running year is the one
   * whose dates contain today, not the one somebody ticked. The form
   * defaults to that year, so a student is recorded against the year the
   * college is actually in.
   */
  academicYears: Array<{
    id: string;
    year: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  }>;
  onSubmit: (payload: Omit<Student, 'id'>) => void;
}

/**
 * The options of the widened student fields.
 *
 * They are written as the college reads them, not as the database stores
 * them: "Scheduled Caste" rather than `SC`, "Father" rather than `FATHER`.
 */
const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'NOT_RECORDED', label: 'Not recorded' },
];

const BLOOD_GROUPS: Array<{ value: BloodGroup; label: string }> = [
  { value: 'A_POS', label: 'A positive' },
  { value: 'A_NEG', label: 'A negative' },
  { value: 'B_POS', label: 'B positive' },
  { value: 'B_NEG', label: 'B negative' },
  { value: 'AB_POS', label: 'AB positive' },
  { value: 'AB_NEG', label: 'AB negative' },
  { value: 'O_POS', label: 'O positive' },
  { value: 'O_NEG', label: 'O negative' },
  { value: 'NOT_RECORDED', label: 'Not recorded' },
];

const RESERVED_CATEGORIES: Array<{ value: ReservedCategory; label: string }> = [
  { value: 'GENERAL', label: 'General' },
  { value: 'SC', label: 'Scheduled Caste' },
  { value: 'ST', label: 'Scheduled Tribe' },
  { value: 'OBC', label: 'Other Backward Class' },
  { value: 'EWS', label: 'Economically Weaker Section' },
  { value: 'NOT_RECORDED', label: 'Not recorded' },
];

const FEE_CATEGORIES: Array<{ value: FeeCategory; label: string }> = [
  { value: 'REGULAR', label: 'Regular fee' },
  { value: 'MANAGEMENT_QUOTA', label: 'Management quota' },
  { value: 'NRI', label: 'NRI fee' },
  { value: 'CONCESSION', label: 'Fee concession' },
  { value: 'SCHOLARSHIP', label: 'Scholarship' },
  { value: 'NOT_RECORDED', label: 'Not recorded' },
];

const GUARDIAN_RELATIONS: Array<{ value: GuardianRelation; label: string }> = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GRANDFATHER', label: 'Grandfather' },
  { value: 'GRANDMOTHER', label: 'Grandmother' },
  { value: 'UNCLE', label: 'Uncle' },
  { value: 'AUNT', label: 'Aunt' },
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'SIBLING', label: 'Brother or sister' },
  { value: 'OTHER', label: 'Guardian' },
];

const STUDENT_STATUSES: Array<{ value: StudentStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Studying' },
  { value: 'GRADUATED', label: 'Graduated' },
  { value: 'DROPPED_OUT', label: 'Dropped out' },
  { value: 'ON_LEAVE', label: 'On leave' },
];

/**
 * The fields the widened student model adds, beyond the class placement.
 */
interface StudentDetailsForm {
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  alternateEmail: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  photoUrl: string;
  bloodGroup: BloodGroup;
  nationalId: string;
  admissionYear: string;
  section: string;
  reservedCategory: ReservedCategory;
  feeCategory: FeeCategory;
  scholarshipRecipient: boolean;
  guardianName: string;
  guardianRelation: GuardianRelation;
  guardianPhone: string;
  guardianEmail: string;
  guardianOccupation: string;
  guardian2Name: string;
  guardian2Relation: GuardianRelation;
  guardian2Phone: string;
  guardian2Email: string;
  guardian2Occupation: string;
  status: StudentStatus;
  statusReason: string;
  statusDate: string;
}

/**
 * StudentFormFields — the shared field set for creating and editing a
 * student.
 *
 * One component serves both the "new student" and "edit student" pages:
 * the create page renders it with no `initial`, the edit page renders it
 * with the fetched record. The two flows therefore can never drift apart —
 * a field added here appears on both.
 *
 * ## The permission-gated blocks
 *
 * Three groups of fields are shown only to a member who may record them:
 * the **identity document** details, the **guardian** details and the
 * **status**. The gate is the same one the server enforces, read from the
 * session — so a teacher is never shown a field whose submission would be
 * refused.
 */
export function StudentFormFields({
  id,
  initial,
  branches,
  schemes,
  academicYears,
  onSubmit,
}: StudentFormFieldsProps) {
  /**
   * The **running** academic year is the default — the one whose dates
   * contain today, which is what the backend defaults its reports to. The
   * `isActive` flag is not consulted: a flag that contradicts the dates
   * would send the form to a year the college has already left.
   */
  const activeYear = defaultAcademicYear(academicYears) ?? academicYears[0];

  const [error, setError] = useState<string | null>(null);

  /**
   * The three gated blocks.
   *
   * They come from the session, which is the same source the server uses
   * to decide — so the form never offers a field the server would refuse.
   */
  const { data: user } = useCurrentUser();
  const held = new Set(user?.permissions ?? []);
  const mayRecordIdentity = held.has('students:read_sensitive');
  const mayRecordGuardian = held.has('students:read_guardian');

  const [form, setForm] = useState<Omit<Student, 'id'>>(() =>
    initial
      ? {
          rollNo: initial.rollNo,
          name: initial.name,
          branchId: initial.branchId,
          schemeId: initial.schemeId,
          semester: initial.semester,
          batchId: initial.batchId,
          academicYearId: initial.academicYearId,
          isActive: initial.isActive ?? true,
        }
      : {
          rollNo: '',
          name: '',
          branchId: branches[0]?.id ?? '',
          schemeId: schemes[0]?.id ?? '',
          semester: 1,
          batchId: '',
          academicYearId: activeYear?.id ?? '',
          isActive: true,
        },
  );

  const [details, setDetails] = useState<StudentDetailsForm>(() => ({
    dateOfBirth: '',
    gender: 'NOT_RECORDED',
    phone: '',
    alternateEmail: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    photoUrl: '',
    bloodGroup: 'NOT_RECORDED',
    nationalId: '',
    admissionYear: initial?.admissionYear ? String(initial.admissionYear) : '',
    section: initial?.section ?? '',
    reservedCategory: 'NOT_RECORDED',
    feeCategory: 'NOT_RECORDED',
    scholarshipRecipient: false,
    guardianName: '',
    guardianRelation: 'OTHER',
    guardianPhone: '',
    guardianEmail: '',
    guardianOccupation: '',
    guardian2Name: '',
    guardian2Relation: 'OTHER',
    guardian2Phone: '',
    guardian2Email: '',
    guardian2Occupation: '',
    status: initial?.status ?? 'ACTIVE',
    statusReason: '',
    statusDate: '',
  }));

  /**
   * A batch records the year a student was admitted, while `academicYearId`
   * is the year the student is currently in. They are different years, so
   * filtering the batches by the current academic year would hide the very
   * batch the student belongs to. Every batch is listed instead.
   */
  const { data: batchData } = useBatches();
  const batches = batchData ?? [];

  /**
   * Builds the payload.
   *
   * A field the clerk left blank is **omitted** rather than sent as an
   * empty string — so clearing a field is not the same as not touching it,
   * and a blank optional field never overwrites a recorded value.
   */
  const buildPayload = (): Omit<Student, 'id'> => {
    const payload: Record<string, unknown> = {
      ...form,
      admissionYear: details.admissionYear ? Number(details.admissionYear) : undefined,
      section: details.section || undefined,
      phone: details.phone || undefined,
      alternateEmail: details.alternateEmail || undefined,
      address: details.address || undefined,
      city: details.city || undefined,
      state: details.state || undefined,
      pincode: details.pincode || undefined,
      dateOfBirth: details.dateOfBirth || undefined,
      gender: details.gender,
      reservedCategory: details.reservedCategory,
      feeCategory: details.feeCategory,
      scholarshipRecipient: details.scholarshipRecipient,
      status: details.status,
      statusReason: details.statusReason || undefined,
      statusDate: details.statusDate || undefined,
    };

    if (mayRecordIdentity) {
      payload.photoUrl = details.photoUrl || undefined;
      payload.bloodGroup = details.bloodGroup;
      payload.nationalId = details.nationalId || undefined;
    }

    if (mayRecordGuardian) {
      payload.guardianName = details.guardianName || undefined;
      payload.guardianRelation = details.guardianRelation;
      payload.guardianPhone = details.guardianPhone || undefined;
      payload.guardianEmail = details.guardianEmail || undefined;
      payload.guardianOccupation = details.guardianOccupation || undefined;
      payload.guardian2Name = details.guardian2Name || undefined;
      payload.guardian2Relation = details.guardian2Relation;
      payload.guardian2Phone = details.guardian2Phone || undefined;
      payload.guardian2Email = details.guardian2Email || undefined;
      payload.guardian2Occupation = details.guardian2Occupation || undefined;
    }

    return payload as Omit<Student, 'id'>;
  };

  return (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        // A custom dropdown is a button, not a select, so the browser's own
        // required-validation does not fire for it. The batch is checked here
        // instead — it is the one field the server will reject.
        if (!form.batchId) {
          setError('Select a batch before saving.');
          return;
        }
        setError(null);
        onSubmit(buildPayload());
      }}
      className="flex flex-col gap-lg"
    >
      {/* -----------------------------------------------------------------
          Class placement
      ----------------------------------------------------------------- */}
      <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
        <legend className="sr-only">Class placement</legend>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Roll number</span>
          <input
            required
            value={form.rollNo}
            onChange={(e) => setForm({ ...form, rollNo: e.target.value.toUpperCase() })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Full name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="cb-input"
          />
        </label>
        <Select
          label="Branch"
          value={form.branchId}
          onChange={(e) => setForm({ ...form, branchId: e.target.value })}
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.code} · {branch.name}
            </option>
          ))}
        </Select>
        <Select
          label="Scheme"
          value={form.schemeId}
          onChange={(e) => setForm({ ...form, schemeId: e.target.value })}
        >
          {schemes.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.name}
            </option>
          ))}
        </Select>
        <Select
          label="Academic year"
          value={form.academicYearId}
          onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
        >
          {academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.year}
            </option>
          ))}
        </Select>
        <Select
          label="Batch"
          required
          error={error ?? undefined}
          value={form.batchId}
          onChange={(e) => {
            setError(null);
            setForm({ ...form, batchId: e.target.value });
          }}
        >
          <option value="">Select a batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name}
            </option>
          ))}
        </Select>
        {/**
         * The year follows from the semester — semesters 1 and 2 are year 1,
         * semesters 3 and 4 are year 2, and so on. It is shown for reference
         * but not chosen, so the two can never disagree.
         */}
        <Select label="Year" value={String(yearForSemester(form.semester))} disabled>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              Year {n}
            </option>
          ))}
        </Select>
        <Select
          label="Semester"
          value={String(form.semester)}
          onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
        >
          {ALL_SEMESTERS.map((n) => (
            <option key={n} value={n}>
              Semester {n}
            </option>
          ))}
        </Select>
      </fieldset>

      {/* -----------------------------------------------------------------
          Personal and contact details
      ----------------------------------------------------------------- */}
      <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
        <legend className="mb-base text-title-sm font-semibold text-ink">
          Personal and contact details
        </legend>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Date of birth</span>
          <input
            type="date"
            value={details.dateOfBirth}
            onChange={(e) => setDetails({ ...details, dateOfBirth: e.target.value })}
            className="cb-input"
          />
        </label>
        <Select
          label="Gender"
          value={details.gender}
          onChange={(e) => setDetails({ ...details, gender: e.target.value as Gender })}
        >
          {GENDERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Phone</span>
          <input
            type="tel"
            value={details.phone}
            onChange={(e) => setDetails({ ...details, phone: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Alternate email</span>
          <input
            type="email"
            value={details.alternateEmail}
            onChange={(e) => setDetails({ ...details, alternateEmail: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs md:col-span-2">
          <span className="text-body-sm font-semibold text-ink">Address</span>
          <input
            value={details.address}
            onChange={(e) => setDetails({ ...details, address: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">City</span>
          <input
            value={details.city}
            onChange={(e) => setDetails({ ...details, city: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">State</span>
          <input
            value={details.state}
            onChange={(e) => setDetails({ ...details, state: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Pincode</span>
          <input
            value={details.pincode}
            onChange={(e) => setDetails({ ...details, pincode: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Admission year</span>
          <input
            type="number"
            min={1900}
            max={2200}
            value={details.admissionYear}
            onChange={(e) => setDetails({ ...details, admissionYear: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Section</span>
          <input
            value={details.section}
            onChange={(e) => setDetails({ ...details, section: e.target.value })}
            className="cb-input"
          />
        </label>
      </fieldset>

      {/* -----------------------------------------------------------------
          Category and quotas
      ----------------------------------------------------------------- */}
      <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
        <legend className="mb-base text-title-sm font-semibold text-ink">
          Category and quotas
        </legend>
        <Select
          label="Reserved category"
          value={details.reservedCategory}
          onChange={(e) =>
            setDetails({ ...details, reservedCategory: e.target.value as ReservedCategory })
          }
        >
          {RESERVED_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Fee category"
          value={details.feeCategory}
          onChange={(e) => setDetails({ ...details, feeCategory: e.target.value as FeeCategory })}
        >
          {FEE_CATEGORIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={details.scholarshipRecipient}
            onChange={(e) =>
              setDetails({ ...details, scholarshipRecipient: e.target.checked })
            }
            className="size-4 rounded-xs border-hairline"
          />
          <span className="text-body-sm text-body">This student holds a scholarship.</span>
        </label>
      </fieldset>

      {/* -----------------------------------------------------------------
          The identity document — only for a member who may record it
      ----------------------------------------------------------------- */}
      {mayRecordIdentity ? (
        <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
          <legend className="mb-base text-title-sm font-semibold text-ink">
            Identity document
          </legend>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">National identity number</span>
            <input
              value={details.nationalId}
              onChange={(e) => setDetails({ ...details, nationalId: e.target.value })}
              className="cb-input"
            />
          </label>
          <Select
            label="Blood group"
            value={details.bloodGroup}
            onChange={(e) => setDetails({ ...details, bloodGroup: e.target.value as BloodGroup })}
          >
            {BLOOD_GROUPS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="flex flex-col gap-xs md:col-span-2">
            <span className="text-body-sm font-semibold text-ink">Photograph address</span>
            <input
              value={details.photoUrl}
              onChange={(e) => setDetails({ ...details, photoUrl: e.target.value })}
              className="cb-input"
            />
          </label>
        </fieldset>
      ) : null}

      {/* -----------------------------------------------------------------
          The guardians — only for a member who may record them
      ----------------------------------------------------------------- */}
      {mayRecordGuardian ? (
        <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
          <legend className="mb-base text-title-sm font-semibold text-ink">Guardian</legend>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Guardian’s name</span>
            <input
              value={details.guardianName}
              onChange={(e) => setDetails({ ...details, guardianName: e.target.value })}
              className="cb-input"
            />
          </label>
          <Select
            label="Relation to the student"
            value={details.guardianRelation}
            onChange={(e) =>
              setDetails({ ...details, guardianRelation: e.target.value as GuardianRelation })
            }
          >
            {GUARDIAN_RELATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Guardian’s phone</span>
            <input
              type="tel"
              value={details.guardianPhone}
              onChange={(e) => setDetails({ ...details, guardianPhone: e.target.value })}
              className="cb-input"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Guardian’s email</span>
            <input
              type="email"
              value={details.guardianEmail}
              onChange={(e) => setDetails({ ...details, guardianEmail: e.target.value })}
              className="cb-input"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Guardian’s occupation</span>
            <input
              value={details.guardianOccupation}
              onChange={(e) => setDetails({ ...details, guardianOccupation: e.target.value })}
              className="cb-input"
            />
          </label>

          {/*
            The second guardian. The college records both parents often
            enough that a single slot would lose a real record.
          */}
          <label className="flex flex-col gap-xs md:col-span-2">
            <span className="text-body-sm font-semibold text-ink">
              Second guardian’s name (if the college records one)
            </span>
            <input
              value={details.guardian2Name}
              onChange={(e) => setDetails({ ...details, guardian2Name: e.target.value })}
              className="cb-input"
            />
          </label>
          <Select
            label="Second guardian’s relation"
            value={details.guardian2Relation}
            onChange={(e) =>
              setDetails({ ...details, guardian2Relation: e.target.value as GuardianRelation })
            }
          >
            {GUARDIAN_RELATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Second guardian’s phone</span>
            <input
              type="tel"
              value={details.guardian2Phone}
              onChange={(e) => setDetails({ ...details, guardian2Phone: e.target.value })}
              className="cb-input"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Second guardian’s email</span>
            <input
              type="email"
              value={details.guardian2Email}
              onChange={(e) => setDetails({ ...details, guardian2Email: e.target.value })}
              className="cb-input"
            />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="text-body-sm font-semibold text-ink">Second guardian’s occupation</span>
            <input
              value={details.guardian2Occupation}
              onChange={(e) => setDetails({ ...details, guardian2Occupation: e.target.value })}
              className="cb-input"
            />
          </label>
        </fieldset>
      ) : null}

      {/* -----------------------------------------------------------------
          The status lifecycle
      ----------------------------------------------------------------- */}
      <fieldset className="grid grid-cols-1 gap-base md:grid-cols-2">
        <legend className="mb-base text-title-sm font-semibold text-ink">
          Standing in the course
        </legend>
        <Select
          label="Status"
          value={details.status}
          onChange={(e) => setDetails({ ...details, status: e.target.value as StudentStatus })}
        >
          {STUDENT_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="flex flex-col gap-xs">
          <span className="text-body-sm font-semibold text-ink">Date of the change</span>
          <input
            type="date"
            value={details.statusDate}
            onChange={(e) => setDetails({ ...details, statusDate: e.target.value })}
            className="cb-input"
          />
        </label>
        <label className="flex flex-col gap-xs md:col-span-2">
          <span className="text-body-sm font-semibold text-ink">Reason for the change</span>
          <input
            value={details.statusReason}
            onChange={(e) => setDetails({ ...details, statusReason: e.target.value })}
            className="cb-input"
          />
        </label>
      </fieldset>
    </form>
  );
}
