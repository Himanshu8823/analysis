import type {
  BloodGroup,
  FeeCategory,
  Gender,
  GuardianRelation,
  ReservedCategory,
  StudentStatus,
} from '@/lib/services/students.service';

/**
 * The labels the college uses for the student's real-world details.
 *
 * The database stores `ON_LEAVE`, `SC`, `A_POS` and so on — a developer's
 * shorthand. A college clerk reads "On leave", "Scheduled Caste" and
 * "A positive". These tables are the single place that translation
 * happens, so a raw enum value can never reach the screen by accident.
 */

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: 'Studying',
  GRADUATED: 'Graduated',
  DROPPED_OUT: 'Dropped out',
  ON_LEAVE: 'On leave',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  NOT_RECORDED: 'Not recorded',
};

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

export const RESERVED_CATEGORY_LABELS: Record<ReservedCategory, string> = {
  GENERAL: 'General',
  SC: 'Scheduled Caste',
  ST: 'Scheduled Tribe',
  OBC: 'Other Backward Class',
  EWS: 'Economically Weaker Section',
  NOT_RECORDED: 'Not recorded',
};

export const FEE_CATEGORY_LABELS: Record<FeeCategory, string> = {
  REGULAR: 'Regular fee',
  MANAGEMENT_QUOTA: 'Management quota',
  NRI: 'NRI fee',
  CONCESSION: 'Fee concession',
  SCHOLARSHIP: 'Scholarship',
  NOT_RECORDED: 'Not recorded',
};

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
 * The exam components, in the words a college clerk uses.
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
 * The state of an examination, in the words a college clerk uses.
 */
export const EXAMINATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Not yet processed',
  PROCESSING: 'Being processed',
  PUBLISHED: 'Result declared',
  FAILED: 'Could not be processed',
};

/**
 * The label of a student's status.
 *
 * An unknown status falls back to a plain sentence rather than the raw
 * value — a value the system does not know is a sentence the clerk cannot
 * act on.
 */
export function studentStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return STUDENT_STATUS_LABELS[status as StudentStatus] ?? 'Unknown';
}

/**
 * The label of a gender.
 */
export function genderLabel(gender: string | null | undefined): string {
  if (!gender) return 'Not recorded';
  return GENDER_LABELS[gender as Gender] ?? 'Not recorded';
}

/**
 * The label of a blood group.
 */
export function bloodGroupLabel(group: string | null | undefined): string {
  if (!group) return 'Not recorded';
  return BLOOD_GROUP_LABELS[group as BloodGroup] ?? 'Not recorded';
}

/**
 * The label of a reserved category.
 */
export function reservedCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Not recorded';
  return RESERVED_CATEGORY_LABELS[category as ReservedCategory] ?? 'Not recorded';
}

/**
 * The label of a fee category.
 */
export function feeCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Not recorded';
  return FEE_CATEGORY_LABELS[category as FeeCategory] ?? 'Not recorded';
}

/**
 * The label of a guardian's relation to the student.
 */
export function guardianRelationLabel(relation: string | null | undefined): string {
  if (!relation) return 'Guardian';
  return GUARDIAN_RELATION_LABELS[relation as GuardianRelation] ?? 'Guardian';
}

/**
 * The label of an exam component.
 */
export function examTypeLabel(examType: string): string {
  return EXAM_TYPE_LABELS[examType.toUpperCase()] ?? examType;
}

/**
 * The label of an examination's state.
 */
export function examinationStatusLabel(status: string | null | undefined): string {
  if (!status) return 'No examination scheduled';
  return EXAMINATION_STATUS_LABELS[status.toUpperCase()] ?? 'Unknown';
}
