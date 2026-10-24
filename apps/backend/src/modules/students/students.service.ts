import { Injectable, NotFoundException } from '@nestjs/common';
import { StudentsRepository } from './students.repository';
import { CreateStudentDto, UpdateStudentDto } from './dto';
import type { Student } from '@prisma/client';

@Injectable()
export class StudentsService {
  constructor(private readonly repository: StudentsRepository) {}

  async create(dto: CreateStudentDto, createdBy: string): Promise<Student> {
    return this.repository.create(dto, createdBy);
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    branchId?: string;
    schemeId?: string;
    currentYear?: number;
    semester?: number;
    academicYearId?: string;
    search?: string;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Student> {
    const student = await this.repository.findById(id);
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  async update(id: string, dto: UpdateStudentDto, updatedBy: string): Promise<Student> {
    return this.repository.update(id, dto, updatedBy);
  }

  async delete(id: string, deletedBy: string): Promise<void> {
    return this.repository.softDelete(id, deletedBy);
  }
}