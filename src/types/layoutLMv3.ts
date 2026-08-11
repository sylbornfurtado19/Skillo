// ── LayoutLMv3 Visual Document Layout Types (Huang et al., 2022) ─────────────

export interface BoundingBox2D {
  x0: number; // 0 to 1000 (normalized grid)
  y0: number; // 0 to 1000
  x1: number; // 0 to 1000
  y1: number; // 0 to 1000
  width: number;
  height: number;
}

export interface VisualLayoutElement {
  id: string;
  type: 'HEADER' | 'SECTION_TITLE' | 'BODY_TEXT' | 'COLUMN_BLOCK' | 'LIST_ITEM';
  text: string;
  boundingBox: BoundingBox2D;
  columnSpan: number; // 1, 2, or multi
  visualHierarchyLevel: 1 | 2 | 3;
}

export interface LayoutFormattingPenalty {
  ruleId: 'COLUMN_OVERLAP' | 'MARGIN_VIOLATION' | 'HIERARCHY_MISMATCH' | 'DENSITY_OVERFLOW';
  severity: 'CRITICAL' | 'MODERATE' | 'MINOR';
  description: string;
  affectedBoundingBox: BoundingBox2D;
  deductionPoints: number;
}

export interface VisualLayoutAnalysisResult {
  pageCount: number;
  layoutIntegrityScore: number; // 0.0 to 100.0%
  elements: VisualLayoutElement[];
  penalties: LayoutFormattingPenalty[];
  detectedLayoutType: 'SINGLE_COLUMN' | 'TWO_COLUMN' | 'HYBRID_GRID';
}
