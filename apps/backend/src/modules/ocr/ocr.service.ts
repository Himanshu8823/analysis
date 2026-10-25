import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { HF_MODELS, type HfModelConfig, type HfModelKey } from './hf-models';
import { parseMarksSheet, type ExtractedMark } from '../upload/marks-file.parser';

/**
 * Parses OCR output into mark rows.
 *
 * The OCR model returns the text it read. The text is laid out in the same
 * way a spreadsheet is — a header line followed by one line per mark — so it
 * goes through the same sheet parser. Rows that cannot be read are reported
 * rather than dropped silently.
 */
function parseOcrText(text: string): {
  rows: ExtractedMark[];
  errors: Array<{ row: number; error: string }>;
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    return { rows: [], errors: [{ row: 1, error: 'No text was recognised' }] };
  }

  // The header is the first line naming a roll number and a subject column.
  const headerIndex = lines.findIndex((line) => {
    const normalised = line.toLowerCase().replace(/[_-]/g, ' ');
    return normalised.includes('roll') && normalised.includes('subject');
  });

  if (headerIndex === -1) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          error:
            'The recognised text has no header row naming "Roll No" and "Subject". Upload a spreadsheet instead.',
        },
      ],
    };
  }

  const headerCells = lines[headerIndex].split(/\s{2,}/).map((cell) => cell.trim());
  const dataRows = lines
    .slice(headerIndex + 1)
    .map((line) => line.split(/\s{2,}/).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2);

  try {
    return parseMarksSheet(headerCells, dataRows);
  } catch (err) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          error: err instanceof Error ? err.message : 'The recognised text could not be read',
        },
      ],
    };
  }
}

export interface OcrProcessResult {
  extractedText: string;
  tables?: unknown;
  confidence: number;
  modelUsed: string;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly hf: HfInference | null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaClient,
  ) {
    const token =
      this.config.get<string>('HF_API_TOKEN') ??
      this.config.get<string>('hf.apiToken') ??
      process.env.HF_API_TOKEN;
    if (!token) {
      this.logger.warn(
        'HF_API_TOKEN not configured - OCR calls will fail with auth errors',
      );
      this.hf = null;
    } else {
      this.hf = new HfInference(token);
    }
  }

  /**
   * Choose the best HF model for the supplied content hints.
   */
  async selectModel(
    hasTableLikeContent: boolean,
    hasHandwriting: boolean,
  ): Promise<HfModelConfig> {
    if (hasTableLikeContent) return HF_MODELS.TABLE_TRANSFORMER;
    if (hasHandwriting) return HF_MODELS.TROCR_HANDWRITTEN;
    return HF_MODELS.PADDLE_OCR;
  }

  /** Convenience constructor used by tests/CLI. */
  model(key: HfModelKey): HfModelConfig {
    const m = HF_MODELS[key];
    if (!m) throw new Error(`Unknown HF model key ${key}`);
    return m;
  }

  /**
   * Process an image/PDF buffer using the supplied HF model. Updates the
   * UploadJob row with progress + extracted data as the work progresses.
   *
   * `jobId` is `null` for the standalone extract endpoint, which runs OCR on
   * a URL without creating an upload job. In that case the progress and
   * result updates are skipped — there is no row to write them to.
   */
  async processImage(
    jobId: string | null,
    fileBuffer: Buffer,
    modelConfig: HfModelConfig,
  ): Promise<OcrProcessResult> {
    if (!this.hf) {
      const message = 'HF_API_TOKEN not configured';
      await this.markJobFailed(jobId, message);
      throw new Error(message);
    }

    if (fileBuffer.length > modelConfig.maxInputSizeBytes) {
      const message = `Input exceeds ${modelConfig.maxInputSizeBytes} bytes for ${modelConfig.modelId}`;
      await this.markJobFailed(jobId, message);
      throw new Error(message);
    }

    try {
      if (jobId) {
        await this.prisma.uploadJob.update({
          where: { id: jobId },
          data: { status: 'PROCESSING', progress: 30, startedAt: new Date() },
        });
      }

      const textResult = await this.hf.imageToText({
        data: fileBuffer,
        model: modelConfig.modelId,
      });
      const extractedText = textResult.generated_text ?? '';

      let tables: Prisma.InputJsonValue | undefined = undefined;
      if (modelConfig.supportsTableDetection) {
        try {
          const tableResult = await this.hf.objectDetection({
            data: fileBuffer,
            model: 'microsoft/table-transformer-detection',
          });
          tables = tableResult as unknown as Prisma.InputJsonValue;
        } catch (err) {
          this.logger.warn(
            `Table detection failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // The recognised text is parsed into mark rows so the review screen has
      // the same shape as it does for a spreadsheet upload.
      const parsed = parseOcrText(extractedText);

      const extractedData: Prisma.InputJsonValue = {
        text: extractedText,
        model: modelConfig.modelId,
        rows: parsed.rows as unknown as Prisma.InputJsonValue,
        errors: parsed.errors as unknown as Prisma.InputJsonValue,
        totalRows: parsed.rows.length,
        errorCount: parsed.errors.length,
        ...(tables !== undefined ? { tables } : {}),
      };

      if (jobId) {
        await this.prisma.uploadJob.update({
          where: { id: jobId },
          data: {
            status: 'EXTRACTED',
            progress: 80,
            extractedData,
          },
        });
      }

      return {
        extractedText,
        tables,
        confidence: 0.85,
        modelUsed: modelConfig.modelId,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'unknown OCR failure';
      await this.markJobFailed(jobId, message);
      throw err;
    }
  }

  /**
   * Get job status; returns null if the job has been deleted.
   */
  async getJobStatus(jobId: string): Promise<unknown> {
    return this.prisma.uploadJob.findUnique({ where: { id: jobId } });
  }

  private async markJobFailed(jobId: string | null, message: string): Promise<void> {
    // The standalone extract endpoint has no upload job to mark as failed.
    if (!jobId) return;

    try {
      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          errorMessage: `OCR failed: ${message}`,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to update job ${jobId} as FAILED: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
