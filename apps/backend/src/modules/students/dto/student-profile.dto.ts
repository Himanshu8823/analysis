import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  BloodGroup,
  FeeCategory,
  Gender,
  GuardianRelation,
  ReservedCategory,
  StudentStatus,
} from '@prisma/client';

/**
 * The **views** the profile screen is built from.
 *
 * These types are the whole of the PII contract. The service decides which
 * view a caller gets, and the view decides which fields exist at all — so a
 * field the caller may not see is not "blanked out" in the response, it is
 * **absent from the object**. A frontend that forgets to hide a column
 * cannot leak it, because the value is not in the payload to leak.
 *
 * That is the whole point of this design. The alternative — returning every
 * field and letting the frontend hide them — puts the security boundary in
 * the client, where it is one forgotten `className` away from being gone.
 */

/**
 * The sensitive identity block: the national identity reference and the
 * blood group.
 *
 * Only a caller holding `students:read_sensitive` ever receives this
 * object. Everyone else gets `undefined` for the field, not a masked
 * string.
 */
export interface StudentSensitiveIdentityView {
  /** The national identity reference (Aadhaar or equivalent). */
  nationalId: string | null;
  /** The blood group, as recorded on the college's identity card. */
  bloodGroup: BloodGroup | null;
}

/**
 * One guardian, as the profile shows them.
 */
export interface StudentGuardianView {
  name: string | null;
  relation: GuardianRelation | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
}

/**
 * The guardian block.
 *
 * Only a caller holding `students:read_guardian` ever receives this
 * object.
 */
export interface StudentGuardiansView {
  primary: StudentGuardianView | null;
  secondary: StudentGuardianView | null;
}

/**
 * The identity and profile block — the "who is this student" section.
 */
export interface StudentIdentityView {
  id: string;
  rollNo: string;
  name: string;
  /** The photograph, as a URL. Absent when no photo has been uploaded. */
  photoUrl: string | null;
  /** The initials to show when there is no photograph. */
  initials: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  schemeId: string;
  schemeName: string;
  batchId: string;
  batchName: string;
  /** The current semester. */
  semester: number;
  /** The year of study, derived from the semester. */
  currentYear: number;
  /** The academic year the student is currently in. */
  academicYearId: string;
  academicYear: string;
  /** The year the student joined the course. */
  admissionYear: number | null;
  /** The section (division). */
  section: string | null;
  /** The student's own email address. */
  email: string | null;
  /** Whether a login has been provisioned for this student. */
  hasLogin: boolean;

  // Contact details — always visible to a caller who may read the record.
  phone: string | null;
  alternateEmail: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;

  // Category and quotas.
  reservedCategory: ReservedCategory | null;
  feeCategory: FeeCategory | null;
  scholarshipRecipient: boolean;

  // The status lifecycle.
  status: StudentStatus;
  statusReason: string | null;
  statusDate: string | null;

  /**
   * The sensitive identity block.
   *
   * `undefined` when the caller may not read it. The key is absent from the
   * JSON entirely — not `null`, not an empty string.
   */
  sensitive?: StudentSensitiveIdentityView;

  /**
   * The guardian block.
   *
   * `undefined` when the caller may not read it.
   */
  guardians?: StudentGuardiansView;
}

/**
 * One subject in the academic snapshot — a subject the student is enrolled
 * in this semester.
 */
export interface StudentEnrolledSubjectView {
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
}

/**
 * The academic snapshot — "where the student stands right now".
 */
export interface StudentAcademicSnapshotView {
  /** The semester the snapshot describes. */
  semester: number;
  academicYearId: string;
  academicYear: string;
  /** The subjects the student is enrolled in this semester. */
  subjects: StudentEnrolledSubjectView[];
  /** The total credits of those subjects. */
  totalCredits: number;
  /** The credits the student earned in them. */
  earnedCredits: number;
  /** The aggregate percentage, as a number between 0 and 100. */
  aggregate: number | null;
  /** The aggregate as a grade letter. */
  grade: string | null;
  /** Whether the student passed every subject they were marked in. */
  isPass: boolean | null;
  /** Whether the result has been evaluated yet. */
  isEvaluated: boolean;
  /**
   * The subjects the student has not cleared.
   *
   * Empty when there is nothing to clear. `undefined` when the caller may
   * not read this student's result.
   */
  failedSubjects?: Array<{ subjectCode: string; subjectName: string; reason: string }>;
}

/**
 * One component of one subject — a single mark entry.
 */
export interface StudentMarkComponentView {
  examType: string;
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
  remarks: string | null;
}

/**
 * One subject's marks in one semester.
 */
export interface StudentSubjectMarksView {
  subjectOfferingId: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  academicYearId: string;
  academicYear: string;
  credits: number;
  /** The subject's maximum marks — shown so the score can be judged at a glance. */
  maxMarks: number;
  /** The subject's passing mark — shown alongside the score. */
  passingMarks: number;
  /** The total the student scored in this subject. */
  totalObtained: number;
  /** The sum of the components' maximum marks. */
  totalMax: number;
  /** The percentage the student scored in this subject. */
  percentage: number | null;
  /** Whether the student cleared this subject. */
  isPass: boolean | null;
  /** The reason the subject was not cleared, when it was not. */
  reason: string | null;
  /** The component breakdown — CA1, CA2, Mid-Sem, Written, Practical. */
  components: StudentMarkComponentView[];
}

/**
 * One semester's marks — the group the marks history is built from.
 *
 * The group is the semester, not the subject: a clerk reads a student's
 * journey semester by semester, and within each semester subject by
 * subject.
 */
export interface StudentMarksHistoryGroup {
  semester: number;
  academicYearId: string;
  academicYear: string;
  subjects: StudentSubjectMarksView[];
}

/**
 * One semester's result, as the result history shows it.
 */
export interface StudentResultHistoryEntryView {
  semester: number;
  academicYearId: string;
  academicYear: string;
  schemeName: string;
  /** The total the student scored across the semester's subjects. */
  totalMarks: number;
  /** The sum of the maximum marks across the semester's subjects. */
  maxTotalMarks: number;
  /** The aggregate percentage. */
  aggregate: number | null;
  /** The aggregate as a grade letter. */
  grade: string | null;
  /** The credits the student earned in the semester. */
  creditsEarned: number;
  /** The total credits of the semester's subjects. */
  totalCredits: number;
  /** Whether the student passed the semester. */
  isPass: boolean | null;
  /** The state of the examination this result belongs to. */
  examinationStatus: string | null;
  /** The name of the examination this result belongs to. */
  examinationName: string | null;
  /** When the result was declared, if it has been. */
  resultPublishedAt: string | null;
}

/**
 * One document attached to the student.
 */
export interface StudentDocumentView {
  id: string;
  /** The kind of document — "Mark statement", "Generated report". */
  kind: string;
  /** The document's title, in the language of the college. */
  title: string;
  /** When it was created. */
  createdAt: string;
  /** The status of the document — "Ready", "Being prepared", "Failed". */
  status: string;
  /** The file URL, when the document is ready to open. */
  fileUrl: string | null;
}

/**
 * One entry in the student's activity trail.
 */
export interface StudentActivityView {
  id: string;
  /** What happened, in the language of the college — "Marks updated". */
  action: string;
  /** Who did it. */
  actorName: string | null;
  /** When it happened. */
  createdAt: string;
  /** Any extra detail the audit row carries. */
  details: string | null;
}

/**
 * The whole profile payload.
 */
export interface StudentProfileView {
  /** The identity and profile block. */
  identity: StudentIdentityView;
  /**
   * The academic snapshot.
   *
   * `undefined` when the caller may not read this student's marks.
   */
  academic?: StudentAcademicSnapshotView;
  /**
   * The marks history, grouped by semester.
   *
   * `undefined` when the caller may not read this student's marks.
   */
  marksHistory?: Array<{
    semester: number;
    academicYearId: string;
    academicYear: string;
    subjects: StudentSubjectMarksView[];
  }>;
  /**
   * The result history — one row per semester.
   *
   * `undefined` when the caller may not read this student's results.
   */
  resultHistory?: StudentResultHistoryEntryView[];
  /**
   * The documents attached to the student.
   *
   * `undefined` when the caller may not read them.
   */
  documents?: StudentDocumentView[];
  /**
   * The activity trail — who changed this student's data, and when.
   *
   * `undefined` when the caller may not read the audit trail.
   */
  activity?: StudentActivityView[];
  /**
   * The actions this caller may take on this student.
   *
   * The list is computed on the server from the caller's permissions, so
   * the screen never offers a button the server would refuse.
   */
  availableActions: string[];
  /**
   * A note explaining what this caller may not see, when something is
   * withheld. Written for a college clerk, never as a permission string.
   */
  restrictedNotice?: string;
}

/**
 * The exam-type labels the profile uses.
 *
 * The database stores `CA1`, `MID_SEM` and so on — a developer's shorthand.
 * The screen shows what a college clerk calls them.
 */
export const EXAM_TYPE_LABELS: Record<string, string> = {
  CA1: 'Class Assignment 1',
  CA2: 'Class Assignment 2',
  CA3: 'Class Assignment 3',
  /** The Scheme 2022 internal component. */
  CT: 'Class Test',
  CT1: 'Class Test 1',
  CT2: 'Class Test 2',
  CT3: 'Class Test 3',
  MID_SEM: 'Mid-Semester',
  MICRO_PROJECT: 'Micro Project',
  QUIZ: 'Quiz',
  WRITTEN: 'Written Examination',
  EXTERNAL: 'External Examination',
  PRACTICAL: 'Practical',
  ORAL: 'Oral',
  THEORY: 'Theory',
};

/**
 * The label for an exam type, falling back to the raw value only when the
 * system does not know the type at all.
 */
export function examTypeLabel(examType: string): string {
  return EXAM_TYPE_LABELS[examType.toUpperCase()] ?? examType;
}

/**
 * The student status labels.
 */
export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Studying',
  GRADUATED: 'Graduated',
  DROPPED_OUT: 'Dropped out',
  ON_LEAVE: 'On leave',
};

/**
 * The gender labels.
 */
export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  NOT_RECORDED: 'Not recorded',
};

/**
 * The blood group labels.
 */
export const BLOOD_GROUP_LABELS: Record<BloodGroup, string> = {
  A_POS: 'A positive',
  A_NEG: 'A negative',
  B_POS: 'B positive',
  B_NEG: 'B negative',
  AB_POS: 'AB positive',
  AB_NEG: 'AB negative',
  O_POS: 'O positive',
  O_NEG: 'O negative',
  NOT_RECORDED: 'Not recorded',
};

/**
 * The reserved-category labels.
 */
export const RESERVED_CATEGORY_LABELS: Record<ReservedCategory, string> = {
  GENERAL: 'General',
  SC: 'Scheduled Caste',
  ST: 'Scheduled Tribe',
  OBC: 'Other Backward Class',
  EWS: 'Economically Weaker Section',
  NOT_RECORDED: 'Not recorded',
};

/**
 * The fee-category labels.
 */
export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  REGULAR: 'Regular fee',
  MANAGEMENT_QUOTA: 'Management quota',
  NRI: 'NRI fee',
  CONCESSION: 'Fee concession',
  SCHOLARSHIP: 'Scholarship',
  NOT_RECORDED: 'Not recorded',
};

/**
 * The guardian-relation labels.
 */
export const GUARDIAN_RELATION_LABELS: Record<GuardianRelation, string> = {
  FATHER: 'Father',
  MOTHER: 'Mother',
  GRANDFATHER: 'Grandfather',
  GRANDMOTHER: 'Grandmother',
  UNCLE: 'Uncle',
  AUNT: 'Aunt',
  SPOUSE: 'Spouse',
  SIBLING: 'Brother or sister',
  OTHER: 'Guardian',
};

/**
 * The grade a percentage earns.
 *
 * The bands are the ones a common Indian college uses for the aggregate.
 * A percentage with no band is reported as `null` rather than as a letter
 * the college does not use.
 */
export function gradeForPercentage(percentage: number | null): string | null {
  if (percentage === null || !Number.isFinite(percentage)) return null;
  if (percentage >= 90) return 'O';
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'B+';
  if (percentage >= 50) return 'B';
  if (percentage >= 45) return 'C';
  if (percentage >= 40) return 'P';
  return 'F';
}

/**
 * The API property decorators for the profile response.
 *
 * They are declared here so the Swagger page documents the shape without
 * the service having to repeat the annotations on every field.
 */
export const ProfileApiDocs = {
  identity: ApiProperty({
    description: 'The identity and profile block: who this student is.',
  }),
  academic: ApiPropertyOptional({
    description:
      'The academic snapshot: the current semester, its subjects and the ' +
      "student's standing in them. Absent when the caller may not read them.",
  }),
  marksHistory: ApiPropertyOptional({
    description:
      'The marks history, grouped by semester. Absent when the caller may ' +
      'not read this student’s marks.',
  }),
  resultHistory: ApiPropertyOptional({
    description:
      'The result history — one row per semester. Absent when the caller ' +
      'may not read this student’s results.',
  }),
  documents: ApiPropertyOptional({
    description: 'The documents attached to the student.',
  }),
  activity: ApiPropertyOptional({
    description: 'The activity trail — who changed this student, and when.',
  }),
  availableActions: ApiProperty({
    type: [String],
    description: 'The actions this caller may take on this student.',
  }),
};
