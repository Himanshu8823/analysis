/**
 * Reading a syllabus PDF into a reviewable set of subjects.
 *
 * The flow is deliberately short and deliberately stops short of the
 * database:
 *
 * ```
 * PDF → read → structured rows → the reviewer checks them → the reviewer
 * confirms → subjects are written
 * ```
 *
 * Nothing is written until the reviewer confirms. The model reads; it never
 * decides. That is the whole point of the review screen: a model that
 * misreads one course out of thirty must cost the reviewer one correction,
 * not a wrong mark in a result.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { CourseType } from '@/common/constants/scheme';
import type { SchemeDocument } from '@result-analysis/shared-types';
import { SchemeReaderService } from '@/common/ai/scheme-reader.service';
import { AiError } from '@/common/ai/ai.errors';
import { StorageService } from '../storage/storage.service';
import { AuthorisationService } from '@/common/services/authorisation.service';
import { UrlGuardService } from '@/common/services/url-guard.service';

/**
 * The largest syllabus the reader will accept.
 *
 * A scheme document is a handful of pages. A limit far above that exists so
 * that a mistake — handing the reader a textbook — is refused with a clear
 * message instead of consuming a large amount of time and money.
 */
const MAX_SCHEME_FILE_SIZE = 20 * 1024 * 1024;

/**
 * The result of reading a document, as the review screen receives it.
 */
export interface SchemeReadResponse extends SchemeDocument {
  /** The pages that were read. */
  pagesRead: number;
  /** The model that read the document. */
  model: string;
  /** How long the reading took, in milliseconds. */
  durationMs: number;
  /** The rows that were dropped, and why. */
  rejected: Array<{ reason: string; data: unknown }>;
  /**
   * What the guard said about the document.
   *
   * It tells the reviewer that the document was checked before it was read,
   * and how each page scored.
   */
  guard: {
    /** Whether every page was safe. */
    isSafe: boolean;
    /** The score for each page. Below 0.1 is safe. */
    verdicts: Array<{ pageNumber: number; score: number; isSafe: boolean; wasChecked: boolean }>;
    /** The pages that were refused. Empty when the document is safe. */
    refusedPages: number[];
    /**
     * The pages that could not be checked.
     *
     * They were not refused — nothing was found wrong with them — but they
     * were not defended either.
     */
    uncheckedPages: number[];
  };
}

/**
 * Reads syllabus documents and checks who may ask for it.
 */
@Injectable()
export class SchemeDocumentService {
  private readonly logger = new Logger(SchemeDocumentService.name);

  constructor(
    private readonly reader: SchemeReaderService,
    private readonly storage: StorageService,
    private readonly prisma: PrismaClient,
    private readonly authorisation: AuthorisationService,
    private readonly urlGuard: UrlGuardService
  ) {}

  /**
   * Whether the automatic reading is available.
   *
   * The frontend uses this to decide whether to offer the button at all,
   * rather than letting the user press it and fail.
   */
  get isReadingAvailable(): boolean {
    return this.reader.isAvailable;
  }

  /**
   * Reads a syllabus PDF and returns the rows for review.
   *
   * @param buffer The document's bytes.
   * @param fileName The name of the document, for the audit trail.
   * @param readerId The user asking for the reading.
   * @param branchId The branch the scheme is for.
   */
  async read(
    input: {
      buffer: Buffer;
      fileName: string;
      branchId: string;
      academicYearId: string;
    },
    readerId: string
  ): Promise<SchemeReadResponse> {
    /**
     * The branch scope is checked before anything is read. A user who may
     * not write to the branch gets a clear refusal rather than a reading
     * they cannot use.
     */
    await this.authorisation.assertBranchWritable(readerId, input.branchId, 'scheme');

    const buffer = input.buffer;

    if (buffer.length > MAX_SCHEME_FILE_SIZE) {
      throw new BadRequestException(
        'This document is too large to read. Upload only the pages that carry the scheme.'
      );
    }

    /**
     * The file must really be a PDF. A renamed spreadsheet would fail
     * inside the reader with a confusing message.
     */
    if (buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new BadRequestException('This file is not a PDF. Upload the scheme as a PDF.');
    }

    try {
      const result = await this.reader.read(buffer);

      this.logger.log(
        `Read "${input.fileName}" for branch ${input.branchId}: ${result.courses.length} courses, ` +
          `${result.warnings.length} warnings, ${result.rejected.length} rejected, ` +
          `${result.durationMs}ms with ${result.model}`
      );

      return {
        courses: result.courses,
        warnings: result.warnings,
        semesters: result.semesters,
        pageCount: result.pageCount,
        pagesRead: result.pagesRead,
        model: result.model,
        durationMs: result.durationMs,
        rejected: result.rejected,
        guard: result.guard,
      };
    } catch (error) {
      if (error instanceof AiError) {
        /**
         * The message the user is shown says what to do next, and the
         * manual route is always open.
         */
        this.logger.warn(
          `The scheme reading failed for "${input.fileName}": ${error.kind} — ${error.message}`
        );
        throw new ServiceUnavailableException(error.userMessage);
      }
      throw error;
    }
  }

  /**
   * Uploads a syllabus PDF and reads it in one call.
   *
   * The document is read from the bytes that were uploaded — it is never
   * written to storage and fetched back. The reader parses the text out of
   * the PDF locally, so a round trip through a file store would buy
   * nothing and would make the feature depend on the store being
   * configured.
   */
  async readUploadedFile(
    file: Express.Multer.File | undefined,
    body: { branchId?: string; academicYearId?: string },
    readerId: string
  ): Promise<SchemeReadResponse> {
    if (!file) {
      throw new BadRequestException('A PDF file is required.');
    }

    if (!body.branchId) {
      throw new BadRequestException('Choose the branch this scheme belongs to.');
    }

    /**
     * The file must really be a PDF. A renamed spreadsheet is refused here,
     * with a message that says what to do, rather than failing later with
     * a confusing error.
     */
    if (file.buffer.subarray(0, 4).toString('latin1') !== '%PDF') {
      throw new BadRequestException(
        'This file is not a PDF. Download the scheme as a PDF and upload that.'
      );
    }

    return this.read(
      {
        buffer: file.buffer,
        fileName: file.originalname,
        branchId: body.branchId,
        academicYearId: body.academicYearId ?? '',
      },
      readerId
    );
  }

  /**
   * Fetches a document's bytes from storage.
   *
   * The bytes are read from this system's own store when the URL points at
   * it, and fetched over HTTP otherwise. Only this system's own base URL is
   * fetched from - an arbitrary URL in a request body would let a caller
   * make the server fetch anything, which is a server-side request forgery.
   */
  async fetchStoredDocument(fileUrl: string): Promise<Buffer> {
    const stored = await this.storage.readByUrl(fileUrl);
    if (stored) return stored;

    let url: URL;
    try {
      url = new URL(fileUrl);
    } catch {
      throw new BadRequestException('That document address is not valid. Upload it again.');
    }

    /**
     * The origins the server is willing to fetch from.
     *
     * These are this system's own addresses — the storage base URL and the
     * configured frontend URL. They come from the configuration, never from
     * the request: an allowlist built out of the URL being checked would
     * allow every URL, because the URL would be on the list by definition.
     */
    const allowed = new Set<string>();
    allowed.add(this.storage.publicUrl);
    const configured = process.env.FRONTEND_URL;
    if (configured) {
      try {
        allowed.add(new URL(configured).origin);
      } catch {
        // A malformed configured URL simply contributes no origin.
      }
    }

    const origins = new Set<string>();
    for (const candidate of allowed) {
      try {
        origins.add(new URL(candidate).origin);
      } catch {
        // A malformed configured URL simply contributes no origin.
      }
    }

    if (!origins.has(url.origin)) {
      throw new ForbiddenException(
        'The document could not be read from that location. Upload it again.'
      );
    }

    /**
     * The origin is this system's own, but the address it resolves to still
     * has to be one the server may reach. The guard is what stops a name
     * that looks like the system's own from pointing somewhere else.
     */
    await this.urlGuard.assertFetchable(fileUrl);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new NotFoundException('The document could not be found. Upload it again.');
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Writes the reviewed courses as subjects and their offerings.
   *
   * This is called only after the reviewer has looked at the rows and
   * accepted them.
   *
   * The model behind the two writes matters: a `Subject` is the identity of
   * a course — its code, its name, its credits and its marks — and it is
   * shared by every branch that teaches it. A `SubjectOffering` is the
   * assignment of that subject to one branch, in one semester, under one
   * scheme. So a syllabus read for one branch creates or updates the
   * subject, and creates or updates the offering that binds it to that
   * branch.
   *
   * A course that already exists is updated rather than duplicated — the
   * reviewer is correcting a reading, not creating a second copy.
   */
  async writeSubjects(
    input: {
      branchId: string;
      academicYearId: string;
      schemeId: string;
      /**
       * The courses the reviewer confirmed.
       *
       * The shape is the DTO's, not the reader's, because the reviewer's
       * screen posts back exactly what it showed — and the reviewer may
       * have corrected a value on the way.
       */
      courses: Array<{
        courseCode: string;
        courseName: string;
        courseType?: CourseType | null;
        semester?: number | null;
        theoryHours?: number | null;
        practicalHours?: number | null;
        ca?: number | null;
        mse?: number | null;
        ese?: number | null;
        credits?: number | null;
        options?: string[];
        pageNumber?: number | null;
      }>;
    },
    writerId: string
  ): Promise<{
    created: number;
    updated: number;
    skipped: number;
    offeringsCreated: number;
    offeringsUpdated: number;
  }> {
    await this.authorisation.assertBranchWritable(writerId, input.branchId, 'subject');

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let offeringsCreated = 0;
    let offeringsUpdated = 0;

    for (const course of input.courses) {
      /**
       * A row without a code cannot become a subject — there is nothing to
       * identify it by. It is skipped and counted, not invented.
       */
      if (!course.courseCode.trim()) {
        skipped += 1;
        continue;
      }

      /**
       * The marks a subject carries.
       *
       * The scheme's components are the maximum marks of each part. A
       * subject with no components has no marks, and a subject with no
       * marks cannot be marked — so it is skipped.
       */
      const ca = course.ca ?? 0;
      const mse = course.mse ?? 0;
      const ese = course.ese ?? 0;
      const maxMarks = ca + mse + ese;

      if (maxMarks <= 0) {
        skipped += 1;
        continue;
      }

      /**
       * The components are stored as the scheme's own shape, so the marks
       * calculator can read them without guessing.
       */
      const components: Prisma.InputJsonValue = [
        { type: 'CA', maxMarks: ca },
        { type: 'MSE', maxMarks: mse },
        { type: 'ESE', maxMarks: ese },
      ].filter((component) => component.maxMarks > 0);

      const code = course.courseCode.trim();

      const subject = await this.prisma.subject.upsert({
        where: { code },
        create: {
          code,
          name: course.courseName.trim(),
          credits: course.credits ?? 0,
          maxMarks,
          passingMarks: Math.round(maxMarks * 0.4),
          components,
          isActive: true,
        },
        update: {
          name: course.courseName.trim(),
          credits: course.credits ?? 0,
          maxMarks,
          passingMarks: Math.round(maxMarks * 0.4),
          components,
          isActive: true,
        },
      });

      /**
       * Whether the subject was there before or has just been made. The
       * upsert cannot say, so the check is done on what the row looks like
       * after the write — the timestamps are compared.
       */
      if (subject.createdAt.getTime() === subject.updatedAt.getTime()) {
        created += 1;
      } else {
        updated += 1;
      }

      /**
       * The offering binds the subject to this branch, this semester and
       * this scheme. The year is the semester the course is taught in,
       * which is how the rest of the system addresses a class context.
       */
      const semester = course.semester ?? 1;

      const existingOffering = await this.prisma.subjectOffering.findFirst({
        where: {
          subjectId: subject.id,
          branchId: input.branchId,
          semester,
          schemeId: input.schemeId,
        },
        select: { id: true },
      });

      if (existingOffering) {
        await this.prisma.subjectOffering.update({
          where: { id: existingOffering.id },
          data: {
            /**
             * The academic year is optional on the offering, but Prisma
             * wants an unset relation to be left out rather than set to
             * `null`.
             */
            ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
            isActive: true,
          },
        });
        offeringsUpdated += 1;
        continue;
      }

      await this.prisma.subjectOffering.create({
        data: {
          subjectId: subject.id,
          branchId: input.branchId,
          semester,
          schemeId: input.schemeId,
          ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
          isActive: true,
        },
      });
      offeringsCreated += 1;
    }

    return { created, updated, skipped, offeringsCreated, offeringsUpdated };
  }
}
