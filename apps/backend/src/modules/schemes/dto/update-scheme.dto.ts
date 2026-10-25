import { PartialType } from '@nestjs/swagger';
import { CreateSchemeDto } from './create-scheme.dto';

export class UpdateSchemeDto extends PartialType(CreateSchemeDto) {}
