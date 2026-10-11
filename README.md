# jacobschneider.design — static rebuild

A hand-coded, dependency-free copy of the Framer site at
<https://www.jacobschneider.design/>. Plain HTML, CSS and a little vanilla JS —
no build step, no framework, no runtime.

```
index.html      markup (home)
about.html      about page: intro, photo, horizontal timeline
styles.css      all styling, tokens at the top
script.js       Amsterdam clock, testimonial carousel, reel playback
serve.js        tiny static server for local preview (Node, no deps)
assets/
  fonts/        Inter (7 unicode-range subsets) + Season Mix Medium Italic
  js/           gsap.min.js (3.15, self-hosted)
  img/          logos, avatars, video posters, favicon, OG image
  video/        the eight work reels (~78 MB total — agency-template 31 MB and moda 21 MB are the heavy ones)
```

## Run it

```bash
node serve.js 4178
```

Then open <http://localhost:4178>. Any static server works — the site is just
files, so `python3 -m http.server` or dropping the folder on Netlify, Vercel,
Cloudflare Pages or S3 all work the same.

## How it was matched

Geometry, type and colour were read off the live site and reproduced to within
about 2px at every breakpoint. The breakpoints mirror Framer's: desktop ≥1200,
tablet 810–1199, mobile ≤809.

Key numbers live as CSS custom properties in `:root`. Each work card carries its
own reel placement inline:

```html
<article class="card" style="--vx:48px; --vy:48px; --vw:466px; --vh:316px; --mar:302/211">
```

`--vx/--vy/--vw/--vh` position the reel on desktop; `--mar` is the aspect ratio
used below 1200px, where the original centres the reel in the card instead of
hanging it from the top padding.

### The inline marks in the About paragraph

Framer draws the Framer/Mollie/Red Antler/Daniel Dalen marks as absolutely
positioned overlays at hard-coded coordinates, with runs of extra spaces in the
text reserving room for them. That breaks as soon as the text reflows, so here:

- the three company marks are **real inline boxes** with tuned margins, so a line
  break can never strand a mark away from its name;
- the Framer mark keeps a **zero-advance anchor**, because the original
  deliberately lets it hang at the end of line 1 while "Framer expert" wraps.

Both reproduce the original's line breaks exactly at 1440px and 390px.

## Project modal (Stripe-style)

Clicking a work card opens a case study in a dialog, matching the interaction
pattern from Stripe's product pages: a light wash with a blurred backdrop, and
the panel scaling and fading in **from the card you clicked** (the
`transform-origin` is set to that card's centre on open).

- Built on the native `<dialog>` element, so Esc, focus trapping and top-layer
  stacking are handled by the browser. The `.is-open` class only drives the
  transition.
- Closes on ×, Esc, or a click outside the panel; focus returns to the card.
- Grid reels pause while the dialog is open and resume on close. The dialog's
  own reel is cloned in on open and removed on close, so nothing downloads
  until you actually open a project.
- The expand glyph on each card appears on hover, and is always visible on
  touch devices (`@media (hover: none)`).
- The dialog scrolls if it has to but shows **no scrollbar**
  (`scrollbar-width: none` plus the `::-webkit-scrollbar` reset).

### What the modal shows

Meta line, title, a short description and the project's reel — nothing else.
No buttons, no photo grid, no border on the panel; the soft shadow and the
blurred backdrop separate it from the page.

### Where the modal copy comes from

Pulled from **jacobschneider.framer.media/work** and its project pages — with a
caveat: every project page there carries the same generic bio, so the only
project-specific facts it yields are the service, the year, and the live link
from the archive table. Those are in. The descriptions are written from what
is verifiable: the timeline Jacob supplied, what the reels themselves show
(the Hive event is dated and located on screen; Letters states its own
claims), and the work site's labels.

The work site also gave live links (Letters → letters.app, AI at Mollie →
jobs.mollie.com/ai-manifesto); they went out with the modal's buttons.

## Services

Below Works, in the 600px column: four rows — Web design, Brand design, Code
development, Framer development — each a number, the name and one line about
it. No pricing, no hover. On mobile the line drops under the name.

When the list scrolls into view the hairlines draw themselves in from the left
one after another and each row rises in behind its line (`servicesReveal` in
`script.js`). The lines are pseudo-elements driven by a `--draw` custom
property, because a border can't be scaled.

The closing "Book a call" used to sit inside the Works section; it now closes
the page after Services (`.page-cta`). Services and that button fade in with
the rest of the page once the hero text has finished.

## Hero intro (GSAP)

On load the hero plays a staggered blur-in: status bar, then the "About" label,
then the paragraph word by word as a wave of `blur(7px) → 0` moving left to
right, then the two buttons. Only once that has landed do Testimonials, Works,
Services and the closing button fade in — a plain fade, no blur, 150ms apart.
About 3.3s end to end.

GSAP 3.15 core is **self-hosted** in `assets/js/` — no CDN, so the site still
works offline. No plugins needed; the word splitting is ~20 lines in
`script.js`.

**Why not SplitText:** the About paragraph is fragile. `white-space: pre-wrap`
plus the inline logo marks mean anything that changes inline layout moves the
line breaks, and the whole point of the rebuild was matching them exactly. So:

- only bare text nodes are split; links, logo marks and the signature stay
  whole and animate as single units;
- word wrappers are `display: inline`, never `inline-block` — inline-block
  would allow a `y` transform but also shifts where lines break;
- the movement therefore comes from opacity and blur only;
- the `filter` is cleared on complete, so the final text renders with normal
  subpixel antialiasing rather than staying on a composited layer.

Verified after the change: paragraph height, every mark position and every line
break are identical to before.

**Safety rails**, because an invisible hero is the worst failure mode here:

- an inline script in `<head>` hides the hero before first paint, with a 2s
  timeout that reveals it anyway if the scripts never load;
- the timeline waits for `visibilitychange` if the page opens in a background
  tab — and reveals the hero unanimated in the meantime, so it is never left
  sitting at an invisible start state;
- a 4s failsafe forces the end state if `requestAnimationFrame` is throttled
  and the timeline never ticks;
- `prefers-reduced-motion: reduce` skips the whole thing, text straight to
  final state.

## Testimonial transition (GSAP)

Switching reviews is direction-aware. The outgoing quote blurs away and drifts
in the direction of travel, the incoming one arrives from the opposite side and
its words wash in, the avatar pops in with a slight overshoot, and the active
indicator bar springs up from a squashed scale.

The part that actually matters: **the block's height is tweened**. The four
quotes are 76 / 25 / 101 / 25 px tall on desktop, so previously the arrows below
snapped between the one-line and four-line reviews. In animated mode every slide
goes absolute and `#slides` has its own height animated to the incoming quote's,
so everything below glides.

Same constraints as the hero, so the same approach: words are `display: inline`
spans animated with opacity and blur only, the underlined name (`.u`) stays
whole, and the per-slide avatar is absolutely positioned so it can be
transformed freely.

Edge cases handled:

- **Clicking faster than the transition.** A new switch snaps the in-flight
  timeline to its end before starting (`tl.progress(1)` then kill) rather than
  killing it outright — killing skips `onComplete`, which would leave the old
  slide flagged active and visible forever. There's a defensive sweep for stale
  `is-active` flags too. Verified by hammering the arrows mid-transition: never
  more than the two participating slides are visible.
- **Resize.** The wrapper height is re-measured (debounced) when the quotes
  re-wrap at a new width, skipped while a transition is running.
- **No GSAP / reduced motion.** Falls back to the original CSS cross-fade with
  natural height — no splitting, no absolute slides.

Verified unchanged against the Framer original afterwards: slide heights
[76, 25, 101, 25], section height 174px, arrows at 129px.

## Pill buttons

"Book a call" is back to exactly what the Framer original ships: a plain black
pill, 106×35. The original's hover sheen is kept too — a blurred shape that
sweeps across on hover in the pill's own colour, so it is invisible there and
here. Set `--shine` (e.g. `rgba(255,255,255,.28)`) on `.btn` to actually see it.

## Colour modes

Three themes, picked from the swatches immediately left of "AMS":

| | | |
|---|---|---|
| **Light** | off-white `#fdfdfb`, black ink | the original |
| **Dark** | neutral near-black `#0e0e0d` | |
| **Paper** | warm cream `#f6f1e7`, brown-black ink | |

Each theme has its own swatch rather than one button cycling through them: a
12px circle filled with that theme's page colour. The active one carries a ring
in the current theme's ink, and a hairline inset keeps the pale swatches
visible against a pale page. The colours are hard-coded per theme on purpose —
a swatch has to show *its* theme, not the active one.

- The theme is resolved by an inline script in `<head>` **before first paint**,
  so it can never flash the wrong one.
- It follows the OS by default (dark → Dark, otherwise Light). The moment the
  visitor picks one it's stored in `localStorage` and wins from then on.
- Each theme is just a block of token overrides on `:root[data-theme="…"]` —
  nothing else in the stylesheet is theme-aware. Adding a fourth is three
  edits: the token block, a `.sw--<id>` colour, and a `<button class="sw">` in
  the status bar. The themes the site accepts are listed once, in the `ok`
  array in the `<head>` script; anything else stored falls back to Light, so a
  visitor can never be stranded in a theme with no swatch.

**The swap is instant, deliberately.** Components carry their own transitions
(links, indicator dots, arrows, buttons), so a theme change used to fade some
things and snap others. A `.theming` class now kills *every* transition for the
duration of the swap. The sequence matters: add the class, change the theme,
move the active ring, force a style flush (`void document.body.offsetWidth`),
remove the class — without the flush in the middle the browser coalesces it all
and the transitions run anyway. The swatch ring is updated inside that window
too, and its `box-shadow` is deliberately not transitioned, because the ring's
colours come from the theme and would otherwise fade. Measured after every
switch: zero transitions running.

Three things deliberately don't follow the theme, because the logos are baked
with a fixed polarity:

- the **Red Antler** chip stays light everywhere;
- the **Mollie** plate stays dark (its glyph is white), lifted to `#1c1c1a` in
  Dark and `#16202f` in Midnight so the badge doesn't vanish into the page;
- the orange accent is the same in all five.

## About page

`about.html` — same 600px column as the home page, same status line, same
themes. Paragraph, then the photo (no corner radius), then the timeline, which
carries an extra 70px above it on top of the section gap.

### Timeline: a ruler you scrub

Modelled on the milestone-timeline pattern: a measure slides under a needle
fixed at the centre, and whichever milestone is nearest the needle becomes the
active one, with its month and description in the readout below. Rebuilt from
scratch in the site's own palette — the needle takes the orange accent, ticks
and labels run off the theme tokens, so it follows Light / Dark / Paper.

Everything is positioned from the `data-date` on each `<li>`, so the markup
stays the single source of truth: adding a milestone is one `<li>`, and the
ruler, ticks, year labels and ordering all follow. Ticks are weekly, taller at
each month, tallest and labelled at each year; weekly ticks within 5px of a
month boundary are skipped so they never double up. Alternate milestones sit
higher so neighbouring labels can't collide.

Drag it, shift-scroll over it, **click any milestone label to jump straight to
it**, or tab to it and use the arrow keys (`Home` / `End` for the ends). No
hint text above it. None of the text on the ruler takes pointer events and the
stage can't start a text selection, so dragging never catches a label; a click
is matched to a label by its rect instead. It's
exposed as a `role="slider"` with `aria-valuenow`. Releasing a drag settles
onto the nearest milestone. The "Book a call" button only appears on the final
milestone.

Click-to-jump needed a fix that isn't obvious: the stage called
`setPointerCapture` on `pointerdown`, which retargets the following `click` to
the stage, so it never reached the label. Capture is now deferred until the
pointer has actually moved more than 3px — a real drag — leaving plain clicks
to land normally.

A milestone body may contain a link (the Red Antler entry links to MODA), so
the readout clones the body's nodes rather than copying its text.

Each label is pinned to its point on the ruler by a stem ending in a dot — the
active one turns the dot orange at 1.5x and the stem to ink. Alternating
milestones sit higher, and their stems are correspondingly longer, so both rows
land exactly on the tick row.

The readout reserves the height of the tallest body, so changing milestone
never nudges the page. That height is **measured at runtime** rather than set
in CSS, and re-measured on resize — a hand-tuned `min-height` would silently
start jumping again the moment you edited the copy.

Animations are GSAP: the intro reuses the home page's word-by-word blur-in; the
photo fades in with a subtle blur (`blur(8px) → 0`, 1.1s) — but only once the
hero text has finished *and* the photo is on screen, so above the fold it
follows the text and below it waits for the scroll. The hero signals the end
with an `intro:done` event plus `data-intro="done"` on `<html>` for anything
that starts listening late; it also signals when it's skipped (reduced motion,
no GSAP) so nothing waits forever. Empty tweens still take up time on a
timeline, so the hero only adds its button and section fades where those
exist — otherwise the about photo sat ~0.7s waiting for nothing;
the ruler rises in with its labels staggering; the readout cross-fades on every
change. Reveals fire from `IntersectionObserver` rather than ScrollTrigger, so
no extra plugin is needed, and each reveal carries the same 4s failsafe as the
hero — a throttled `requestAnimationFrame` must never leave the page blank.

Two bugs worth recording, both found by testing rather than reading:

- The first readout was written inside a tween's `onComplete`, so it stayed
  empty until the tab was looked at. The first render now writes straight out
  and only later changes cross-fade.
- Stepping faster than the 180ms cross-fade let an earlier tween land *after* a
  newer one and write stale text. Each new readout now kills the one still
  running.

### Timeline content

The nine milestones are Jacob's own, supplied directly:

| | |
|---|---|
| Dec 2023 | taught himself WordPress over the Christmas holiday |
| Jul 2024 | first paid gig, via Fiverr |
| Nov 2024 | first serious project — Into The Great Wide Open |
| Jan 2025 | job offer from Framer, declined for school |
| Apr 2025 | Museum Villa, with Studio Somehow |
| Jun 2025 | the summer at Mollie, introduced by the founder |
| Sep 2025 | ongoing freelance for Daniel Dalen |
| Jan 2026 | Red Antler (New York), on MODA |
| Oct 2026 | open for work |

He gave months, not days, so each `data-date` picks a sensible day inside the
month he named — only the position on the ruler depends on it.

**One thing still to fill in:** the MODA link in the Red Antler milestone is
`href="#"`, tagged `data-todo`. Point it at the real project.

Two milestones found on X earlier — the second Framer template relaunch
(May 2026) and the portfolio relaunch plus Foliobin feature (Jun 2026) — are
*not* in the list above, because the supplied list superseded them. They're
each a single `<li>` if you want them back.

### Getting there

The **About** label on the home page is the link to it, with a small arrow on
hover — the site had no navigation, and an unreachable page is no use. The
about page has a "Back" link where "Open for work" sits on the home page.

## Deliberate differences from the live site

| | Live site | Here |
|---|---|---|
| Testimonial arrows | don't advance the carousel | work; dots and slide update |
| "Book a call" under Works | no `href` | links to Cal.com, and now closes the page after Services |
| Daniel Dalen link in About | `href` ends in a stray `\` | cleaned up |
| "Daniel dalen" on mobile | lowercase `d` (per-breakpoint typo) | "Daniel Dalen" everywhere |
| Tablet card widths | 388 / 436 (uneven) | equal, as the design intends |
| Work cards | static | open a case-study modal (copy + reel) |
| Projects | six | eight — Agency Template and MODA added as a fourth row |
| Services | — | four-row list below Works |
| Hero | appears instantly | staggered blur-in intro |
| Testimonial switch | cross-fade, height jumps | direction-aware, height tweened |
| Theme | light only | three colour modes, one swatch each |
| Pages | one | plus an about page, linked from the About label |
| Mollie mark | glyph sits ~1.5px low | cropped PNG, properly centred |

## Quirks kept on purpose

These look like bugs but are in the original, so they were reproduced:

- The testimonial column is **613px**, not 600px like the other sections, which
  pushes it ~6px left of the About column. Set `.testimonials { max-width }` to
  `var(--col)` to line them up.
- The gap between work rows is **24px** between rows 1→2 but **12px** between
  2→3, because only the first row has bottom padding. Give every `.work-row`
  `padding: 12px 32px` to even it out.
- The "Book a call" sheen is **black on a black pill**, so it is invisible.
  Set `--shine` (e.g. `rgba(255,255,255,.28)`) on `.btn` to switch it on.

## Notes

- The clock is real Amsterdam time via `Intl.DateTimeFormat` with
  `timeZone: 'Europe/Amsterdam'`, so DST is handled for you.
- Reels play only while on screen (`IntersectionObserver`) and pause otherwise.
- Fonts are self-hosted and preloaded; `Inter Placeholder` is a
  metric-compatible local fallback so nothing shifts while Inter loads.
- The videos are the bulk of the payload. If you want a lighter page, re-encode
  them to WebM/AV1 and add a second `<source>`.
