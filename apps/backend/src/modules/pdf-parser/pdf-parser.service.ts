import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
// pdf-parse returns text + per-page metadata
// We import the underlying library dynamically so tests can stub it out.
import type { PdfParseResult, PdfPageText } from './pdf-parser.types';

/**
 * PDF text-parsing service.
 *
 * Behaviour:
 *  - Text extraction happens via `pdf-parse` (lazy require).
 *  - If the PDF has no extractable text (scanned image), the file is flagged
 *    as PDF_IMAGE and the caller is expected to route it to OCR.
 *  - We attempt a simple line-based "table" parse to give the upload pipeline
 *    something structured to display in the UI.
 */
@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
  ) {}

  /**
   * Parse a PDF given its URL. Returns text + best-effort tables.
   */
  async extractTextFromUrl(fileUrl: string): Promise<PdfParseResult> {
    const buffer = await this.downloadAsBuffer(fileUrl);
    return this.parseBuffer(buffer);
  }

  /**
   * Parse an already-downloaded PDF buffer. Useful for tests and the worker.
   */
  async parseBuffer(buffer: Buffer): Promise<PdfParseResult> {
    const pdfParse = (await import('pdf-parse')).default as (
      b: Buffer,
    ) => Promise<{
      text: string;
      numpages: number;
      info: Record<string, unknown>;
    }>;

    const parsed = await pdfParse(buffer);
    const text = parsed.text || '';
    const pages: PdfPageText[] = [
      {
        pageNumber: 1,
        text,
        tables: this.parseTablesFromText(text),
      },
    ];

    return {
      pages,
      metadata: {
        totalPages: parsed.numpages ?? 1,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Heuristic used by the upload pipeline to decide whether the PDF is a
   * scanned image that should be sent through OCR instead of text extraction.
   */
  detectTextBased(buffer: Buffer): boolean {
    const sample = buffer.subarray(0, Math.min(buffer.length, 65536));
    let printable = 0;
    for (let i = 0; i < sample.length; i++) {
      const b = sample[i];
      if (b !== undefined && (b >= 0x20 || b === 0x0a || b === 0x0d || b === 0x09)) {
        printable++;
      }
    }
    return printable / sample.length > 0.85;
  }

  /**
   * Persist the parse payload onto an upload-job row. Marks it FAILED if the
   * document is empty (caller should reroute to OCR in that case).
   */
  async persistForJob(
    jobId: string,
    result: PdfParseResult,
  ): Promise<void> {
    const text = result.pages
      .map((p) => p.text)
      .join('\n')
      .trim();

    if (text.length < 10) {
      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          fileType: 'PDF_IMAGE',
          status: 'FAILED',
          errorMessage: 'PDF contains no extractable text - route to OCR',
          completedAt: new Date(),
        },
      });
      return;
    }
    await this.prisma.uploadJob.update({
      where: { id: jobId },
      data: {
        status: 'EXTRACTED',
        progress: 80,
        extractedData: {
          text,
          tables: result.pages.flatMap((p) => p.tables),
          totalPages: result.metadata.totalPages,
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Loads the bytes of the PDF.
   *
   * A file the backend stored itself is read straight from disk: the `/files`
   * route it was published under is JWT-guarded, so fetching it over HTTP
   * would fail with a 401. Files that live somewhere else (an external
   * bucket) are still fetched over HTTP.
   */
  private async downloadAsBuffer(fileUrl: string): Promise<Buffer> {
    const stored = await this.storage.readByUrl(fileUrl);
    if (stored) return stored;

    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(
        `Could not download ${fileUrl}: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Extract 2D tables from a chunk of text using a simple "rows separated by
   * newline, columns separated by 2+ spaces" heuristic. Suitable for tabular
   * DBATU result PDFs but by no means production-grade; a stronger library
   * (e.g. pdfplumber) should eventually replace this.
   */
  private parseTablesFromText(text: string): string[][][] {
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    const tables: string[][][] = [];
    let current: string[][] = [];
    const flush = () => {
      if (current.length >= 2) tables.push(current);
      current = [];
    };
    for (const line of lines) {
      const row = line
        .split(/\s{2,}|\t+|\|/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (row.length >= 2) {
        current.push(row);
      } else {
        flush();
      }
    }
    flush();
    return tables;
  }
}
