/**
 * The test that keeps the college's language out of the database's.
 *
 * The student model stores `ON_LEAVE`, `SC`, `A_POS` and `FATHER` — a
 * developer's shorthand for the state, the category, the blood group and
 * the relation. A college clerk reads "On leave", "Scheduled Caste",
 * "A positive" and "Father".
 *
 * These tables are the single place that translation happens. A raw enum
 * value reaching the screen is a small thing that makes the whole system
 * feel like a tool built by developers rather than one built for the
 * people who use it — and it happens exactly once, in one place, unless
 * somebody bypasses the table.
 *
 * The test therefore checks two things: that every value the database can
 * store has a label, and that the labels are the ones a college would
 * use — not the raw value with a different capitalisation.
 */

import {
  BLOOD_GROUP_LABELS,
  EXAM_TYPE_LABELS,
  FEE_CATEGORY_LABELS,
  GENDER_LABELS,
  GUARDIAN_RELATION_LABELS,
  RESERVED_CATEGORY_LABELS,
  STUDENT_STATUS_LABELS,
  bloodGroupLabel,
  examinationStatusLabel,
  examTypeLabel,
  feeCategoryLabel,
  genderLabel,
  guardianRelationLabel,
  reservedCategoryLabel,
  studentStatusLabel,
} from '@/lib/utils/student-labels';

/**
 * Every value the database can store for each field.
 *
 * These mirror the Prisma enums. The list is written out here rather than
 * imported from the generated client, because the frontend may not import
 * a runtime value from the backend's generated client — and because a
 * written-out list is the thing a reviewer can read.
 */
const STORED_VALUES = {
  status: ['ACTIVE', 'GRADUATED', 'DROPPED_OUT', 'ON_LEAVE'],
  gender: ['MALE', 'FEMALE', 'OTHER', 'NOT_RECORDED'],
  bloodGroup: [
    'A_POS',
    'A_NEG',
    'B_POS',
    'B_NEG',
    'AB_POS',
    'AB_NEG',
    'O_POS',
    'O_NEG',
    'NOT_RECORDED',
  ],
  reservedCategory: ['GENERAL', 'SC', 'ST', 'OBC', 'EWS', 'NOT_RECORDED'],
  feeCategory: [
    'REGULAR',
    'MANAGEMENT_QUOTA',
    'NRI',
    'CONCESSION',
    'SCHOLARSHIP',
    'NOT_RECORDED',
  ],
  guardianRelation: [
    'FATHER',
    'MOTHER',
    'GRANDFATHER',
    'GRANDMOTHER',
    'UNCLE',
    'AUNT',
    'SPOUSE',
    'SIBLING',
    'OTHER',
  ],
};

describe('the student labels', () => {
  it('has a label for every status the database can store', () => {
    for (const value of STORED_VALUES.status) {
      const label = studentStatusLabel(value);
      expect({ value, label, known: label !== 'Unknown' }).toEqual({
        value,
        label,
        known: true,
      });
    }
  });

  it('has a label for every gender the database can store', () => {
    for (const value of STORED_VALUES.gender) {
      expect({ value, label: genderLabel(value) }).toEqual({
        value,
        label: GENDER_LABELS[value as keyof typeof GENDER_LABELS],
      });
    }
  });

  it('has a label for every blood group the database can store', () => {
    for (const value of STORED_VALUES.bloodGroup) {
      expect({ value, label: bloodGroupLabel(value) }).toEqual({
        value,
        label: BLOOD_GROUP_LABELS[value as keyof typeof BLOOD_GROUP_LABELS],
      });
    }
  });

  it('has a label for every reserved category the database can store', () => {
    for (const value of STORED_VALUES.reservedCategory) {
      expect({ value, label: reservedCategoryLabel(value) }).toEqual({
        value,
        label: RESERVED_CATEGORY_LABELS[value as keyof typeof RESERVED_CATEGORY_LABELS],
      });
    }
  });

  it('has a label for every fee category the database can store', () => {
    for (const value of STORED_VALUES.feeCategory) {
      expect({ value, label: feeCategoryLabel(value) }).toEqual({
        value,
        label: FEE_CATEGORY_LABELS[value as keyof typeof FEE_CATEGORY_LABELS],
      });
    }
  });

  it('has a label for every guardian relation the database can store', () => {
    for (const value of STORED_VALUES.guardianRelation) {
      // `OTHER` legitimately reads as "Guardian" — the college records
      // "somebody who is the student's guardian" without naming how.
      const label = guardianRelationLabel(value);
      expect({ value, label, known: label !== '' }).toEqual({
        value,
        label,
        known: true,
      });
    }
  });
});

describe('the labels a college would recognise', () => {
  it('writes the status the way the college writes it', () => {
    expect(studentStatusLabel('ACTIVE')).toBe('Studying');
    expect(studentStatusLabel('GRADUATED')).toBe('Graduated');
    expect(studentStatusLabel('DROPPED_OUT')).toBe('Dropped out');
    expect(studentStatusLabel('ON_LEAVE')).toBe('On leave');
  });

  it('spells out the reserved category rather than the code', () => {
    expect(reservedCategoryLabel('SC')).toBe('Scheduled Caste');
    expect(reservedCategoryLabel('ST')).toBe('Scheduled Tribe');
    expect(reservedCategoryLabel('OBC')).toBe('Other Backward Class');
    expect(reservedCategoryLabel('EWS')).toBe('Economically Weaker Section');
  });

  it('spells out the blood group rather than the code', () => {
    expect(bloodGroupLabel('A_POS')).toBe('A positive');
    expect(bloodGroupLabel('O_NEG')).toBe('O negative');
  });

  it('names the guardian rather than the code', () => {
    expect(guardianRelationLabel('FATHER')).toBe('Father');
    expect(guardianRelationLabel('SIBLING')).toBe('Brother or sister');
  });

  it('names the exam component the way the college names it', () => {
    expect(examTypeLabel('CA1')).toBe('Class Assignment 1');
    expect(examTypeLabel('MID_SEM')).toBe('Mid-Semester');
    expect(examTypeLabel('WRITTEN')).toBe('Written Examination');
    expect(examTypeLabel('PRACTICAL')).toBe('Practical');
  });

  it('names the examination state the way the college names it', () => {
    expect(examinationStatusLabel('PUBLISHED')).toBe('Result declared');
    expect(examinationStatusLabel('PENDING')).toBe('Not yet processed');
    expect(examinationStatusLabel(null)).toBe('No examination scheduled');
  });
});

describe('the labels when the value is missing or unknown', () => {
  it('says "not recorded" rather than showing nothing', () => {
    expect(genderLabel(null)).toBe('Not recorded');
    expect(bloodGroupLabel(undefined)).toBe('Not recorded');
    expect(reservedCategoryLabel(null)).toBe('Not recorded');
    expect(feeCategoryLabel(null)).toBe('Not recorded');
  });

  it('does not show a raw value for a status it does not know', () => {
    expect(studentStatusLabel('SOMETHING_ELSE')).toBe('Unknown');
    expect(studentStatusLabel(null)).toBe('Unknown');
  });

  it('falls back to the exam type itself when the system does not know it', () => {
    // A component the college invents later must still be readable — but
    // the fallback is the raw value, because there is nothing else to say.
    expect(examTypeLabel('FIELD_WORK')).toBe('FIELD_WORK');
  });
});

describe('the label tables are complete', () => {
  it('covers every status, gender, blood group, category and relation', () => {
    expect(Object.keys(STUDENT_STATUS_LABELS).sort()).toEqual(
      [...STORED_VALUES.status].sort(),
    );
    expect(Object.keys(GENDER_LABELS).sort()).toEqual([...STORED_VALUES.gender].sort());
    expect(Object.keys(BLOOD_GROUP_LABELS).sort()).toEqual(
      [...STORED_VALUES.bloodGroup].sort(),
    );
    expect(Object.keys(RESERVED_CATEGORY_LABELS).sort()).toEqual(
      [...STORED_VALUES.reservedCategory].sort(),
    );
    expect(Object.keys(FEE_CATEGORY_LABELS).sort()).toEqual(
      [...STORED_VALUES.feeCategory].sort(),
    );
    expect(Object.keys(GUARDIAN_RELATION_LABELS).sort()).toEqual(
      [...STORED_VALUES.guardianRelation].sort(),
    );
  });

  it('covers every exam component the marks model stores', () => {
    // These are the components the scheme calculators and the marks
    // importer know about.
    for (const examType of [
      'CA1',
      'CA2',
      'MID_SEM',
      'WRITTEN',
      'PRACTICAL',
      'ORAL',
      'CT',
      'MICRO_PROJECT',
      'QUIZ',
    ]) {
      expect(Object.keys(EXAM_TYPE_LABELS)).toContain(examType);
    }
  });
});
