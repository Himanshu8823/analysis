import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import type { Student } from '@prisma/client';
import { CreateStudentDto, UpdateStudentDto } from './dto';

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateStudentDto, _createdBy: string): Promise<Student> {
    try {
      return await this.prisma.student.create({
        data: {
          rollNo: data.rollNo,
          name: data.name,
          branchId: data.branchId,
          semester: data.semester,
          schemeId: data.schemeId,
          batchId: data.batchId,
          academicYearId: data.academicYearId,
          isActive: data.isActive ?? true,
          ...studentDetailFields(data),
          ...(data.admissionYear !== undefined ? { admissionYear: data.admissionYear } : {}),
          ...(data.section !== undefined ? { section: data.section } : {}),
        },
      });
    } catch (err) {
      /**
       * A roll number is unique per academic year. Without this the caller
       * gets a raw Prisma error (HTTP 500) instead of a conflict (HTTP 409).
       */
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(
          `Roll No "${data.rollNo}" already exists for this academic year`
        );
      }
      throw err;
    }
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    branchId?: string | string[];
    schemeId?: string;
    semester?: number;
    academicYearId?: string;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.StudentWhereInput = {
      // Soft-deleted students stay in the table for the audit trail, but they
      // must not appear in the roster.
      isActive: true,
    };
    // The scope may name one branch or a set of them (a user can hold a role
    // in more than one branch), so the filter accepts either.
    if (params.branchId) {
      where.branchId = Array.isArray(params.branchId) ? { in: params.branchId } : params.branchId;
    }
    if (params.schemeId) where.schemeId = params.schemeId;
    if (params.semester !== undefined) where.semester = params.semester;
    if (params.academicYearId) where.academicYearId = params.academicYearId;
    if (params.search) {
      where.OR = [
        { rollNo: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: { rollNo: 'asc' },
        skip,
        take: pageSize,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          scheme: { select: { id: true, name: true } },
          academicYear: { select: { id: true, year: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findById(id: string): Promise<Student | null> {
    return this.prisma.student.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateStudentDto, updatedBy: string): Promise<Student> {
    return this.prisma.student.update({
      where: { id },
      data: {
        ...(data.rollNo !== undefined ? { rollNo: data.rollNo } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId } : {}),
        ...(data.semester !== undefined ? { semester: data.semester } : {}),
        ...(data.schemeId !== undefined ? { schemeId: data.schemeId } : {}),
        ...(data.batchId !== undefined ? { batchId: data.batchId } : {}),
        ...(data.academicYearId !== undefined ? { academicYearId: data.academicYearId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...studentDetailFields(data),
        ...(data.admissionYear !== undefined ? { admissionYear: data.admissionYear } : {}),
        ...(data.section !== undefined ? { section: data.section } : {}),
        updatedBy,
      },
    });
  }

  async softDelete(id: string, _deletedBy: string): Promise<void> {
    await this.prisma.student.update({
      where: { id },
      data: { isActive: false, status: 'DROPPED_OUT' },
    });
  }

  /**
   * Inserts many students in one transaction. The unique constraint on
   * `(rollNo, academicYearId)` is the source of truth for duplicates — the
   * pre-check below only exists so the caller gets a per-row message instead
   * of a single rolled-back transaction.
   */
  async bulkCreate(
    rows: CreateStudentDto[]
  ): Promise<{ inserted: number; errors: Array<{ row: number; error: string }> }> {
    if (!rows.length) return { inserted: 0, errors: [] };

    const academicYearIds = [...new Set(rows.map((row) => row.academicYearId))];
    const rollNos = [...new Set(rows.map((row) => row.rollNo))];

    const existing = await this.prisma.student.findMany({
      where: {
        rollNo: { in: rollNos },
        academicYearId: { in: academicYearIds },
      },
      select: { rollNo: true, academicYearId: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.rollNo}::${e.academicYearId}`));

    const errors: Array<{ row: number; error: string }> = [];
    const accepted: CreateStudentDto[] = [];
    const seenInFile = new Set<string>();

    rows.forEach((row, index) => {
      const key = `${row.rollNo}::${row.academicYearId}`;
      if (existingKeys.has(key)) {
        errors.push({ row: index + 1, error: `Roll No "${row.rollNo}" already exists` });
        return;
      }
      if (seenInFile.has(key)) {
        errors.push({ row: index + 1, error: `Roll No "${row.rollNo}" is duplicated in the file` });
        return;
      }
      seenInFile.add(key);
      accepted.push(row);
    });

    if (!accepted.length) return { inserted: 0, errors };

    const result = await this.prisma.student.createMany({
      data: accepted.map((row) => ({
        rollNo: row.rollNo,
        name: row.name,
        branchId: row.branchId,
        semester: row.semester,
        schemeId: row.schemeId,
        batchId: row.batchId,
        academicYearId: row.academicYearId,
        isActive: row.isActive ?? true,
        ...studentDetailFields(row),
      })),
      skipDuplicates: true,
    });

    return { inserted: result.count, errors };
  }
}

/**
 * The writable real-world detail fields, as a Prisma data fragment.
 *
 * The DTO carries the dates as strings (that is what a JSON body holds),
 * and Prisma wants a `Date`. The conversion happens here, in one place, so
 * no call site has to remember it — and so an empty string never reaches
 * Prisma as an invalid date.
 *
 * Every field is conditional: an absent field is left alone rather than
 * written as `null`, so a partial update never clears a value the caller
 * did not mention.
 *
 * The return type is written out rather than borrowed from Prisma, because
 * the same fragment has to fit a create, an update and a `createMany` —
 * and Prisma's own operation-input types (`StringFieldUpdateOperationsInput`
 * and friends) are not accepted by the create shapes.
 */
interface StudentDetailFields {
  dateOfBirth?: Date | null;
  gender?: CreateStudentDto['gender'];
  phone?: string;
  alternateEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  photoUrl?: string;
  bloodGroup?: CreateStudentDto['bloodGroup'];
  nationalId?: string;
  reservedCategory?: CreateStudentDto['reservedCategory'];
  feeCategory?: CreateStudentDto['feeCategory'];
  scholarshipRecipient?: boolean;
  guardianName?: string;
  guardianRelation?: CreateStudentDto['guardianRelation'];
  guardianPhone?: string;
  guardianEmail?: string;
  guardianOccupation?: string;
  guardian2Name?: string;
  guardian2Relation?: CreateStudentDto['guardian2Relation'];
  guardian2Phone?: string;
  guardian2Email?: string;
  guardian2Occupation?: string;
  status?: CreateStudentDto['status'];
  statusReason?: string;
  statusDate?: Date | null;
}

function studentDetailFields(data: {
  dateOfBirth?: string;
  gender?: CreateStudentDto['gender'];
  phone?: string;
  alternateEmail?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  photoUrl?: string;
  bloodGroup?: CreateStudentDto['bloodGroup'];
  nationalId?: string;
  reservedCategory?: CreateStudentDto['reservedCategory'];
  feeCategory?: CreateStudentDto['feeCategory'];
  scholarshipRecipient?: boolean;
  guardianName?: string;
  guardianRelation?: CreateStudentDto['guardianRelation'];
  guardianPhone?: string;
  guardianEmail?: string;
  guardianOccupation?: string;
  guardian2Name?: string;
  guardian2Relation?: CreateStudentDto['guardian2Relation'];
  guardian2Phone?: string;
  guardian2Email?: string;
  guardian2Occupation?: string;
  status?: CreateStudentDto['status'];
  statusReason?: string;
  statusDate?: string;
}): StudentDetailFields {
  return {
    ...(data.dateOfBirth !== undefined ? { dateOfBirth: toDateOrNull(data.dateOfBirth) } : {}),
    ...(data.gender !== undefined ? { gender: data.gender } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.alternateEmail !== undefined ? { alternateEmail: data.alternateEmail } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.state !== undefined ? { state: data.state } : {}),
    ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
    ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
    ...(data.bloodGroup !== undefined ? { bloodGroup: data.bloodGroup } : {}),
    ...(data.nationalId !== undefined ? { nationalId: data.nationalId } : {}),
    ...(data.reservedCategory !== undefined ? { reservedCategory: data.reservedCategory } : {}),
    ...(data.feeCategory !== undefined ? { feeCategory: data.feeCategory } : {}),
    ...(data.scholarshipRecipient !== undefined
      ? { scholarshipRecipient: data.scholarshipRecipient }
      : {}),
    ...(data.guardianName !== undefined ? { guardianName: data.guardianName } : {}),
    ...(data.guardianRelation !== undefined ? { guardianRelation: data.guardianRelation } : {}),
    ...(data.guardianPhone !== undefined ? { guardianPhone: data.guardianPhone } : {}),
    ...(data.guardianEmail !== undefined ? { guardianEmail: data.guardianEmail } : {}),
    ...(data.guardianOccupation !== undefined
      ? { guardianOccupation: data.guardianOccupation }
      : {}),
    ...(data.guardian2Name !== undefined ? { guardian2Name: data.guardian2Name } : {}),
    ...(data.guardian2Relation !== undefined ? { guardian2Relation: data.guardian2Relation } : {}),
    ...(data.guardian2Phone !== undefined ? { guardian2Phone: data.guardian2Phone } : {}),
    ...(data.guardian2Email !== undefined ? { guardian2Email: data.guardian2Email } : {}),
    ...(data.guardian2Occupation !== undefined
      ? { guardian2Occupation: data.guardian2Occupation }
      : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.statusReason !== undefined ? { statusReason: data.statusReason } : {}),
    ...(data.statusDate !== undefined ? { statusDate: toDateOrNull(data.statusDate) } : {}),
  };
}

/**
 * Turns an ISO date string into a `Date`, or `null` when the string is
 * empty.
 *
 * The DTO validator has already refused a malformed date, so an invalid
 * value here means the string was blank — which the college reads as "no
 * date", not as "the first of January 1970".
 */
function toDateOrNull(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
