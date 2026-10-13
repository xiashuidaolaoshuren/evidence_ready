import { extractText, getDocumentProxy } from "unpdf";

export type PdfExtractErrorCode =
  | "encrypted"
  | "image-only"
  | "empty"
  | "unsupported"
  | "corrupt";

export class PdfExtractError extends Error {
  readonly code: PdfExtractErrorCode;

  constructor(code: PdfExtractErrorCode, message: string) {
    super(message);
    this.name = "PdfExtractError";
    this.code = code;
  }
}

export interface ExtractPagesInput {
  id: string;
  filename: string;
  mediaType: string;
  buffer: Buffer;
}

export interface ExtractedDocument {
  id: string;
  filename: string;
  mediaType: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

function isTxt(filename: string): boolean {
  return filename.toLowerCase().endsWith(".txt");
}

function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

function isWhitespaceOnly(text: string): boolean {
  return text.trim().length === 0;
}

function isEncryptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "PasswordException" ||
    message.includes("password") ||
    message.includes("encrypted")
  );
}

async function extractPdfPages(buffer: Buffer): Promise<ExtractedDocument["pages"]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(text) ? text : [text];

    if (pageTexts.length === 0) {
      throw new PdfExtractError(
        "empty",
        "The document contains no readable pages.",
      );
    }

    if (pageTexts.every(isWhitespaceOnly)) {
      throw new PdfExtractError(
        "image-only",
        "The PDF appears to be image-only or contains no extractable text.",
      );
    }

    return pageTexts.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText,
    }));
  } catch (error) {
    if (error instanceof PdfExtractError) throw error;
    if (isEncryptedError(error)) {
      throw new PdfExtractError(
        "encrypted",
        "The PDF is encrypted. Provide an unlocked copy.",
      );
    }
    throw new PdfExtractError(
      "corrupt",
      "The PDF could not be parsed. It may be corrupt or in an unsupported format.",
    );
  }
}

function extractTxtPages(buffer: Buffer): ExtractedDocument["pages"] {
  const text = buffer.toString("utf8");
  if (isWhitespaceOnly(text)) {
    throw new PdfExtractError("empty", "The document is empty.");
  }

  const markerPattern = /^--- page (\d+) ---$/gm;
  const matches = [...text.matchAll(markerPattern)];
  if (matches.length === 0) {
    return [{ pageNumber: 1, text }];
  }

  const pages: ExtractedDocument["pages"] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const pageNumber = Number(match?.[1] ?? index + 1);
    const start = (match?.index ?? 0) + (match?.[0]?.length ?? 0);
    const end = matches[index + 1]?.index ?? text.length;
    const pageText = text.slice(start, end).trim();
    pages.push({ pageNumber, text: pageText });
  }

  return pages;
}

export async function extractPages(
  input: ExtractPagesInput,
): Promise<ExtractedDocument> {
  if (isTxt(input.filename)) {
    return {
      id: input.id,
      filename: input.filename,
      mediaType: input.mediaType,
      pages: extractTxtPages(input.buffer),
    };
  }

  if (isPdf(input.filename)) {
    return {
      id: input.id,
      filename: input.filename,
      mediaType: input.mediaType,
      pages: await extractPdfPages(input.buffer),
    };
  }

  throw new PdfExtractError(
    "unsupported",
    "Unsupported file type. Use PDF or TXT.",
  );
}
