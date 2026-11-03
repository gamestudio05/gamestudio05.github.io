/* Game Studio 05 site script. No dependencies, no trackers.
   Everything here is progressive: the pages work fully without it. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function reduced() { return motionQuery.matches; }
  var hasIO = "IntersectionObserver" in window;

  /* ------------------------------------------------------------------
     Attract loop: the Scout climbing an endless hill, horde behind it.
     ------------------------------------------------------------------ */
  var IMG = "/assets/img/hero/";
  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.decoding = "async";
      im.onload = function () { resolve(im); };
      im.onerror = reject;
      im.src = src;
    });
  }

  // Scout geometry in metres, from the game's own vehicle data.
  var CAR = { w: 3.611, h: 1.31, sx: -0.002, sy: 0.399, rearX: -1.15, frontX: 1.15, axleY: -0.082, r: 0.43 };
  var HORDE = { cw: 143, ch: 169, frames: 6, rows: 4, metres: 2.05 };

  function ground(x) {
    return 0.055 * x + 0.9 * Math.sin(x * 0.14) + 0.45 * Math.sin(x * 0.33 + 1.3) + 0.13 * Math.sin(x * 0.9 + 0.4);
  }

  function Attract(canvas, art) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.art = art;
    this.t = 0;
    this.x = 30;            // car position along the hill, metres
    this.speed = 9;         // metres per second
    this.spin = 0;
    this.sus = 0; this.susV = 0; this.prevMid = null; this.prevVel = 0;
    this.camY = ground(this.x);
    this.enter = 0;         // 0..1 drive-in progress
    this.dust = [];
    this.running = false;
    this.visible = true;
    this.last = 0;
    this.horde = [
      { d: 4.6, row: 2, ph: 0.3 }, { d: 6.4, row: 0, ph: 1.7 }, { d: 8.1, row: 1, ph: 2.9 },
      { d: 9.9, row: 3, ph: 4.1 }, { d: 11.8, row: 2, ph: 5.2 }, { d: 13.4, row: 1, ph: 0.9 }
    ];
    this.pattern = this.ctx.createPattern(art.ground, "repeat");
    this.resize();
  }
  Attract.prototype.resize = function () {
    var r = this.c.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.k = Math.max(44, Math.min(86, this.w * 0.068));
    this.carScreen = this.w * (this.w < 700 ? 0.6 : 0.68);
    this.baseY = this.h * (this.w < 700 ? 0.58 : 0.6);
  };
  Attract.prototype.sy = function (y) { return this.baseY - (y - this.camY) * this.k; };
  Attract.prototype.step = function (dt) {
    this.t += dt;
    this.x += this.speed * dt;
    this.spin += (this.speed * dt) / CAR.r;
    if (this.enter < 1) this.enter = Math.min(1, this.enter + dt / 1.8);
    var target = ground(this.x) + 0.4;
    this.camY += (target - this.camY) * Math.min(1, dt * 1.6);
    // Suspension: a damped spring driven by the hill's vertical acceleration.
    var mid = (ground(this.x + CAR.rearX) + ground(this.x + CAR.frontX)) / 2;
    if (this.prevMid !== null && dt > 0) {
      var vel = (mid - this.prevMid) / dt;
      var acc = (vel - this.prevVel) / dt;
      this.prevVel = vel;
      var force = -70 * this.sus - 9 * this.susV - acc * 0.035;
      this.susV += force * dt;
      this.sus += this.susV * dt;
      this.sus = Math.max(-0.1, Math.min(0.1, this.sus));
    }
    this.prevMid = mid;
    // Dust off the rear tyre.
    if (!reduced() && this.dust.length < 36 && Math.random() < dt * 14) {
      var rx = this.x + CAR.rearX - CAR.r * 0.6;
      this.dust.push({ x: rx, y: ground(rx) + 0.04, vx: -1 - Math.random() * 1.5, vy: 0.25 + Math.random() * 0.5, life: 0, max: 0.45 + Math.random() * 0.4, s: 0.05 + Math.random() * 0.08 });
    }
    for (var i = this.dust.length - 1; i >= 0; i--) {
      var p = this.dust[i];
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 0.97; p.s += dt * 0.22;
      if (p.life > p.max) this.dust.splice(i, 1);
    }
  };
  Attract.prototype.draw = function () {
    var ctx = this.ctx, k = this.k, w = this.w, h = this.h, self = this;
    ctx.clearRect(0, 0, w, h);
    var ease = 1 - Math.pow(1 - this.enter, 3);
    var screenX = -260 + (this.carScreen + 260) * ease;
    function wx(px) { return self.x + (px - screenX) / k; }
    function px(x) { return screenX + (x - self.x) * k; }

    // Terrain.
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var sx = 0; sx <= w + 8; sx += 8) ctx.lineTo(sx, this.sy(ground(wx(sx))));
    ctx.lineTo(w + 8, h);
    ctx.closePath();
    if (this.pattern && this.pattern.setTransform && window.DOMMatrix) {
      this.pattern.setTransform(new DOMMatrix().translateSelf(-((this.x * k) % 256), (this.camY * k) % 256));
    }
    ctx.fillStyle = this.pattern || "#5a3826";
    ctx.fill();
    var fade = ctx.createLinearGradient(0, this.baseY - k * 2, 0, h);
    fade.addColorStop(0, "rgba(14,10,8,0)");
    fade.addColorStop(1, "rgba(14,10,8,0.75)");
    ctx.fillStyle = fade;
    ctx.fill();
    ctx.beginPath();
    for (var ex = 0; ex <= w + 8; ex += 8) {
      var ey = this.sy(ground(wx(ex)));
      if (ex === 0) ctx.moveTo(ex, ey); else ctx.lineTo(ex, ey);
    }
    ctx.lineWidth = Math.max(4, k * 0.09);
    ctx.strokeStyle = "#3b2416";
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(240,180,120,0.55)";
    ctx.stroke();

    // The horde.
    var a = this.art.horde;
    var zh = HORDE.metres * k, zw = zh * HORDE.cw / HORDE.ch;
    for (var z = 0; z < this.horde.length; z++) {
      var m = this.horde[z];
      var d = m.d + 0.8 * Math.sin(this.t * 0.7 + m.ph);
      var zx = this.x - d;
      var zpx = px(zx);
      if (zpx < -zw || zpx > w + zw) continue;
      var frame = Math.floor(this.t * 9 + m.ph * 3) % HORDE.frames;
      var bob = Math.abs(Math.sin(this.t * 9 * Math.PI / 3 + m.ph)) * k * 0.05;
      ctx.drawImage(a, frame * HORDE.cw, m.row * HORDE.ch, HORDE.cw, HORDE.ch, zpx - zw / 2, this.sy(ground(zx)) - zh + k * 0.06 - bob, zw, zh);
    }

    // Dust.
    for (var i = 0; i < this.dust.length; i++) {
      var p = this.dust[i];
      var al = 0.22 * (1 - p.life / p.max);
      ctx.fillStyle = "rgba(214,170,128," + al.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(px(p.x), this.sy(p.y), p.s * k, 0, Math.PI * 2);
      ctx.fill();
    }

    // The Scout.
    var xr = this.x + CAR.rearX, xf = this.x + CAR.frontX;
    var yr = ground(xr) + CAR.r, yf = ground(xf) + CAR.r;
    var ang = Math.atan2(yf - yr, xf - xr);
    var cos = Math.cos(ang), sin = Math.sin(ang);
    var mx = (xr + xf) / 2 - sin * (-CAR.axleY + this.sus), my = (yr + yf) / 2 + cos * (-CAR.axleY + this.sus);
    ctx.save();
    ctx.translate(px(mx), this.sy(my));
    ctx.rotate(-ang);
    ctx.drawImage(this.art.body, (CAR.sx - CAR.w / 2) * k, -(CAR.sy + CAR.h / 2) * k, CAR.w * k, CAR.h * k);
    ctx.restore();
    var wd = CAR.r * 2 * k;
    [[xr, yr], [xf, yf]].forEach(function (wpos) {
      ctx.save();
      ctx.translate(px(wpos[0]), self.sy(wpos[1]));
      ctx.rotate(self.spin);
      ctx.drawImage(self.art.wheel, -wd / 2, -wd / 2, wd, wd);
      ctx.restore();
    });
  };
  Attract.prototype.frame = function (now) {
    if (!this.running) return;
    var dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    this.step(dt);
    this.draw();
    var self = this;
    this.raf = requestAnimationFrame(function (n) { self.frame(n); });
  };
  Attract.prototype.play = function () {
    if (this.running || reduced()) return;
    this.running = true; this.last = 0;
    var self = this;
    this.raf = requestAnimationFrame(function (n) { self.frame(n); });
  };
  Attract.prototype.pause = function () { this.running = false; cancelAnimationFrame(this.raf); };
  Attract.prototype.still = function () {
    // One composed frame for reduced motion: car mid-climb, horde close behind.
    this.enter = 1; this.x = 38.5; this.camY = ground(this.x) + 0.4; this.t = 1.2; this.dust = [];
    this.draw();
  };

  function startAttract() {
    var canvases = document.querySelectorAll("canvas[data-attract]");
    if (!canvases.length || !canvases[0].getContext) return;
    Promise.all([loadImage(IMG + "scout-body.webp"), loadImage(IMG + "scout-wheel.webp"), loadImage(IMG + "horde.webp"), loadImage(IMG + "ground.webp")])
      .then(function (ims) {
        var art = { body: ims[0], wheel: ims[1], horde: ims[2], ground: ims[3] };
        Array.prototype.forEach.call(canvases, function (canvas) {
          var a = new Attract(canvas, art);
          canvas.classList.add("is-ready");
          function sync() {
            if (reduced()) { a.pause(); a.still(); return; }
            if (a.visible && !document.hidden) a.play(); else a.pause();
          }
          if (hasIO) {
            new IntersectionObserver(function (es) { a.visible = es[0].isIntersecting; sync(); }).observe(canvas);
          }
          document.addEventListener("visibilitychange", sync);
          if (motionQuery.addEventListener) motionQuery.addEventListener("change", sync);
          if ("ResizeObserver" in window) {
            new ResizeObserver(function () { a.resize(); if (!a.running) { if (reduced()) a.still(); else a.draw(); } }).observe(canvas);
          }
          sync();
        });
      })
      .catch(function () { /* the photo backdrop stands on its own */ });
  }
  if (document.readyState === "complete") startAttract();
  else window.addEventListener("load", startAttract);

  /* ------------------------------------------------------------------
     Vehicle classes as tabs.
     ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("[data-tabs]"), function (box) {
    var list = box.querySelector("[role=tablist]");
    var tabs = Array.prototype.slice.call(box.querySelectorAll("[role=tab]"));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
    if (!list || !tabs.length) return;
    box.classList.add("js-tabs");
    list.hidden = false;
    function select(i, focus, animate) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      if (animate && !reduced()) {
        var p = panels[i];
        p.classList.remove("is-driving");
        void p.offsetWidth;
        p.classList.add("is-driving");
        setTimeout(function () { p.classList.remove("is-driving"); }, 900);
      }
    }
    var start = tabs.findIndex(function (t) { return t.getAttribute("aria-selected") === "true"; });
    select(start < 0 ? 0 : start, false, false);
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false, true); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = tabs.length - 1;
        if (n !== null) { e.preventDefault(); select(n, true, true); }
      });
    });
  });

  /* ------------------------------------------------------------------
     Stage rail buttons.
     ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("[data-rail]"), function (rail) {
    var list = rail.querySelector("ol");
    var controls = rail.querySelector(".rail-controls");
    if (!list || !controls) return;
    controls.hidden = false;
    var prev = controls.querySelector('[data-dir="-1"]'), next = controls.querySelector('[data-dir="1"]');
    function update() {
      prev.disabled = list.scrollLeft <= 4;
      next.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 4;
    }
    function go(dir) {
      var card = list.querySelector("li");
      var step = card ? card.getBoundingClientRect().width + 18 : list.clientWidth * 0.8;
      var count = Math.max(1, Math.floor(list.clientWidth / step));
      list.scrollBy({ left: dir * step * count, behavior: reduced() ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });

  /* ------------------------------------------------------------------
     Outrun march and night "lights on": only while on screen.
     ------------------------------------------------------------------ */
  if (hasIO) {
    Array.prototype.forEach.call(document.querySelectorAll(".march"), function (m) {
      new IntersectionObserver(function (es) {
        m.classList.toggle("is-on", es[0].isIntersecting && !reduced());
      }).observe(m.parentElement);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-beam]"), function (f) {
      var io = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { f.classList.add("is-lit"); io.disconnect(); }
      }, { threshold: 0.45 });
      io.observe(f);
    });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll("[data-beam]"), function (f) { f.classList.add("is-lit"); });
  }

  /* ------------------------------------------------------------------
     Trailer: poster first, YouTube (no-cookie) only after a click.
     ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll("[data-video]"), function (box) {
    var link = box.querySelector(".video-facade");
    if (!link) return;
    link.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var id = box.getAttribute("data-video");
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1";
      f.title = "Summit Climb trailer";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      box.replaceChild(f, link);
      f.focus();
    });
  });

  /* ------------------------------------------------------------------
     Screenshot lightbox.
     ------------------------------------------------------------------ */
  var dialog = document.querySelector("[data-lightbox]");
  var shots = Array.prototype.slice.call(document.querySelectorAll("a.shot"));
  if (dialog && typeof dialog.showModal === "function" && shots.length) {
    var img = dialog.querySelector("img"), cap = dialog.querySelector("figcaption");
    var index = 0, opener = null;
    function show(i) {
      index = (i + shots.length) % shots.length;
      var a = shots[index];
      img.onerror = function () { img.onerror = null; img.src = a.getAttribute("href"); };
      img.src = a.getAttribute("data-full") || a.getAttribute("href");
      img.alt = a.getAttribute("data-caption") || "";
      cap.textContent = (index + 1) + " / " + shots.length + "  " + (a.getAttribute("data-caption") || "");
    }
    shots.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        opener = a;
        show(i);
        dialog.showModal();
      });
    });
    dialog.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1); });
    dialog.querySelector(".lb-next").addEventListener("click", function () { show(index + 1); });
    dialog.querySelector(".lb-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(index - 1); }
    });
    dialog.addEventListener("close", function () { if (opener) opener.focus(); });
  }

  /* ------------------------------------------------------------------
     Mobile dock: a Play button once the hero is gone, until the ticket.
     ------------------------------------------------------------------ */
  var dock = document.querySelector("[data-dock]");
  var hero = document.querySelector(".hero");
  var ticket = document.querySelector(".ticket-zone");
  if (dock && hero && hasIO) {
    dock.hidden = false;
    dock.inert = true;
    var heroOn = true, ticketOn = false;
    function syncDock() {
      var on = !heroOn && !ticketOn;
      dock.classList.toggle("is-on", on);
      dock.inert = !on;
      if (!on) dock.setAttribute("aria-hidden", "true"); else dock.removeAttribute("aria-hidden");
    }
    new IntersectionObserver(function (es) { heroOn = es[0].isIntersecting; syncDock(); }).observe(hero);
    if (ticket) new IntersectionObserver(function (es) { ticketOn = es[0].isIntersecting; syncDock(); }).observe(ticket);
    syncDock();
  }
})();
