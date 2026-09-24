/* Service carousel — 3D coverflow.
   Works with the existing markup: #services > .tile[data-go], #service-prev, #service-next, [data-slide].
   Tapping the centre card books (index.js handles that). Tapping a side card brings it to the centre
   instead of opening it, and a swipe never counts as a tap. */
(function () {
  "use strict";
  var track = document.getElementById("services");
  if (!track) return;
  var cards = Array.prototype.slice.call(track.querySelectorAll(".tile"));
  var n = cards.length;
  if (!n) return;
  var dots = Array.prototype.slice.call(document.querySelectorAll("[data-slide]"));
  var prev = document.getElementById("service-prev");
  var next = document.getElementById("service-next");
  var reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var names = cards.map(function (c) { var t = c.querySelector(".t"); return (t ? t.textContent : c.textContent).trim(); });
  var cur = 0;

  track.setAttribute("aria-roledescription", "carousel");
  cards.forEach(function (c, i) {
    c.setAttribute("aria-roledescription", "slide");
    if (!c.querySelector(".cta")) {
      var s = document.createElement("span");
      s.className = "cta"; s.setAttribute("aria-hidden", "true"); s.textContent = "Book now \u2192";
      c.appendChild(s);
    }
  });

  /* position of card i relative to the current one, wrapped so it's always the short way round */
  function rel(i) {
    var d = (i - cur) % n; if (d < 0) d += n;
    if (d > n / 2) d -= n;
    return d;
  }
  function posName(d) { return d === 0 ? "0" : d === -1 ? "-1" : d === 1 ? "1" : "hidden"; }

  function render() {
    cards.forEach(function (c, i) {
      var pos = posName(rel(i)), old = c.getAttribute("data-pos");
      var crosses = old && old !== pos && (
        (old === "-1" && pos === "1") || (old === "1" && pos === "-1") || old === "hidden" || pos === "hidden");
      if (crosses && !reduce.matches) {
        c.classList.add("wrap");
        c.setAttribute("data-pos", pos);
        void c.offsetWidth;                               /* commit the jump with no transition */
        requestAnimationFrame(function () { requestAnimationFrame(function () { c.classList.remove("wrap"); }); });
      } else {
        c.setAttribute("data-pos", pos);
      }
      var active = pos === "0";
      c.setAttribute("aria-label", (active ? "Book " : "Show ") + names[i] + " (" + (i + 1) + " of " + n + ")");
      c.tabIndex = active ? 0 : -1;                        /* roving tab stop: one card in the tab order */
      c.setAttribute("aria-hidden", pos === "hidden" ? "true" : "false");
    });
    dots.forEach(function (d, i) { d.setAttribute("aria-current", String(i === cur)); });
    if (prev) prev.disabled = n < 2;
    if (next) next.disabled = n < 2;
  }
  function goTo(i, focus) {
    cur = ((i % n) + n) % n; render();
    if (focus) cards[cur].focus({ preventScroll: true });
  }
  function step(d, focus) { goTo(cur + d, focus); }

  if (prev) prev.onclick = function () { step(-1); };
  if (next) next.onclick = function () { step(1); };
  dots.forEach(function (d, i) { d.onclick = function () { goTo(i); }; });

  /* keyboard: arrows move, Home/End jump; Enter/Space on the centre card books (native button) */
  track.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); step(1, true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1, true); }
    else if (e.key === "Home") { e.preventDefault(); goTo(0, true); }
    else if (e.key === "End") { e.preventDefault(); goTo(n - 1, true); }
  });

  /* taps: a side card comes to the centre; only the centre card books.
     Capture phase, so this runs before the card's own click handler in index.js. */
  var suppressClick = false;
  track.addEventListener("click", function (e) {
    var c = e.target.closest ? e.target.closest(".tile") : null;
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; return; }
    if (!c) return;
    var i = cards.indexOf(c);
    if (i !== cur) { e.stopPropagation(); e.preventDefault(); goTo(i); }
  }, true);

  /* swipe / drag with pointer events (touch, mouse, pen) */
  var x0 = null, y0 = null, dx = 0, pid = null, dragging = false;
  var W = function () { return cards[cur].getBoundingClientRect().width || 280; };
  track.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; dx = 0; pid = e.pointerId; dragging = false;
  });
  track.addEventListener("pointermove", function (e) {
    if (x0 === null || e.pointerId !== pid) return;
    dx = e.clientX - x0;
    var dy = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;   /* let vertical scrolling win */
      dragging = true; track.classList.add("dragging");
      try { track.setPointerCapture(pid); } catch (_) {}
    }
    var lim = W() * 0.9;                                                  /* resist past one card */
    var d = Math.max(-lim, Math.min(lim, dx * 0.75));
    track.style.setProperty("--drag", d + "px");
  });
  function endDrag() {
    if (x0 === null) return;
    var wasDragging = dragging;
    track.classList.remove("dragging");
    track.style.setProperty("--drag", "0px");
    if (wasDragging) {
      suppressClick = true; setTimeout(function () { suppressClick = false; }, 400);
      var threshold = Math.min(60, W() * 0.18);
      if (Math.abs(dx) > threshold) step(dx < 0 ? 1 : -1);
    }
    x0 = y0 = pid = null; dx = 0; dragging = false;
  }
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);
  /* Only when the carousel itself loses capture. On touch, Chrome implicitly captures the finger to the
     card it landed on; taking capture for the track makes that card fire lostpointercapture, which
     bubbles here and must NOT end the drag. */
  track.addEventListener("lostpointercapture", function (e) { if (e.target === track && dragging) endDrag(); });

  /* trackpad two-finger swipe / shift+wheel on desktop */
  var wheelLock = false;
  track.addEventListener("wheel", function (e) {
    var h = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!h) return;
    e.preventDefault();
    if (wheelLock || Math.abs(h) < 12) return;
    wheelLock = true; step(h > 0 ? 1 : -1);
    setTimeout(function () { wheelLock = false; }, 520);
  }, { passive: false });

  render();
})();
