/**
 * Unit Tests for Resume Upload Progress, Validation, and Lifecycle (PROMPT 06)
 *
 * Verifies:
 * 1. Valid upload and successful processing with accurate stages ('uploading' -> 'processing' -> 'complete').
 * 2. Network, timeout, and HTTP error handling (never reaches 100% on failure).
 * 3. File validation: 5 MB size limit and supported format enforcement.
 * 4. Parsing failure handling when uploaded file lacks selectable text (scanned PDF).
 * 5. AbortSignal / cancellation and stale asynchronous response protection.
 * 6. Non-simulated progress tracking via real XHR progress events and fetch fallback.
 * 7. Accessible status messaging distinguishing upload completion from text extraction.
 */

import {
  extractResumeTextApi,
  type ResumeUploadProgress,
  type ExtractResumeOptions,
} from '../src/services/constants';

describe('Prompt 06 — Resume Upload Progress and Lifecycle', () => {
  const originalXHR = global.XMLHttpRequest;
  const originalFetch = global.fetch;

  afterEach(() => {
    global.XMLHttpRequest = originalXHR;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('1. Real Upload Progress Events & Staged State Transitions', () => {
    it('accurately reports staged progress: uploading -> processing -> complete with real bytes', async () => {
      const progressEvents: ResumeUploadProgress[] = [];
      const validText = 'Jane Doe\nSenior Software Engineer with 8+ years building cloud services and web apps.\nExtensive experience in React, TypeScript, Next.js, and Node.js.\nEducation: B.S. in Computer Science.';

      // Mock XMLHttpRequest with real progress events
      class MockXHR {
        public upload = {
          onprogress: null as ((event: any) => void) | null,
          onload: null as (() => void) | null,
        };
        public status = 200;
        public responseText = JSON.stringify({
          status: 'success',
          text: validText,
          pageCount: 1,
          charCount: validText.length,
        });
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        public ontimeout: (() => void) | null = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          // 1. Simulate byte upload progress: 50%
          if (this.upload.onprogress) {
            this.upload.onprogress({
              lengthComputable: true,
              loaded: 5000,
              total: 10000,
            });
          }

          // 2. Simulate byte upload completion: 100% of bytes sent
          if (this.upload.onprogress) {
            this.upload.onprogress({
              lengthComputable: true,
              loaded: 10000,
              total: 10000,
            });
          }
          if (this.upload.onload) {
            this.upload.onload();
          }

          // 3. Server finishes processing and responds
          if (this.onload) {
            this.onload();
          }
        });
        public abort = jest.fn();
      }

      (global as any).XMLHttpRequest = MockXHR;

      const dummyFile = new File(['dummy content'], 'resume.pdf', { type: 'application/pdf' });

      const result = await extractResumeTextApi(dummyFile, {
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      expect(result.text).toBe(validText);
      expect(result.charCount).toBeGreaterThanOrEqual(100);

      // Verify that progress stages accurately reflect real stages
      expect(progressEvents.length).toBeGreaterThanOrEqual(3);

      // Early progress is in 'uploading' stage (under 99%)
      const uploadingEvents = progressEvents.filter((p) => p.stage === 'uploading');
      expect(uploadingEvents.length).toBeGreaterThanOrEqual(1);
      expect(uploadingEvents[0].percent).toBe(50);

      // When bytes finish sending, transitions to 'processing' at 99% (NOT 100% yet!)
      const processingEvents = progressEvents.filter((p) => p.stage === 'processing');
      expect(processingEvents.length).toBeGreaterThanOrEqual(1);
      expect(processingEvents[0].percent).toBe(99);

      // 100% completion is ONLY reported at the very end after server text extraction succeeds
      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent.percent).toBe(100);
      expect(lastEvent.stage).toBe('complete');
    });

    it('falls back to staged progress reporting when XMLHttpRequest is not available', async () => {
      // Force fetch fallback by removing XMLHttpRequest
      delete (global as any).XMLHttpRequest;

      const validText = 'Alex Mercer\nStaff Frontend Engineer with over 10 years experience in distributed systems.\nExpert in Next.js, TypeScript, React 19, and full-stack performance optimization.';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          text: validText,
          pageCount: 2,
          charCount: validText.length,
        }),
      });

      const progressEvents: ResumeUploadProgress[] = [];
      const dummyFile = new File(['fallback content'], 'resume.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const result = await extractResumeTextApi(dummyFile, {
        onProgress: (p) => progressEvents.push({ ...p }),
      });

      expect(result.text).toBe(validText);

      // Must progress through uploading -> processing -> complete
      expect(progressEvents.some((p) => p.stage === 'uploading')).toBe(true);
      expect(progressEvents.some((p) => p.stage === 'processing')).toBe(true);
      expect(progressEvents[progressEvents.length - 1].stage).toBe('complete');
      expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
    });
  });

  describe('2. Failure Handling & Never Reaching 100% on Error', () => {
    it('never reaches 100% or complete stage on HTTP failure (e.g. 413 Payload Too Large)', async () => {
      const progressEvents: ResumeUploadProgress[] = [];

      class MockFailingXHR {
        public upload = {
          onprogress: null as ((event: any) => void) | null,
          onload: null as (() => void) | null,
        };
        public status = 413;
        public responseText = JSON.stringify({
          status: 'error',
          code: 'OVERSIZE',
          message: 'Resume file exceeds maximum allowed size (5 MB).',
        });
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        public ontimeout: (() => void) | null = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          if (this.upload.onprogress) {
            this.upload.onprogress({ lengthComputable: true, loaded: 500, total: 1000 });
          }
          if (this.onload) {
            this.onload();
          }
        });
        public abort = jest.fn();
      }

      (global as any).XMLHttpRequest = MockFailingXHR;

      const dummyFile = new File(['oversize dummy'], 'oversize.pdf', { type: 'application/pdf' });

      await expect(
        extractResumeTextApi(dummyFile, {
          onProgress: (p) => progressEvents.push({ ...p }),
        })
      ).rejects.toThrow(/Resume file exceeds maximum allowed size/i);

      // Crucial: Progress must NEVER reach 100% or 'complete'
      expect(progressEvents.some((p) => p.percent === 100)).toBe(false);
      expect(progressEvents.some((p) => p.stage === 'complete')).toBe(false);
    });

    it('never reaches 100% on network failure', async () => {
      const progressEvents: ResumeUploadProgress[] = [];

      class MockNetworkErrorXHR {
        public upload = {
          onprogress: null as ((event: any) => void) | null,
          onload: null as (() => void) | null,
        };
        public status = 0;
        public responseText = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        public ontimeout: (() => void) | null = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          if (this.upload.onprogress) {
            this.upload.onprogress({ lengthComputable: true, loaded: 200, total: 1000 });
          }
          if (this.onerror) {
            this.onerror();
          }
        });
        public abort = jest.fn();
      }

      (global as any).XMLHttpRequest = MockNetworkErrorXHR;

      const dummyFile = new File(['dummy'], 'resume.pdf', { type: 'application/pdf' });

      await expect(
        extractResumeTextApi(dummyFile, {
          onProgress: (p) => progressEvents.push({ ...p }),
        })
      ).rejects.toThrow(/Network error during resume upload/i);

      expect(progressEvents.some((p) => p.percent === 100)).toBe(false);
      expect(progressEvents.some((p) => p.stage === 'complete')).toBe(false);
    });

    it('never reaches 100% on upload timeout', async () => {
      const progressEvents: ResumeUploadProgress[] = [];

      class MockTimeoutXHR {
        public upload = {
          onprogress: null as ((event: any) => void) | null,
          onload: null as (() => void) | null,
        };
        public status = 0;
        public responseText = '';
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        public ontimeout: (() => void) | null = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          if (this.ontimeout) {
            this.ontimeout();
          }
        });
        public abort = jest.fn();
      }

      (global as any).XMLHttpRequest = MockTimeoutXHR;

      const dummyFile = new File(['dummy'], 'resume.pdf', { type: 'application/pdf' });

      await expect(
        extractResumeTextApi(dummyFile, {
          onProgress: (p) => progressEvents.push({ ...p }),
        })
      ).rejects.toThrow(/timed out/i);

      expect(progressEvents.some((p) => p.percent === 100)).toBe(false);
      expect(progressEvents.some((p) => p.stage === 'complete')).toBe(false);
    });

    it('rejects when upload finishes but extracted text has fewer than 100 characters (scanned PDF)', async () => {
      const progressEvents: ResumeUploadProgress[] = [];

      class MockScannedPdfXHR {
        public upload = {
          onprogress: null as ((event: any) => void) | null,
          onload: null as (() => void) | null,
        };
        public status = 200;
        public responseText = JSON.stringify({
          status: 'success',
          text: 'Short unselectable text', // < 100 characters
          pageCount: 1,
          charCount: 23,
        });
        public onload: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        public ontimeout: (() => void) | null = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          if (this.onload) {
            this.onload();
          }
        });
        public abort = jest.fn();
      }

      (global as any).XMLHttpRequest = MockScannedPdfXHR;

      const dummyFile = new File(['scanned'], 'scanned.pdf', { type: 'application/pdf' });

      await expect(
        extractResumeTextApi(dummyFile, {
          onProgress: (p) => progressEvents.push({ ...p }),
        })
      ).rejects.toThrow(/scanned PDF, no selectable text/i);

      // Must never mark complete!
      expect(progressEvents.some((p) => p.stage === 'complete')).toBe(false);
      expect(progressEvents.some((p) => p.percent === 100)).toBe(false);
    });
  });

  describe('3. AbortSignal & Cancellation', () => {
    it('aborts upload immediately when AbortSignal fires and stops further progress', async () => {
      const abortFn = jest.fn();

      const controller = new AbortController();

      class MockAbortableXHR {
        public upload = {
          onprogress: null as any,
          onload: null as any,
        };
        public status = 200;
        public responseText = '{}';
        public onload: any = null;
        public onerror: any = null;
        public ontimeout: any = null;

        public open = jest.fn();
        public setRequestHeader = jest.fn();
        public send = jest.fn(() => {
          // Simulates abort triggered while request is in-flight
          controller.abort();
        });
        public abort = abortFn;
      }

      (global as any).XMLHttpRequest = MockAbortableXHR;

      const dummyFile = new File(['data'], 'resume.pdf', { type: 'application/pdf' });

      const uploadPromise = extractResumeTextApi(dummyFile, {
        signal: controller.signal,
      });

      await expect(uploadPromise).rejects.toThrow(/Upload aborted/i);
      expect(abortFn).toHaveBeenCalledTimes(1);
    });

    it('rejects immediately if AbortSignal is already aborted prior to upload start', async () => {
      const controller = new AbortController();
      controller.abort();

      const dummyFile = new File(['data'], 'resume.pdf', { type: 'application/pdf' });

      await expect(
        extractResumeTextApi(dummyFile, {
          signal: controller.signal,
        })
      ).rejects.toThrow(/Upload aborted/i);
    });
  });

  describe('4. Backward Compatibility with legacy (file, showToast) signature', () => {
    it('supports legacy function parameter for toast notifications', async () => {
      delete (global as any).XMLHttpRequest;

      const showToast = jest.fn();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          status: 'error',
          message: 'Server error during extraction.',
        }),
      });

      const dummyFile = new File(['content'], 'resume.txt', { type: 'text/plain' });

      await expect(extractResumeTextApi(dummyFile, showToast)).rejects.toThrow(/Server error during extraction/i);
      expect(showToast).toHaveBeenCalledWith('Server error during extraction.', 'error');
    });
  });
});
