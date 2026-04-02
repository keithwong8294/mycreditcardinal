# MyCreditCardinal — Design System

> Claude Code: read this file for all visual/styling decisions.
> To change the look and feel, the founder edits this file and says "refactor to match updated DESIGN.md."

## Design philosophy

Dark, refined, financial-tool aesthetic. Think Bloomberg Terminal meets modern fintech — information-dense but clean. No playfulness, no rounded bubbly shapes, no pastel colors. Sharp, confident, data-forward.

## Brand

- **Name:** MyCreditCardinal
- **Logo text:** "MyCreditCardinal" — "My" in regular weight, "Credit" in regular, "Cardinal" in accent green
- **Tagline:** "Stop leaving rewards on the table."

## Colors (Tailwind CSS custom theme)

```
// tailwind.config.ts extend.colors:
bg: {
  primary: '#08080e',     // page background
  surface: '#0d0e16',     // card/component background
  elevated: '#13141f',    // raised surfaces, modals
  input: '#1a1c2a',       // input fields, dropdowns
  hover: '#232538',       // hover states
},
border: {
  subtle: 'rgba(255,255,255,0.07)',   // default borders
  medium: 'rgba(255,255,255,0.13)',   // hover/focus borders
  strong: 'rgba(255,255,255,0.22)',   // active/selected borders
},
text: {
  primary: '#e4e6f2',     // main text
  secondary: '#8288a6',   // labels, descriptions
  tertiary: '#4d5270',    // hints, placeholders
},
accent: {
  green: '#5ce0a0',       // positive values, CTAs, active states
  blue: '#6db3f2',        // links, info badges, Tiff's cards
  amber: '#f0a050',       // warnings, caps hit
  red: '#f06070',         // negative values, delete actions
  purple: '#a78bfa',      // special features (rotating categories, custom select)
  gold: '#c9a84c',        // Keith's cards, premium feel
  pink: '#e879f9',        // Bilt currency color
},
currency: {
  chase_ur: '#6fcf97',
  amex_mr: '#a78bfa',
  cap1: '#c9a84c',
  citi_typ: '#6db3f2',
  bilt: '#e879f9',
  cash: '#94a3b8',
  discover: '#f0a050',
  wf: '#f06070',
}
```

## Typography

- **Font:** Outfit (Google Fonts) — weights 300, 400, 500, 600
- **Load:** `@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap')`

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page title / logo | 20px | 600 | white |
| Section header (h2) | 14px | 600 | text-secondary, uppercase, letter-spacing 0.1em |
| Card name | 13-14px | 500 | text-primary |
| Body text | 13px | 400 | text-primary |
| Labels / descriptions | 11-12px | 400 | text-secondary |
| Badges / pills | 10-11px | 500 | varies by context |
| Metric numbers (big) | 22-28px | 600 | accent-green (positive) or accent-red (negative) |
| Table headers | 10px | 600 | text-tertiary, uppercase, letter-spacing 0.06em |
| Input text | 12-13px | 400 | text-primary |

## Spacing scale

Use Tailwind defaults. Key values:
- Component padding: `p-3` (12px) or `p-4` (16px)
- Card internal padding: `p-3` (compact cards) or `p-4` (detailed cards)
- Section gaps: `space-y-5` (20px) between major sections
- Grid gaps: `gap-2` (8px) for card grids, `gap-3` (12px) for metric grids
- Border radius: `rounded-lg` (8px) for cards, `rounded-full` for pills/badges

## Components

### Card tile (in browser grid)
- Container: bg-surface, border border-subtle, rounded-lg, overflow-hidden
- Face: 80px tall, CSS gradient background from card's color array, flex column justify-end
- Face content: issuer (9px uppercase, white/40%) and card name (13px, white/95%)
- Body: bg-surface, p-2.5
- Earn pills: rounded-full, text-[10px], px-1.5 py-0.5
  - Highlight: bg-green/10, text-green (for above-default rates)
  - Default: bg-white/5, text-secondary
- In-wallet badge: absolute top-1.5 right-1.5, bg-green, text-black, rounded-full, font-semibold
- In-wallet border: border-green, ring-1 ring-green

### Wallet card row
- Container: bg-surface, border border-subtle, rounded-lg, p-3, flex items-center gap-3
- Card face mini: 48x30px, rounded, gradient background
- Name: 13px font-medium, truncate
- Sub text: 11px text-secondary (issuer · fee · currency)
- Remove button: text-red, bg-red/8, rounded-md, px-2 py-1

### Routing table
- Container: border border-subtle, rounded-lg, overflow-hidden
- Header row: bg-elevated, border-b, 10px uppercase text-tertiary
- Data rows: border-b border-white/3, hover:bg-white/[0.015]
- Grid columns: [category 110px] [slider+input 1fr] [card dropdown 140px] [rate 40px] [value 60px]
- Slider: 3px track (text-tertiary bg), 12px round thumb (text-primary)
- Text input: 54px wide, bg-input, border-subtle, rounded-md, text-right

### Metric cards
- Container: bg-elevated, rounded-lg, p-3.5, text-center
- Label: 11px text-secondary, mb-1
- Value: 22px font-semibold (green for positive, red for negative)
- Subtitle: 10px text-tertiary, mt-0.5

### Buttons
- Default: bg-elevated, border border-medium, text-primary, rounded-lg, px-3.5 py-1.5, text-[12px]
- Primary: bg-green, text-black, border-green, font-medium
- Danger: text-red, bg-red/8
- Pill toggle: rounded-full, same as default but when active: bg-input, text-primary, border-green

### Tab bar
- Container: border-b border-subtle, flex, overflow-x-auto
- Tab: px-4 py-2.5, text-[13px] font-medium, text-secondary
- Active: text-primary, border-b-2 border-green

### Person chip bar
- Chip: rounded-full, px-3 py-1, text-[12px], border border-medium, text-secondary
- Active: bg-input, text-primary, border-green
- Add button: border-dashed, text-tertiary

### Quarterly rotation grid
- 4-column grid
- Each: label (10px text-tertiary, centered) + select (bg-elevated, border-subtle, rounded-md, centered text)

### Forms
- Label: 11px font-medium text-secondary, mb-1
- Input/select: w-full bg-elevated border-subtle rounded-md text-[13px] px-2.5 py-2
- Focus: border-blue, outline-none
- Two-column layouts: grid grid-cols-2 gap-2

## Animations

Minimal. No decorative animations. Only functional transitions:
- Border color changes: transition-colors duration-150
- Opacity changes (hover, inactive states): transition-opacity duration-150
- Card tile hover: border-medium (subtle highlight)
- Tab underline: no transition needed (instant swap)

## Responsive breakpoints

- Mobile: < 640px — single column everything, smaller grid columns in routing table
- Tablet: 640-920px — 2-column card grid, adjusted routing columns
- Desktop: > 920px — 3-column card grid, full routing table

## Dark mode

The entire app is dark mode only. No light mode toggle. This simplifies the design system and matches the financial-tool aesthetic.

## Accessibility

- All interactive elements must have visible focus states (ring-1 ring-blue)
- Minimum contrast: text-primary on bg-primary passes WCAG AA
- All images/icons need alt text
- Tab navigation must work through all interactive elements
- Slider + text input pairs: both control the same value for different input preferences

## Do NOT use

- Gradients on UI elements (only on card faces)
- Drop shadows
- Blur/glass effects
- Border radius larger than rounded-lg (except pills which use rounded-full)
- White or light backgrounds anywhere
- Emoji in UI (only in data display where categories might use them)
- Animation on page load
- Skeleton loaders that pulse/animate (use static gray placeholders)
