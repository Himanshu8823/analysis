import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import type { Prisma, UploadJob } from '@prisma/client';
import { UploadRepository } from './upload.repository';
import { StorageService } from '../storage/storage.service';

export interface CreateUploadJobInput {
  uploadedBy: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  metadata?: Record<string, unknown>;
  /**
   * The already-detected file type. When supplied, the URL is not fetched
   * again just to work out the type.
   */
  detectedType?: FileTypeDetectionResult['type'];
}

export interface FileTypeDetectionResult {
  type: 'EXCEL' | 'PDF_TEXT' | 'PDF_IMAGE' | 'CSV' | 'UNKNOWN';
  mimeHint: string;
}

/** Magic-byte signatures used to verify upload content. */
const MAGIC = {
  PDF: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  ZIP_XLSX: Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK..
  CSV_OK: Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
} as const;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  /** 50 MB hard limit per file (PROJECT.md). */
  static readonly MAX_FILE_SIZE = 50 * 1024 * 1024;

  constructor(
    private readonly repository: UploadRepository,
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    @InjectQueue('upload-jobs') private readonly uploadQueue: Queue,
    @InjectQueue('ocr-jobs') private readonly ocrQueue: Queue,
  ) {}

  /**
   * Create an upload job from a presigned storage URL. Validates file type +
   * size + magic bytes before persisting. Dispatches to the matching worker
   * queue for actual extraction.
   */
  async createJob(input: CreateUploadJobInput): Promise<UploadJob> {
    if (input.fileSize > UploadService.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File exceeds ${UploadService.MAX_FILE_SIZE} byte limit`,
      );
    }
    if (!input.fileUrl.startsWith('http')) {
      throw new BadRequestException('fileUrl must be an absolute URL');
    }

    const job = await this.repository.create(input);

    try {
      const type =
        input.detectedType ?? (await this.detectFileType(input.fileUrl)).type;
      const queue = type === 'PDF_IMAGE' ? 'ocr-jobs' : 'upload-jobs';

      if (queue === 'ocr-jobs') {
        await this.ocrQueue.add(
          'process',
          { jobId: job.id, fileUrl: input.fileUrl },
          { removeOnComplete: true, removeOnFail: 100 },
        );
      } else {
        await this.uploadQueue.add(
          'process',
          { jobId: job.id, fileUrl: input.fileUrl, fileType: type },
          { removeOnComplete: true, removeOnFail: 100 },
        );
      }

      return job;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Failed to dispatch job ${job.id}: ${message}`);
      await this.repository.updateStatus(job.id, {
        status: 'FAILED',
        errorMessage: `Dispatch failed: ${message}`,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  /**
   * Creates an upload job from a multipart file.
   *
   * The bytes are written to local storage first, so the job gets a URL the
   * backend can actually fetch — a `blob:` URL from the browser is useless
   * to a server-side parser.
   */
  async createJobFromFile(
    file: { buffer: Buffer; originalname: string; size: number },
    uploadedBy: string,
    metadata?: Record<string, unknown>,
  ): Promise<UploadJob> {
    if (file.size > UploadService.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File exceeds ${UploadService.MAX_FILE_SIZE} byte limit`,
      );
    }

    const stored = await this.storage.save(file.buffer, file.originalname);

    // The file type decides which parser runs, so it is detected from the
    // bytes rather than assumed — a CSV upload would otherwise be parsed as
    // a spreadsheet.
    const detection = await this.detectBufferType(file.buffer, file.originalname);

    return this.createJob({
      uploadedBy,
      fileName: file.originalname,
      fileType: detection.type,
      fileUrl: stored.fileUrl,
      fileSize: file.size,
      metadata,
      detectedType: detection.type,
    });
  }

  /**
   * Detects the file type from the uploaded bytes, falling back to the
   * extension when the content is inconclusive.
   */
  private async detectBufferType(
    buffer: Buffer,
    filename: string,
  ): Promise<FileTypeDetectionResult> {
    const head = buffer.subarray(0, Math.min(buffer.length, 4096));
    if (head.subarray(0, 4).equals(MAGIC.PDF)) {
      const excerpt = head.toString('latin1');
      const isImageOnly = /\/Subtype\s*\/Image/.test(excerpt);
      return {
        type: isImageOnly ? 'PDF_IMAGE' : 'PDF_TEXT',
        mimeHint: 'application/pdf',
      };
    }
    if (head.subarray(0, 4).equals(MAGIC.ZIP_XLSX)) {
      return {
        type: 'EXCEL',
        mimeHint: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }
    if (this.looksLikeCsv(head)) {
      return { type: 'CSV', mimeHint: 'text/csv' };
    }

    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return { type: 'PDF_TEXT', mimeHint: 'application/pdf' };
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      return { type: 'EXCEL', mimeHint: 'application/vnd.ms-excel' };
    }
    if (lower.endsWith('.csv')) return { type: 'CSV', mimeHint: 'text/csv' };
    return { type: 'UNKNOWN', mimeHint: '' };
  }

  async findAll(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    uploadedBy?: string;
  }) {
    return this.repository.findAll(params);
  }

  async findById(id: string): Promise<UploadJob> {
    const job = await this.repository.findById(id);
    if (!job) throw new NotFoundException('Upload job not found');
    return job;
  }

  async updateStatus(
    id: string,
    update: {
      status?: string;
      progress?: number;
      errorMessage?: string;
      extractedData?: Record<string, unknown>;
      startedAt?: Date;
      completedAt?: Date;
      fileType?: string;
    },
  ): Promise<UploadJob> {
    return this.repository.updateStatus(id, update);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  /**
   * Confirm the extracted payload and persist it into the marks table.
   * Returns the count of marks upserted.
   */
  async confirmExtraction(
    jobId: string,
    rows: Array<{
      rollNo: string;
      subjectCode: string;
      examType: string;
      marksObtained: number;
      maxMarks: number;
      isAbsent?: boolean;
    }>,
    metadata?: Record<string, unknown>,
    confirmedBy?: string,
  ): Promise<{ jobId: string; marksCreated: number }> {
    const job = await this.findById(jobId);
    if (job.status !== 'EXTRACTED') {
      throw new BadRequestException(
        `Cannot confirm job in status ${job.status}; expected EXTRACTED`,
      );
    }
    const ctx = (metadata ?? (job.metadata as Record<string, unknown> | null) ?? {}) as {
      branchId?: string;
      schemeId?: string;
      semester?: number;
      academicYearId?: string;
    };

    // `semester` is a number, so a plain falsy check would also reject a
    // legitimate value and would accept `NaN`. Every field is validated
    // explicitly instead.
    const semester = Number(ctx.semester);
    if (
      !ctx.branchId ||
      !ctx.schemeId ||
      !Number.isInteger(semester) ||
      semester < 1 ||
      !ctx.academicYearId
    ) {
      throw new BadRequestException(
        'metadata.branchId, metadata.schemeId, metadata.semester and metadata.academicYearId are required to confirm',
      );
    }

    // Resolve subjects by code within the chosen scheme/branch/semester.
    const subjectCodes = [...new Set(rows.map((r) => r.subjectCode))];
    const subjects = await this.prisma.subject.findMany({
      where: {
        schemeId: ctx.schemeId,
        branchId: ctx.branchId,
        semester,
        code: { in: subjectCodes },
      },
      select: { id: true, code: true, schemeId: true, branchId: true, semester: true },
    });
    const subjectByCode = new Map(subjects.map((s) => [s.code, s]));

    // Resolve students by rollNo within the chosen academic year.
    const rollNos = [...new Set(rows.map((r) => r.rollNo))];
    const students = await this.prisma.student.findMany({
      where: {
        rollNo: { in: rollNos },
        academicYearId: ctx.academicYearId,
      },
      select: { id: true, rollNo: true },
    });
    const studentByRollNo = new Map(students.map((s) => [s.rollNo, s]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const skipped: Array<{ reason: string; row: typeof rows[number] }> = [];
    for (const row of rows) {
      const student = studentByRollNo.get(row.rollNo);
      const subject = subjectByCode.get(row.subjectCode);
      if (!student) {
        skipped.push({ reason: `student not found: ${row.rollNo}`, row });
        continue;
      }
      if (!subject) {
        skipped.push({ reason: `subject not found: ${row.subjectCode}`, row });
        continue;
      }
      ops.push(
        this.prisma.mark.upsert({
          where: {
            studentId_subjectId_examType_academicYearId: {
              studentId: student.id,
              subjectId: subject.id,
              examType: row.examType,
              academicYearId: ctx.academicYearId,
            },
          },
          create: {
            studentId: student.id,
            subjectId: subject.id,
            examType: row.examType,
            marksObtained: row.marksObtained,
            maxMarks: row.maxMarks,
            isAbsent: row.isAbsent ?? false,
            academicYearId: ctx.academicYearId,
            createdBy: confirmedBy,
          },
          update: {
            marksObtained: row.marksObtained,
            maxMarks: row.maxMarks,
            isAbsent: row.isAbsent ?? false,
            updatedBy: confirmedBy,
          },
        }),
      );
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }

    if (skipped.length > 0) {
      this.logger.warn(
        `Skipped ${skipped.length} rows while confirming upload ${jobId}: ${JSON.stringify(skipped.slice(0, 5))}`,
      );
    }

    await this.repository.updateStatus(jobId, {
      status: 'COMPLETED',
      progress: 100,
      completedAt: new Date(),
    });

    return { jobId, marksCreated: ops.length };
  }

  /**
   * Inspect the first few bytes of the URL body to determine whether the
   * uploaded blob is a PDF, Excel, plain-text or image (image PDFs require OCR).
   */
  async detectFileType(fileUrl: string): Promise<FileTypeDetectionResult> {
    try {
      const fetched = await fetch(fileUrl, { method: 'GET' });
      if (!fetched.ok) {
        return { type: 'UNKNOWN', mimeHint: fetched.headers.get('content-type') ?? '' };
      }
      const head = await fetched.arrayBuffer();
      const buf = Buffer.from(head.slice(0, Math.min(head.byteLength, 4096)));
      if (buf.subarray(0, 4).equals(MAGIC.PDF)) {
        // Try to estimate whether the PDF is text-based by looking for streams.
        const excerpt = buf.toString('latin1');
        const isImageOnly = /\/Subtype\s*\/Image/.test(excerpt);
        return {
          type: isImageOnly ? 'PDF_IMAGE' : 'PDF_TEXT',
          mimeHint: 'application/pdf',
        };
      }
      if (buf.subarray(0, 4).equals(MAGIC.ZIP_XLSX)) {
        return { type: 'EXCEL', mimeHint: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      }
      // A CSV is plain text: it either starts with a UTF-8 BOM or with a
      // printable character, and contains no NUL byte the way a binary file
      // does. The old check only caught JSON, so every real CSV fell through
      // to UNKNOWN.
      if (this.looksLikeCsv(buf)) {
        return { type: 'CSV', mimeHint: 'text/csv' };
      }
      return { type: 'UNKNOWN', mimeHint: fetched.headers.get('content-type') ?? '' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`detectFileType failed for ${fileUrl}: ${message}`);
      // Fallback: rely on a guess from the URL itself
      const lower = fileUrl.toLowerCase();
      if (lower.endsWith('.pdf')) return { type: 'PDF_TEXT', mimeHint: 'application/pdf' };
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return { type: 'EXCEL', mimeHint: 'application/vnd.ms-excel' };
      if (lower.endsWith('.csv')) return { type: 'CSV', mimeHint: 'text/csv' };
      return { type: 'UNKNOWN', mimeHint: '' };
    }
  }

  /**
   * True when the buffer looks like delimited plain text rather than a
   * binary format — a UTF-8 BOM, or printable ASCII with at least one
   * separator and no NUL byte.
   */
  private looksLikeCsv(buf: Buffer): boolean {
    if (buf.subarray(0, 3).equals(MAGIC.CSV_OK)) return true;
    if (!buf.length) return false;

    // A NUL byte means binary.
    if (buf.includes(0)) return false;

    const sample = buf.subarray(0, Math.min(buf.length, 4096));
    let printable = 0;
    for (const byte of sample) {
      if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e)) {
        printable += 1;
      }
    }
    if (printable / sample.length < 0.9) return false;

    const text = sample.toString('latin1');
    return /[,\t;]/.test(text);
  }
}
