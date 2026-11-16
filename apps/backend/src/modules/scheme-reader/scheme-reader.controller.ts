import { Controller, Get, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permissions, CurrentUser, Audited, AuditAction, AuditResource } from '@/common/decorators';
import { RequestTimeout } from '@/common/interceptors/timeout.interceptor';
import type { JwtPayload } from '@/common/types';
import { SchemeDocumentService } from './scheme-reader.service';
import { ReadSchemeDto, ConfirmSchemeDto } from './dto';

/**
 * How long a reading may take.
 *
 * A scheme document is several pages. Each page is checked by the guard and
 * then read by the model, and neither step can be hurried — a slow model is
 * still a correct answer.
 *
 * The wait is long because the provider limits how much a model may produce
 * in a minute, so the reader pauses between pages. A document of a dozen
 * pages takes a dozen minutes this way, and the timeout has to be above
 * that or the reading is cut off at the last page — which is the page the
 * reviewer most needs to see.
 */
const READING_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Reading a syllabus PDF into subjects.
 */
@ApiTags('Scheme Reader')
@ApiBearerAuth()
@Controller('scheme-reader')
export class SchemeReaderController {
  constructor(private readonly service: SchemeDocumentService) {}

  /**
   * Whether the automatic reading is available.
   *
   * The frontend asks this before it offers the button, so that a system
   * with no AI key shows the manual route on its own rather than failing
   * when the user presses a button.
   */
  @Get('availability')
  @Permissions('schemes:read')
  @ApiOperation({ summary: 'Whether the automatic scheme reading is available' })
  availability() {
    return {
      available: this.service.isReadingAvailable,
      /**
       * What the user is told when it is not. The manual route is always
       * there, so this is a reassurance rather than an apology.
       */
      message: this.service.isReadingAvailable
        ? null
        : 'Automatic reading is not available on this system. You can still enter the scheme by hand.',
    };
  }

  /**
   * Reads a syllabus PDF and returns the courses for review.
   *
   * Nothing is written by this call. The reviewer looks at what comes back
   * and confirms it in a second call.
   */
  @Post('read')
  @Permissions('schemes:read')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @RequestTimeout(READING_TIMEOUT_MS)
  @ApiOperation({ summary: 'Read a syllabus PDF into structured courses for review' })
  async read(@Body() dto: ReadSchemeDto, @CurrentUser() user: JwtPayload) {
    /**
     * The document is fetched here rather than inside the service, so the
     * service reads bytes and nothing else. The reader parses the text out
     * of the PDF locally, so a document already in storage is fetched once
     * and then read.
     */
    const buffer = await this.service.fetchStoredDocument(dto.fileUrl);

    return this.service.read(
      {
        buffer,
        fileName: dto.fileName,
        branchId: dto.branchId,
        academicYearId: dto.academicYearId,
      },
      user.sub
    );
  }

  /**
   * Uploads a syllabus PDF and reads it in one call.
   *
   * This is what the browser uses. The bytes never touch a third party: the
   * file is written to this system's own storage, and it is read from there.
   */
  @Post('read-file')
  @Permissions('schemes:read')
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @RequestTimeout(READING_TIMEOUT_MS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a syllabus PDF and read it into structured courses' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async readFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { branchId?: string; academicYearId?: string },
    @CurrentUser() user: JwtPayload
  ) {
    return this.service.readUploadedFile(file, body, user.sub);
  }

  /**
   * Writes the reviewed courses as subjects.
   */
  @Post('confirm')
  @Permissions('subjects:write')
  @Audited(AuditResource.SUBJECT, AuditAction.CREATE, {
    detailsFromBody: { courseCount: 'courses.length' },
  })
  @ApiOperation({ summary: 'Write the reviewed courses as subjects' })
  async confirm(@Body() body: ConfirmSchemeDto, @CurrentUser() user: JwtPayload) {
    return this.service.writeSubjects(
      {
        branchId: body.branchId,
        academicYearId: body.academicYearId,
        schemeId: body.schemeId,
        courses: body.courses,
      },
      user.sub
    );
  }
}
