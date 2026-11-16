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

  /**
   * The branches a member may see.
   *
   * `undefined` means college-wide — every branch. A list of one or more
   * narrows the list to those branches. The list is a *set* rather than a
   * single id because a member may work in several branches, and a read
   * that named none must still be narrowed to all of them.
   */
  async findAll(branchIds?: string[]): Promise<Branch[]> {
    return this.repository.findAll(branchIds);
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
