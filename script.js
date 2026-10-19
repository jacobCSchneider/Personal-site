/* jacobschneider.design — clock + testimonial carousel */

(function clock() {
  var el = document.getElementById('clock');
  if (!el) return;

  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  function tick() {
    el.textContent = fmt.format(new Date());
  }

  tick();
  setInterval(tick, 1000);
})();

/* Wrap bare words in `display: inline` spans so they can be staggered.
   Elements matching `atomic` are returned whole instead of being split, and
   whitespace is re-inserted verbatim — both matter because the text here uses
   `white-space: pre-wrap` and padded space runs that position inline marks.
   Nothing here is inline-block: that would allow transforms but would also
   move the line breaks. */
function splitWords(root, atomic) {
  var units = [];

  (function walk(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        if (!n.nodeValue.trim()) return;
        var frag = document.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            var w = document.createElement('span');
            w.className = 'w';
            w.textContent = part;
            frag.appendChild(w);
            units.push(w);
          }
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        if (atomic && n.matches(atomic)) units.push(n);
        else walk(n);
      }
    });
  })(root);

  return units;
}

(function carousel() {
  var wrap = document.getElementById('slides');
  var slides = Array.prototype.slice.call(document.querySelectorAll('#slides .slide'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('#dots .dot'));
  var prev = document.getElementById('prev');
  var next = document.getElementById('next');
  if (!wrap || !slides.length || !prev || !next) return;

  var i = 0;
  var animated = !!window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  function flags() {
    dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
    prev.setAttribute('aria-disabled', String(i === 0));
    next.setAttribute('aria-disabled', String(i === slides.length - 1));
  }

  /* ── plain cross-fade: no GSAP, or the visitor asked for less motion ── */
  if (!animated) {
    (function show(n) {
      i = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      flags();
      prev.onclick = function () { show(i - 1); };
      next.onclick = function () { show(i + 1); };
    })(0);
    return;
  }

  /* ── animated ──
     Every slide goes absolute and the wrapper's height is animated to the
     incoming quote's height, so the arrows below glide instead of jumping
     between the one-line and four-line reviews. */
  wrap.classList.add('is-animated');

  // Split each quote once, up front.
  var parts = slides.map(function (s) {
    return {
      el: s,
      avatar: s.querySelector('.slide__avatar'),
      // keep the underlined name whole, split everything else per word
      words: splitWords(s.querySelector('.slide__text'), '.u')
    };
  });

  function heightOf(p) { return p.el.offsetHeight; }

  // Only ever adds: the outgoing slide has to stay visible while it animates
  // out, so it is un-flagged in the timeline's onComplete instead.
  function setActive(n) { slides[n].classList.add('is-active'); }

  var tl = null;

  function go(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === i) return;

    var dir = n > i ? 1 : -1;
    var out = parts[i];
    var into = parts[n];
    var toDot = dots[n];
    i = n;
    flags();

    // Snap any transition still in flight to its end first. Killing it outright
    // would skip its onComplete, leaving that slide flagged active — and
    // visible — forever.
    if (tl) { tl.progress(1); tl.kill(); tl = null; }

    // Belt and braces: nothing but these two should be showing.
    slides.forEach(function (s, k) {
      if (k !== n && s !== out.el) s.classList.remove('is-active');
    });

    // Make the incoming slide measurable and visible before timing anything.
    setActive(n);
    gsap.set(into.el, { clearProps: 'transform' });
    var target = heightOf(into);

    tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () {
        out.el.classList.remove('is-active');
        gsap.set(into.words, { clearProps: 'filter,willChange' });
        gsap.set(wrap, { height: heightOf(into) });   // settle on the real height
      }
    });

    // outgoing: blurs away and drifts in the direction of travel
    tl.to(out.words, {
      opacity: 0, filter: 'blur(5px)', duration: .26, stagger: { each: .008 }
    }, 0)
      .to(out.el, { y: -16 * dir, duration: .3 }, 0)
      .to(out.avatar, { scale: .9, opacity: 0, duration: .22 }, 0);

    // the block resizes underneath both quotes
    tl.to(wrap, { height: target, duration: .5, ease: 'power3.inOut' }, .04);

    // incoming: arrives from the other side, words wash in
    tl.fromTo(into.el, { y: 20 * dir }, { y: 0, duration: .45 }, .16)
      .fromTo(into.words,
        { opacity: 0, filter: 'blur(7px)' },
        { opacity: 1, filter: 'blur(0px)', duration: .45, stagger: { each: .012 } }, .18)
      // from .9, not from nothing, and no bounce: a click put no momentum in
      .fromTo(into.avatar,
        { scale: .9, opacity: 0 },
        { scale: 1, opacity: 1, duration: .4 }, .2);

    // indicator: the colour comes from .is-active in CSS; this just adds a
    // small stretch on the bar that takes over
    tl.fromTo(toDot, { scaleY: .6 }, { scaleY: 1, duration: .3 }, 0);
  }

  // press feedback: a short give in the direction of travel
  function nudge(btn, dir) {
    gsap.fromTo(btn, { x: 3 * dir }, { x: 0, duration: .18, ease: 'power3.out' });
  }

  prev.addEventListener('click', function () { nudge(prev, 1); go(i - 1); });
  next.addEventListener('click', function () { nudge(next, -1); go(i + 1); });

  // initial state
  setActive(0);
  flags();
  gsap.set(wrap, { height: heightOf(parts[0]) });

  // keep the wrapper honest when the quotes re-wrap at a new width
  var resizeTimer;
  addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (tl && tl.isActive()) return;
      gsap.set(wrap, { height: 'auto' });
      gsap.set(wrap, { height: heightOf(parts[i]) });
    }, 150);
  });
})();

/* Play the work reels only while they are on screen, and keep nudging
   play() — some browsers ignore the autoplay attribute until there is data. */
var play = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
var gridPaused = false;

(function videos() {
  var vids = Array.prototype.slice.call(document.querySelectorAll('.card video'));
  if (!vids.length) return;

  if (!('IntersectionObserver' in window)) {
    vids.forEach(play);
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (!e.isIntersecting || gridPaused) { v.pause(); return; }
      if (v.readyState >= 2) play(v);
      else v.addEventListener('canplay', function () { play(v); }, { once: true });
    });
  }, { rootMargin: '200px 0px' });

  vids.forEach(function (v) { io.observe(v); });

  window.__grid = {
    pause: function () {
      gridPaused = true;
      vids.forEach(function (v) { v.pause(); });
    },
    resume: function () {
      gridPaused = false;
      vids.forEach(function (v) {
        var r = v.getBoundingClientRect();
        if (r.bottom > -200 && r.top < innerHeight + 200) play(v);
      });
    }
  };
})();

/* Video lightbox: click a card and its reel grows out of the card to fill
   the screen; click anywhere (or Esc) and it shrinks back into place.
   (The case-study <template>s are still in index.html, unused for now.)
   <dialog> gives Esc and the top layer for free; GSAP does the FLIP. */
(function videoLightbox() {
  var box = document.getElementById('lightbox');
  var vid = document.getElementById('lightbox-video');
  var veil = box && box.querySelector('.lightbox__veil');
  var closeBtn = document.getElementById('lightbox-close');
  if (!box || !vid || !box.showModal) return;

  var hasGsap = typeof gsap !== 'undefined';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var source = null;     // the card's own <video>
  var opener = null;
  var busy = null;

  // the transform that makes the big video sit exactly over the small one
  function flipFrom(el) {
    var a = el.getBoundingClientRect(), b = vid.getBoundingClientRect();
    return {
      x: a.left + a.width / 2 - (b.left + b.width / 2),
      y: a.top + a.height / 2 - (b.top + b.height / 2),
      scaleX: a.width / b.width, scaleY: a.height / b.height
    };
  }

  function open(card) {
    source = card.querySelector('.card__media video');
    if (!source) return;
    opener = card.querySelector('.card__open');
    if (busy) busy.kill();

    var ar = source.videoWidth ? source.videoWidth + ' / ' + source.videoHeight
                               : getComputedStyle(card).getPropertyValue('--mar');
    box.style.setProperty('--ar', ar);
    vid.src = source.currentSrc || source.src;
    try { vid.currentTime = source.currentTime; } catch (e) {}

    box.showModal();
    document.documentElement.classList.add('has-modal');
    if (window.__grid) window.__grid.pause();
    play(vid);

    if (!hasGsap || reduce) return;
    busy = gsap.timeline()
      .fromTo(veil, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power2.out' }, 0)
      .fromTo(vid, flipFrom(source),
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: .5, ease: 'expo.out' }, 0)
      .fromTo(closeBtn, { opacity: 0 }, { opacity: 1, duration: .3 }, .25);
  }

  function finish() {
    box.close();
    vid.pause();
    vid.removeAttribute('src'); vid.load();      // unload the big copy
    document.documentElement.classList.remove('has-modal');
    if (window.__grid) window.__grid.resume();
    if (hasGsap) gsap.set([vid, veil, closeBtn], { clearProps: 'all' });
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    busy = null;
  }

  function close() {
    if (!box.open) return;
    if (busy) busy.kill();
    if (!hasGsap || reduce || !source) return finish();
    busy = gsap.timeline({ onComplete: finish })
      .to(closeBtn, { opacity: 0, duration: .15 }, 0)
      .to(vid, Object.assign(flipFrom(source), { duration: .35, ease: 'power3.out' }), 0)
      .to(veil, { opacity: 0, duration: .3, ease: 'power2.out' }, .05);
  }

  document.querySelectorAll('.card__open').forEach(function (btn) {
    btn.addEventListener('click', function () { open(btn.closest('.card')); });
  });

  box.addEventListener('click', close);            // anywhere: veil, video, ×
  box.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
})();

/* Hero intro.
   The About paragraph is delicate: `white-space: pre-wrap` plus the inline
   logo marks mean anything that changes inline layout moves the line breaks.
   So the words are wrapped in plain `display: inline` spans and animated with
   opacity and blur only — never transform, which would need inline-block.
   Links, logo marks and the signature animate whole rather than per word. */
/* Marks that open a line. Each mark's left margin is tuned against the space
   in front of it; at the start of a line that space is gone, so the mark would
   sit indented (Framer) or poke out past the text edge (Dalen). Flag those
   glues so CSS can drop the margin. Re-checked whenever the wrap can change. */
(function markLineStarts() {
  var glues = document.querySelectorAll('.about__text .glue');
  if (!glues.length) return;

  function check() {
    glues.forEach(function (g) {
      g.classList.remove('at-start');
      var mark = g.firstElementChild;
      var prev = g.previousSibling;
      while (prev && !(prev.textContent || '').trim()) prev = prev.previousSibling;
      if (!mark || !prev) return;
      var r = document.createRange();
      r.selectNodeContents(prev);
      var rects = r.getClientRects();
      var last = rects[rects.length - 1];
      var box = mark.getBoundingClientRect();
      // a different line: the mark's middle is below the previous text's box
      if (last && box.top + box.height / 2 > last.bottom) g.classList.add('at-start');
    });
  }

  check();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
  addEventListener('resize', check);
})();

/* Ring carousel (carousel.html), after Bencho's 3D Card Carousel. The
   reels sit on a turntable seen from slightly above: the front one is full
   size, the back ones shrink and ride up. Drag to turn it — the angle is
   never wrapped, so a card never takes the long way round. Let go and a
   spring carries the ring on at the finger's own speed, lands where that
   momentum would have run out (the nearest card to there), and can be
   grabbed again at any point mid-flight. At rest each card bobs on its own
   rhythm (CSS). Everything is 2D, so paint order is set by hand from how
   near the front a card is. Only the front three reels play. */
(function ringCarousel() {
  var track = document.getElementById('car-track');
  if (!track) return;                                    // not this page

  var slots = Array.prototype.slice.call(track.querySelectorAll('.car-slot'));
  var cards = slots.map(function (s) { return s.querySelector('.car-card'); });
  var vids = slots.map(function (s) { return s.querySelector('video'); });
  var nameEl = document.getElementById('ring-name');
  var countEl = document.getElementById('ring-count');
  var n = slots.length;
  if (!n) return;

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DEPTH = 100;        // how much smaller the back gets (0–150)
  var LIFT = 38;          // px the back rides up; keep in sync with --lift
  var PULL = 140;         // px of drag per card
  var MAX_THROW = 2;      // cards a flick may carry past the release point
  var DECEL = .995;       // momentum projection's deceleration rate (per ms)
  var REST = [-4.2, 2.6, -1.4, 3.8, 1.7];             // each card's resting tilt, deg
  var BOB = [4.7, 5.9, 6.7, 5.3, 7.1, 6.1];           // bob periods, s
  var FLOAT = .15;        // how much they drift at rest (0–1)
  var SPREAD = .62;       // orbit is at least this × the widest card, so the
                          // neighbours show instead of hiding behind the front one
  var EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

  var lift = LIFT, orbit = 0;
  function measure() {
    var cs = getComputedStyle(track.parentNode);
    lift = parseFloat(cs.getPropertyValue('--lift')) || LIFT;
    var widest = 0;
    slots.forEach(function (s) { widest = Math.max(widest, s.offsetWidth); });
    // keep the ring inside the frame where it can, but never so tight that
    // the front card covers its neighbours; past that the sides run under
    // the frame's fade
    orbit = Math.max((track.clientWidth - widest) / 2, widest * SPREAD);
  }

  slots.forEach(function (s, i) {
    var f = s.querySelector('.car-float');
    f.style.setProperty('--dur', BOB[i % BOB.length] + 's');
    f.style.setProperty('--bob', (FLOAT * 16).toFixed(2) + 'px');
    f.style.setProperty('--sway', (FLOAT * 1.4).toFixed(2) + 'deg');
  });

  var turn = 0;                                        // start on the first card
  var mod = function (a, b) { return ((a % b) + b) % b; };
  var playing = [];
  var captionAnim = null;

  function place() {
    var near = [];
    for (var i = 0; i < n; i++) {
      var th = (i - turn) * (Math.PI * 2 / n);
      var f = (Math.cos(th) + 1) / 2;                   // 1 front, 0 back
      var x = Math.sin(th) * orbit;
      var y = -(1 - f) * lift;                          // the back rides up
      var sc = (1 - DEPTH / 200) + (DEPTH / 200) * f;
      slots[i].style.transform = 'translate(-50%, -50%) translate(' + x.toFixed(2) + 'px, ' +
        y.toFixed(2) + 'px) rotate(' + REST[i % REST.length] + 'deg) scale(' + sc.toFixed(4) + ')';
      slots[i].style.zIndex = String(Math.round(f * 100));   // paint order, by hand
      if (f > .5) near.push(i);                          // the front half of the ring
    }
    var front = mod(Math.round(turn), n);
    if (nameEl && nameEl.textContent !== slots[front].dataset.name) {
      nameEl.textContent = slots[front].dataset.name;
      if (countEl) countEl.textContent = (front + 1) + ' / ' + n;
      // a quick fade over the swap, so the words don't just flip mid-drag
      if (nameEl.animate && !reduced) {
        if (captionAnim) captionAnim.cancel();
        captionAnim = nameEl.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 160, easing: EASE_OUT });
      }
    }
    // only the reels at the front play; the rest wait, paused, round the back
    if (near.join() !== playing.join()) {
      vids.forEach(function (v, i) {
        if (!v) return;
        if (near.indexOf(i) >= 0) { if (v.paused) play(v); }
        else if (!v.paused) v.pause();
      });
      playing = near;
    }
  }

  /* ── spring: the ring's own motion between gestures ──
     A spring rather than a timed ease, so it can start at whatever speed
     the finger let go at (no seam between dragging and gliding) and be
     grabbed again mid-flight. Apple's two knobs: response (s) and damping
     ratio — critically damped for a step, a little under for a throw, so
     the bounce only ever comes from momentum the user put in. */
  var vel = 0;            // cards per second
  var raf = 0;
  function springTo(target, response, zeta) {
    cancelAnimationFrame(raf);
    if (reduced) { turn = target; vel = 0; place(); return; }
    var k = Math.pow(2 * Math.PI / response, 2);
    var c = 2 * zeta * Math.sqrt(k);
    var last = performance.now();
    (function step(now) {
      var dt = Math.min(32, now - last) / 1000; last = now;
      var acc = -k * (turn - target) - c * vel;
      vel += acc * dt;
      turn += vel * dt;
      if (Math.abs(turn - target) < .0005 && Math.abs(vel) < .005) { turn = target; vel = 0; place(); return; }
      place();
      raf = requestAnimationFrame(step);
    })(last);
  }
  function stepBy(d) { vel = 0; springTo(Math.round(turn) + d, .3, 1); }

  /* ── drag ── */
  var drag = null;
  track.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || drag) return;                 // one finger drives; extras are ignored
    cancelAnimationFrame(raf);                          // grab it mid-flight, from where it is
    drag = { id: e.pointerId, x0: e.clientX, t0: turn, last: e.clientX, t: e.timeStamp, vx: 0 };
    track.classList.add('is-held');
    try { track.setPointerCapture(e.pointerId); } catch (err) {}
  });
  track.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dt = Math.max(1, e.timeStamp - drag.t);
    var vx = Math.max(-6, Math.min(6, (e.clientX - drag.last) / dt));   // px/ms; 6 is already a hard flick
    drag.vx = (drag.vx + vx) / 2;                                        // smoothed
    drag.last = e.clientX; drag.t = e.timeStamp;
    turn = drag.t0 - (e.clientX - drag.x0) / PULL;           // 1:1, no clamp, no wrap
    place();
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    track.classList.remove('is-held');
    // A finger that stops and then lifts sends no moves while it is still,
    // so the last recorded speed would still be the swipe's. Only carry
    // momentum if the release follows straight on from the movement.
    var vx = e.type === 'pointercancel' || e.timeStamp - d.t > 80 ? 0 : d.vx;
    vel = -vx * 1000 / PULL;                                 // px/ms → cards/s
    // land where this momentum would run out, on the nearest card to there
    var projected = turn + (vel / 1000) * DECEL / (1 - DECEL);
    var target = Math.round(Math.max(turn - MAX_THROW, Math.min(turn + MAX_THROW, projected)));
    var thrown = Math.abs(vel) > 1.5;
    springTo(target, thrown ? .42 : .36, thrown ? .82 : 1);
  }
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  track.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    stepBy(d);
  });

  measure();
  place();
  addEventListener('resize', function () { measure(); place(); });

  // The markup carries each reel's aspect; trust the file once it is known.
  // (After place() is live: with the files cached this runs synchronously.)
  vids.forEach(function (v, i) {
    if (!v) return;
    var fix = function () {
      if (!v.videoWidth) return;
      slots[i].style.setProperty('--ar', v.videoWidth + ' / ' + v.videoHeight);
      measure(); place();
    };
    if (v.readyState >= 1) fix();
    else v.addEventListener('loadedmetadata', fix, { once: true });
  });

  /* ── in: the cards rise into place, front first ──
     Web Animations rather than a rAF tween, so it stays smooth while the
     reels are still loading, and on the card (not the slot, which the ring
     owns, nor the float, which the bob owns). */
  function enter() {
    cards.forEach(function (card, i) {
      if (!card.animate) return;
      var rank = Math.min(i, n - i);                     // distance from the front, in cards
      card.animate(
        reduced ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }],
        { duration: reduced ? 200 : 520, delay: reduced ? 0 : rank * 55, easing: EASE_OUT, fill: 'backwards' });
    });
  }
  enter();
})();

(function heroIntro() {
  var root = document.documentElement;
  var reveal = function () { root.classList.remove('pre-anim'); };

  // Other animations (the about photo) wait for this. The attribute is for
  // anything that starts listening late; the event for anything already waiting.
  var finished = false;
  var done = function () {
    if (finished) return;
    finished = true;
    root.setAttribute('data-intro', 'done');
    document.dispatchEvent(new Event('intro:done'));
  };

  var para = document.querySelector('.about__text');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!para || !para.animate || reduced) { reveal(); done(); return; }

  // Links, logo marks and the signature animate whole rather than per word.
  var units = splitWords(para, 'a, .mark, .ico, .signature');

  var statusRow = document.querySelector('.statusbar__row');
  var label = document.querySelector('.about > .section-label');
  var actions = Array.prototype.slice.call(document.querySelectorAll('.about__actions > *'));
  var later = Array.prototype.slice.call(document.querySelectorAll('.testimonials, .works, .services, .page-cta'));   // home only

  var OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  var SOFT = 'cubic-bezier(0.25, 1, 0.5, 1)';

  /* Web Animations rather than a rAF tween: this plays while the page is at
     its busiest (fonts settling, eight reels starting to load), and a
     requestAnimationFrame loop is the first thing to drop frames then. These
     run off the main thread. `fill: backwards` holds each start state from
     the moment the animation is created, so the class can drop in the same
     tick and nothing ever paints un-animated; with no forwards fill, every
     element returns to its own style when done — the words to plain,
     subpixel-rendered text with no filter left on them. */
  function run() {
    var anims = [];
    var end = 0;
    var add = function (el, frames, ms, at, easing) {
      if (!el) return;
      anims.push(el.animate(frames, { duration: ms, delay: at, easing: easing || OUT, fill: 'backwards' }));
      end = Math.max(end, at + ms);
    };
    var rise = function (px) { return [{ opacity: 0, transform: 'translateY(' + px + 'px)' }, { opacity: 1, transform: 'none' }]; };

    add(statusRow, rise(6), 700, 0);
    add(label, rise(6), 600, 250);
    // the paragraph, word by word, as a wave of blur moving left to right
    var t = 550;
    units.forEach(function (u, k) {
      add(u, [{ opacity: 0, filter: 'blur(7px)' }, { opacity: 1, filter: 'blur(0px)' }], 750, t + k * 18);
    });
    var wordsEnd = t + (units.length - 1) * 18 + 750;
    actions.forEach(function (a, k) { add(a, rise(10), 600, wordsEnd - 500 + k * 80); });
    var actionsEnd = actions.length ? wordsEnd - 500 + (actions.length - 1) * 80 + 600 : wordsEnd;
    // only once the text has landed: the rest of the page, a plain fade
    later.forEach(function (el, k) { add(el, [{ opacity: 0 }, { opacity: 1 }], 800, actionsEnd - 150 + k * 150, SOFT); });

    reveal();

    Promise.all(anims.map(function (a) { return a.finished; })).then(done, function () {});
    // never leave the page waiting on an animation that can't finish
    setTimeout(function () {
      anims.forEach(function (a) { try { if (a.playState !== 'finished') a.finish(); } catch (e) {} });
      done();
    }, end + 1500);
  }

  // Don't burn the intro while the tab is in the background. Show the hero as
  // it is for now — never leave it sitting at an invisible start state — and
  // play the intro when the page is actually looked at.
  if (document.hidden) {
    reveal();
    document.addEventListener('visibilitychange', function onShow() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onShow);
      run();
    });
  } else {
    run();
  }
})();

/* Colour themes. The active one is resolved before first paint by the inline
   script in <head>; this wires the swatches up to it. */
(function themes() {
  var root = document.documentElement;
  var wrap = document.getElementById('themes');
  if (!wrap) return;

  var swatches = Array.prototype.slice.call(wrap.querySelectorAll('.sw'));
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var chosen = null;
  try { chosen = localStorage.getItem('theme'); } catch (e) {}

  function sync() {
    var cur = root.getAttribute('data-theme');
    swatches.forEach(function (s) {
      s.setAttribute('aria-pressed', String(s.dataset.themeId === cur));
    });
  }

  function apply(next, remember) {
    // Suppress every transition, swap, flush the new styles, restore. Without
    // the flush in the middle the browser would coalesce all three and the
    // transitions would run anyway.
    root.classList.add('theming');
    root.setAttribute('data-theme', next);
    sync();                               // inside the window, so the ring moves instantly too
    void document.body.offsetWidth;
    root.classList.remove('theming');

    if (remember) {
      chosen = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    }
  }

  swatches.forEach(function (s) {
    s.addEventListener('click', function () { apply(s.dataset.themeId, true); });
  });

  // follow the OS while the visitor hasn't picked a theme themselves
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (chosen) return;
      apply(e.matches ? 'dark' : 'light', false);
    });
  }

  sync();
})();


/* ── about page ──────────────────────────────────────────────
   Reveals are driven by IntersectionObserver firing GSAP timelines rather
   than ScrollTrigger, so the page needs no extra plugin. */
(function aboutPage() {
  var photo = document.getElementById('photo');
  if (!photo) return;                                  // not this page

  if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var img = photo.querySelector('img');

  gsap.set(img, { opacity: 0, filter: 'blur(8px)' });

  // a plain fade with a little blur, once the photo comes into view
  function reveal() {
    var tl = gsap.timeline()
      .fromTo(img, { opacity: 0, filter: 'blur(8px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'power2.out' }, 0)
      .add(function () { gsap.set(img, { clearProps: 'filter' }); });   // back to crisp

    // if rAF is throttled the tween never ticks — never leave the photo invisible
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 4000);
  }

  // Two conditions: the hero text has finished, and the photo is on screen.
  // Above the fold that means straight after the text; below it, on scroll.
  var textDone = document.documentElement.getAttribute('data-intro') === 'done';
  var inView = !('IntersectionObserver' in window);
  var started = false;
  function maybe() {
    if (started || !textDone || !inView) return;
    started = true;
    reveal();
  }

  if (!textDone) {
    document.addEventListener('intro:done', function () { textDone = true; maybe(); }, { once: true });
  }

  if (!inView) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        inView = true;
        maybe();
      });
    }, { threshold: .25 });
    io.observe(photo);
  }

  maybe();
})();

/* ── timeline ruler ──────────────────────────────────────────
   The strip slides under a needle fixed at the centre; whichever milestone is
   nearest the needle is the active one. Everything is positioned from the
   `data-date` on each <li>, so the markup stays the single source of truth. */
(function rulerTimeline() {
  var root = document.getElementById('ruler');
  if (!root) return;

  var stage = document.getElementById('ruler-stage');
  var strip = document.getElementById('ruler-strip');
  var ticksEl = document.getElementById('ruler-ticks');
  var yearsEl = document.getElementById('ruler-years');
  var dateEl = document.getElementById('ruler-date');
  var textEl = document.getElementById('ruler-text');
  var cta = root.querySelector('.ruler__cta');
  var marks = Array.prototype.slice.call(root.querySelectorAll('.ms'));
  if (!stage || !strip || !marks.length) return;

  var DAY = 864e5;
  var PX = 2.4;                                   // pixels per day
  var PAD = 75;                                   // days of runway either side

  var items = marks.map(function (el) {
    return {
      el: el,
      t: Date.parse(el.dataset.date + 'T12:00:00Z'),
      body: el.querySelector('.ms__body'),
      now: el.classList.contains('ms--now')
    };
  }).sort(function (a, b) { return a.t - b.t; });

  var start = items[0].t - PAD * DAY;
  var end = items[items.length - 1].t + PAD * DAY;
  var total = (end - start) / DAY * PX;
  var xOf = function (t) { return (t - start) / DAY * PX; };

  strip.style.width = total + 'px';
  stage.setAttribute('aria-valuemax', String(items.length));

  /* ── ruler marks ── */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var tickXs = (function build() {
    var frag = document.createDocumentFragment();
    var yfrag = document.createDocumentFragment();
    var boundaries = [];

    // month and year boundaries first, so weekly ticks can dodge them
    var d = new Date(start);
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    while (d.getTime() <= end) {
      var t = d.getTime();
      if (t >= start) {
        var isYear = d.getUTCMonth() === 0;
        var tick = document.createElement('span');
        tick.className = 'tick ' + (isYear ? 'tick--year' : 'tick--month');
        tick.style.left = xOf(t) + 'px';
        frag.appendChild(tick);
        boundaries.push(xOf(t));

        var lab = document.createElement('span');
        lab.className = 'year';
        lab.style.left = xOf(t) + 'px';
        lab.textContent = isYear ? d.getUTCFullYear() : MONTHS[d.getUTCMonth()];
        if (!isYear) lab.style.opacity = '.55';
        yfrag.appendChild(lab);
      }
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }

    for (var t2 = start; t2 <= end; t2 += 7 * DAY) {
      var x = xOf(t2);
      var clash = boundaries.some(function (b) { return Math.abs(b - x) < 5; });
      if (clash) continue;
      var w = document.createElement('span');
      w.className = 'tick';
      w.style.left = x + 'px';
      frag.appendChild(w);
      boundaries.push(x);
    }

    ticksEl.appendChild(frag);
    yearsEl.appendChild(yfrag);
    return boundaries;
  })();

  /* Snap every milestone onto the nearest tick, so a label and its stripe
     always sit on a line of the measure rather than between two. Ticks are
     weekly, so this moves a date by at most ~3 days — and the months Jacob
     gave are what matter, not the exact day. */
  items.forEach(function (it) {
    var want = xOf(it.t);
    var best = want, bestD = Infinity;
    tickXs.forEach(function (x) {
      var d = Math.abs(x - want);
      if (d < bestD) { bestD = d; best = x; }
    });
    it.x = best;
    it.el.style.left = best + 'px';
  });

  /* How far the crosshair has to reach to touch each label. Its foot sits 96px
     below the stage top, so the height is that minus where the label ends —
     which differs because every other milestone sits higher. */
  var NEEDLE_BASE = 34;
  function measureReach() {
    items.forEach(function (it) {
      it.reach = Math.max(NEEDLE_BASE, 96 - (it.el.offsetTop + it.el.offsetHeight));
    });
  }
  measureReach();

  /* ── position ── */
  var pos = items[0].x;                           // where the needle sits, in strip px
  var active = -1;

  /* The strip's own motion. A drag writes its position straight through, 1:1
     with the finger; everything else — a click, a key, a release — hands the
     target to a spring, which starts from wherever the strip is and at
     whatever speed it already has, so a release glides on from the drag
     with no seam and a new target mid-flight just bends the path. */
  var cur = 0, v = 0, raf = 0;           // strip offset in px, and px/s
  var reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setXNow(x) {
    cancelAnimationFrame(raf);
    cur = x; v = 0;
    strip.style.transform = 'translate3d(' + x.toFixed(2) + 'px, 0, 0)';
  }
  function springX(target, v0) {
    cancelAnimationFrame(raf);
    if (reducedMotion) { setXNow(target); return; }
    if (typeof v0 === 'number') v = v0;
    var k = Math.pow(2 * Math.PI / .4, 2);  // response .4s
    var c = 2 * Math.sqrt(k);               // critically damped: no overshoot on a ruler
    var last = performance.now();
    (function step(now) {
      var dt = Math.min(32, now - last) / 1000; last = now;
      v += (-k * (cur - target) - c * v) * dt;
      cur += v * dt;
      if (Math.abs(cur - target) < .05 && Math.abs(v) < 1) { cur = target; v = 0; }
      strip.style.transform = 'translate3d(' + cur.toFixed(2) + 'px, 0, 0)';
      if (cur !== target) raf = requestAnimationFrame(step);
    })(last);
  }

  function paint(animate) {
    var offset = stage.clientWidth / 2 - pos;
    if (animate === true) springX(offset, animate === true && typeof paint.v0 === 'number' ? paint.v0 : undefined);
    else setXNow(offset);
    paint.v0 = undefined;

    // nearest milestone wins
    var first = active === -1;
    var best = 0, bestD = Infinity;
    items.forEach(function (it, i) {
      var dd = Math.abs(it.x - pos);
      if (dd < bestD) { bestD = dd; best = i; }
    });
    if (best !== active) {
      active = best;
      items.forEach(function (it, i) { it.el.classList.toggle('is-active', i === best); });
      stage.setAttribute('aria-valuenow', String(best + 1));
      show(items[best], first);
    }

    // The crosshair only reaches up to the word once it is genuinely on the
    // milestone, so dragging past one doesn't make it flail.
    var on = bestD < 10;
    stage.style.setProperty('--needle-s', ((on ? items[best].reach : NEEDLE_BASE) / 96).toFixed(4));
  }

  var readoutTl = null;

  function show(it, instant) {
    var d = new Date(it.t);
    var label = MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    if (cta) cta.classList.toggle('is-on', !!it.now);

    // The first readout is written straight out: putting it in a tween's
    // onComplete would leave it blank until the tab is looked at, because
    // requestAnimationFrame is throttled in background tabs.
    // Cloned rather than assigned as text, so a link inside a milestone body
    // (authored markup, not user input) survives into the readout.
    var fill = function () {
      dateEl.textContent = label;
      textEl.replaceChildren.apply(textEl, it.body.cloneNode(true).childNodes);
    };

    if (instant || !window.gsap) { fill(); return; }
    // Kill any cross-fade still running, otherwise a slower earlier one can
    // land after a newer one and write stale text into the readout.
    if (readoutTl) readoutTl.kill();

    // Out is a straight fade: no movement, no blur. In rises 2px with a hint
    // of blur. The stagger is gone too — date and body moving separately was
    // most of what made the swap feel jumpy.
    readoutTl = gsap.timeline()
      .to([dateEl, textEl], {
        opacity: 0,
        duration: .18, ease: 'power2.out',
        onComplete: fill
      })
      .fromTo([dateEl, textEl],
        { y: 2, filter: 'blur(2px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: .35, ease: 'power3.out',
          // drop the filter so the text renders with subpixel antialiasing again
          onComplete: function () { gsap.set([dateEl, textEl], { clearProps: 'filter' }); }
        });
  }

  function goTo(i, animate, v0) {
    i = Math.max(0, Math.min(items.length - 1, i));
    pos = items[i].x;
    paint.v0 = v0;
    paint(animate !== false);
  }

  var clamp = function (v) { return Math.max(0, Math.min(total, v)); };

  /* ── drag ── */
  var down = false, startX = 0, startPos = 0, moved = 0;
  var lastX = 0, lastT = 0, vx = 0;              // finger speed, px/ms, smoothed
  var DECEL = .995;                              // momentum projection, per ms

  stage.addEventListener('pointerdown', function (e) {
    if (down) return;                            // one pointer drives it
    cancelAnimationFrame(raf);                   // grab it mid-glide, from where it is
    pos = clamp(stage.clientWidth / 2 - cur);    // …which is here, not where it was headed
    down = true; moved = 0; vx = 0;
    startX = lastX = e.clientX; lastT = e.timeStamp; startPos = pos;
    stage.classList.add('is-dragging');
  });

  stage.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    // Capture only once this is unmistakably a drag. Capturing on pointerdown
    // would retarget the following click to the stage, so clicking a milestone
    // label would never reach the <li>.
    if (moved > 3 && stage.setPointerCapture) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var dt = Math.max(1, e.timeStamp - lastT);
    vx = (vx + Math.max(-6, Math.min(6, (e.clientX - lastX) / dt))) / 2;
    lastX = e.clientX; lastT = e.timeStamp;
    pos = clamp(startPos - dx);
    paint(false);                                // 1:1 with the finger
  });

  function release(e) {
    if (!down) return;
    down = false;
    stage.classList.remove('is-dragging');
    if (moved <= 2) return;                      // that was a click; the click handler has it
    // A finger that stops and then lifts sends no moves while it is still,
    // so only carry momentum if the release follows straight on from it.
    var speed = e && e.type !== 'pointercancel' && e.timeStamp - lastT <= 80 ? vx : 0;
    // land on the milestone nearest to where this speed would run out
    var projected = clamp(pos - speed * DECEL / (1 - DECEL));
    var best = 0, bestD = Infinity;
    items.forEach(function (it, i) { var d = Math.abs(it.x - projected); if (d < bestD) { bestD = d; best = i; } });
    goTo(best, true, speed * 1000);              // the strip moves with the finger: px/ms → px/s
  }
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    stage.addEventListener(ev, release);
  });
  // a mouse leaving the stage ends the drag; a finger keeps dragging (touch
  // pointers are implicitly captured, and leave fires right after up anyway)
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') release(e);
  });

  // a drag shouldn't count as a click on a label
  // Labels ignore the pointer, so clicks land on the stage; work out which
  // label (if any) was under the pointer from its rect instead.
  stage.addEventListener('click', function (e) {
    if (moved > 4) return;                        // that was a drag, not a click
    for (var i = 0; i < items.length; i++) {
      var r = items[i].el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) { goTo(i); return; }
    }
  });

  /* ── wheel + keyboard ── */
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;   // let the page scroll
    e.preventDefault();
    pos = clamp(pos + e.deltaX);
    paint(false);
  }, { passive: false });

  stage.addEventListener('keydown', function (e) {
    var k = e.key;
    if (k === 'ArrowRight') { e.preventDefault(); goTo(active + 1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); }
    else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(items.length - 1); }
  });

  addEventListener('resize', function () { reserve(); measureReach(); paint(false); });

  /* Reserve the tallest body's height so swapping milestones never nudges the
     page. Measured rather than guessed in CSS, so editing the copy can't
     quietly reintroduce the jump. */
  function reserve() {
    textEl.style.minHeight = '0px';
    var tallest = 0;
    items.forEach(function (it) {
      textEl.replaceChildren.apply(textEl, it.body.cloneNode(true).childNodes);
      tallest = Math.max(tallest, textEl.scrollHeight);
    });
    textEl.style.minHeight = tallest + 'px';
  }

  /* ── first paint, then reveal ── */
  reserve();
  paint(false);

  if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.set(stage, { opacity: 0, y: 18 });
  gsap.set([dateEl, textEl], { opacity: 0 });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
        .to(stage, { opacity: 1, y: 0, duration: .8 })
        .to([dateEl, textEl], { opacity: 1, duration: .5 }, .25)
        .fromTo(marks, { opacity: 0 }, { opacity: 1, duration: .5, stagger: .06 }, .1);

      // same failsafe as the photo: never leave the ruler invisible
      setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 4000);
    });
  }, { threshold: .2 });
  io.observe(root);
})();

/* ── services: lines draw in, rows follow ────────────────────
   Runs when the list comes into view. The whole section also fades in with
   the rest of the page after the hero; this is the detail inside it. */
(function servicesReveal() {
  var list = document.querySelector('.services__list');
  if (!list || !window.gsap) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var rows = Array.prototype.slice.call(list.querySelectorAll('.service'));
  var parts = rows.map(function (r) { return r.querySelectorAll('.service__num, .service__name, .service__desc'); });

  // Real elements for the hairlines, so the draw is a plain transform the
  // compositor can run, rather than a custom property that restyles every
  // frame. The CSS pseudo-element lines stand in when this never runs.
  function rule(parent, cls) {
    var el = document.createElement('span');
    el.className = 'service__rule' + (cls ? ' ' + cls : '');
    el.setAttribute('aria-hidden', 'true');
    parent.appendChild(el);
    return el;
  }
  var rules = rows.map(function (r) { return rule(r); });
  var endRule = rule(list, 'service__rule--end');
  list.classList.add('has-rules');

  gsap.set(rules.concat(endRule), { scaleX: 0 });
  parts.forEach(function (p) { gsap.set(p, { opacity: 0, y: 10 }); });

  function play() {
    // Gentle curves throughout: the lines ease in and out instead of shooting
    // across, and the text rises on a long, soft power2 tail. Rows overlap
    // heavily so it reads as one wave down the list, not four steps.
    var tl = gsap.timeline({
      onComplete: function () { gsap.set(rules.concat(endRule), { clearProps: 'willChange' }); }
    });
    rows.forEach(function (row, i) {
      var at = i * .14;
      tl.fromTo(rules[i], { scaleX: 0 },
          { scaleX: 1, duration: 1.3, ease: 'power3.inOut', willChange: 'transform' }, at)
        .fromTo(parts[i], { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 1, ease: 'power2.out', stagger: .07 }, at + .35);
    });
    tl.fromTo(endRule, { scaleX: 0 },
      { scaleX: 1, duration: 1.3, ease: 'power3.inOut' }, rows.length * .14);

    // never leave the list half-drawn if rAF is throttled
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 5000);
  }

  if (!('IntersectionObserver' in window)) { play(); return; }
  // start as the list's top clears the bottom 15% of the screen, so the draw
  // is already under way by the time the eye gets there
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      play();
    });
  }, { rootMargin: '0px 0px -15% 0px' });
  io.observe(list);
})();
