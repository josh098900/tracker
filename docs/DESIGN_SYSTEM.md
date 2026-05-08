# Design System

## Vibe
Editorial, calm, scholarly. This is a serious analytical tool but for students, not enterprises. Think *FT Alphaville* meets *Linear* — generous typography, considered colour, no neon gradients.

## Typography

### Display
**Instrument Serif** (Google Fonts) — for h1, hero text, balance score number.

### Body & UI
**Inter** (Google Fonts) — everything else.

### Mono
**JetBrains Mono** — for repo names, commit SHAs, file paths.

### Type scale (Tailwind classes)

| Element | Class |
|---|---|
| Hero | `font-serif text-6xl md:text-7xl tracking-tight` |
| h1 | `font-serif text-4xl tracking-tight` |
| h2 | `font-serif text-2xl` |
| h3 | `font-sans text-lg font-semibold` |
| Body | `font-sans text-base leading-relaxed` |
| Small | `font-sans text-sm text-muted-foreground` |
| Mono | `font-mono text-sm` |

Load fonts via `next/font/google` in `app/layout.tsx` and expose them as CSS variables (`--font-serif`, `--font-sans`, `--font-mono`).

## Colour

### Light mode (default)
```
--background:        #FAFAF7   /* warm off-white */
--foreground:        #0F0F0F
--surface:           #FFFFFF
--muted:             #F2F2EC
--muted-foreground:  #6B6B66
--border:            #E5E5E0
--primary:           #0F4C75   /* deep blue */
--primary-foreground:#FFFFFF
--accent:            #C97B5A   /* warm terracotta — used very sparingly, only for the balance score */
--destructive:       #B33A3A
--success:           #2F7D4F
```

### Dark mode (phase 4)
Inverted; defer until M4.

## Categorical chart palette (up to 10 contributors)

Curated for accessibility and distinguishability. Order is intentional — first colour goes to the contributor with the most commits, and so on. The same contributor uses the same colour across **every** chart.

```
1.  #4E79A7   blue
2.  #F28E2B   orange
3.  #59A14F   green
4.  #E15759   red
5.  #B07AA1   purple
6.  #76B7B2   teal
7.  #EDC948   yellow
8.  #FF9DA7   pink
9.  #9C755F   brown
10. #BAB0AC   grey
```

> If a repo has more than 10 contributors, group the smallest into an "Other" bucket. We are not making 14-colour palettes.

## Layout

### Spacing scale
Use Tailwind defaults. Page-level vertical rhythm: `py-16 md:py-24` between major sections.

### Container
- Dashboard: `max-w-6xl mx-auto px-6`.
- Landing page: `max-w-3xl mx-auto px-6` for narrative focus.

### Grid
The dashboard uses CSS Grid:
- 12-column at `lg:`.
- Charts take 6, 8, or 12 columns. No 4-column charts; they're too cramped.

### Cards
- Background: `--surface`.
- Border: `1px solid --border`.
- Radius: `rounded-2xl`.
- Padding: `p-6`.
- No drop shadows. Borders only.

## Components (shadcn/ui)

Use these primitives directly; do not rebuild them:
- `Button`, `Card`, `Tabs`, `Tooltip`, `Dialog`, `Skeleton`, `Toast`, `Input`, `Slider`.
- For the URL input: `Input` + custom validator state (red border + helper text on invalid).
- For the loading state: a custom progress strip, not the default `Progress` (we want SSE-driven smooth fill).

## Chart styling

### Universal rules
- No 3D, no chartjunk.
- Axes: `--border` colour, 1px stroke.
- Gridlines: `--muted` colour, 1px, dashed only on the y-axis.
- Tooltips: `--surface` background, `--border` 1px, `rounded-lg`, `text-sm`, `p-3`.
- Always include: title, x-axis label, y-axis label, source note (e.g. *"Excludes 12 lockfile changes"*).
- Animate on initial load only (300ms ease-out). No hover animations.

### Per-chart specifics

| Chart | Library | Notes |
|---|---|---|
| Contribution timeline | Recharts `AreaChart` (stacked) | x = ISO week; soft fills, no strokes between layers |
| Breakdown donut | Recharts `PieChart` | Inner radius 60%, labels outside |
| File ownership treemap | visx `Treemap` | Squarified; colour by primary owner; size by LOC |
| Fairness radar | Recharts `RadarChart` | One polygon per contributor, 0.2 fill opacity |
| Commit heatmap | visx `HeatmapRect` | 7 rows × 24 cols; sequential single-hue scale per contributor |
| Churn | Recharts `ComposedChart` | Bars (additions green, deletions red), line (net) |
| Co-authorship graph | visx + d3-force | Node size by PR count; edge weight by review count |
| Consistency timeline | Recharts `LineChart` | One line per contributor; small multiples preferred at >4 contributors |

## Voice & copy

- **Headers in Title Case.** Body in sentence case.
- **Numbers always rounded sensibly.** `38%` not `37.8421%`. `1.2K commits` not `1,247`.
- **No exclamation marks.** This is an analytical tool.
- **Active voice.** *"Sam authored 38% of commits"* not *"38% of commits were authored by Sam"*.
- **Hedging where honest.** *"This score reflects commit data only — see what we can't measure."*
- **UK English throughout.** *"analyse"*, not *"analyze"*. (The route stays `/api/analyze` because it's a code identifier; user-facing copy uses British spelling.)

## Iconography
Lucide (already bundled with shadcn). Use sparingly; never decoratively. Sizes: 16px in body, 20px in headers, 24px in hero.

## Accessibility floor
- WCAG AA contrast for all text-on-background pairs.
- Charts have text alternatives — every chart card includes a `<details>` with a textual summary.
- Keyboard navigable; focus rings visible.
- Don't rely on colour alone to encode contributor identity — pair colour with name labels and avatars wherever possible.
