'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type ResultsTabKey =
  | 'overview'
  | 'confidence'
  | 'contrastive'
  | 'lats'
  | 'gaze'
  | 'pose'
  | 'affect'
  | 'sync'
  | 'responses';

export interface ResultsNavItem {
  id: string;
  tab: ResultsTabKey;
  label: string;
}

export interface UseResultsScrollSpyOptions {
  navItems: ResultsNavItem[];
  defaultTab?: ResultsTabKey;
  readingLineOffset?: number;
}

export interface UseResultsScrollSpyReturn {
  activeTab: ResultsTabKey;
  setActiveTab: React.Dispatch<React.SetStateAction<ResultsTabKey>>;
  scrollToSection: (id: string, tab: ResultsTabKey) => void;
  isProgrammaticScrolling: () => boolean;
}

/**
 * Calculates priority score for an intersecting section based on its bounding rect
 * relative to the reading line (just below the sticky header).
 */
export function calculateSectionReadingScore(
  rect: { top: number; bottom: number } | DOMRect | undefined,
  ratio: number = 0,
  readingLine: number = 140
): number {
  if (!rect || (rect.top === 0 && rect.bottom === 0)) {
    return ratio;
  }
  // If section straddles the reading line, give highest priority
  if (rect.top <= readingLine && rect.bottom >= readingLine) {
    return 10000 - rect.top;
  }
  // If section is below reading line, score by proximity
  if (rect.top > readingLine) {
    return 5000 - Math.abs(rect.top - readingLine);
  }
  // If section has passed reading line (above it)
  return 1000 - Math.abs(rect.bottom - readingLine);
}

/**
 * Resolves the best active nav item from currently intersecting sections.
 */
export function resolveActiveNavItem(
  visibleItems: ResultsNavItem[],
  intersectingMap: Map<string, { boundingClientRect?: { top: number; bottom: number }; intersectionRatio?: number }>,
  readingLine: number = 140
): ResultsNavItem | null {
  if (visibleItems.length === 0) return null;
  if (visibleItems.length === 1) return visibleItems[0];

  let bestItem = visibleItems[0];
  let bestScore = -Infinity;

  for (const item of visibleItems) {
    const entry = intersectingMap.get(item.id);
    if (!entry) continue;

    const score = calculateSectionReadingScore(entry.boundingClientRect, entry.intersectionRatio || 0, readingLine);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

/**
 * Headless controller for scrollspy behavior, enabling deterministic testing in Node/browser environments.
 */
export class ResultsScrollSpyController {
  private navItems: ResultsNavItem[] = [];
  private activeTab: ResultsTabKey;
  private readingLineOffset: number;
  private isMounted = true;
  private isProgrammaticScroll = false;
  private programmaticTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private rafId: number | null = null;
  private observer: IntersectionObserver | null = null;
  private intersectingMap = new Map<string, { boundingClientRect?: { top: number; bottom: number }; intersectionRatio?: number }>();
  private onActiveTabChange?: (tab: ResultsTabKey) => void;

  constructor(options: {
    navItems: ResultsNavItem[];
    defaultTab?: ResultsTabKey;
    readingLineOffset?: number;
    onActiveTabChange?: (tab: ResultsTabKey) => void;
  }) {
    this.navItems = options.navItems;
    this.activeTab = options.defaultTab || 'overview';
    this.readingLineOffset = options.readingLineOffset ?? 140;
    this.onActiveTabChange = options.onActiveTabChange;
  }

  public getActiveTab(): ResultsTabKey {
    return this.activeTab;
  }

  public getIsProgrammaticScrolling(): boolean {
    return this.isProgrammaticScroll;
  }

  public setActiveTab(tab: ResultsTabKey): void {
    if (!this.isMounted) return;
    if (this.activeTab !== tab) {
      this.activeTab = tab;
      this.onActiveTabChange?.(tab);
    }
  }

  public setNavItems(items: ResultsNavItem[]): void {
    this.navItems = items;
  }

  public scrollToSection(id: string, tab: ResultsTabKey): void {
    if (!this.isMounted) return;
    this.setActiveTab(tab);
    this.isProgrammaticScroll = true;

    if (this.programmaticTimeoutId) {
      clearTimeout(this.programmaticTimeoutId);
    }
    this.programmaticTimeoutId = setTimeout(() => {
      this.isProgrammaticScroll = false;
    }, 800);

    if (typeof window !== 'undefined') {
      if (window.history && window.history.pushState) {
        const targetHash = `#${id}`;
        if (window.location.hash !== targetHash) {
          window.history.pushState(null, '', targetHash);
        }
      }

      const el = document.getElementById(id);
      if (el) {
        const prefersReducedMotion =
          window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    }
  }

  public handleUserInterrupt(): void {
    if (this.isProgrammaticScroll) {
      this.isProgrammaticScroll = false;
      if (this.programmaticTimeoutId) {
        clearTimeout(this.programmaticTimeoutId);
        this.programmaticTimeoutId = null;
      }
    }
  }

  public syncHash(rawHash: string): boolean {
    if (!rawHash) return false;
    const cleanHash = rawHash.replace(/^#/, '');
    const matched = this.navItems.find((item) => item.id === cleanHash || item.tab === cleanHash);
    if (matched) {
      this.setActiveTab(matched.tab);
      if (typeof window !== 'undefined') {
        const el = document.getElementById(matched.id);
        if (el) {
          const prefersReducedMotion =
            window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
          });
        }
      }
      return true;
    }
    return false;
  }

  public handleIntersectionEntries(
    entries: Array<{ target: { id: string }; isIntersecting: boolean; boundingClientRect?: { top: number; bottom: number }; intersectionRatio?: number }>
  ): void {
    if (!this.isMounted || this.isProgrammaticScroll) return;

    for (const entry of entries) {
      if (entry.isIntersecting) {
        this.intersectingMap.set(entry.target.id, entry);
      } else {
        this.intersectingMap.delete(entry.target.id);
      }
    }

    if (this.intersectingMap.size === 0) return;

    const visibleItems = this.navItems.filter((item) => this.intersectingMap.has(item.id));
    const resolved = resolveActiveNavItem(visibleItems, this.intersectingMap, this.readingLineOffset);
    if (resolved) {
      this.setActiveTab(resolved.tab);
    }
  }

  public handleBoundaryScroll(scrollY: number, windowHeight: number, docHeight: number): void {
    if (!this.isMounted || this.isProgrammaticScroll || this.navItems.length === 0) return;

    if (scrollY <= 80) {
      this.setActiveTab(this.navItems[0].tab);
      return;
    }

    if (docHeight > 0 && scrollY + windowHeight >= docHeight - 30) {
      this.setActiveTab(this.navItems[this.navItems.length - 1].tab);
      return;
    }
  }

  public initBrowserListeners(): () => void {
    if (typeof window === 'undefined') return () => {};

    const onWheelOrTouch = () => this.handleUserInterrupt();
    window.addEventListener('wheel', onWheelOrTouch, { passive: true });
    window.addEventListener('touchmove', onWheelOrTouch, { passive: true });

    const onHashOrHistory = () => {
      this.syncHash(window.location.hash);
    };
    window.addEventListener('hashchange', onHashOrHistory);
    window.addEventListener('popstate', onHashOrHistory);

    // Initial check for hash
    if (window.location.hash) {
      this.syncHash(window.location.hash);
    }

    // Scroll handler with requestAnimationFrame
    const onScroll = () => {
      if (this.rafId !== null) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const winHeight = window.innerHeight || 0;
        const docHeight = document.documentElement.scrollHeight || 0;
        this.handleBoundaryScroll(scrollY, winHeight, docHeight);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // IntersectionObserver setup
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => {
          this.handleIntersectionEntries(entries as any);
        },
        {
          rootMargin: '-100px 0px -40% 0px',
          threshold: [0, 0.2, 0.5, 0.8],
        }
      );

      this.navItems.forEach((item) => {
        const el = document.getElementById(item.id);
        if (el && this.observer) {
          this.observer.observe(el);
        }
      });
    }

    return () => {
      window.removeEventListener('wheel', onWheelOrTouch);
      window.removeEventListener('touchmove', onWheelOrTouch);
      window.removeEventListener('hashchange', onHashOrHistory);
      window.removeEventListener('popstate', onHashOrHistory);
      window.removeEventListener('scroll', onScroll);

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    };
  }

  public destroy(): void {
    this.isMounted = false;
    if (this.programmaticTimeoutId) {
      clearTimeout(this.programmaticTimeoutId);
      this.programmaticTimeoutId = null;
    }
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.intersectingMap.clear();
  }
}

/**
 * React hook to synchronize active Results navigation state with scroll position,
 * clicks, URL hash, and browser history.
 */
export function useResultsScrollSpy({
  navItems,
  defaultTab = 'overview',
  readingLineOffset = 140,
}: UseResultsScrollSpyOptions): UseResultsScrollSpyReturn {
  const [activeTab, setActiveTab] = useState<ResultsTabKey>(defaultTab);
  const controllerRef = useRef<ResultsScrollSpyController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new ResultsScrollSpyController({
      navItems,
      defaultTab,
      readingLineOffset,
      onActiveTabChange: (newTab) => {
        setActiveTab((prev) => (prev === newTab ? prev : newTab));
      },
    });
  }

  // Update navItems on controller when items change
  useEffect(() => {
    controllerRef.current?.setNavItems(navItems);
  }, [navItems]);

  // Manage browser lifecycle
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;

    const cleanupListeners = controller.initBrowserListeners();
    return () => {
      cleanupListeners();
      controller.destroy();
    };
  }, [navItems]);

  const scrollToSection = useCallback((id: string, tab: ResultsTabKey) => {
    controllerRef.current?.scrollToSection(id, tab);
  }, []);

  const isProgrammaticScrolling = useCallback(() => {
    return controllerRef.current?.getIsProgrammaticScrolling() ?? false;
  }, []);

  return {
    activeTab,
    setActiveTab,
    scrollToSection,
    isProgrammaticScrolling,
  };
}
