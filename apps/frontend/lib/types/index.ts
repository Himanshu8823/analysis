// Domain types — placeholders that will move to packages/shared-types
// when the backend exposes its generated types.

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HOD'
  | 'TEACHER'
  | 'PRINCIPAL'
  | 'STUDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
}

export interface Scheme {
  id: string;
  code: string;
  name: string;
  year: number;
}

export interface Subject {
  id: string;
  branchId: string;
  schemeId: string;
  semester: number;
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
}

export interface Student {
  id: string;
  rollNo: string;
  name: string;
  branchId: string;
  schemeId: string;
  year: number;
  semester: number;
  batchId?: string;
}

export interface Mark {
  id: string;
  studentId: string;
  subjectId: string;
  examType: 'INTERNAL' | 'EXTERNAL' | 'PRACTICAL';
  marksObtained: number;
  maxMarks: number;
  isAbsent: boolean;
}

export interface UploadJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  fileName: string;
  createdAt: string;
}

export interface Report {
  id: string;
  name: string;
  generatedAt: string;
  downloadUrl: string;
}