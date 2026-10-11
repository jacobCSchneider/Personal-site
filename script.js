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
      .to(out.el, { y: -16 * dir, duration: .34, ease: 'power2.in' }, 0)
      .to(out.avatar, { scale: .4, opacity: 0, duration: .26 }, 0);

    // the block resizes underneath both quotes
    tl.to(wrap, { height: target, duration: .5, ease: 'power3.inOut' }, .04);

    // incoming: arrives from the other side, words wash in
    tl.fromTo(into.el, { y: 20 * dir }, { y: 0, duration: .55 }, .18)
      .fromTo(into.words,
        { opacity: 0, filter: 'blur(7px)' },
        { opacity: 1, filter: 'blur(0px)', duration: .5, stagger: { each: .012 } }, .2)
      .fromTo(into.avatar,
        { scale: .3, opacity: 0 },
        { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.4)' }, .22);

    // indicator: the colour comes from .is-active in CSS; this just adds a
    // small pop on the bar that takes over
    tl.fromTo(toDot, { scaleY: .35 }, { scaleY: 1, duration: .45, ease: 'back.out(3)' }, 0);
  }

  function nudge(btn, dir) {
    gsap.fromTo(btn, { x: 4 * dir }, { x: 0, duration: .45, ease: 'power2.out' });
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
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: .6, ease: 'expo.out' }, 0)
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
      .to(vid, Object.assign(flipFrom(source), { duration: .45, ease: 'power3.inOut' }), 0)
      .to(veil, { opacity: 0, duration: .35, ease: 'power2.in' }, .1);
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

(function heroIntro() {
  var root = document.documentElement;
  var reveal = function () { root.classList.remove('pre-anim'); };

  // Other animations (the about photo) wait for this. The attribute is for
  // anything that starts listening late; the event for anything already waiting.
  var done = function () {
    root.setAttribute('data-intro', 'done');
    document.dispatchEvent(new Event('intro:done'));
  };

  var para = document.querySelector('.about__text');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!para || !window.gsap || reduced) { reveal(); done(); return; }

  // Links, logo marks and the signature animate whole rather than per word.
  var units = splitWords(para, 'a, .mark, .ico, .signature');

  var statusRow = document.querySelector('.statusbar__row');
  var label = document.querySelector('.about > .section-label');
  var actions = document.querySelectorAll('.about__actions > *');
  var later = document.querySelectorAll('.testimonials, .works, .services, .page-cta');   // home only

  function run() {
    // Start state and reveal happen in the same tick, so the browser never
    // paints the hero un-animated.
    gsap.set(units, { opacity: 0, filter: 'blur(7px)' });
    gsap.set([statusRow, label], { opacity: 0, y: 6 });
    gsap.set(actions, { opacity: 0, y: 10 });
    gsap.set(later, { opacity: 0 });
    gsap.set(para, { opacity: 1 });
    reveal();

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .to(statusRow, { opacity: 1, y: 0, duration: .7 })
      .to(label, { opacity: 1, y: 0, duration: .6 }, '-=.45')
      .to(units, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: .75,
        stagger: { each: .018 },
        // drop the filter so the text goes back to subpixel rendering
        onComplete: function () { gsap.set(units, { clearProps: 'filter,willChange' }); }
      }, '-=.3');

    // Empty tweens still take up time on a timeline, so these are only added
    // when there is something to animate — the about page has neither, and
    // otherwise its photo would wait ~0.7s for nothing.
    if (actions.length) tl.to(actions, { opacity: 1, y: 0, duration: .6, stagger: .08 }, '-=.5');
    // only once the text has landed: the rest of the page, a plain fade
    if (later.length) tl.to(later, { opacity: 1, duration: .8, ease: 'power2.out', stagger: .15 }, '>-.15');
    tl.add(done);

    // GSAP runs on requestAnimationFrame, which browsers throttle hard in
    // background or occluded tabs. Without this the hero could sit at its
    // start state — invisible — so force the end state if it never ran.
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 5500);
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

  var setX = window.gsap
    ? gsap.quickTo(strip, 'x', { duration: .45, ease: 'power3' })
    : function (v) { strip.style.transform = 'translateX(' + v + 'px)'; };

  function paint(animate) {
    var offset = stage.clientWidth / 2 - pos;
    if (animate === false && window.gsap) gsap.set(strip, { x: offset });
    else setX(offset);

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
    stage.style.setProperty('--needle-h', (on ? items[best].reach : NEEDLE_BASE) + 'px');
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
        duration: .25, ease: 'power2.out',
        onComplete: fill
      })
      .fromTo([dateEl, textEl],
        { y: 2, filter: 'blur(2px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: .5, ease: 'power2.out',
          // drop the filter so the text renders with subpixel antialiasing again
          onComplete: function () { gsap.set([dateEl, textEl], { clearProps: 'filter' }); }
        });
  }

  function goTo(i, animate) {
    i = Math.max(0, Math.min(items.length - 1, i));
    pos = items[i].x;
    paint(animate);
  }

  var clamp = function (v) { return Math.max(0, Math.min(total, v)); };

  /* ── drag ── */
  var down = false, startX = 0, startPos = 0, moved = 0;

  stage.addEventListener('pointerdown', function (e) {
    down = true; moved = 0;
    startX = e.clientX; startPos = pos;
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
    pos = clamp(startPos - dx);
    paint();
  });

  function release() {
    if (!down) return;
    down = false;
    stage.classList.remove('is-dragging');
    // settle on whichever milestone is nearest
    if (moved > 2) goTo(active);
  }
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    stage.addEventListener(ev, release);
  });
  // a mouse leaving the stage ends the drag; a finger keeps dragging (touch
  // pointers are implicitly captured, and leave fires right after up anyway)
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') release();
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
    paint();
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

  gsap.set(rows, { '--draw': 0 });
  gsap.set(list, { '--draw-end': 0 });
  parts.forEach(function (p) { gsap.set(p, { opacity: 0, y: 8 }); });

  function play() {
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // explicit start values: the motion never depends on when GSAP happens
    // to read the elements' current state
    rows.forEach(function (row, i) {
      var at = i * .12;
      tl.fromTo(row, { '--draw': 0 }, { '--draw': 1, duration: .8, ease: 'expo.out' }, at)
        .fromTo(parts[i], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .6, stagger: .05 }, at + .1);
    });
    tl.fromTo(list, { '--draw-end': 0 }, { '--draw-end': 1, duration: .8, ease: 'expo.out' }, rows.length * .12);

    // never leave the list half-drawn if rAF is throttled
    setTimeout(function () { if (tl.progress() < 1) tl.progress(1); }, 4000);
  }

  if (!('IntersectionObserver' in window)) { play(); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      play();
    });
  }, { threshold: .3 });
  io.observe(list);
})();
