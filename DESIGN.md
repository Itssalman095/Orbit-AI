# DESIGN.md: x.ai/bot (Grok Bot landing page)

## Source
- URL: https://x.ai/bot
- Capture date: 2026-10-11
- Evidence: Firecrawl scrape (`branding` + `images`, scrapeId `01a12b18-9471-727b-a19e-c76491acd40d`), page markdown, plus the page's own minified stylesheets (8 CSS chunks, incl. `2c36252obglji.css` globals and `3cmwpn-z8xem4.css` theme layer) and rendered button markup. Full-page screenshot capture returned only text content (JS-heavy page), so no image artifact — tokens below are from source CSS, not visual estimation.
- Confidence: exact values quoted from source CSS; hex values marked "≈" are converted from the site's HSL triplets.

## Design Summary
A near-monochrome, high-contrast "product-grade" marketing page: white (light) / near-black (dark) surfaces, near-black pill CTAs, one vivid orange accent (`--color-sunset`), a custom variable sans (`xVf`) with Geist Mono for code, and an embedded Grok Bot app mock whose UI has its own finer-grained palette (Apple-ish blues, hairline 0.5px borders, glass blur layers).

## Design Tokens

### Colors — base system (shadcn-style HSL triplets, applied as `hsl(var(--x))`)

Named palette (exact, from `:root` in globals CSS):

| Token | HSL (exact) | Hex (≈) |
|---|---|---|
| `--color-jet` | `0 0% 4%` | `#0a0a0a` |
| `--color-charcoal` | `0 0% 10%` | `#1a1a1a` |
| `--color-umbra` | `221 12% 14%` | `#1f2228` |
| `--color-ink` | `213 11% 16%` | `#24282d` |
| `--color-ash` | `216 5% 19` *(sic, no `%` in source)* | `#2e3133` |
| `--color-steel` | `216 4% 22%` | `#36393a` |
| `--color-fog` | `216 4% 51%` | `#7d8387` |
| `--color-pewter` | `213 12% 70%` | `#a9b2bc` |
| `--color-dove` | `222 19% 86%` | `#d5d9e2` |
| `--color-nimbus` | `228 21.74% 95.49%` | `#f1f2f6` |
| `--color-ivory` | `40 18% 97%` | `#f9f8f6` |
| `--color-white` | `0 0% 100%` | `#ffffff` |
| `--color-midnight` | `214 58.3% 9.4%` | `#0a1626` |
| `--color-evenfall` | `214 16.1% 28%` | `#3c4653` |
| `--color-breeze` | `214 48.9% 73.9%` | `#9cb8dd` |
| `--color-dawn` | `37 100% 76%` | `#ffd085` |
| `--color-sunset` | `22 100% 51.6%` | `#ff6308` |
| `--color-dusk` | `263 70% 50.4%` | `#6c28d9` |
| `--color-twilight` | `255 92% 76%` | `#de8afa` |
| `--color-codeblock` | `0 0% 7%` | `#121212` |

Semantic mapping — Light (`:root`):

| Role | Value (exact) |
|---|---|
| `--primary` / `--foreground` | `var(--color-jet)` → `#0a0a0a` |
| `--primary-hover` / `--foreground-hover` | `var(--color-umbra)` → `#1f2228` |
| `--secondary` | `var(--color-fog)` → `#7d8387` |
| `--secondary-hover` | `var(--color-pewter)` |
| `--accent` / `--accent-hover` | `var(--color-sunset)` / `var(--color-dawn)` |
| `--background` | `var(--color-white)` → `#ffffff` |
| `--background-hover` | `var(--color-dove)` |
| `--card` | `var(--color-ivory)` → `#f9f8f6` |
| `--border` | `var(--color-dove)` → `#d5d9e2` |
| `--input` | `var(--color-white)` |
| `--success` / `--warning` / `--error` / `--info` | `142 71% 45%` / `45 93% 47%` / `0 84% 60%` / `breeze` |
| `--radius` | `.5rem` (8px) |

Semantic mapping — Dark (`.dark`):

| Role | Value (exact) |
|---|---|
| `--primary` / `--primary-hover` | `white` / `ivory` |
| `--background` / `--background-hover` | `jet` (#0a0a0a) / `umbra` |
| `--foreground` / `--foreground-hover` | `dove` (#d5d9e2) / `white` |
| `--card` / `--border` / `--input` | `charcoal` (#1a1a1a) / `umbra` (#1f2228) / `fog` |
| `--success` / `--warning` / `--error` | `142 69% 58%` / `45 93% 58%` / `0 72% 65%` |

Selection style: `::selection { background: hsl(var(--foreground)); color: hsl(var(--background)) }` (fully inverted).

Marketing-page theme layer (exact):

| Token | Light | Dark |
|---|---|---|
| `--color-theme-fg` | `#252525` | `#edecec` |
| `--color-theme-card-hex` | `#f2f2f2` | `#1b1b1b` |
| `--color-theme-card-02-hex` | `#ebebeb` | `#202020` |
| `--color-theme-card-04-hex` | `#e1e1e1` | `#2b2b2b` |
| `--color-theme-card-hover-hex` | `#ebebeb` | `#202020` |
| `--color-theme-card-03-hex` | `color-mix(primary 5%, card)` | `color-mix(primary 8%, card)` |
| `--color-theme-border-01/02` | fg @ 2.5% / 10% opacity | same |
| `--color-theme-fg-10 / fg-20` | fg @ 10% / 20% opacity | same |
| ANSI green / red | `#1f8a65` / `#cf2d56` | same |
| Hero headline ink | `#000` | `#fff` |

Grok Bot in-app UI palette (`.baby-grok-bot`, exact):

| Token | Light | Dark (`cursor-dark`) |
|---|---|---|
| text-primary | `#0a0a0a` | `#f2f2f2` |
| text-secondary / tertiary | `#0000008c` / `#00000059` | `#ffffff94` / `#ffffff5c` |
| text-accent | `#0a84ff` | `#64b5ff` |
| fill-accent | `#006ceb` | `#64b5ff` |
| danger / success / warning | `#c0362c` / `#1f8a65` / `#b26a00` | `#ff6b5e` / `#4cc79b` / `#e8a33d` |
| bg-editor / chrome / elevated | `#fcfcfc` / `#fbfbfb` / `#fcfcfc` | `#1c1c1c` / `#141414` / `#262626` |
| bg-card / tertiary / active / hover | `#0000000a` / `#0000000d` / `#00000014` / `#0000000a` | `#ffffff0f` / `#ffffff12` / `#ffffff1f` / `#ffffff0f` |
| border-default | `#0000001a` | `#ffffff1f` |
| fill-emphasis | `#111110` | `#f0f0f0` |
| user bubble (ink) | `#111110` (`#fff`) | `#ecece8` (`#141414`) |
| agent bubble | `#1010000a` | `#ffffff0f` |
| current-agent accent / coat | `#156e7a` / `#885cf5` | `#156e7a` (accent token reused) |
| sidebar text / separator / hover / selected | `#141414` / `#14141426` / `#0a0a0a0a` / `#0a0a0a0e` | `#ffffffe6` / `#ffffff1f` / `#ffffff0d` / `#ffffff13` |
| macOS traffic lights | red `#ff5f57` · yellow `#ffbd2e` · green `#28c840` | same |

Brand accent scales also exist (brown, red, orange, yellow, green, cyan, blue, violet, magenta, gray — 100→700 steps each; e.g. orange-400 `#e84302`, cyan-400 `#0093a3` — the latter is x.ai's site-wide link color per Firecrawl branding detection).

### Typography
- **Primary (body + headings): `xVf`** — custom "X Variable" woff2, `font-weight: 200–800`, set globally on `html`. Fallback: local Arial with `ascent-override: 90.56%; descent-override: 22.64%; line-gap-override: 0%; size-adjust: 106.01%`.
- **Mono: `GeistMono`** — variable, `100–900`; stack: `ui-monospace, SFMono-Regular, Roboto Mono, Menlo, Monaco, Liberation Mono, DejaVu Sans Mono, Courier New, monospace`. Used for `code/kbd/pre` and `.mono-tag` (uppercase, `letter-spacing: .1em`, secondary color).
- **Product UI: `--font-system`** = `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`.
- **Display: `CursorGothic`** (400 only), stacked `CursorGothic, xVf, system-ui, sans-serif`.
- Type classes (exact): `.type-xs` = xVf 0.75rem/1.5, tracking `.01em`, w400 · `.type-product-sm` = 11px/1.27273, tracking `.0044em` · `.type-product-base` = 12px/1.33333 · `.type-product-lg` = 13px · `.font-display` = weight 500, tracking `-.01em` · `.hero-headline` tracking `-.02em`.
- Measured render sizes (Firecrawl): h1 ≈ 60px, h2 ≈ 36px, body ≈ 18px.

### Spacing And Layout
- Base spacing unit 4px (Firecrawl detection); `--spacing-g1` = `10rem/16` (10px) grid unit.
- `--radius`: 8px base; `--radius-2xs: 2px`, `--radius-xs: 4px`; buttons/cards pill-shaped (`9999px`); media frames `1.5rem`.
- `--site-content-width: 64rem`; `--site-frame-inset: 20px` (8px ≤640px); header `4rem` tall, `hsl(background / .85)` + 12px blur.
- Hairline borders: 1px `fg@2.5%` (cards), 0.5px inside app UI; `--shadow-outline-theme: 0 0 0 1px border-02`.
- Glass treatment: `blur(14px) saturate(1.45)` + white gradient overlays (light), `blur(18px) saturate(1.2)` (dark).

## Components

### Buttons — marketing CTAs (exact, from rendered markup + CSS)
- **Primary CTA:** `inline-flex items-center justify-center rounded-full` · bg `hsl(var(--primary))` = **`#0a0a0a`**, hover `hsl(var(--primary-hover))` = `#1f2228` · text `hsl(var(--background))` = `#ffffff` · **height 44px (`h-11`)**, **padding-x 24px (`px-6`)**, gap 6px, font-size 16px, weight 400, `transition-colors`. (Firecrawl branding confirms: bg `#0A0A0A`, text `#FFFFFF`, radius `9999px`, shadow none.)
- **Secondary CTA:** same pill geometry; bg `--color-theme-card-03-hex` (= primary 5% mixed into card ≈ `#f7f6ea` light; dark override `oklch(32% 0 0)` on Teams card), text `hsl(var(--foreground))` = `#0a0a0a`, hover bg fg @ 10%. (Firecrawl measured rendered bg `#EDECEA`, confidence 0.9.)
- **Small pill:** padding `var(--button-padding-sm)` = `.45em .8em .46em`.
- **In-app pill buttons** (`.baby-grok-bot-card-action`): radius `999px`, padding `5px 12px`, 13px/18px, weight 500 · primary: bg `#111110`/text `#fff` (dark `#f0f0f0`/`#141414`), hover `opacity: .88` · secondary: 0.5px border `#0000001a` on elevated bg, hover bg `#0000000a` · ghost: text `#00000059`, hover `#0000008c`.
- **Input focus ring:** `outline: 2px solid hsl(var(--primary) / .3); outline-offset: 2px`.
- Hero CTAs: "Download for Linux" (primary) + "Contact sales" (secondary); pricing cards use full-width CTAs; animated rolling-text labels (Pro→Pro+→Ultra) with `cubic-bezier(0.23,1,0.32,1)` 700ms.

### Other components observed
- Pricing cards on `card`/`ivory` surface with 1px fg@2.5% border, check icons (16px, stroke 1.5, round caps), `text-secondary` body.
- Use-case pills: `9999px`, inset 1px border ring, padding `.2rem .55rem`, 12px; active state `bg-theme-bg-subtle`.
- Chat mock: glass chrome (`blur(80px) saturate(180%)`), 16px-radius agent cards, typing dots (1.3s staggered opacity), entry animation `translateY(8px) scale(.97) → 0/1` 280ms `cubic-bezier(.2,.9,.3,1.15)`.
- Footer character: outlined Grok mark, stroke 1.75px non-scaling, fg @ 18% opacity, vertical mask fade.

## Page Patterns
Section order: announcement pill → hero (h1 + sub + dual CTA + app window mock) → feature blocks alternating copy/app mock ("Message Bots like teammates", "Work with many Bots at once", "works where you work", "Show a Bot how it's done", "get smarter", "Connect the Bots") → bot jobs grid → video social proof → Pricing (3 cards: Cursor $20, Grok $30, Teams $40/seat) → Download → Guides → FAQs (accordion) → final CTA → mega-footer.

## Content Style
Terse, lowercase-adjacent product voice ("sent. inbox at zero, 5 drafts parked for tomorrow."); CTAs are verb-first ("Get Pro", "Contact sales", "Explore more bots"); headings are short benefit statements.

## Agent Build Instructions
1. Recreate the token system: shadcn-style HSL triplet variables with the jet/umbra/dove/ivory mapping above; `--radius: 8px`.
2. Buttons: black `#0a0a0a` pills, 44px tall, 24px x-padding, 16px/400 text, hover `#1f2228`; secondary = warm light pill `#f7f6ea`-ish via `color-mix(primary 5%, card)`.
3. Typography: one variable sans (weight axis 200–800) for everything; Geist Mono for code/eyebrow tags (uppercase, +10% tracking); headings tracking −2%.
4. Surfaces: white page, `#f9f8f6` cards, hairline `fg@2.5%` borders, `#252525` fg on marketing layer.
5. One accent: sunset orange `#ff6308` (hover `#ffd085`) used sparingly.
6. Dark mode inverts to jet background / dove text / charcoal cards.
7. In-app mock UI: use the `.baby-grok-bot` palette table (Apple-style `#0a84ff`/`#006ceb` accents, 0.5px hairlines, glass blur, 16px chat cards, pill action buttons).

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://x.ai/bot
target_stack: n/a (tokens only)
output: DESIGN.md
