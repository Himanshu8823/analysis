/**
 * Hugging Face model metadata used by the OCR module to pick the right
 * endpoint + constraints per request.
 */
export interface HfModelConfig {
  modelId: string;
  apiUrl: string;
  maxInputSizeBytes: number;
  supportsTableDetection: boolean;
  supportsHandwritten: boolean;
}

export const HF_MODELS: Record<string, HfModelConfig> = {
  TABLE_TRANSFORMER: {
    modelId: 'microsoft/table-transformer-structure-recognition',
    apiUrl:
      'https://api-inference.huggingface.co/models/microsoft/table-transformer-structure-recognition',
    maxInputSizeBytes: 50 * 1024 * 1024,
    supportsTableDetection: true,
    supportsHandwritten: false,
  },
  TROCR_HANDWRITTEN: {
    modelId: 'microsoft/trocr-base-handwritten',
    apiUrl: 'https://api-inference.huggingface.co/models/microsoft/trocr-base-handwritten',
    maxInputSizeBytes: 10 * 1024 * 1024,
    supportsTableDetection: false,
    supportsHandwritten: true,
  },
  PADDLE_OCR: {
    modelId: 'PaddlePaddle/PaddleOCR',
    apiUrl: 'https://api-inference.huggingface.co/models/PaddlePaddle/PaddleOCR',
    maxInputSizeBytes: 10 * 1024 * 1024,
    supportsTableDetection: false,
    supportsHandwritten: false,
  },
} as const;

export type HfModelKey = keyof typeof HF_MODELS;
