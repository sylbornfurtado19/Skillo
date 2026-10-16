// Parsers are imported lazily: a parser that fails to load must not crash the whole route
// (that produced a bare HTTP 500 with no message) and TXT uploads should never depend on them.
export const MAX_RESUME_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MIN_RESUME_TEXT_CHARS = 100; // < 100 characters rejection threshold
export const MAX_RESUME_TEXT_CHARS = 15000; // GraphRAG cap

export type DetectedFileType = 'pdf' | 'docx' | 'txt';

export class ResumeExtractionError extends Error {
  code: 'OVERSIZE' | 'SHORT_TEXT' | 'UNSUPPORTED_TYPE' | 'PARSE_FAILED';
  statusCode: number;

  constructor(
    message: string,
    code: 'OVERSIZE' | 'SHORT_TEXT' | 'UNSUPPORTED_TYPE' | 'PARSE_FAILED',
    statusCode = 400
  ) {
    super(message);
    this.name = 'ResumeExtractionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function detectFileType(buffer: Buffer, fileName?: string): DetectedFileType {
  if (!buffer || buffer.length === 0) {
    throw new ResumeExtractionError(
      'File is empty. Please upload a valid resume.',
      'UNSUPPORTED_TYPE',
      400
    );
  }

  const normalizedFileName = fileName?.toLowerCase() || '';

  // 1. PDF magic bytes: %PDF (0x25, 0x50, 0x44, 0x46) anywhere in first 1024 bytes (per ISO 32000-1)
  const pdfHeaderIndex = buffer.indexOf(Buffer.from('%PDF'));
  if (
    (pdfHeaderIndex !== -1 && pdfHeaderIndex < 1024) ||
    (normalizedFileName.endsWith('.pdf') && pdfHeaderIndex !== -1)
  ) {
    return 'pdf';
  }

  // 2. DOCX magic bytes: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4B &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    if (normalizedFileName && !normalizedFileName.endsWith('.docx')) {
      throw new ResumeExtractionError(
        'ZIP archive detected, but only Microsoft Word (.docx) files are supported.',
        'UNSUPPORTED_TYPE',
        400
      );
    }
    return 'docx';
  }

  // 3. Known binary formats rejection
  if (buffer.length >= 4) {
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
    const isExe = buffer[0] === 0x4D && buffer[1] === 0x5A;
    if (isPng || isJpg || isGif || isExe) {
      throw new ResumeExtractionError(
        'Unsupported binary file format. Only PDF, DOCX, and TXT files are accepted.',
        'UNSUPPORTED_TYPE',
        400
      );
    }
  }

  // 4. Check for UTF-16 LE / BE Windows Unicode text files
  const isUtf16Le = buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE;
  const isUtf16Be = buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF;
  if (isUtf16Le || isUtf16Be) {
    return 'txt';
  }

  // 5. Reject null bytes in first 4096 bytes (heuristic for binary files)
  const checkLength = Math.min(buffer.length, 4096);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0x00) {
      throw new ResumeExtractionError(
        'Binary file detected without valid PDF/DOCX headers. Only PDF, DOCX, and TXT files are accepted.',
        'UNSUPPORTED_TYPE',
        400
      );
    }
  }

  // 6. Accept plain text (if filename is given, ensure .txt, .text, .md or extensionless)
  if (
    !normalizedFileName ||
    /\.(txt|text|md|markdown)$/i.test(normalizedFileName) ||
    !normalizedFileName.includes('.')
  ) {
    return 'txt';
  }

  throw new ResumeExtractionError(
    'Unsupported file extension. Only PDF, DOCX, and TXT files are accepted.',
    'UNSUPPORTED_TYPE',
    400
  );
}

import zlib from 'zlib';

function extractPdfTextFallback(buffer: Buffer): { text: string; pageCount: number } {
  let text = '';
  const content = buffer.toString('binary');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(content)) !== null) {
    const rawStream = Buffer.from(match[1], 'binary');
    let decompressed = '';
    try {
      decompressed = zlib.inflateSync(rawStream).toString('utf-8');
    } catch {
      decompressed = rawStream.toString('utf-8');
    }

    // Match strings in ( ... ) Tj
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
      text += tjMatch[1] + ' ';
    }

    // Match strings in [ ( ... ) ] TJ
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = tjArrayRegex.exec(decompressed)) !== null) {
      const innerTj = /\(([^)]+)\)/g;
      let innerMatch: RegExpExecArray | null;
      while ((innerMatch = innerTj.exec(arrayMatch[1])) !== null) {
        text += innerMatch[1];
      }
      text += ' ';
    }
  }

  const pageMatches = content.match(/\/Type\s*\/Page\b/g);
  const pageCount = Math.max(1, pageMatches ? pageMatches.length : 1);
  return { text: text.trim(), pageCount };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const pdfHeaderIndex = buffer.indexOf(Buffer.from('%PDF'));
  const effectiveBuffer = pdfHeaderIndex > 0 ? buffer.subarray(pdfHeaderIndex) : buffer;

  let parser: any = null;
  try {
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: effectiveBuffer });
      await parser.load();
      const result = await parser.getText();
      const pagesJoined = (result.pages || [])
        .map((p: { text?: string }) => (p?.text || '').trim())
        .filter(Boolean)
        .join('\n\n');
      const fullText = (result.text || '').trim();
      const rawPagesText = pagesJoined.length >= fullText.length ? pagesJoined : fullText || pagesJoined;
      const pageCount = result.total || result.pages?.length || 1;
      if (rawPagesText && rawPagesText.length >= 50) {
        return { text: rawPagesText, pageCount };
      }
    } catch (loadOrParseErr) {
      console.warn('[resumeExtraction] PDFParse primary parsing warning, attempting stream fallback:', loadOrParseErr);
    }

    // Fallback stream extraction for documents where PDFParse worker or font table fails
    const fallback = extractPdfTextFallback(effectiveBuffer);
    if (fallback.text && fallback.text.length >= 50) {
      return fallback;
    }

    throw new ResumeExtractionError(
      'scanned PDF, no selectable text',
      'SHORT_TEXT',
      422
    );
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch {
        // no-op
      }
    }
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value || '';
  const pageCount = Math.max(1, Math.ceil(rawText.length / 3000));
  return { text: rawText, pageCount };
}

export function extractTextFromTxt(buffer: Buffer): { text: string; pageCount: number } {
  let rawText = '';
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 BOM
    rawText = buffer.subarray(3).toString('utf-8');
  } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE BOM (Windows Unicode)
    rawText = buffer.subarray(2).toString('utf16le');
  } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE BOM
    rawText = buffer.subarray(2).swap16().toString('utf16le');
  } else {
    rawText = buffer.toString('utf-8');
  }
  const pageCount = Math.max(1, Math.ceil(rawText.length / 3000));
  return { text: rawText, pageCount };
}

export interface ExtractResumeOptions {
  buffer: Buffer;
  fileName?: string;
  mimeType?: string;
  minChars?: number;
  maxChars?: number;
  maxFileSize?: number;
}

export interface ResumeExtractionResult {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function extractResumeText(
  options: ExtractResumeOptions
): Promise<ResumeExtractionResult> {
  const {
    buffer,
    fileName,
    minChars = MIN_RESUME_TEXT_CHARS,
    maxChars = MAX_RESUME_TEXT_CHARS,
    maxFileSize = MAX_RESUME_FILE_SIZE,
  } = options;

  // 1. Oversize check
  if (buffer.length > maxFileSize) {
    throw new ResumeExtractionError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit.`,
      'OVERSIZE',
      413
    );
  }

  // 2. Validate by magic bytes
  const fileType = detectFileType(buffer, fileName);

  // 3. Extract text based on detected type
  let extracted: { text: string; pageCount: number };
  try {
    if (fileType === 'pdf') {
      extracted = await extractTextFromPdf(buffer);
    } else if (fileType === 'docx') {
      extracted = await extractTextFromDocx(buffer);
    } else {
      extracted = extractTextFromTxt(buffer);
    }
  } catch (err: unknown) {
    if (err instanceof ResumeExtractionError) throw err;
    const msg = err instanceof Error ? err.message : 'Corrupted file content';
    throw new ResumeExtractionError(
      `Failed to extract text from ${fileType.toUpperCase()} file: ${msg}`,
      'PARSE_FAILED',
      422
    );
  }

  // 4. Normalize text
  const normalizedText = extracted.text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  // 5. Short-text rejection
  if (normalizedText.length < minChars) {
    throw new ResumeExtractionError(
      'scanned PDF, no selectable text',
      'SHORT_TEXT',
      422
    );
  }

  // 6. Cap output at 15,000 chars
  const cappedText = normalizedText.slice(0, maxChars);

  return {
    text: cappedText,
    pageCount: extracted.pageCount,
    charCount: cappedText.length,
  };
}
