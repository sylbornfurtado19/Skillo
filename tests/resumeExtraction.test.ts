import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import {
  extractResumeText,
  detectFileType,
  ResumeExtractionError,
  MAX_RESUME_FILE_SIZE,
  MIN_RESUME_TEXT_CHARS,
  MAX_RESUME_TEXT_CHARS,
} from '../src/lib/services/resumeExtraction.server';

describe('Server-Side Resume Extraction Service Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  const sampleValidResume = `
Jane Doe
Senior Full-Stack Engineer | Seattle, WA | jane.doe@example.com
Summary:
Experienced software engineer with over 8 years of experience building distributed web applications,
high-throughput microservices, and AI-driven mock interview systems using Next.js, TypeScript, and Go.
Experience:
- Staff Software Engineer at Acme Cloud (2021 - Present): Designed and deployed real-time video evaluation engines.
- Senior Software Engineer at TechCorp (2018 - 2021): Scaled PostgreSQL databases and Redis caching layers.
Education:
- B.S. in Computer Science, University of Washington (2014 - 2018)
Skills:
- TypeScript, React, Next.js, Node.js, Go, Python, Docker, Kubernetes, GraphQL, REST APIs.
`.trim();

  describe('1. TXT Extraction', () => {
    it('successfully extracts text, charCount, and estimated pageCount from valid plain text', async () => {
      const buffer = Buffer.from(sampleValidResume, 'utf-8');
      const result = await extractResumeText({
        buffer,
        fileName: 'jane_doe_resume.txt',
      });

      expect(result.text).toBe(sampleValidResume);
      expect(result.charCount).toBe(sampleValidResume.length);
      expect(result.charCount).toBeGreaterThanOrEqual(MIN_RESUME_TEXT_CHARS);
      expect(result.pageCount).toBe(1);
    });

    it('correctly handles UTF-8 BOM in plain text resumes', async () => {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      const content = Buffer.from(sampleValidResume, 'utf-8');
      const buffer = Buffer.concat([bom, content]);

      const result = await extractResumeText({
        buffer,
        fileName: 'resume_with_bom.txt',
      });

      expect(result.text).toBe(sampleValidResume);
      expect(result.charCount).toBe(sampleValidResume.length);
    });

    it('normalizes CRLF line endings to LF', async () => {
      const crlfText = sampleValidResume.replace(/\n/g, '\r\n');
      const buffer = Buffer.from(crlfText, 'utf-8');

      const result = await extractResumeText({
        buffer,
        fileName: 'crlf_resume.txt',
      });

      expect(result.text).not.toContain('\r\n');
      expect(result.text).toBe(sampleValidResume);
    });
  });

  describe('2. PDF and DOCX Extraction', () => {
    it('successfully extracts text from a valid PDF document with %PDF header', async () => {
      const samplePdfText =
        'Jane Doe is an experienced staff software engineer with deep expertise in Next.js, TypeScript, Go, and distributed systems architecture.';
      const samplePdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' +
          '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n' +
          '3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n' +
          '0000000000 65535 f \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n120\n%%EOF'
      );

      jest.spyOn(PDFParse.prototype as any, 'load').mockResolvedValue(undefined);
      jest.spyOn(PDFParse.prototype, 'getText').mockResolvedValue({
        pages: [{ text: samplePdfText, num: 1 }],
        text: samplePdfText,
        total: 1,
      } as any);

      const result = await extractResumeText({
        buffer: samplePdf,
        fileName: 'jane_resume.pdf',
      });

      expect(result.text).toContain('Jane Doe');
      expect(result.charCount).toBeGreaterThanOrEqual(MIN_RESUME_TEXT_CHARS);
      expect(result.pageCount).toBe(1);
    });

    it('successfully extracts text from a valid DOCX document with PK header', async () => {
      const sampleDocxText =
        'Jane Doe is an experienced staff software engineer with deep expertise in Next.js, TypeScript, Go, and distributed systems architecture.';
      const sampleDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

      jest.spyOn(mammoth, 'extractRawText').mockResolvedValue({
        value: sampleDocxText,
        messages: [],
      } as any);

      const result = await extractResumeText({
        buffer: sampleDocx,
        fileName: 'jane_resume.docx',
      });

      expect(result.text).toContain('Jane Doe');
      expect(result.charCount).toBeGreaterThanOrEqual(MIN_RESUME_TEXT_CHARS);
      expect(result.pageCount).toBe(1);
    });
  });

  describe('3. Short-Text Rejection (< 100 chars / scanned PDF)', () => {
    it('rejects short text with under 100 characters and throws SHORT_TEXT error', async () => {
      const shortText = 'John Doe. Software Engineer.';
      const buffer = Buffer.from(shortText, 'utf-8');

      await expect(
        extractResumeText({
          buffer,
          fileName: 'short.txt',
        })
      ).rejects.toThrow(ResumeExtractionError);

      try {
        await extractResumeText({
          buffer,
          fileName: 'short.txt',
        });
      } catch (err: any) {
        expect(err.code).toBe('SHORT_TEXT');
        expect(err.statusCode).toBe(422);
        expect(err.message).toMatch(/scanned PDF, no selectable text/i);
      }
    });

    it('rejects empty files with UNSUPPORTED_TYPE error', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        extractResumeText({
          buffer: emptyBuffer,
          fileName: 'empty.txt',
        })
      ).rejects.toThrow(ResumeExtractionError);
    });

    it('rejects whitespace-only files as short text', async () => {
      const whitespaceBuffer = Buffer.from('   \n\n\t   ', 'utf-8');

      await expect(
        extractResumeText({
          buffer: whitespaceBuffer,
          fileName: 'whitespace.txt',
        })
      ).rejects.toThrow(/scanned PDF, no selectable text/i);
    });
  });

  describe('4. Oversize Rejection (> 5 MB)', () => {
    it('rejects files larger than 5 MB with OVERSIZE code and 413 status', async () => {
      // 5 MB + 1 byte
      const oversizedBuffer = Buffer.alloc(MAX_RESUME_FILE_SIZE + 1024, 'a');

      await expect(
        extractResumeText({
          buffer: oversizedBuffer,
          fileName: 'giant_resume.txt',
        })
      ).rejects.toThrow(ResumeExtractionError);

      try {
        await extractResumeText({
          buffer: oversizedBuffer,
          fileName: 'giant_resume.txt',
        });
      } catch (err: any) {
        expect(err.code).toBe('OVERSIZE');
        expect(err.statusCode).toBe(413);
        expect(err.message).toMatch(/5 MB limit/i);
      }
    });
  });

  describe('5. Magic Bytes and File Type Validation', () => {
    it('correctly detects PDF magic bytes (%PDF)', () => {
      const pdfHeader = Buffer.from('%PDF-1.7\n%fake-binary');
      expect(detectFileType(pdfHeader, 'my_resume.pdf')).toBe('pdf');
    });

    it('correctly detects DOCX magic bytes (PK\\x03\\x04) with .docx extension', () => {
      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      expect(detectFileType(docxHeader, 'resume.docx')).toBe('docx');
    });

    it('rejects ZIP magic bytes when extension is not .docx', () => {
      const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      expect(() => detectFileType(zipHeader, 'archive.zip')).toThrow(
        /only Microsoft Word \(\.docx\) files are supported/i
      );
    });

    it('rejects executable binaries (MZ header) even if named resume.txt', () => {
      const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      expect(() => detectFileType(exeHeader, 'resume.txt')).toThrow(
        /Unsupported binary file format/i
      );
    });

    it('rejects image files (PNG header) disguised as resumes', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => detectFileType(pngHeader, 'resume.pdf')).toThrow(
        /Unsupported binary file format/i
      );
    });

    it('rejects unknown extensions', () => {
      const textBuffer = Buffer.from(sampleValidResume);
      expect(() => detectFileType(textBuffer, 'resume.exe')).toThrow(
        /Unsupported file extension/i
      );
    });
  });

  describe('6. Maximum Character Capping (15,000 Chars)', () => {
    it('caps output text at exactly 15,000 characters matching GraphRAG limit', async () => {
      const hugeResume = 'A'.repeat(25000);
      const buffer = Buffer.from(hugeResume, 'utf-8');

      const result = await extractResumeText({
        buffer,
        fileName: 'huge_resume.txt',
      });

      expect(result.text.length).toBe(MAX_RESUME_TEXT_CHARS);
      expect(result.charCount).toBe(15000);
      expect(result.text).toBe('A'.repeat(15000));
    });
  });
});
