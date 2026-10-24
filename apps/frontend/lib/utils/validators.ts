import { z } from 'zod';

export const validators = {
  rollNo: z.string().min(1).max(20).regex(/^[A-Z0-9]+$/i, 'Invalid roll number'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  marks: z.number().min(0).max(1000, 'Invalid marks'),
  year: z.number().int().min(1).max(4),
  semester: z.number().int().min(1).max(8),
} as const;