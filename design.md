# 🎨 Campus Genie — Master Design System & Component Specification

> **Comprehensive Design Document**: Exhaustive specification of design tokens, color ramps, typography, geometry, elevation, animation curves, component architectures, and state variations derived from the **Beautiful UI** design system for **Campus Genie** (Databricks Lakehouse + Genie Agent).

---

## 1. Design Philosophy & Aesthetic Foundation

### 1.1 The "Cool Precision" Visual Language
1. **Cool, Hairline-Governed Surfaces**:
   * Canvas uses an intentional blue-tinted neutral base (`--canvas: oklch(0.231 0.004 264.487)` in Dark Mode, `oklch(0.961 0.002 247.84)` in Light Mode).
   * Cards, dialogs, and interactive panes float on `--canvas` with solid, hairline borders (`--line: oklch(0.308 0.006 258.354)` in Dark Mode) rather than muddy alpha borders.
   * Eliminates unwanted murky grey tints in favor of crisp, high-contrast dark slate surfaces.

2. **Layered Single-Digit-Opacity Shadows**:
   * Shadows combine a 1px solid hairline ring with smooth, multi-step blur stacks (`shadow-plugin`) for tactile depth without diffuse blur halos.

3. **Semantic Condiments**:
   * Neutral ink (`--ink`, `--ink-2`, `--ink-3`) carries 95% of visual weight.
   * Semantic color (Accent Blue, Sage Green, Ember Orange, Crimson Red) is strictly applied as a condiment for status indicators, live timers, delta values, and interactive highlights.

4. **AI-Native Primitives**:
   * First-class interfaces for agent reasoning cycles (`ThinkingState`), pixel-grid matrix loading states (`LoadingState`), multi-step DAG flowcharts (`Flowchart`), unified SQL code blocks (`CodeBlock`), streaming typography with masked blur tails (`StreamText`), and human-in-the-loop approvals (`ApprovalCard`).

---

## 2. Token Architecture & OKLCH Color Ramp

Tokens are declared in `src/app/globals.css` and bound to Tailwind CSS v4 `@theme inline` variables.

### 2.1 Color Token Matrix
| Semantic Token | Light Mode (OKLCH) | Dark Mode (OKLCH) | Hex Approx (Dark) | Core Usage |
|---|---|---|---|---|
| `--page` | `0.985 0.001 286.376` | `0.209 0.004 264.477` | `#16181D` | Root inner viewport / deep background |
| `--canvas` | `0.961 0.002 247.84` | `0.231 0.004 264.487` | `#1A1D23` | Card container background, panel frames |
| `--surface` | `1 0 0` | `0.26 0.006 271.191` | `#20232A` | Elevated cards, menus, popovers |
| `--inset` | `0.979 0.002 247.839` | `0.243 0.004 264.492` | `#1C1F26` | Code gutters, inactive pills, table footers |
| `--hover` | `0.97 0.002 247.839` | `0.289 0.006 271.22` | `#262A33` | Hover highlights |
| `--hover-2` | `0.933 0.003 247.86` | `0.318 0.007 274.747` | `#2D323D` | Active selected tabs, glide menu highlights |
| `--field` | `0.961 0.001 286.375` | `0.293 0.006 271.223` | `#272B34` | Search inputs, composer background |
| `--stripe-bg` | `0.97 0 0` | `0.226 0.004 264.485` | `#181B21` | Fixed 45° viewport hatch background |
| `--stripe` | `0.405 0 0 / 0.075` | `1 0 0 / 0.055` | `rgba(255,255,255,0.055)` | Diagonal hatch lines |

### 2.2 Ink Ramp (Typography & Icons)
| Token | Light Mode | Dark Mode | Contrast | Usage |
|---|---|---|---|---|
| `--ink` | `oklch(0.247 0.006 258.361)` | `oklch(0.964 0.002 247.839)` | AAA | Primary headlines, active icons, code text |
| `--ink-2` | `oklch(0.506 0.01 264.477)` | `oklch(0.731 0.008 260.731)` | AA | Body descriptions, table column headers, labels |
| `--ink-3` | `oklch(0.695 0.009 264.505)` | `oklch(0.541 0.01 264.484)` | A | Timestamps, counts, shortcuts, disabled text |

### 2.3 Borders & Dividers
| Token | Light Mode | Dark Mode | Description |
|---|---|---|---|
| `--line` | `oklch(0.946 0.003 264.542)` | `oklch(0.308 0.006 258.354)` | Solid hairline border for cards and panels |
| `--line-strong` | `oklch(0.912 0.005 258.326)` | `oklch(0.356 0.007 264.474)` | Focused controls, prompt bar outline |
| `--line-soft` | `oklch(0.966 0.002 264.542)` | `oklch(0.278 0.006 258.354)` | Internal dividers between card items |
| `--grid-line` | `color-mix(var(--line) 78%, transparent)` | `color-mix(var(--line) 78%, transparent)` | Flowchart grid dots and connection axes |

### 2.4 Semantic Accents
| Role | Main Token (`--color`) | Ink Token (`--ink`) | Tint Token (`--tint`) | Usage |
|---|---|---|---|---|
| **Accent (Blue)** | `oklch(0.68 0.173 253.301)` | `oklch(0.788 0.113 248.33)` | `oklch(0.68 0.173 253.301 / 0.16)` | Genie triggers, active tabs, links |
| **Green (Success)**| `oklch(0.705 0.154 153.814)` | `oklch(0.705 0.154 153.814)` | `oklch(0.705 0.154 153.814 / 0.14)` | Completed steps, approved cards |
| **Orange (Warning)**| `oklch(0.746 0.156 55.642)` | `oklch(0.746 0.156 55.642)` | `oklch(0.746 0.156 55.642 / 0.14)` | Pending tasks, review required |
| **Red (Danger)** | `oklch(0.666 0.18 21.433)` | `oklch(0.666 0.18 21.433)` | `oklch(0.666 0.18 21.433 / 0.14)` | Failed tool runs, cancellations |

---

## 3. Typography & Typesetting System

* **Primary Sans**: `Inter` (`--font-sans`, `--font-inter`)
* **Monospace**: `JetBrains Mono` (`--font-mono`, `--font-mono-face`)
* **OpenType Features**: `font-feature-settings: "cv11", "ss01"` (clean lowercase l/r, curved digits, tight figures)
* **Base Letter Spacing**: `-0.01em`
* **Tabular Numbers**: Mandatory `font-variant-numeric: tabular-nums` for all metrics, dates, percentages, and calculations.

### Typography Scale
| Level | Font Size | Line Height | Weight | Letter Spacing | Example Tailwind Classes |
|---|---|---|---|---|---|
| **Page Title** | 20px (1.25rem) | 1.3 | 600 | `-0.02em` | `text-[20px] font-semibold text-ink` |
| **Section Header** | 15px (0.9375rem) | 1.35 | 600 | `-0.015em` | `text-[15px] font-semibold text-ink` |
| **Card Headline** | 14px (0.875rem) | 1.4 | 600 | `-0.01em` | `text-[14px] font-semibold text-ink` |
| **Body / Message** | 14px (0.875rem) | 1.5 | 400 | `-0.01em` | `text-[14px] leading-relaxed text-ink` |
| **Interactive Label** | 13px (0.8125rem) | 1.35 | 500 | `normal` | `text-[13px] font-medium text-ink-2` |
| **Micro Caption** | 11.5px (0.71875rem)| 1.2 | 500 | `normal` | `text-[11.5px] font-medium text-ink-3 tabular-nums` |
| **SQL / Code** | 12.5px (0.78125rem)| 1.65 | 400 | `normal` | `font-mono text-[12.5px] leading-[1.65]` |

---

## 4. Geometry & Radii Scale

Strict hierarchical corner radiuses ensure visual cohesion across nested containers:
* **Micro Chips & Badges**: `6px` (`--radius-chip` / `rounded-[6px]`)
* **Buttons, Form Controls & Inputs**: `8px` (`--radius-control` / `rounded-[8px]`)
* **Cards & Embedded Modules**: `10px` – `12px` (`--radius-card` / `rounded-[10px]` – `rounded-[12px]`)
* **Top-Level Panels & Application Shell**: `14px` (`--radius-window` / `rounded-[14px]`)
* **Pills & Status Rings**: `9999px` (`rounded-full`)

---

## 5. Elevation & Layered Shadows

Shadows pair a solid hairline ring (`--line`) with multi-step elevation:
* `--shadow-hairline`: `0 0 0 1px var(--line)`
* `--shadow-btn`: `0 0 0 1px oklch(1 0 0 / 0.1), 0 1px 2px oklch(0 0 0 / 0.3)`
* `--shadow-card`: `0 0 0 1px oklch(1 0 0 / 0.11), 0 1px 2px oklch(0 0 0 / 0.2), 0 2px 6px oklch(0 0 0 / 0.2)`
* `--shadow-raised`: `0 0 0 1px oklch(1 0 0 / 0.13), 0 2px 10px oklch(0 0 0 / 0.22)`
* `--shadow-overlay`: `0 0 0 1px oklch(1 0 0 / 0.15), 0 8px 28px oklch(0 0 0 / 0.34)`
* `--shadow-inset-field`: `inset 0 1px 2px oklch(0 0 0 / 0.4)`

---

## 6. Motion, Animations & Timing Curves

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
--ease-link: cubic-bezier(0.16, 1, 0.3, 1);
```

### Keyframe Animations
1. **`pixel-on` (Pixel-Grid Loader)**:
   ```css
   @keyframes pixel-on {
     0%, 100% { opacity: 0.15; }
     18%, 42% { opacity: 1; }
     62% { opacity: 0.15; }
   }
   ```
2. **`caret-blink` (Streaming Caret)**:
   ```css
   @keyframes caret-blink {
     0%, 100% { opacity: 1; }
     50% { opacity: 0; }
   }
   ```
3. **`stream-tail` (Character Blur Tail)**:
   ```css
   .stream-tail {
     filter: blur(1.6px);
     mask-image: linear-gradient(to right, oklch(0 0 0) 20%, oklch(0 0 0 / 0.2));
   }
   ```
4. **`pop-in` (Popover & Menu Entry)**: `pop-in 180ms cubic-bezier(0.23,1,0.32,1) both`
5. **`shimmer-text` (Gradient Text Shimmer)**: `shimmer-text 1.4s linear infinite`

---

## 7. Component Catalog & Variations Directory

Every component includes distinct variations designed for interactive campus agent workflows:

### 7.1 Agent Intelligence Primitives
* **`ThinkingState`**:
  * `Steps`: Sequential execution trace with live spinner (`Scanning persona` -> `Querying Delta tables` -> `Filtering meetups`).
  * `Reasoning`: Prose reasoning chain analyzing student constraints and alumni patterns.
  * `Search`: Multi-source introspection displaying database sources and URLs.
* **`LoadingState`**:
  * `Drive`: Chevron wavefront driving right across 3x3 pixel matrix.
  * `Dots`: Circular wavefront with smooth pulse.
  * `Orbit`: Perimeter orbiting comet with live elapsed stopwatch timer (`X.Xs`).
* **`PromptBar`**:
  * `Rounded`: Standard card-radius composer.
  * `Pill`: Full-radius floating composer.
  * Includes Glimm rainbow shader sweeps, `@` data source search, `/` command catalog, and model selection.
* **`ToolChips`**:
  * Expandable Databricks SQL execution badges, Unity Catalog lookups, and API status dots.
* **`TaskRows`**:
  * 4-step pipeline with animated rings, retry triggers, and expandable step metadata.
* **`StreamingText`**:
  * Token-by-token stream with streaming tail and settled caret transitions.
* **`ApprovalCard`**:
  * Human-in-the-loop confirmation gates for event RSVPs, Google Calendar additions, and club registrations.
* **`RecommendationCard`**:
  * High-match badge, lead time, commitment indicators, and action triggers.
* **`ContextCards`**:
  * Expandable knowledge attachments for campus policies and prerequisite syllabi.

### 7.2 Data & Exploration Primitives
* **`RecordsTable`**:
  * Multi-column Lakehouse grid with dynamic column math (Averages, Sums, Counts), sorting, and AI property derivation.
* **`DiffTable`**:
  * Visual comparative diff between academic schedules and extracurricular commitments.
* **`FilterTable`**:
  * Filterable queue with color-mixed status pills (`filter-status-todo`, `filter-status-progress`, `filter-status-done`).
* **`InsightCards`**:
  * Live sparkline metric cards powered by `liveline` with cursor tracking tooltips.
* **`Flowchart`**:
  * Interactive SVG node DAG displaying Genie query planning and feedback loops.
* **`CodeBlock`**:
  * `Code`: Syntax highlighted Databricks SQL query listing with line numbers.
  * `Diff`: Unified code diff with green additions and red deletions.
* **`FineTuneCard`**:
  * Interactive sliders for tuning persona extroversion, bandwidth, and city radius.
* **`SearchList`**:
  * Rapid command search across clubs, labs, and city meetups.
* **`SelectionActions`**:
  * Floating contextual action bar appearing on text selections.
* **`ChatComposer`**:
  * Multi-modal composer with attachment drawer for lab PDFs and flyers.
* **`SidebarNav`**:
  * Collapsible navigation rail (52px to 224px) with workspace switcher and search.

### 7.3 Atoms
* **`Button`**: `primary`, `secondary`, `ghost`, `accent`, `success`, `quiet`.
* **`StatusPill`**: `green`, `orange`, `red`, `accent`, `neutral`.
* **`ValuePill`**: Accent and success delta indicators.
* **`Chip`**: Removable tag with count badges.
* **`EntityChip`**: Monogram avatar + entity label.
* **`ProgressRing`**: Animated SVG circle completion indicator.
* **`SegmentedControl`**: Sliding highlight switcher.
* **`Switch`**: Accessible toggle switch.
* **`TextRow`**: High-density label/value row.
* **`StreamText`**: Standalone streaming text token renderer.
* **`Shimmer`**: Polished loading placeholder.

---

## 8. Design Compliance Rules

- [x] **Strict Background Consistency**: All component-holding containers use `bg-canvas` (`oklch(0.231 0.004 264.487)`) with crisp `border-line` borders.
- [x] **Zero Mismatched Greys**: Pure OKLCH blue-tinted neutral ramp eliminates muddy grey backgrounds.
- [x] **Interactive Variation Support**: Preserved and exposed all variants for `ThinkingState`, `LoadingState`, `CodeBlock`, and `PromptBar`.
- [x] **Tabular Numeric Consistency**: Strict `tabular-nums` formatting for all data points.
