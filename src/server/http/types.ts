import type { interpretAnswer, ModelTransport } from "../../../server/model";
import type { runExtraction } from "../../../server/pipeline";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/domain/upload-limits";

export const DEFAULT_MAX_REQUEST_BYTES = MAX_TOTAL_UPLOAD_BYTES + 64 * 1024;

export interface HttpDeps {
  fixtureDir: string;
  apiKey?: string;
  transport?: ModelTransport;
  runExtractionFn?: typeof runExtraction;
  interpretAnswerFn?: typeof interpretAnswer;
  maxRequestBytes?: number;
  publicDemo?: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    envVar?: string;
    failedSources?: Array<{
      id: string;
      filename: string;
      code: string;
      message: string;
    }>;
  };
}
