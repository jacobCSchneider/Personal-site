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

- the three company marks are **real inline boxes** with tuned margins, each
  wrapped with its name in a `.glue` span (`white-space: pre`). An inline box
  is itself a break opportunity, so without the glue a phone at 375px left the
  Mollie chip at the end of one line and "Mollie" on the next;
- the Framer mark keeps a **zero-advance anchor**, because on desktop the
  original deliberately lets it hang at the end of line 1 while "Framer
  expert" wraps. On phones "Framer" stays on the logo's line, so there the
  anchor is widened (13.1px) to give the logo 4.3px before and 5px after —
  the same air as the Mollie chip — instead of the F running into it, and the
  pair is glued too.

The margins are tuned against the space in front of each mark. When a mark
opens a line that space is gone, so a small script (`markLineStarts`) flags
those glues with `.at-start` on load, font load and resize, and CSS drops the
margin: every mark that starts a line now sits exactly on the text edge
(checked at 320–1440px). Line breaks still match the original at 1440px and
390px.

## Work cards: click to enlarge

Clicking a work card shows **just its reel, bigger** — no case-study text, no
panel. The video grows out of the card it came from (a GSAP FLIP: the big
video starts with the transform that lays it exactly over the card's video and
eases to identity), over a light blurred wash. Click anywhere, press ×, or Esc
and it shrinks back into the card.

- Native `<dialog id="lightbox">`, so Esc and top-layer stacking come free.
- Sized to the reel's own aspect (read from the playing card video, falling
  back to the card's `--mar`) and as large as fits: up to 1400px wide, 64px
  clear of the top and bottom on desktop, 16px gutters on mobile. Nothing is
  cropped.
- The big copy picks up at the card's `currentTime`, so it looks continuous.
  Grid reels pause while it's open and resume on close; the big copy's `src`
  is dropped on close so it stops downloading. Focus goes back to the card.
- The expand glyph on each card appears on hover, and is always visible on
  touch devices (`@media (hover: none)`).

The case-study modal this replaced is gone for now, but its copy is still in
`index.html` as eight unused `<template id="detail-…">` blocks (written from
jacobschneider.framer.media/work — service, year, and what the reels show), in
case the modal comes back.

## Services

Below Works, in the 600px column: four rows — Web design, Brand design, Code
development, Framer development — each a number, the name and one line about
it. No pricing, no hover. On mobile the line drops under the name.

When the list scrolls into view the hairlines draw themselves in from the left
one after another and each row rises in behind its line (`servicesReveal` in
`script.js`). It starts as the list clears the bottom 15% of the screen.

Tuned for smoothness:
- **Lines** are real `<span class="service__rule">`s that `script.js` adds,
  animated with `scaleX`, which the compositor can run. Before, they were
  pseudo-elements driven by a `--draw` custom property, so every frame
  restyled them. Without JS, plain pseudo-element lines stand in.
- **Easing** is `power3.inOut` over 1.3s for the lines, where `expo.out` used
  to shoot halfway across almost instantly. The text uses `power2.out` over
  1s, rising 10px.
- **Rows** start 0.14s apart and overlap heavily, so the list reads as one
  wave rather than four steps.

The closing "Book a call" used to sit inside the Works section; it now closes
the page after Services (`.page-cta`). Services and that button fade in with
the rest of the page once the hero text has finished.

## Hero intro (Web Animations API)

On load the hero plays a staggered blur-in: status bar, then the "About" label,
then the paragraph word by word as a wave of `blur(7px) → 0` moving left to
right, then the two buttons. Only once that has landed do Testimonials, Works,
Services and the closing button fade in — a plain fade, no blur, 150ms apart.
About 3.2s end to end, all on the strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)`.

It runs on the **Web Animations API**, not GSAP: this plays while the page is
at its busiest (fonts settling, eight reels starting to load), which is exactly
when a `requestAnimationFrame` loop drops frames, and WAAPI animations run off
the main thread. Each animation is created with `fill: backwards` in the same
tick the hiding class drops, so nothing paints un-animated; with no forwards
fill, every element returns to its own style when done — the words to plain,
subpixel-rendered text with no filter left on them.

GSAP 3.15 core is still **self-hosted** in `assets/js/` for the gesture-driven
and scroll-driven pieces (testimonials, lightbox, services, timeline readout);
no plugins. The word splitting is ~20 lines in `script.js`.

**Why not SplitText:** the About paragraph is fragile. `white-space: pre-wrap`
plus the inline logo marks mean anything that changes inline layout moves the
line breaks, and the whole point of the rebuild was matching them exactly. So:

- only bare text nodes are split; links, logo marks and the signature stay
  whole and animate as single units;
- word wrappers are `display: inline`, never `inline-block` — inline-block
  would allow a `y` transform but also shifts where lines break;
- the movement therefore comes from opacity and blur only;
- nothing is left on the words afterwards (no forwards fill), so the final
  text renders with normal subpixel antialiasing rather than staying on a
  composited layer.

Verified after the change: paragraph height, every mark position and every line
break are identical to before.

**Safety rails**, because an invisible hero is the worst failure mode here:

- an inline script in `<head>` hides the hero before first paint, with a 2s
  timeout that reveals it anyway if the scripts never load;
- the intro waits for `visibilitychange` if the page opens in a background
  tab — and reveals the hero unanimated in the meantime, so it is never left
  sitting at an invisible start state;
- a failsafe 1.5s after the last animation should have ended finishes them all
  and fires `intro:done` regardless;
- `prefers-reduced-motion: reduce` skips the whole thing, text straight to
  final state.

## Testimonial transition (GSAP)

Switching reviews is direction-aware. The outgoing quote blurs away and drifts
in the direction of travel, the incoming one arrives from the opposite side and
its words wash in, the avatar fades up from scale .9, and the active indicator
bar stretches up from .6. Everything eases out (`power3.out`), exits included —
an ease-in on an exit delays the moment the eye is on — and nothing bounces: a
click puts no momentum in, so an overshoot would be invented. The arrows give
3px in the direction of travel for 180ms on press, and squeeze to .9 while held.
About 0.65s end to end.

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
The sweep is a `transform`, not an animated `left` (which would re-lay the
button out every frame), and it only runs on devices that hover. A press
squeezes the pill to `scale(.97)` in 160ms — feedback on the touch-down, not
the release.

## Colour

One light theme: off-white `#fdfdfb`, black ink, the orange accent. The three
colour modes (Light / Dark / Paper, picked from swatches next to "AMS") that
the rebuild had for a while are gone, along with the before-first-paint theme
script and the `.theming` transition killer that went with them. The tokens
on `:root` are the only place colour lives.

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
exposed as a `role="slider"` with `aria-valuenow`. The "Book a call" button
only appears on the final milestone.

**How it moves.** A drag writes the strip's position straight through, 1:1
with the finger (it used to trail it on a 450ms tween). Everything else — a
click, a key, a release — hands the target to a critically damped spring
(response 0.4s), which starts from wherever the strip is and at whatever speed
it already has. So a release glides on from the drag with no seam, a flick
carries: the landing milestone is the one nearest to where that speed would
run out (momentum projection, `d = .995`), and grabbing the strip mid-glide
picks it up from where it is. A release more than 80ms after the last movement
carries no momentum. The needle's reach is a `scaleY` from its foot rather than
an animated `height`. The readout swap is a 180ms fade out and a 350ms rise in,
short because scrubbing swaps it tens of times.

Click-to-jump needed a fix that isn't obvious: the stage called
`setPointerCapture` on `pointerdown`, which retargets the following `click` to
the stage, so it never reached the label. Capture is now deferred until the
pointer has actually moved more than 3px — a real drag — leaving plain clicks
to land normally.

On phones the ruler sets `touch-action: pan-y`. Without it the browser treats
a horizontal swipe as a page pan, fires `pointercancel` within a few pixels
and the drag never starts; with it, sideways swipes scrub the ruler and
vertical ones still scroll the page. A finger sliding off the stage mid-swipe
no longer ends the drag either — only a mouse leaving does.

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

## Motion principles

Every animation on the site was passed through Emil Kowalski's `animate`,
`review-animations`, `animation-performance` and `apple-design` skills
(installed in `.agents/skills/`). The rules that now hold everywhere:

- **Properties:** `transform` and `opacity` only (plus `filter` blur under
  20px). The button sheen, the timeline needle and the hero's word reveal all
  moved off `left` / `height` / inline-style sweeps onto transforms.
- **Easing tokens:** `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for anything
  entering, exiting or changing state; `--ease-in-out: cubic-bezier(0.77, 0,
  0.175, 1)` for things moving on screen; plain `ease` for hover and colour.
  No `ease-in` on UI anywhere.
- **Nothing from nothing:** entrances start from `scale(.9)` or a few px of
  travel, never from `scale(0)` or a bare fade.
- **Bounce only from momentum:** springs are critically damped unless the
  user threw something (the carousel after a flick).
- **Gestures:** 1:1 tracking, pointer capture, one pointer at a time,
  velocity hand-off into a spring, momentum projection for the landing point,
  grab-able mid-flight.
- **Busy main thread:** anything that plays during load (hero intro, carousel
  entrance) runs on CSS or the Web Animations API; GSAP is kept for motion the
  page drives after it has settled.
- **Hover motion** is gated to `(hover: hover) and (pointer: fine)`; press
  feedback lives on `:active` at 160ms.
- **Reduced motion** keeps the opacity and colour changes and drops the
  movement, on every piece.

## Page transition (glimm)

Page links don't reload the document. `pageSweep` in `script.js` fetches the
next page (on hover already, so it's cached by the click) and glimm's band
(glimm.dev, MIT; the framework-agnostic core is vendored in
`assets/js/glimm/`, loaded by a `<script type="module">` on each page and
exposed as `window.glimm`) makes **one pass** across the screen. The band is
the mask: ahead of it the page you were on, behind it the next one.

- **At the click** the old `<main>` is lifted into a fixed, viewport-sized
  layer (`.page-old`, shifted by the scroll offset so it looks identical) and
  the new `<main>` goes into the flow underneath, scrolled to the top. Every
  frame the old layer's `mask-image` is cut along the band's leading edge —
  the same 6% soft edge glimm's own curtain uses — so the band sits right
  over the seam. Once the band has passed, the old layer is removed.
- **No second entrance.** The modules re-run for the new page (`initPage()`;
  window/document listeners are registered with `pageSignal()` and die with
  the page; the clock keeps one interval), but with `pageArrived` set, so the
  hero intro, photo fade, timeline, services and carousel entrances are
  skipped: the page is fully rendered the moment the band reveals it. On a
  hard load they play as before.
- **History.** `pushState` per hop, `scrollRestoration` manual; back and
  forward replay the sweep right to left. A fetched document is cloned in,
  not moved, so the cache can serve the same page again.
- **Settings** are the `SWEEP` object at the top of `pageSweep`: palette (the
  seven named ones, or `glimm.accentPair('#ff8c00', …)` for one built on the
  accent), direction, `sweepMs`, easing, `bandTight`, `swellAmount`,
  `waveAmount`, `rippleAmount`, `waveSpeed`, `peakAlpha`, `brightness`,
  `outroMs`. Current: ember, 1.6s, bandTight 9, wave 1.4, ripple 1.3, speed
  .9, brightness 1.05.
- **Falls back** to an instant swap with reduced motion, in a hidden tab, or
  without WebGL; to a normal navigation if the fetch fails; and a timer
  clears the old layer if the band's animation frames never come. Links that
  open in a new tab, downloads, anchors, external links and anything marked
  `data-glimm-skip` are left alone.

An earlier version did glimm's two-phase covered sweep (cover, hold on a
solid, swap, reveal); it read as two passes with a stop in the middle. Before
that, a pixel-wave transition did a full page load at the cut and flashed.

## Deliberate differences from the live site

| | Live site | Here |
|---|---|---|
| Testimonial arrows | don't advance the carousel | work; dots and slide update |
| "Book a call" under Works | no `href` | links to Cal.com, and now closes the page after Services |
| Daniel Dalen link in About | `href` ends in a stray `\` | cleaned up |
| "Daniel dalen" on mobile | lowercase `d` (per-breakpoint typo) | "Daniel Dalen" everywhere |
| Tablet card widths | 388 / 436 (uneven) | equal, as the design intends |
| Work cards | static | click to enlarge the reel |
| Projects | six | eight — Agency Template and MODA added as a fourth row |
| Services | — | four-row list below Works |
| Hero | appears instantly | staggered blur-in intro |
| Testimonial switch | cross-fade, height jumps | direction-aware, height tweened |
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

## Analytics

Vercel Web Analytics, in its plain-HTML form: a two-line snippet in the
`<head>` of both pages that loads `/_vercel/insights/script.js`. No npm package:
`@vercel/analytics` (and its `/next` import) needs a bundler, and this site has
no build step. Vercel serves the script itself, so it only runs on the
deployed site — on `localhost` the request 404s, harmlessly. Page views show up
once **Analytics** is enabled for the project in the Vercel dashboard.

## Notes

- The clock is real Amsterdam time via `Intl.DateTimeFormat` with
  `timeZone: 'Europe/Amsterdam'`, so DST is handled for you.
- Reels play only while on screen (`IntersectionObserver`) and pause otherwise.
- Fonts are self-hosted and preloaded; `Inter Placeholder` is a
  metric-compatible local fallback so nothing shifts while Inter loads.
- The videos are the bulk of the payload. If you want a lighter page, re-encode
  them to WebM/AV1 and add a second `<source>`.
