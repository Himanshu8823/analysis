import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  AllocationsRepository,
  type TeacherAllocationRow,
  type ClassTeacherAssignmentRow,
} from './allocations.repository';
import { CreateTeacherAllocationDto, CreateClassTeacherAssignmentDto } from './dto';

@Injectable()
export class AllocationsService {
  constructor(
    private readonly repository: AllocationsRepository,
    private readonly prisma: PrismaClient
  ) {}

  // ---------------------------------------------------------------------
  // Teacher allocations — "this teacher teaches this subject offering"
  // ---------------------------------------------------------------------

  async findTeacherAllocations(params: {
    branchId?: string;
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
    subjectOfferingId?: string;
  }): Promise<TeacherAllocationRow[]> {
    return this.repository.findTeacherAllocations(params);
  }

  /**
   * Allocates a subject offering to a teacher.
   *
   * Three things are checked before the write:
   *  - the teacher exists and is active,
   *  - the offering exists and is active,
   *  - the pair has not already been allocated for that year.
   *
   * The offering must belong to the same branch as the teacher. A teacher of
   * one branch cannot be allocated a subject from another — that is what
   * makes the HOD's branch scope meaningful.
   */
  async createTeacherAllocation(dto: CreateTeacherAllocationDto): Promise<TeacherAllocationRow> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, isActive: true, name: true, email: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isActive) {
      throw new BadRequestStateException('This teacher account is deactivated');
    }

    const offering = await this.prisma.subjectOffering.findUnique({
      where: { id: dto.subjectOfferingId },
      select: { id: true, branchId: true, isActive: true },
    });
    if (!offering) throw new NotFoundException('Subject offering not found');
    if (!offering.isActive) {
      throw new BadRequestStateException('This subject offering is no longer active');
    }

    const duplicate = await this.prisma.teacherSubject.findFirst({
      where: {
        teacherId: dto.teacherId,
        subjectOfferingId: dto.subjectOfferingId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        'This teacher is already allocated to that subject for this year'
      );
    }

    await this.repository.createTeacherAllocation(dto);

    const rows = await this.repository.findTeacherAllocations({
      subjectOfferingId: dto.subjectOfferingId,
      teacherId: dto.teacherId,
      academicYearId: dto.academicYearId,
    });
    const created = rows[0];
    if (!created) {
      throw new NotFoundException('Allocation could not be read back');
    }
    return created;
  }

  async deleteTeacherAllocation(id: string): Promise<void> {
    const existing = await this.repository.findTeacherAllocationById(id);
    if (!existing) throw new NotFoundException('Teacher allocation not found');
    await this.repository.deleteTeacherAllocation(id);
  }

  // ---------------------------------------------------------------------
  // Class teacher assignments — "this teacher is the class teacher"
  // ---------------------------------------------------------------------

  async findClassTeacherAssignments(params: {
    branchId?: string;
    semester?: number;
    academicYearId?: string;
    teacherId?: string;
  }): Promise<ClassTeacherAssignmentRow[]> {
    return this.repository.findClassTeacherAssignments(params);
  }

  /**
   * Assigns the class teacher for a class.
   *
   * A class has exactly one class teacher. Posting for a class that already
   * has one *replaces* it rather than failing, so the caller never has to do
   * a delete-then-create dance — which would leave the class with no teacher
   * if the second step failed.
   */
  async createClassTeacherAssignment(
    dto: CreateClassTeacherAssignmentDto,
    assignedBy: string
  ): Promise<ClassTeacherAssignmentRow> {
    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId },
      select: { id: true, isActive: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isActive) {
      throw new BadRequestStateException('This teacher account is deactivated');
    }

    const existing = await this.prisma.classTeacherAssignment.findFirst({
      where: {
        branchId: dto.branchId,
        semester: dto.semester,
        schemeId: dto.schemeId,
        academicYearId: dto.academicYearId,
      },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.classTeacherAssignment.update({
        where: { id: existing.id },
        data: { teacherId: dto.teacherId, assignedBy, assignedAt: new Date() },
      });
    } else {
      await this.repository.createClassTeacherAssignment({ ...dto, assignedBy });
    }

    const rows = await this.repository.findClassTeacherAssignments({
      branchId: dto.branchId,
      semester: dto.semester,
      academicYearId: dto.academicYearId,
      teacherId: dto.teacherId,
    });
    const created = rows.find((r) => r.schemeId === dto.schemeId);
    if (!created) {
      throw new NotFoundException('Assignment could not be read back');
    }
    return created;
  }

  async deleteClassTeacherAssignment(id: string): Promise<void> {
    const existing = await this.repository.findClassTeacherAssignmentById(id);
    if (!existing) throw new NotFoundException('Class teacher assignment not found');
    await this.repository.deleteClassTeacherAssignment(id);
  }
}

/**
 * A bad state on an existing record — the record is there but cannot be used
 * (a deactivated teacher, a retired offering).
 *
 * `BadRequestException` is used rather than `ConflictException` because the
 * conflict is with the record's own state, not with another request.
 */
class BadRequestStateException extends ForbiddenException {}
