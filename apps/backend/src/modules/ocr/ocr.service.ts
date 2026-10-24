import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HfInference } from '@huggingface/inference';
import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { HF_MODELS, type HfModelConfig, type HfModelKey } from './hf-models';

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
   */
  async processImage(
    jobId: string,
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
      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', progress: 30, startedAt: new Date() },
      });

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

      await this.prisma.uploadJob.update({
        where: { id: jobId },
        data: {
          status: 'EXTRACTED',
          progress: 80,
          extractedData: {
            text: extractedText,
            tables,
            model: modelConfig.modelId,
          },
        },
      });

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

  private async markJobFailed(jobId: string, message: string): Promise<void> {
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
