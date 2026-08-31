# 🎨 Campus Genie — Design System & UI Specification

> **Master Design Document**: Comprehensive specification of tokens, typography, surfaces, spacing, shadows, animations, and component contracts derived from the **Beautiful UI** design system.

---

## 1. Core Philosophy & Aesthetic Principles

1. **Cool, Hairline-Governed Surfaces**:
   * Canvas uses subtle blue-tinted neutral shades (`--canvas`, `--page`).
   * Cards float on pure white (`#fff`) in light mode and deep charcoal (`oklch(0.26 0.006 271.191)`) in dark mode.
   * Hairline borders are crisp, solid lines (`--line`, `--line-strong`), not muddy alpha overlays.

2. **Layered Single-Digit-Opacity Shadows**:
   * Shadows combine a 1px solid hairline ring with smooth, multi-step blur stacks (`shadow-plugin`) for a physical, tactile feel.

3. **Semantic Condiments**:
   * Neutral ink carries 95% of the visual weight. Color (accent blue, sage green, ember orange, rose red) is used strictly as a high-signal condiment for status pips, active chips, and diff tags.

4. **AI-Native Primitives**:
   * First-class interfaces for thinking cycles, multi-step task execution, SQL query tool calls, character-by-character text streaming with soft blur tails, and human-in-the-loop approval gates.

---

## 2. Color Tokens (OKLCH Ramp)

All color tokens are declared in `app/globals.css` and mapped to Tailwind `@theme inline` variables.

### 2.1 Surfaces & Canvas
| Token | Light Mode (OKLCH) | Dark Mode (OKLCH) | Usage |
|---|---|---|---|
| `--page` | `0.985 0.001 286.376` | `0.209 0.004 264.477` | Main container / chat background |
| `--canvas` | `0.961 0.002 247.84` | `0.231 0.004 264.487` | Viewport outer background / shell |
| `--surface` | `1 0 0` (Pure White) | `0.26 0.006 271.191` | Cards, popovers, active panes |
| `--inset` | `0.979 0.002 247.839` | `0.243 0.004 264.492` | Subdued sections, table footers |
| `--hover` | `0.97 0.002 247.839` | `0.289 0.006 271.22` | Subtle hover state |
| `--hover-2` | `0.933 0.003 247.86` | `0.318 0.007 274.747` | Active selection, button hover |
| `--field` | `0.961 0.001 286.375` | `0.293 0.006 271.223` | Search fields, inputs, composer bg |
| `--stripe-bg` | `0.97 0 0` | `0.226 0.004 264.485` | Background diagonal texture tint |
| `--stripe` | `0.405 0 0 / 0.075` | `1 0 0 / 0.055` | 45-degree fixed hatch lines |

### 2.2 Neutral Ink Ramp
| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--ink` | `oklch(0.247 0.006 258.361)` | `oklch(0.964 0.002 247.839)` | Primary text, titles, prominent icons |
| `--ink-2` | `oklch(0.506 0.01 264.477)` | `oklch(0.731 0.008 260.731)` | Secondary text, labels, inactive tabs |
| `--ink-3` | `oklch(0.695 0.009 264.505)` | `oklch(0.541 0.01 264.484)` | Tertiary captions, counts, shortcuts |

### 2.3 Borders
| Token | Light Mode | Dark Mode | Description |
|---|---|---|---|
| `--line` | `oklch(0.946 0.003 264.542)` | `oklch(0.308 0.006 258.354)` | Standard panel & card borders |
| `--line-strong` | `oklch(0.912 0.005 258.326)` | `oklch(0.356 0.007 264.474)` | Focused controls, buttons, tooltips |
| `--line-soft` | `oklch(0.966 0.002 264.542)` | `oklch(0.278 0.006 258.354)` | Internal dividers, subtle lines |
| `--grid-line` | `color-mix(var(--line) 78%, transparent)` | `...` | Flowchart grid dots/lines |

### 2.4 Accent & Semantic Colors
| Semantics | Base Color (`--color`) | Ink Variant (`--ink`) | Tint / Background (`--tint`) |
|---|---|---|---|
| **Accent (Blue)** | `oklch(0.626 0.205 254.947)` | `oklch(0.556 0.187 255.617)` | `oklch(0.96 0.019 252.878)` |
| **Success (Green)**| `oklch(0.603 0.155 150.883)` | `...` | `oklch(0.958 0.017 159.118)` |
| **Warning (Orange)**| `oklch(0.689 0.179 49.902)` | `...` | `oklch(0.964 0.021 67.581)` |
| **Danger (Red)** | `oklch(0.621 0.192 23.042)` | `...` | `oklch(0.956 0.017 17.462)` |

---

## 3. Typography & Text Hierarchy

* **Primary Font**: `Inter` (`--font-sans`, `--font-inter`)
* **Monospace Font**: `JetBrains Mono` (`--font-mono`, `--font-mono-face`)
* **Feature Settings**: `font-feature-settings: "cv11", "ss01"` (tight figures, curved r/l, clean lowercase)
* **Base Letter Spacing**: `-0.01em`
* **Numeric Typography**: Always use `font-variant-numeric: tabular-nums` for dates, metrics, percentages, and table records.

### Text Scale & Styling Matrix
| Role | Size | Weight | Tracking | Class / Token |
|---|---|---|---|---|
| **Display Title** | 18px - 20px | 600 (`font-semibold`) | `-0.02em` | `text-[18px] font-semibold text-ink` |
| **Section Header**| 14px - 15px | 600 (`font-semibold`) | `-0.01em` | `text-[14px] font-semibold text-ink` |
| **Chat Message** | 14px | 400 (`font-normal`) | `-0.01em` | `text-[14px] leading-relaxed text-ink` |
| **Controls / Nav** | 13.5px - 14px | 500 (`font-medium`) | `-0.01em` | `text-[13.5px] font-medium text-ink-2` |
| **Label / Meta** | 12.5px - 13px | 500 (`font-medium`) | `normal` | `text-[12.5px] font-medium text-ink-2` |
| **Captions / Counts** | 11px - 11.5px | 500 (`font-medium`) | `normal` | `text-[11.5px] text-ink-3 tabular-nums` |
| **Code / SQL** | 12px - 13px | 400 (`font-normal`) | `normal` | `font-mono text-[12.5px] leading-normal` |

---

## 4. Radii & Geometry Tokens

Strict hierarchical corner radiuses guarantee cohesive geometry across nesting:
* **Chips & Badges**: `6px` (`--radius-chip` / `rounded-[6px]`)
* **Controls & Buttons**: `8px` (`--radius-control` / `rounded-[8px]`)
* **Cards & Embedded Blocks**: `10px` (`--radius-card` / `rounded-[10px]`)
* **Windows & Top-Level Shells**: `14px` (`--radius-window` / `rounded-[14px]`)
* **Pills & Status Rings**: `9999px` (`rounded-full`)

---

## 5. Shadows & Elevation

Each shadow pairs an exact 1px hairline border ring with smooth optical diffusion:
* `--shadow-hairline`: `0 0 0 1px var(--line)`
* `--shadow-btn`: `0 0 0 1px var(--line-strong), var(--shadow-xs)`
* `--shadow-card`: `0 0 0 1px var(--line), var(--shadow-sm)`
* `--shadow-raised`: `0 0 0 1px var(--line), var(--shadow-md)`
* `--shadow-overlay`: `0 0 0 1px var(--line), var(--shadow-lg)`
* `--shadow-inset-field`: `inset 0 1px 2px oklch(0 0 0 / 0.12)`

---

## 6. Layout Grid & Spatial Rhythm

* **Outer App Shell**: `p-2.5` padding around the entire viewport `h-[100dvh]` with `gap-2.5` (10px) between sidebar, active view, and side drawers.
* **Top Navigation / Tab Bar**: Fixed `h-10` (40px) or `h-11` (44px), `border-b border-line px-3.5 flex items-center justify-between`.
* **Sidebar**: Animated collapse between `52px` (rail) and `224px` (expanded) with smooth `280ms cubic-bezier(0.16, 1, 0.3, 1)` transition.
* **Side Drawers / Inspector Panes**: Docked `w-[360px]` or `w-[400px]` rounded containers with `border border-line bg-page`.
* **Chat Prompt Composer**: Centered `max-w-[720px]` floating prompt bar with expandable menus and shader sweep animation.

---

## 7. Motion & Easing Curves

```css
--ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
--ease-link: cubic-bezier(0.16, 1, 0.3, 1);
```

* **Pop-in Transition**: `pop-in 180ms cubic-bezier(0.23,1,0.32,1) both`
* **Fade-in Transition**: `fade-in 300ms ease both`
* **Streaming Text Caret**:
  ```css
  .stream-caret {
    animation: caret-blink 1s step-end infinite;
  }
  .stream-tail {
    filter: blur(1.6px);
    mask-image: linear-gradient(to right, oklch(0 0 0) 20%, oklch(0 0 0 / 0.2));
  }
  ```

---

## 8. Complete Component Registry & Architecture

Every component from the Beautiful UI registry is integrated and available:

### 🧩 Atoms (`src/components/atoms/`)
1. `Button.tsx`: Hairline outline, subtle solid, primary dark, ghost, and icon button variants.
2. `Chip.tsx`: Interactive micro-tags with counts and delete triggers.
3. `EntityChip.tsx`: Avatar + label compact entity representation.
4. `ProgressRing.tsx`: Circular SVG animated task completion indicators.
5. `SegmentedControl.tsx`: Sliding pill animated multi-option switcher.
6. `Shimmer.tsx`: Smooth gradient loading placeholders.
7. `StatusPill.tsx`: Color-coded semantic state badges (Active, In-Progress, Approved, Pending).
8. `StreamText.tsx`: Live character-revealing text with blur tail and blinking cursor.
9. `Switch.tsx`: Accessible boolean toggle controls.
10. `TextRow.tsx`: High-density key-value pair rows with meta labels.
11. `ValuePill.tsx`: Numeric and metric trend badges with delta indicators.

### 🏛️ Primitives (`src/components/primitives/`)
1. `ApprovalCard.tsx`: Human-in-the-loop action card with accept/reject/modify states.
2. `ChatComposer.tsx`: Multi-modal chat input with model selector and attachment drawer.
3. `CodeBlock.tsx`: Syntax highlighted code viewer with line numbers, copy button, and SQL tabs.
4. `ContextCards.tsx`: Expandable contextual knowledge reference cards.
5. `DiffTable.tsx`: Side-by-side or inline data comparison before/after changes.
6. `FilterTable.tsx`: Quick query builder and column filter pills.
7. `FineTuneCard.tsx`: Parameter adjustment card with interactive sliders and weights.
8. `Flowchart.tsx`: SVG node graph rendering multi-step agent reasoning DAGs.
9. `GlideMenu.tsx`: Fluid sliding-highlight menu system with hover tracking.
10. `InsightCards.tsx`: Metric summary cards with live sparkline charts (`liveline`).
11. `LoadingState.tsx`: Pixel-grid and equalizer animated loading indicators.
12. `PromptBar.tsx`: Hero input bar with Glimm shader sweeps, attachment trigger, and preset chips.
13. `RecommendationCard.tsx`: Curated event/club recommendation cards with match percentage.
14. `RecordsTable.tsx`: Full-featured Lakehouse data grid with column math, filtering, and sorting.
15. `SearchList.tsx`: Fast keyboard-navigable command search list.
16. `SelectionActions.tsx`: Floating action toolbar triggered when rows/entities are selected.
17. `SidebarNav.tsx`: Collapsible workspace and chat history navigation rail.
18. `StreamingText.tsx`: Multi-paragraph streaming markdown text renderer with token stream.
19. `TaskRows.tsx`: Step-by-step agent execution plan with real-time status indicators.
20. `ThinkingState.tsx`: Collapsible accordion displaying agent inner thoughts and reasoning chains.
21. `ToolChips.tsx`: Expandable badges showing Databricks SQL execution, Unity Catalog lookups, and API calls.

---

## 9. Design Rules Checklist for Campus Genie

- [x] **No standard Bootstrap/Chakra/Next.js default blue styles**: Strict adherence to OKLCH tokens and hairline borders.
- [x] **Zero Layout Shifts**: Heights and widths are pinned with tabular numbers and CSS transitions.
- [x] **Tabular Numeric Consistency**: All counts, dates, prices, timestamps, and metrics use `tabular-nums`.
- [x] **Accessible Contrast**: Contrast validated for both Light and Dark mode variations.
- [x] **Interaction Polish**: Active state feedback with micro-scaling (`active:scale-[0.98]`).
