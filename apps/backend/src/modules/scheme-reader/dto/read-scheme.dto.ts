import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/**
 * The body of a request to read a syllabus PDF that is already in storage.
 */
export class ReadSchemeDto {
  /**
   * The file to read.
   *
   * The URL is one the storage service issued. It is not an arbitrary
   * address — the server fetches from its own bucket, and a URL that points
   * somewhere else would be a server-side request forgery.
   */
  @ApiProperty({ description: 'The storage URL of the syllabus PDF to read.' })
  @IsString()
  @MaxLength(2048)
  fileUrl!: string;

  /**
   * The name of the file, used only to label the reading in the review
   * screen and in the audit trail.
   */
  @ApiProperty({ description: 'The name of the file, for the audit trail.' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  /**
   * The branch the scheme belongs to.
   *
   * A scheme is read for one branch — the branch whose curriculum the
   * document describes.
   */
  @ApiProperty({ description: 'The branch the scheme belongs to.' })
  @IsString()
  branchId!: string;

  /**
   * The academic year the scheme belongs to.
   */
  @ApiProperty({ description: 'The academic year the scheme belongs to.' })
  @IsString()
  academicYearId!: string;
}
