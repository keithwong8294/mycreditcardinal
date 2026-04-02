# MyCreditCardinal — Design System

> Claude Code: read this file for all visual/styling decisions.
> To change the look and feel, the founder edits this file and says "refactor to match updated DESIGN.md."

## Design philosophy

Clean, professional fintech dashboard. Dark sidebar for navigation, light content area for data. White cards on a light gray background. Green accents for positive values, active states, and CTAs. Approachable and information-dense without being intimidating.

## Brand

- **Name:** MyCreditCardinal
- **Logo text:** "MyCreditCardinal" in white (inside the dark sidebar)
- **Tagline:** "Stop leaving rewards on the table." (shown below logo in sidebar)
- Green accent (`#059669`) for "Cardinal" if the logo appears on a light background

## Layout

### Desktop (≥ 768px)
- Fixed left sidebar: 220px wide, `bg-[#0f1219]`, full viewport height
- Content area: fills remaining width (`md:ml-[220px]`), `bg-surface` (`#f8f9fb`)
- White (`bg-white`) shadcn Cards sit on top of the surface background

### Mobile (< 768px)
- Fixed top header: 56px (`h-14`), same dark `bg-[#0f1219]`, hamburger + logo
- Sidebar hidden by default; slides in from left as an overlay with black/50 backdrop
- Content area: `pt-14` to clear the fixed header, `bg-surface`

## Colors (Tailwind CSS custom theme)

```
// globals.css @theme block:
surface:  '#f8f9fb'   // page / content area background
elevated: '#ffffff'   // white cards, modals, raised surfaces
field:    '#f1f5f9'   // input fields
hover:    '#e2e8f0'   // hover states

subtle:  rgb(0 0 0 / 0.07)   // default borders (light)
medium:  rgb(0 0 0 / 0.13)   // hover/focus borders
strong:  rgb(0 0 0 / 0.22)   // active/selected borders

primary:   '#1a1a2e'   // main text (dark)
secondary: '#64748b'   // labels, descriptions
tertiary:  '#94a3b8'   // hints, placeholders

green:  '#059669'   // positive values, active nav, CTAs
blue:   '#2563eb'   // links, info
amber:  '#d97706'   // warnings, caps hit
red:    '#dc2626'   // negative values, delete
purple: '#7c3aed'   // rotating / custom-select special features
gold:   '#c9a84c'   // premium feel
pink:   '#db2777'   // Bilt currency
```

### Sidebar-specific (hardcoded, not tokens)
- Background: `#0f1219`
- Nav active: `bg-[#059669] text-white`
- Nav inactive: `text-white/50 hover:text-white hover:bg-white/5`
- Person active: `bg-[#059669]/15 text-[#34d399]`
- Person inactive: `text-white/45 hover:text-white/60`
- Borders/dividers: `border-white/5`
- Logo: `text-white`
- Tagline: `text-white/35`
- Section labels: `text-white/30`

## Typography

- **Font:** Outfit (Google Fonts) — weights 300, 400, 500, 600, loaded as `--font-sans`

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Logo (sidebar) | 17px | 600 | white |
| Nav items (sidebar) | 13px | 500 | white/50 inactive, white active |
| Section header (content) | 14px | 600 | text-secondary, uppercase, tracking-wider |
| Card name | 13-14px | 500 | text-primary |
| Body text | 13px | 400 | text-primary |
| Labels / descriptions | 11-12px | 400 | text-secondary |
| Badges / pills | 10-11px | 500 | varies |
| Metric numbers (big) | 22-28px | 600 | text-green (positive) or text-red (negative) |
| Table headers | 10px | 600 | text-tertiary, uppercase |
| Input text | 12-13px | 400 | text-primary |

## Spacing

- Component padding: `p-3` or `p-4`
- Section gaps: `space-y-5`
- Grid gaps: `gap-2` (card grids), `gap-3` (metric grids)
- Border radius: `rounded-lg` for cards, `rounded-full` for pills
- Content area page padding: `p-6`

## shadcn/ui

Use shadcn components (Button, Card, Select, Tabs, Slider, Dialog, Badge, Checkbox) from `components/ui/`. All use default light theme styling. Apply our tokens (`text-green`, `text-red`, `text-primary`, etc.) on content inside shadcn components, not on the shadcn components themselves — except for green CTAs: `className="bg-green hover:bg-green/90 text-white"`.

## Components

### Sidebar nav item
- Container: `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium`
- Active: `bg-[#059669] text-white`
- Inactive: `text-white/50 hover:text-white hover:bg-white/5`
- Icon: text symbol (14px), 16px fixed width, centered

### Person chip (sidebar)
- Active: `bg-[#059669]/15 text-[#34d399]`, `rounded-lg px-3 py-1.5 text-[12px]`
- Inactive: `text-white/45 hover:text-white/60`
- Add button: `text-white/30 hover:text-white/60`

### Card tile (browser grid)
- Container: shadcn `<Card>`, `bg-white border-subtle rounded-lg overflow-hidden`
- Face: 80px tall, CSS dark gradient (represents physical card colors), flex column justify-end
- Face content: issuer (9px uppercase, white/60%), card name (13px, white/95%)
- Body: `p-2.5`
- Earn pills: shadcn `<Badge>` — highlight: `bg-green/10 text-green`; default: `bg-surface text-secondary border border-subtle`
- In-wallet badge: `absolute top-1.5 right-1.5 bg-green text-white rounded-full text-[10px] font-semibold px-1.5`
- In-wallet border: `ring-1 ring-green border-green`

### Wallet card row
- Container: shadcn `<Card>`, `p-3 flex items-center gap-3`
- Card face mini: 48×30px, `rounded`, dark gradient
- Name: `text-[13px] font-medium text-primary truncate`
- Sub text: `text-[11px] text-secondary`
- Remove: shadcn `<Button variant="ghost" size="sm">`, `text-red hover:text-red`

### Routing table
- Wrapper: `border border-subtle rounded-lg overflow-hidden`
- Header: `bg-surface border-b border-subtle text-[10px] uppercase text-tertiary tracking-wider`
- Rows: `border-b border-subtle hover:bg-surface`
- Slider: shadcn `<Slider>`; Select: shadcn `<Select>`
- Spend input: `w-[54px] bg-field border border-subtle rounded-md text-right text-[12px]`

### Metric cards
- Container: shadcn `<Card>`, `p-4 text-center`
- Label: `text-[11px] text-secondary mb-1`
- Value: `text-[22px] font-semibold text-green` (positive) or `text-red` (negative)
- Subtitle: `text-[10px] text-tertiary mt-0.5`

### Buttons
- Primary CTA: `bg-green hover:bg-green/90 text-white` on shadcn `<Button>`
- Default: shadcn `variant="default"`
- Outline: shadcn `variant="outline"`
- Ghost: shadcn `variant="ghost"`
- Danger: shadcn `variant="destructive"`

### Forms
- Label: `text-[11px] font-medium text-secondary mb-1`
- Inputs: shadcn components
- Two-column: `grid grid-cols-2 gap-2`

## Animations

- Color/border transitions: `transition-colors duration-150`
- Sidebar mobile slide: `transition-transform duration-200 ease-in-out`
- shadcn handles its own animation

## Responsive

- Mobile < 768px: top bar + sidebar overlay
- Tablet 768-1024px: sidebar visible, content adjusts
- Desktop > 1024px: full sidebar + content layout

## Card face gradients

Credit card face previews use **dark** CSS gradients representing the physical card color. These are the only place dark/rich color gradients appear. All other UI surfaces are light.

## Do NOT use

- Dark backgrounds in the content area
- Drop shadows (use `border border-subtle` for elevation)
- Blur/glass effects
- Gradients on UI surfaces (only card face previews)
- Border radius > `rounded-lg` except `rounded-full` for pills
- Custom replacements for shadcn components that already exist
- Pulsing skeleton loaders (use static gray placeholders)
