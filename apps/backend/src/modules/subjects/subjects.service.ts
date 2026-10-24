import { Injectable, NotFoundException } from '@nestjs/common';
import { SubjectsRepository } from './subjects.repository';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';
import type { Subject } from '@prisma/client';

@Injectable()
export class SubjectsService {
  constructor(private readonly repository: SubjectsRepository) {}

  async create(dto: CreateSubjectDto): Promise<Subject> {
    return this.repository.create(dto);
  }

  async findAll(params: {
    branchId?: string;
    schemeId?: string;
    semester?: number;
    isActive?: boolean;
  }): Promise<Subject[]> {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<Subject> {
    const subject = await this.repository.findById(id);
    if (!subject) throw new NotFoundException('Subject not found');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}