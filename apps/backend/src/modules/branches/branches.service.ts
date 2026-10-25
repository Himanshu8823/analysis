import { Injectable } from '@nestjs/common';
import { BranchesRepository } from './branches.repository';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import type { Branch } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(private readonly repository: BranchesRepository) {}

  async create(dto: CreateBranchDto, userId: string): Promise<Branch> {
    return this.repository.create(dto, userId);
  }

  async findAll(): Promise<Branch[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Branch> {
    return this.repository.findById(id);
  }

  async update(id: string, dto: UpdateBranchDto, userId: string): Promise<Branch> {
    return this.repository.update(id, dto, userId);
  }

  async delete(id: string, userId: string): Promise<void> {
    return this.repository.delete(id, userId);
  }
}
