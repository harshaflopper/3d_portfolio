/* Abhi Ayur – phone walkthrough (dollhouse).
 *
 * Stops: the closed building, then the six rooms. Every room clip starts on the same
 * dollhouse frame and ends on that room's photo, so moving from one room to the next
 * is: current clip backwards (rise out to the dollhouse) + next clip forwards (dive in).
 * The opening uses the roof clip backwards (roof lifts off). Scrolling picks the stop;
 * the picture travels there at its own steady pace, like turning a page.
 */
(function () {
  "use strict";

  var phone = window.matchMedia("(orientation: portrait) and (max-width: 820px)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var section = document.getElementById("tour");
  var canvas = section && section.querySelector(".tour-canvas");
  if (!section || !canvas || !canvas.getContext || reduce || !phone.matches) return;

  var root = document.documentElement;
  var ctx = canvas.getContext("2d", { alpha: false });
  var rooms = [].slice.call(section.querySelectorAll(".room"));
  var railButtons = [].slice.call(section.querySelectorAll("[data-goto]"));
  var railFill = section.querySelector(".tr-fill");
  var counter = section.querySelector(".tour-counter");
  var counterValue = section.querySelector(".tc-value");
  var counterStep = section.querySelector(".tc-step");
  var indexName = section.querySelector(".tix-name");
  var indexNum = section.querySelector(".tix-num");

  // ── media ──
  var FRAMES = { 0: 48, 1: 70, 2: 71, 3: 72, 4: 72, 5: 72, 6: 72 }; // clip 0 = roof coming down
  var FWD = 2.5;  // seconds for a dive into a room
  var REV = 1.1;  // seconds for rising back out to the dollhouse
  var OPEN = 1.3; // seconds for the roof lifting off
  function frameUrl(c, i) { return "media/m/f/c" + c + "_" + String(i + 1).padStart(3, "0") + ".webp"; }

  // ── path: list of frames with their durations ──
  // stops: 0 = closed building, 1..6 = rooms
  var path = [];      // {c, i}
  var times = [0];    // cumulative seconds at each path index
  var stopIdx = [];   // path index of each stop
  function add(c, from, to, total) {
    var step = from <= to ? 1 : -1, n = Math.abs(to - from) + 1, dt = total / Math.max(1, n - 1);
    for (var i = from; ; i += step) {
      if (path.length) times.push(times[times.length - 1] + dt);
      path.push({ c: c, i: i });
      if (i === to) break;
    }
  }
  path.push({ c: 0, i: FRAMES[0] - 1 }); // closed building
  stopIdx.push(0);
  add(0, FRAMES[0] - 2, 0, OPEN * (FRAMES[0] - 2) / (FRAMES[0] - 1));
  add(1, 1, FRAMES[1] - 1, FWD); stopIdx.push(path.length - 1);
  for (var r = 2; r <= 6; r++) {
    add(r - 1, FRAMES[r - 1] - 2, 0, REV);
    add(r, 1, FRAMES[r] - 1, FWD);
    stopIdx.push(path.length - 1);
  }
  var stopTime = stopIdx.map(function (i) { return times[i]; });

  // ── stills shown when resting at a stop ──
  var stills = [];
  var stillUrls = ["media/m/rooms/closed.webp"];
  for (var k = 1; k <= 6; k++) stillUrls.push("media/m/rooms/r" + k + ".webp");

  var frames = {};
  Object.keys(FRAMES).forEach(function (c) { frames[c] = []; });

  function load() {
    var queue = [];
    stillUrls.forEach(function (u, k) { queue.push([u, function (img) { stills[k] = img; }]); });
    var seen = {};
    // the opening and first dive first, then the rest; coarse to fine
    [0, 1, 2, 3, 4, 5, 6].forEach(function (c) {
      [6, 3, 1].forEach(function (step) {
        for (var i = 0; i < FRAMES[c]; i += step) {
          var key = c + ":" + i;
          if (seen[key]) continue;
          seen[key] = true;
          (function (c, i) { queue.push([frameUrl(c, i), function (img) { frames[c][i] = img; }]); })(c, i);
        }
        var last = FRAMES[c] - 1;
        if (!seen[c + ":" + last]) { seen[c + ":" + last] = true; queue.push([frameUrl(c, last), function (img) { frames[c][last] = img; }]); }
      });
    });
    var inflight = 0;
    (function pump() {
      while (inflight < 6 && queue.length) {
        var job = queue.shift();
        inflight++;
        (function (url, done) {
          var img = new Image();
          img.decoding = "async";
          var finish = function () { inflight--; pump(); };
          img.onload = function () {
            (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () { done(img); dirty = true; kick(); finish(); });
          };
          img.onerror = finish;
          img.src = url;
        })(job[0], job[1]);
      }
    })();
  }

  // ── drawing ──
  function cover(img, alpha) {
    if (!img || alpha <= 0.003) return;
    var cw = canvas.width, ch = canvas.height, iw = img.naturalWidth, ih = img.naturalHeight;
    var s = Math.max(cw / iw, ch / ih), w = iw * s, h = ih * s;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  function nearestFrame(c, i) {
    var list = frames[c];
    for (var d = 0; d < FRAMES[c]; d++) { if (list[i - d]) return list[i - d]; if (list[i + d]) return list[i + d]; }
    return null;
  }
  // position on the path for a time t (binary search)
  function pathAt(t) {
    var lo = 0, hi = times.length - 1;
    if (t <= 0) return { k: 0, a: 0 };
    if (t >= times[hi]) return { k: hi, a: 0 };
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
    return { k: lo, a: (t - times[lo]) / (times[lo + 1] - times[lo]) };
  }

  function draw() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0c1b11";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";

    var P = pathAt(t);
    var A = path[P.k], B = path[Math.min(path.length - 1, P.k + 1)];
    var imgA = frames[A.c][A.i] || nearestFrame(A.c, A.i);
    var imgB = frames[B.c][B.i];
    cover(imgA, 1);
    if (imgB && P.a > 0.02) cover(imgB, P.a);

    // resting near a stop: the real photo takes over (clip ends match the photos)
    var s = nearestStop(t);
    var near = Math.abs(t - stopTime[s]);
    var fade = 0.28;
    if (near < fade) cover(stills[s], 1 - near / fade);
    ctx.globalAlpha = 1;

    overlay(s, near);
  }

  function nearestStop(time) {
    var best = 0, bd = Infinity;
    stopTime.forEach(function (st, i) { var d = Math.abs(time - st); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // ── overlay ──
  var fmt = new Intl.NumberFormat("en-IN");
  var cumulative = [], running = 0;
  rooms.forEach(function (el, i) { running += Number(el.getAttribute("data-add") || 0); cumulative[i] = running; });
  var intro = document.createElement("div");
  intro.className = "m-intro";
  intro.innerHTML = '<p class="m-intro-lines"><span>The art of living</span><span>The science of life</span></p>' +
    '<p class="m-intro-sub">Abhi Ayur Holistic Health Care &amp; Research Center · Rajajinagar, Bengaluru</p>' +
    '<p class="m-intro-cue">Scroll to open the centre</p>';
  section.querySelector(".tour-pin").appendChild(intro);

  // ── room annotations: pins on the real objects + title and figure on the photo ──
  // x, y are fractions of the room photo (900×1600); side = which way the label runs.
  var ROOMS = [
    {
      "pins": [
        {
          "x": 0.56,
          "y": 0.45,
          "side": "l",
          "t": "Panchakarma & Ayurvedic treatment centres"
        },
        {
          "x": 0.87,
          "y": 0.61,
          "side": "l",
          "t": "Dr. Abdul Khader · Chief Ayurvedic Consultant & Medical Director"
        }
      ],
      "kicker": "Entrance",
      "title": "Ayurvedic Wellness Centres Network",
      "facts": [
        [
          "Total centres",
          "50"
        ],
        [
          "Investment per centre",
          "₹25,00,000 (25 lakhs)"
        ],
        [
          "Total investment",
          "₹12,50,00,000 (12.5 crores)"
        ],
        [
          "Investor return",
          "23% per annum on total investment"
        ]
      ]
    },
    {
      "pins": [
        {
          "x": 0.48,
          "y": 0.38,
          "side": "r",
          "t": "12 consultations per doctor per day (75% utilization)"
        },
        {
          "x": 0.42,
          "y": 0.57,
          "side": "r",
          "t": "₹500 per consultation"
        }
      ],
      "kicker": "Reception",
      "title": "Doctor consultations",
      "figure": [
        "Monthly per centre",
        "₹1,98,000"
      ]
    },
    {
      "pins": [
        {
          "x": 0.66,
          "y": 0.39,
          "side": "l",
          "t": "Diet counseling"
        },
        {
          "x": 0.44,
          "y": 0.47,
          "side": "r",
          "t": "Detox packages"
        },
        {
          "x": 0.63,
          "y": 0.52,
          "side": "l",
          "t": "Wellness programs"
        },
        {
          "x": 0.48,
          "y": 0.575,
          "side": "r",
          "t": "Yoga"
        }
      ],
      "kicker": "Patient waiting lounge",
      "title": "Other services",
      "figure": [
        "Monthly per centre",
        "₹1,50,000"
      ]
    },
    {
      "pins": [
        {
          "x": 0.22,
          "y": 0.44,
          "side": "r",
          "t": "2 doctors · ₹250–₹700 an hour, average ₹400"
        },
        {
          "x": 0.8,
          "y": 0.5,
          "side": "l",
          "t": "2 therapists · ₹25,000 a month each"
        },
        {
          "x": 0.56,
          "y": 0.33,
          "side": "l",
          "t": "1 manager · ₹35,000 a month"
        },
        {
          "x": 0.28,
          "y": 0.58,
          "side": "r",
          "t": "22 days a month, 8 hours a day"
        }
      ],
      "kicker": "Way to treatment",
      "title": "Staffing per centre"
    },
    {
      "pins": [
        {
          "x": 0.575,
          "y": 0.26,
          "side": "l",
          "t": "4 procedures per doctor per day (2 hrs each)"
        },
        {
          "x": 0.3,
          "y": 0.5,
          "side": "r",
          "t": "Swedana (sudation)"
        },
        {
          "x": 0.58,
          "y": 0.565,
          "side": "l",
          "t": "Abhyanga · ₹2,500 per session"
        },
        {
          "x": 0.72,
          "y": 0.4,
          "side": "l",
          "t": "Utilization 70% (Year 1) → 100% (Year 3+)"
        }
      ],
      "kicker": "Therapy room",
      "title": "Panchakarma procedures",
      "figure": [
        "Monthly per centre, at full capacity",
        "₹3,08,000"
      ]
    },
    {
      "pins": [
        {
          "x": 0.48,
          "y": 0.5,
          "side": "r",
          "t": "Inventory ₹1,00,000 a month"
        },
        {
          "x": 0.85,
          "y": 0.43,
          "side": "l",
          "t": "100% markup (₹2,00,000 revenue)"
        }
      ],
      "kicker": "Pharmacy",
      "title": "Ayurvedic medicine sales",
      "figure": [
        "Monthly per centre",
        "₹2,00,000"
      ],
      "note": "Total monthly revenue per centre (Year 3): ₹8,56,000 · annual ₹1,02,72,000"
    }
  ];
  var PHOTO_W = 900, PHOTO_H = 1600;
  var NS = "http://www.w3.org/2000/svg";
  var esc = function (str) { return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
  var layers = ROOMS.map(function (R, r) {
    var el = document.createElement("div");
    el.className = "m-room";
    el.setAttribute("aria-hidden", "true");
    var html = '<div class="m-pins"></div><div class="m-info"><p class="m-kicker"><span class="m-num">' +
      String(r + 1).padStart(2, "0") + '</span>' + esc(R.kicker) + '</p><h2 class="m-title">' + esc(R.title) + '</h2>';
    if (R.facts) {
      html += '<dl class="m-facts">' + R.facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>";
    }
    if (R.figure) html += '<p class="m-figure"><span>' + esc(R.figure[0]) + '</span><strong>' + esc(R.figure[1]) + "</strong></p>";
    if (R.note) html += '<p class="m-note">' + esc(R.note) + "</p>";
    html += "</div>";
    el.innerHTML = html;
    var pinsBox = el.querySelector(".m-pins");
    R.els = R.pins.map(function (pin, i) {
      var a = document.createElement("div");
      a.className = "m-pin m-pin-" + pin.side;
      a.style.setProperty("--i", i);
      a.innerHTML = '<span class="m-dot"></span><svg class="m-lead" width="44" height="30" aria-hidden="true"><polyline points="' +
        (pin.side === "r" ? "0,30 22,6 44,6" : "44,30 22,6 0,6") + '"/></svg><span class="m-label">' + esc(pin.t) + "</span>";
      pinsBox.appendChild(a);
      return a;
    });
    section.querySelector(".tour-pin").appendChild(el);
    return el;
  });
  function layoutPins() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var sc = Math.max(vw / PHOTO_W, vh / PHOTO_H), w = PHOTO_W * sc, h = PHOTO_H * sc;
    var ox = (vw - w) / 2, oy = (vh - h) / 2;
    ROOMS.forEach(function (R) {
      R.pins.forEach(function (pin, i) {
        var x = ox + pin.x * w, y = oy + pin.y * h;
        var a = R.els[i];
        a.style.left = x.toFixed(1) + "px";
        a.style.top = y.toFixed(1) + "px";
        // keep the label on screen
        var room = pin.side === "r" ? vw - x - 52 : x - 52;
        a.style.setProperty("--room", Math.max(90, Math.min(190, room - 10)) + "px");
      });
    });
  }

  var shownStop = -1, settledRoom = -1, shownMoney = 0, moneyAnim = null;
  function overlay(s, near) {
    var settled = near < 0.06 && Math.abs(t - target) < 0.06;
    // intro
    intro.style.opacity = (s === 0 ? Math.max(0, 1 - near / 0.5) : 0).toFixed(3);
    root.classList.toggle("m-at-intro", s === 0 && near < 0.3);
    // room annotations
    layers.forEach(function (el, r) { el.classList.toggle("is-on", s === r + 1 && settled); });
    // room articles stay for screen readers
    rooms.forEach(function (el, r) {
      var on = s === r + 1 && settled;
      el.classList.toggle("is-active", on);
      el.classList.toggle("is-visible", s === r + 1 && near < 0.5);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    // progress dots and index follow the nearest room
    var room = Math.max(0, s - 1);
    if (s !== shownStop) {
      shownStop = s;
      railButtons.forEach(function (b, i) { if (i === room && s > 0) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
      if (s > 0) rollIndex(room);
    }
    if (railFill) railFill.style.transform = "scaleX(" + Math.max(0, Math.min(1, (t - stopTime[1]) / (stopTime[6] - stopTime[1]))).toFixed(4) + ")";
    // money counter updates when you arrive in a room
    if (settled && s > 0 && settledRoom !== room) {
      var prev = settledRoom;
      settledRoom = room;
      var add = Number(rooms[room].getAttribute("data-add") || 0);
      var title = ((rooms[room].querySelector("h1, h2") || {}).textContent || "").toLowerCase();
      counterStep.textContent = add && room > prev ? "+₹" + fmt.format(add) + " · " + title : "";
      var from = shownMoney, to = cumulative[room], t0 = performance.now();
      if (moneyAnim) cancelAnimationFrame(moneyAnim);
      (function tick(now) {
        var k = Math.min(1, (now - t0) / 900);
        shownMoney = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 4)));
        counterValue.textContent = "₹" + fmt.format(shownMoney);
        if (k < 1) moneyAnim = requestAnimationFrame(tick);
      })(t0);
    }
    counter.classList.toggle("on", s > 0 || near > 0.3);
  }

  var lastIndex = -1;
  function rollIndex(r) {
    if (r === lastIndex) return;
    var dir = r > lastIndex ? 1 : -1;
    lastIndex = r;
    indexName.textContent = railButtons[r].textContent.trim();
    var old = indexNum.querySelector(".tix-roll:not(.leaving)");
    var neu = document.createElement("span");
    neu.className = "tix-roll";
    neu.textContent = String(r + 1).padStart(2, "0");
    if (!old) { indexNum.appendChild(neu); return; }
    if (old.textContent === neu.textContent) return;
    neu.style.transform = "translateY(" + dir * 100 + "%)";
    indexNum.appendChild(neu);
    old.classList.add("leaving");
    old.style.transform = "translateY(" + -dir * 100 + "%)";
    old.style.opacity = "0";
    setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 650);
    requestAnimationFrame(function () { requestAnimationFrame(function () { neu.style.transform = "translateY(0)"; }); });
  }

  // ── motion: the picture travels to the chosen stop at its own pace ──
  var t = 0, target = 0, tween = null, rafId = null, dirty = true;
  // cubic-bezier(0.3, 0.1, 0.2, 1): starts at once, glides, lands softly
  function ease(x) {
    var x1 = 0.3, y1 = 0.1, x2 = 0.2, y2 = 1;
    function bx(u) { return 3 * x1 * u * (1 - u) * (1 - u) + 3 * x2 * u * u * (1 - u) + u * u * u; }
    function by(u) { return 3 * y1 * u * (1 - u) * (1 - u) + 3 * y2 * u * u * (1 - u) + u * u * u; }
    var lo = 0, hi = 1, u = x;
    for (var n = 0; n < 24; n++) { u = (lo + hi) / 2; if (bx(u) < x) lo = u; else hi = u; }
    return by(u);
  }
  function setTarget(nt) {
    if (nt === target) return;
    target = nt;
    var dist = Math.abs(target - t);
    // long jumps (several rooms) travel faster so nobody waits
    var dur = dist <= 3 ? dist : 3 + (dist - 3) * 0.3;
    tween = { from: t, to: target, start: performance.now(), dur: Math.max(0.25, dur) * 1000 };
    kick();
  }
  function frame(now) {
    rafId = null;
    if (tween) {
      var k = Math.min(1, (now - tween.start) / tween.dur);
      t = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) tween = null;
      dirty = true;
    }
    if (dirty) { dirty = false; draw(); }
    if (tween) kick();
  }
  function kick() { if (rafId === null) rafId = requestAnimationFrame(frame); }

  // scroll position → stop
  var STOPS = stopTime.length;
  function stopFromScroll() {
    var total = section.offsetHeight - window.innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / total)) : 0;
    return Math.round(p * (STOPS - 1));
  }
  function onScroll() {
    setTarget(stopTime[stopFromScroll()]);
    root.classList.toggle("past-tour", section.getBoundingClientRect().bottom < window.innerHeight * 0.5);
  }
  function onResize() {
    layoutPins();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    dirty = true;
    kick();
  }
  function goTo(stop) {
    var total = section.offsetHeight - window.innerHeight;
    var top = section.getBoundingClientRect().top + window.scrollY + (stop / (STOPS - 1)) * total;
    window.scrollTo({ top: top, behavior: "smooth" });
  }
  railButtons.forEach(function (b) { b.addEventListener("click", function () { goTo(Number(b.getAttribute("data-goto")) + 1); }); });

  // snap points: one per stop
  for (var sp = 0; sp < STOPS; sp++) {
    var d = document.createElement("div");
    d.className = "m-snap";
    d.style.top = (sp * 100) + "svh";
    section.appendChild(d);
  }

  // switching between phone and desktop layout: reload to pick the right player
  phone.addEventListener("change", function () { location.reload(); });

  // ── start ──
  root.classList.add("mtour-on");
  section.style.height = ((STOPS - 1) * 100 + 100) + "svh";
  onResize();
  t = target = stopTime[stopFromScroll()];
  load();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.__mtour = { now: function () { return [t, target, !!tween]; }, stops: stopTime, jump: function (s) { tween = null; t = target = stopTime[s]; dirty = true; kick(); }, at: function (x) { tween = null; t = target = x; dirty = true; kick(); } };
})();
