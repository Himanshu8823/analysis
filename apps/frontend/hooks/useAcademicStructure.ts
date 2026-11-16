'use client';

import { useQuery } from '@tanstack/react-query';
import {
  academicStructureService,
  type AcademicStructure,
} from '@/lib/services/academic-structure.service';

/**
 * The academic structure.
 *
 * The screen is a navigation, and a navigation is worth keeping fresh — the
 * structure changes when a subject is offered, a teacher is allocated, or a
 * class's marks come in. It is refetched when the window is focused for the
 * same reason.
 */
export function useAcademicStructure(params?: {
  branchId?: string;
  academicYearId?: string;
}) {
  return useQuery<AcademicStructure>({
    queryKey: ['academic-structure', params ?? null],
    queryFn: () => academicStructureService.get(params),
    staleTime: 60 * 1000,
  });
}
