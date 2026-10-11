# NMIMS Portal Design System & Theme Documentation

This document defines the official design tokens, accessibility constraints, and theming standards for the Skillo frontend, modeled after the **NMIMS University Portal** color scheme and UX conventions.

---

## 1. Design Tokens Specification

All colors in the Skillo frontend are centralized as CSS custom properties (`var(--...)`) in `:root` and mirrored in `tailwind.config.js`.

### Light Theme (Default NMIMS Portal)
| Token Name | Value | Purpose / Usage | WCAG AA Ratio (vs Canvas) |
| :--- | :--- | :--- | :--- |
| `--bg-page` | `#F6F3EE` | Global page canvas background. Never pure `#FFFFFF`. | Background |
| `--bg-surface` | `#FBF9F6` | Primary cards, modals, navigation bars, dropdowns. | Background |
| `--bg-surface-alt` | `#EFEBE5` | Secondary sub-cards, input wells, table rows. | Background |
| `--bg-surface-translucent`| `rgba(251, 249, 246, 0.94)` | Sticky navbars, frosted glass panels with `backdrop-blur`. | Translucent BG |
| `--border` | `#E2DDD5` | Standard 1px warm borders on cards, inputs, and dividers. | UI Border |
| `--primary` | `#9B2218` | Official NMIMS Deep Maroon brand color. Main CTAs, banners. | 7.20:1 on `--bg-page` (Pass) |
| `--primary-hover` | `#7F1B13` | Darker maroon state for hovered primary actions. | 10.15:1 on `--text-on-primary` |
| `--primary-active` | `#67150F` | Deepest maroon state for active/pressed interactions. | 12.42:1 on `--text-on-primary` |
| `--primary-soft` | `#F3E1DE` | Soft warm maroon wash for active chips, pills, tags. | Surface Tint |
| `--secondary` | `#6B6E70` | Slate Grey for secondary buttons, metadata, and panel headers. | 4.64:1 on `--bg-page` (Pass) |
| `--secondary-hover` | `#55585A` | Darker slate grey for secondary interactive hover states. | UI Component |
| `--text-primary` | `#2B2523` | High-contrast warm charcoal for primary body & titles. | 13.63:1 on `--bg-page` (Pass) |
| `--text-secondary` | `#6A625E` | Muted charcoal for subtitles, timestamps, labels. | 5.39:1 on `--bg-page` (Pass) |
| `--text-on-primary` | `#FFFFFF` | Pure white typography on solid maroon or slate blocks only. | 7.97:1 on `--primary` (Pass) |
| `--success` | `#3A7552` | Academic emerald for completed steps, passing grades. | 4.93:1 on `--bg-page` (Pass) |
| `--warning` | `#C98A1B` | Academic amber for attention pills, medium scores. | 3.0:1 UI element fill |
| `--text-warning` | `#966007` | High-contrast dark amber for readable warning text. | 4.71:1 on `--bg-page` (Pass) |
| `--danger` | `#B3261E` | Formal red for destructive triggers, critical failures. | 5.91:1 on `--bg-page` (Pass) |
| `--info` | `#4A6B8A` | University blue for informational callouts. | 5.04:1 on `--bg-page` (Pass) |
| `--shadow` | `0 2px 8px rgba(43, 37, 35, 0.08)` | Soft, warm elevation shadow. | Elevation |
| `--focus-ring` | `0 0 0 3px rgba(155, 34, 24, 0.25)` | Accessible keyboard focus outline. | Focus Ring |

---

### Dark Theme Variant (`[data-theme="dark"]`)
| Token Name | Value | Purpose / Usage |
| :--- | :--- | :--- |
| `--bg-page` | `#1E1A19` | Deep charcoal page canvas. |
| `--bg-surface` | `#272221` | Soft dark surface for cards and modals. |
| `--bg-surface-alt` | `#322C2A` | Elevated sub-surface and input background. |
| `--bg-surface-translucent`| `rgba(39, 34, 33, 0.94)` | Translucent navbar background. |
| `--border` | `#423B38` | Subtle warm dark divider. |
| `--primary` | `#CC3F33` | Vivid crimson primary accent (WCAG AA compliant). |
| `--primary-hover` | `#DC4F43` | Hovered state crimson. |
| `--primary-soft` | `#422220` | Dark crimson wash for badges and active pills. |
| `--text-primary` | `#F1ECE8` | High-contrast warm off-white typography. |
| `--text-secondary` | `#B5ADA8` | Muted secondary text. |
| `--focus-ring` | `0 0 0 3px rgba(204, 63, 51, 0.35)` | Crimson keyboard focus outline. |

---

## 2. Core Theming Principles (Do's & Don'ts)

### DO:
1. **Always use CSS Tokens:** Apply Tailwind classes mapped to tokens (`bg-page`, `bg-surface`, `bg-primary`, `text-primary`, `border-border`, etc.) or use `var(--...)`.
2. **Use Off-White Page Backgrounds:** Pages must always use `--bg-page: #F6F3EE`, never pure `#FFFFFF`.
3. **Formal University Portal Aesthetics:**
   - Section headers use the `.nmims-section-banner` styling: solid deep maroon fill with a curved top-right corner (`rounded-tr-3xl`) and uppercase white text.
   - Secondary side panels use `.nmims-panel-header`: slate-grey header blocks.
   - Stat tiles use `.nmims-stat-card`: `--bg-surface` cards with `--border` and `--primary` colored metric numbers.
4. **Ensure Multi-Modal Signals:** Color must never be the only indicator:
   - Success/error/warning states must pair color with icons (`FaCheckCircle`, `FaTimesCircle`, `FaExclamationTriangle`) and descriptive copy.
   - In-body textual links must display an underline cue.
5. **Support Accessibility Modes:**
   - `:focus-visible` must display `--focus-ring`.
   - Respect `prefers-reduced-motion: reduce` by disabling non-essential animations.
   - Respect `prefers-contrast: more` by increasing border and text contrasts.

### DON'T:
1. **Never Hardcode Colors:** Do not write ad-hoc hex values (`#FFFFFF`, `#000000`, `#4F46E5`), arbitrary Tailwind palette colors (`bg-indigo-500`, `text-purple-400`, `border-cyan-500`), or unmapped RGBA strings.
2. **No Pure `#FFFFFF` Canvas Fills:** Never use pure white backgrounds for pages or cards. Pure white (`--text-on-primary`) is strictly reserved for text on solid maroon/slate backgrounds.
3. **No Neon Gradients or Glass Glows:** Avoid cyberpunk glows, saturated gradient rings, and hyper-translucent blurs. Maintain flat, formal university portal fills with 1px warm borders.

---

## 3. Interactive Component States

All interactive elements must provide distinct visual feedback for every lifecycle state:

| State | Visual Treatment | Implementation |
| :--- | :--- | :--- |
| **Default** | `--bg-surface` or `--primary`, 1px `--border`, `--shadow` | Standard component classes |
| **Hover** | Shift to `--primary-hover` or `--bg-surface-alt`, border shifts to `--primary` | `hover:bg-primary-hover transition-colors` |
| **Focus-Visible** | Visible 3px halo outline without default outline | `:focus-visible { box-shadow: var(--focus-ring); }` |
| **Active / Pressed**| Darker fill (`--primary-active`), scale down (`active:scale-98`) | `active:bg-primary-active active:scale-98` |
| **Disabled** | 55% opacity, grayscale filter, `not-allowed` cursor | `button:disabled { opacity: 0.55; cursor: not-allowed; }` |
| **Loading** | Spinner in `--primary` or `--text-on-primary`, text replaced or faded | `<Loader size="sm" />` |
| **Selected** | `--primary-soft` background with `--primary` text & border | `bg-primary-soft text-primary border-primary/30` |

---

## 4. How to Add a New Color Token Properly

If a new semantic color is required:
1. **Define the CSS Variable in `src/index.css`:**
   Add both light mode `:root` and dark mode `[data-theme="dark"]` entries:
   ```css
   :root {
     --accent-editorial: #8C2D19;
   }
   [data-theme="dark"] {
     --accent-editorial: #D44E36;
   }
   ```
2. **Expose the Utility in `tailwind.config.js`:**
   ```javascript
   theme: {
     extend: {
       colors: {
         'accent-editorial': 'var(--accent-editorial)',
       }
     }
   }
   ```
3. **Verify WCAG AA Compliance:**
   - Text against `--bg-page` / `--bg-surface` must achieve at least **4.5:1** contrast ratio.
   - Large text / icons must achieve at least **3.0:1** contrast ratio.
4. **Run Verification:**
   Execute `npx tsc --noEmit` and `npm test` to ensure zero compilation or regression failures.
