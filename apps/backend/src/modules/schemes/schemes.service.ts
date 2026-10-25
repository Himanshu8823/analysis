import { Injectable, NotFoundException } from '@nestjs/common';
import { SchemesRepository } from './schemes.repository';
import { CreateSchemeDto, UpdateSchemeDto } from './dto';
import type { Scheme } from '@prisma/client';

@Injectable()
export class SchemesService {
  constructor(private readonly repository: SchemesRepository) {}

  async create(dto: CreateSchemeDto): Promise<Scheme> {
    return this.repository.create(dto);
  }

  async findAll(): Promise<Scheme[]> {
    return this.repository.findAll();
  }

  async findById(id: string): Promise<Scheme> {
    const scheme = await this.repository.findById(id);
    if (!scheme) throw new NotFoundException('Scheme not found');
    return scheme;
  }

  async update(id: string, dto: UpdateSchemeDto): Promise<Scheme> {
    return this.repository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
