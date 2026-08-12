/**
 * ARCHITECTURAL DECISION:
 * Resume layout analysis operates permanently on deterministic geometric rules
 * and text formatting heuristics rather than deep neural network models.
 *
 * Implements structure-aware spatial coordinate extraction from resume text,
 * normalized to a [0, 1000] integer grid without external machine learning runtimes.
 */

import type {
  BoundingBox2D,
  VisualLayoutElement,
  LayoutFormattingPenalty,
  VisualLayoutAnalysisResult,
} from '@/types/index';

// ── Virtual Page Dimensions (US Letter / A4 approximation) ───────────────────
const PAGE_W = 800;      // Virtual page width in px
const PAGE_H = 1100;     // Virtual page height in px
const CHAR_W = 6;        // Average character width in px (11pt monospace proxy)
const LINE_H = 18;       // Line height in px (1.5x for 11pt font)
const MARGIN_L = 60;     // Left margin in px
const MARGIN_R = 740;    // Right margin in px (800 - 60)
const LINES_PER_PAGE = Math.floor(PAGE_H / LINE_H); // ≈ 61 lines

// ── Section Header Keywords ───────────────────────────────────────────────────
const SECTION_KEYWORDS =
  /^(experience|education|skills|projects|summary|objective|profile|certifications|awards|publications|references|work history|professional|technical|achievements|highlights|courses)/i;

// ── Internal Raw Block ────────────────────────────────────────────────────────
interface RawBlock {
  lineIndex: number;
  raw: string;       // original line (with whitespace)
  text: string;      // trimmed text
  indent: number;    // leading space count
  charCount: number;
  estimatedFontPt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TEXT PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseRawBlocks(resumeText: string): RawBlock[] {
  const lines = resumeText.split('\n');
  const blocks: RawBlock[] = [];
  let lineIdx = 0;

  for (const raw of lines) {
    const text = raw.trimStart();
    if (text.length === 0) { lineIdx++; continue; }

    const indent = raw.length - text.length;

    // Heuristic font size: ALL-CAPS short → large heading, title-case → medium, else normal
    let estimatedFontPt = 11;
    if (text === text.toUpperCase() && text.length <= 40 && /[A-Z]/.test(text)) {
      estimatedFontPt = 14;
    } else if (/^[A-Z][a-z]/.test(text) && text.length <= 50 && SECTION_KEYWORDS.test(text)) {
      estimatedFontPt = 13;
    }

    blocks.push({ lineIndex: lineIdx, raw, text, indent, charCount: text.length, estimatedFontPt });
    lineIdx++;
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ELEMENT TYPE CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

function classifyType(block: RawBlock): VisualLayoutElement['type'] {
  const t = block.text;

  // HEADER: ALL CAPS, no trailing punctuation, short
  if (
    t === t.toUpperCase() &&
    t.length >= 3 &&
    t.length <= 50 &&
    /[A-Z]/.test(t) &&
    !/[.,;:?!]$/.test(t)
  ) {
    return 'HEADER';
  }

  // SECTION_TITLE: matches known section keywords
  if (SECTION_KEYWORDS.test(t) && t.length <= 60) {
    return 'SECTION_TITLE';
  }

  // LIST_ITEM: bullets or numbered lists
  if (/^[•\-\*►▶→✓✗➤◆]\s/.test(t) || /^\d+[.)]\s/.test(t)) {
    return 'LIST_ITEM';
  }

  // COLUMN_BLOCK: large indent (suggests indented side column) or tab-separated
  if (block.indent >= 20 || /\t{2,}/.test(block.raw)) {
    return 'COLUMN_BLOCK';
  }

  return 'BODY_TEXT';
}

function hierarchyLevel(type: VisualLayoutElement['type']): 1 | 2 | 3 {
  if (type === 'HEADER') return 1;
  if (type === 'SECTION_TITLE') return 2;
  return 3;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOUNDING BOX NORMALIZATION  [0, 1000] grid
// Formula: x0 = ⌊(left / W) × 1000⌋, y0 = ⌊(top / H) × 1000⌋
// ─────────────────────────────────────────────────────────────────────────────

function normalizeBBox(
  left: number,
  top: number,
  right: number,
  bottom: number
): BoundingBox2D {
  const clamp = (v: number) => Math.max(0, Math.min(1000, v));
  const x0 = clamp(Math.floor((left / PAGE_W) * 1000));
  const y0 = clamp(Math.floor((top / PAGE_H) * 1000));
  const x1 = clamp(Math.floor((right / PAGE_W) * 1000));
  const y1 = clamp(Math.floor((bottom / PAGE_H) * 1000));
  return { x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 };
}

function buildElement(block: RawBlock, index: number, pageCount: number): VisualLayoutElement {
  const type = classifyType(block);
  const level = hierarchyLevel(type);

  // Estimate pixel position on virtual page
  // y position wraps per page
  const lineOnPage = block.lineIndex % LINES_PER_PAGE;
  const leftPx = MARGIN_L + block.indent * CHAR_W;
  const topPx = lineOnPage * LINE_H;
  const rightPx = Math.min(MARGIN_R, leftPx + block.charCount * (CHAR_W - 1));
  const bottomPx = topPx + block.estimatedFontPt * 1.5;

  const bbox = normalizeBBox(leftPx, topPx, rightPx, bottomPx);

  // columnSpan: full-width elements or headers span 2
  const widthPx = rightPx - leftPx;
  const columnSpan =
    type === 'HEADER' || (block.indent === 0 && widthPx > PAGE_W * 0.65) ? 2 : 1;

  return {
    id: `el_${index}_${type.toLowerCase()}`,
    type,
    text: block.text.length > 90 ? block.text.substring(0, 90) + '...' : block.text,
    boundingBox: bbox,
    columnSpan,
    visualHierarchyLevel: level,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LAYOUT PENALTY CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function detectMarginViolations(elements: VisualLayoutElement[]): LayoutFormattingPenalty[] {
  const penalties: LayoutFormattingPenalty[] = [];
  for (const el of elements) {
    const { x0, x1 } = el.boundingBox;
    if (x0 < 20 && el.type !== 'HEADER') {
      penalties.push({
        ruleId: 'MARGIN_VIOLATION',
        severity: 'MODERATE',
        description: `"${el.text.substring(0, 45)}..." extends past the left margin safety boundary (x0=${x0} < 20). ATS parsers may fail to capture this block.`,
        affectedBoundingBox: el.boundingBox,
        deductionPoints: 8,
      });
    }
    if (x1 > 980) {
      penalties.push({
        ruleId: 'MARGIN_VIOLATION',
        severity: 'CRITICAL',
        description: `"${el.text.substring(0, 45)}..." overflows the right page boundary (x1=${x1} > 980). Content will be clipped by ATS scanners.`,
        affectedBoundingBox: el.boundingBox,
        deductionPoints: 15,
      });
    }
  }
  return penalties;
}

function detectColumnOverlaps(elements: VisualLayoutElement[]): LayoutFormattingPenalty[] {
  const penalties: LayoutFormattingPenalty[] = [];

  for (let i = 0; i < elements.length - 1; i++) {
    const a = elements[i];
    const b = elements[i + 1];

    // Only flag if the two elements are at meaningfully different x positions (parallel columns)
    const xDiff = Math.abs(a.boundingBox.x0 - b.boundingBox.x0);
    if (xDiff < 100) continue;

    const aH = a.boundingBox.y1 - a.boundingBox.y0;
    if (aH <= 0) continue;

    // y-range overlap ratio
    const overlapStart = Math.max(a.boundingBox.y0, b.boundingBox.y0);
    const overlapEnd = Math.min(a.boundingBox.y1, b.boundingBox.y1);
    const yOverlap = overlapEnd - overlapStart;
    const overlapRatio = yOverlap / aH;

    if (yOverlap > 0 && overlapRatio > 0.3) {
      penalties.push({
        ruleId: 'COLUMN_OVERLAP',
        severity: 'MODERATE',
        description: `Multi-column overlap between "${a.text.substring(0, 30)}..." and "${b.text.substring(0, 30)}...". Y-overlap ratio ${(overlapRatio * 100).toFixed(0)}% exceeds ATS parsing threshold (>30%).`,
        affectedBoundingBox: a.boundingBox,
        deductionPoints: 12,
      });
    }
  }
  return penalties;
}

function detectHierarchyMismatches(elements: VisualLayoutElement[]): LayoutFormattingPenalty[] {
  const penalties: LayoutFormattingPenalty[] = [];
  // Flag when a BODY_TEXT element has estimated hierarchy level 1 (should be 3)
  for (const el of elements) {
    if (el.type === 'BODY_TEXT' && el.visualHierarchyLevel === 1) {
      penalties.push({
        ruleId: 'HIERARCHY_MISMATCH',
        severity: 'MINOR',
        description: `Body text "${el.text.substring(0, 45)}..." has incorrect hierarchy level 1. Expected level 3 for body text. Typography inconsistency reduces ATS section parsing fidelity.`,
        affectedBoundingBox: el.boundingBox,
        deductionPoints: 5,
      });
    }
    // Also flag HEADER with hierarchy level 3
    if (el.type === 'HEADER' && el.visualHierarchyLevel === 3) {
      penalties.push({
        ruleId: 'HIERARCHY_MISMATCH',
        severity: 'MINOR',
        description: `Header block "${el.text.substring(0, 45)}..." classified at hierarchy level 3. Expected level 1. Visual heading weight anomaly detected.`,
        affectedBoundingBox: el.boundingBox,
        deductionPoints: 5,
      });
    }
  }
  return penalties;
}

function detectDensityOverflow(
  totalLines: number,
  pageCount: number,
  firstElement?: VisualLayoutElement
): LayoutFormattingPenalty[] {
  const densityPerPage = totalLines / pageCount;
  if (densityPerPage <= 58) return [];

  const fallbackBBox: BoundingBox2D = { x0: 75, y0: 0, x1: 925, y1: 15, width: 850, height: 15 };

  return [
    {
      ruleId: 'DENSITY_OVERFLOW',
      severity: densityPerPage > 72 ? 'CRITICAL' : 'MODERATE',
      description: `Page content density of ${densityPerPage.toFixed(0)} lines/page exceeds the ATS-safe threshold of 58 lines/page. Reduce content density or extend to an additional page.`,
      affectedBoundingBox: firstElement?.boundingBox ?? fallbackBBox,
      deductionPoints: densityPerPage > 72 ? 20 : 10,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. LAYOUT TYPE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectLayoutType(
  elements: VisualLayoutElement[]
): VisualLayoutAnalysisResult['detectedLayoutType'] {
  if (elements.length === 0) return 'SINGLE_COLUMN';

  // Collect x0 positions of non-header elements
  const x0s = elements
    .filter(e => e.type !== 'HEADER' && e.type !== 'SECTION_TITLE')
    .map(e => e.boundingBox.x0);

  if (x0s.length === 0) return 'SINGLE_COLUMN';

  // Count elements in right half of page (x0 > 450 → suggests right column)
  const rightHalf = x0s.filter(x => x > 450 && x < 900);
  const leftHalf = x0s.filter(x => x <= 450);

  const rightRatio = rightHalf.length / x0s.length;

  if (rightRatio > 0.35) {
    // Significant right-column content
    return leftHalf.length > rightHalf.length ? 'HYBRID_GRID' : 'TWO_COLUMN';
  }

  // Check x0 standard deviation — high variance → multi-column
  const mean = x0s.reduce((a, b) => a + b, 0) / x0s.length;
  const variance = x0s.reduce((sum, x) => sum + (x - mean) ** 2, 0) / x0s.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > 120) return 'HYBRID_GRID';
  return 'SINGLE_COLUMN';
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyzes a resume's visual document layout structure using spatial bounding
 * box heuristics derived from text coordinates.
 *
 * Returns a VisualLayoutAnalysisResult containing:
 * - Normalized [0,1000] bounding boxes for all visual layout elements
 * - Layout integrity score (0–100%)
 * - Detected layout type (SINGLE_COLUMN | TWO_COLUMN | HYBRID_GRID)
 * - Penalty list (COLUMN_OVERLAP, MARGIN_VIOLATION, HIERARCHY_MISMATCH, DENSITY_OVERFLOW)
 */
export function analyzeVisualDocumentLayout(
  resumeText: string,
  fileName: string = ''
): VisualLayoutAnalysisResult {
  // Handle empty / minimal input gracefully
  if (!resumeText || resumeText.trim().length < 10) {
    return {
      pageCount: 1,
      layoutIntegrityScore: 85,
      elements: [],
      penalties: [],
      detectedLayoutType: 'SINGLE_COLUMN',
    };
  }

  const rawBlocks = parseRawBlocks(resumeText);
  const totalLines = rawBlocks.length;
  const pageCount = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE));

  // Build VisualLayoutElements (cap at 60 for performance)
  const elements: VisualLayoutElement[] = rawBlocks
    .slice(0, 80)
    .map((block, i) => buildElement(block, i, pageCount));

  // Collect all penalties
  const allPenalties: LayoutFormattingPenalty[] = [
    ...detectMarginViolations(elements),
    ...detectColumnOverlaps(elements),
    ...detectHierarchyMismatches(elements),
    ...detectDensityOverflow(totalLines, pageCount, elements[0]),
  ];

  // Deduplicate by ruleId + affected bbox signature, cap at 8
  const seen = new Set<string>();
  const penalties: LayoutFormattingPenalty[] = [];
  for (const p of allPenalties) {
    const key = `${p.ruleId}_${p.affectedBoundingBox.x0}_${p.affectedBoundingBox.y0}`;
    if (!seen.has(key) && penalties.length < 8) {
      seen.add(key);
      penalties.push(p);
    }
  }

  // Layout integrity score: 100 minus total deductions, floored at 0
  const totalDeductions = penalties.reduce((s, p) => s + p.deductionPoints, 0);
  const layoutIntegrityScore = Math.max(0, Math.min(100, 100 - totalDeductions));

  const detectedLayoutType = detectLayoutType(elements);

  return {
    pageCount,
    layoutIntegrityScore,
    elements: elements.slice(0, 60),
    penalties,
    detectedLayoutType,
  };
}
