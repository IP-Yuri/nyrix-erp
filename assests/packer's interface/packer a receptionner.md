---
name: Logistics & Enterprise Finance Precision
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#747686'
  outline-variant: '#c4c5d7'
  surface-tint: '#2151da'
  primary: '#0037b0'
  on-primary: '#ffffff'
  primary-container: '#1d4ed8'
  on-primary-container: '#cad3ff'
  inverse-primary: '#b7c4ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#623c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#825100'
  on-tertiary-container: '#ffcb8f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b7c4ff'
  on-primary-fixed: '#001551'
  on-primary-fixed-variant: '#0039b5'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  metric-lg:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.03em
  metric-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  tabular-data:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: -0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.75rem
  margin: 1.5rem
  margin-compact: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system targets logistics operators, supply chain directors, and financial controllers who demand density, immediate data legibility, and zero friction in high-stakes environments. The brand personality is authoritative, systematic, and surgically precise. It balances architectural stability with rapid data ingestion, evoking composure under operational load.

The visual aesthetic unites Modern Corporate SaaS with Ant Design’s spatial discipline. It avoids decorative ornament, relying on clean planar division, high-contrast numeric values, deliberate spatial compression, and crisp boundary definition. The interface serves as a high-performance instrument panel where status, variance, and systemic throughput are surfaced with structural clarity.

## Colors

The color system establishes functional stratification between operational status, navigation hierarchy, and numeric density:

- **Canvas & Surface Tiering**: The global canvas uses a cool neutral `#F8FAFC`, transitioning to `#F1F5F9` for secondary groupings and utility rails. Work surfaces, operational tables, and analytic cards sit on pure `#FFFFFF` to ensure optical separation.
- **Brand & Interaction**: Primary actions, active navigation states, and selected operational paths use Royal Blue (`#1D4ED8`), providing high-contrast focus without visual fatigue. Hover states shift to `#1E40AF`, and subdued fills sit at `#EFF6FF`.
- **Semantic Accents**:
  - **Success / Positive Delta**: Emerald Green (`#10B981`) paired with light mint wash (`#ECFDF5`) for inward remittances, completed consignments, and surplus metrics.
  - **Warning / In-Transit Variance**: Amber (`#F59E0B`) with `#FFFBEB` for customs holds, delayed dispatches, or pending approvals.
  - **Critical / Negative Variance**: Crimson (`#EF4444`) with `#FEF2F2` for balance shortfalls, carrier rejections, and SLA breaches.
- **Text & Structure**: Structural borders use precise hairline tones (`#E2E8F0` and `#CBD5E1`). Primary headers and KPIs utilize deep slate navy (`#0F172A`), structural body content uses `#334155`, and supporting metadata utilizes `#64748B`.

## Typography

Typography prioritizes legibility, tight vertical alignment, and structured numerical tabular scanning:

- **Primary Interface**: Inter serves as the foundation for headings, structural controls, and general dashboard labels. Its neutral geometry remains legible at compact sizes without distortion.
- **Numerical & Tabular Metrics**: Geist handles currency amounts, freight weights, exchange rates, and ledger figures. It defaults to monospaced tabular figures (`tnum`, `zero`) to ensure financial columns and shipping manifests align vertically down the decimal.
- **Hierarchy Rules**: Metric cards prioritize size and weight over decorative styling. Labels immediately above metrics appear in muted slate uppercase (`label-sm`). Table cells apply `tabular-data` for figures and `body-sm` for accompanying descriptive strings.

## Layout & Spacing

The layout is built upon a 12-column responsive fluid grid with enterprise-grade information density:

- **Desktop (1280px and above)**: Full-width fluid workspace with a persistent collapsible 240px navigation rail. Default gutter is set to `1rem` (16px) with canvas margins of `1.5rem` (24px). Analytical and ledger views can switch to `gutter-dense` (12px) to maximize horizontal data exposure without clipping columns.
- **Tablet (768px - 1279px)**: Navigation collapses into an icon dock (64px). Metrics panels reflow from 4-column cards into 2x2 grids; tables introduce horizontal scroll boundaries with sticky column locks for identifiers.
- **Mobile (Below 768px)**: Canvas margins step down to `1rem` (16px). Complex multi-column tables transition to vertical master-detail card representations. Operational KPIs display as horizontally scrollable strips.
- **Density Principles**: Component internal padding balances compact vertical bounds with comfortable horizontal breathing room (e.g., standard table cell vertical padding is strictly 8px to 10px, horizontal 12px to 16px).

## Elevation & Depth

This design system avoids heavy shadows, floating blurs, and skeuomorphic gradients. Elevation is achieved through **low-contrast outlines, tonal contrast, and subtle ambient drop**:

- **Card & Container Tiering**: Baseline surfaces (`#FFFFFF`) do not rely on drop shadows for separation against `#F8FAFC`. Instead, they employ a crisp 1px border (`#E2E8F0`).
- **Resting Elevation**: Flat surfaces sit at zero elevation with a 1px border. Hovering on interactive rows or clickable card surfaces shifts the border to `#CBD5E1` and introduces an ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Flyout Drawers & Modals**: Used for shipment tracking side-sheets and transaction detail panels. Styled with `#FFFFFF`, bordered by `#E2E8F0`, and cast with an authoritative enterprise shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03)`.
- **Layered Data Tables**: Fixed table headers and sticky summary footers apply a solid white background with a crisp bottom border (`#E2E8F0`) rather than drop shadows to maintain clean grid lines during high-velocity scrolling.

## Shapes

The geometric framework follows a compact, soft curvature profile (Roundedness `1`):

- **Interactive Controls & Inputs**: Form fields, select triggers, search bars, and primary buttons use `0.25rem` (4px) corner radiuses. This provides clean corner definitions that fit tightly together in dense toolbars and inline editing grids.
- **Cards & Data Tables**: Outer table wrappers, analytic metric panels, and dashboard containers use `0.5rem` (8px, `rounded-lg`). Inner table rows retain sharp `0px` boundaries to uphold seamless horizontal zebra striping and column delineation.
- **Status Tags & Micro Badges**: Status indicators and pill badges utilize `0.25rem` (4px) or fully rounded pill configurations depending on density, maintaining a compact footprint that does not displace numerical data.

## Components

- **Buttons**:
  - *Primary*: Solid `#1D4ED8` background, `#FFFFFF` text, `0.25rem` radius, 32px height for enterprise forms, 36px for global actions. Hover: `#1E40AF`.
  - *Secondary / Outline*: White background, 1px `#E2E8F0` border, `#334155` text. Hover: `#F8FAFC` background, `#0F172A` text, `#CBD5E1` border.
  - *Dense Table Actions*: 28px height, 8px horizontal padding, subtle icon-only or text buttons.

- **Data Tables (Grid)**:
  - *Header*: 36px height, `#F8FAFC` background, uppercase `11px` label in `#64748B`, bottom hairline border `#CBD5E1`.
  - *Rows*: 40px standard height (32px dense mode), `#FFFFFF` resting, `#F8FAFC` on hover. Selected rows feature a 2px left border accent in `#1D4ED8` and `#EFF6FF` tint.
  - *Numeric Columns*: Right-aligned, formatted with `tabular-data` token.

- **Metric & KPI Cards**:
  - Pure `#FFFFFF` surface, 1px `#E2E8F0` border, internal padding `space-lg` (20px). Contains uppercase metadata label (`label-sm`), prominent figure (`metric-lg`), and an inline status chip indicating percentage variance with directional vector arrows.

- **Status Chips & Badges**:
  - 20px height, compact font size (`11px`, weight 600).
  - *Delivered / Paid*: `#ECFDF5` background, `#065F46` text, `#A7F3D0` subtle border.
  - *In-Transit / Pending*: `#EFF6FF` background, `#1E40AF` text, `#BFDBFE` subtle border.
  - *Delayed / Exception*: `#FEF2F2` background, `#991B1B` text, `#FECACA` subtle border.

- **Input Fields & Selectors**:
  - 32px standard height, `#FFFFFF` background, 1px `#CBD5E1` border, `#0F172A` text, 8px horizontal padding.
  - Focus state: 1px `#1D4ED8` border accompanied by an exact `0 0 0 1px #1D4ED8` outer ring. Error state: `#EF4444` border and outline ring.

- **Checkboxes & Radios**:
  - 14px x 14px footprint with `2px` radius for checkboxes; full circle for radios. Off state: 1px `#CBD5E1` border on white. Checked state: solid `#1D4ED8` with a crisp white tick.

- **Split-Pane Detail Drawers**:
  - Slides from right edge over canvas with a persistent 480px width, clean header with cross-reference ID (e.g., `BOL-90214`), tabbed audit logs, and actionable balance overrides.