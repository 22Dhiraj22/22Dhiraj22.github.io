// Theme toggle (remembers choice per browser)
(function () {
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem("theme");
    if (saved) root.setAttribute("data-theme", saved);
  } catch (e) {}
  const btn = document.querySelector(".theme-btn");
  const isDark = () =>
    root.getAttribute("data-theme") === "dark" ||
    (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
  const paint = () => btn && (btn.textContent = isDark() ? "☀" : "☾");
  paint();
  btn && btn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    paint();
  });
})();

// Fade sections in on scroll
(function () {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) return els.forEach(e => e.classList.add("in"));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.1 });
  els.forEach(e => io.observe(e));
})();

// Footer year
document.querySelectorAll("[data-year]").forEach(e => (e.textContent = new Date().getFullYear()));

// Hero buddy: head, face and eyes follow the cursor; blinks; looks around when idle
(function () {
  const wrap = document.querySelector(".buddy");
  const svg = document.getElementById("buddy");
  if (!wrap || !svg) return;
  const $ = id => document.getElementById(id);
  const head = $("b-head"), face = $("b-face"), bangs = $("b-bangs"), hairBack = $("b-hairback");
  const pupils = svg.querySelectorAll(".b-pupil");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let tx = 0, ty = 0, x = 0, y = 0, lastMove = 0;

  addEventListener("pointermove", e => {
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width * 0.5, cy = r.top + r.height * (195 / 460);
    const dx = e.clientX - cx, dy = e.clientY - cy, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(d / 300, 1); // gentler when the cursor is close
    tx = (dx / d) * k; ty = (dy / d) * k; lastMove = performance.now();
  }, { passive: true });

  const mouth = $("b-mouth");
  svg.addEventListener("pointerenter", () => { wrap.classList.add("happy"); mouth.setAttribute("d", "M184 249 Q200 272 216 249"); });
  svg.addEventListener("pointerleave", () => { wrap.classList.remove("happy"); mouth.setAttribute("d", "M186 252 Q200 263 214 252"); });

  function frame(t) {
    if (!reduce && t - lastMove > 2500) { // idle: wander gaze
      tx = Math.sin(t / 1700) * 0.6; ty = Math.sin(t / 2300) * 0.35;
    }
    x += (tx - x) * 0.1; y += (ty - y) * 0.1;
    head.setAttribute("transform", `translate(${x * 8} ${y * 6}) rotate(${x * 7} 200 300)`);
    face.setAttribute("transform", `translate(${x * 9} ${y * 7})`);
    bangs.setAttribute("transform", `translate(${x * 4} ${y * 2})`);
    hairBack.setAttribute("transform", `translate(${x * -4} ${y * -2})`);
    pupils.forEach(p => p.setAttribute("transform", `translate(${x * 5} ${y * 6})`));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (!reduce) (function blink() {
    setTimeout(() => {
      wrap.classList.add("blink");
      setTimeout(() => { wrap.classList.remove("blink"); blink(); }, 130);
    }, 2200 + Math.random() * 3200);
  })();
})();

// Character mode (the "AI character" look): assets/hero/000.jpg … are frames from several AI clips of the
// same woman turning her head. poses.json gives each frame's head direction as [x, y] in degrees
// (x: − screen-left … + screen-right, y: − up … + down), measured per frame with a face-pose model.
// The cursor's direction from HER FACE sets a target direction, a spring eases toward it, and the frame
// whose pose is closest is shown, cross-fading between frames. If the frames can't load, the SVG shows.
(function () {
  const stage = document.querySelector(".stage"), canvas = document.getElementById("stage-canvas");
  if (!stage || !canvas) return;
  const base = stage.dataset.frames;
  if (!base) return;

  const FACE_X = 0.51, FACE_Y = 0.27;  // her face position inside a frame (0..1)
  const Y_WEIGHT = 1.3;                // vertical mismatch counts a bit more than horizontal
  // Phones: keep fewer, smaller frames decoded so the browser doesn't run out of memory
  const lite = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  let poses = [], frames = [], box = null, dirty = true, onScreen = true, backdrop = "#3a0710";
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, px = null, py = null, lastMove = -1e9, lastT = 0;
  let shown = -1, prev = -1, fade = 1, drawnX = 1e9, drawnY = 1e9;

  const load = i => new Promise(res => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => res(false);
    img.onload = async () => {
      // Decode up front so switching frames never stalls the animation
      try { frames[i] = await (lite ? createImageBitmap(img, { resizeWidth: 560, resizeHeight: Math.round(560 * img.naturalHeight / img.naturalWidth), resizeQuality: "high" }) : createImageBitmap(img)); }
      catch (e) { try { await img.decode(); } catch (_) {} frames[i] = img; }
      dirty = true; res(true);
    };
    img.src = base + String(i).padStart(3, "0") + ".jpg";
  });

  // Loaded frame whose pose is closest to (gx, gy)
  function closest(gx, gy) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < poses.length; i++) {
      if (!frames[i]) continue;
      const dx = poses[i][0] - gx, dy = (poses[i][1] - gy) * Y_WEIGHT, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return [best, bd];
  }
  const dist = (i, gx, gy) => { const dx = poses[i][0] - gx, dy = (poses[i][1] - gy) * Y_WEIGHT; return dx * dx + dy * dy; };

  // Where the frame is drawn (device px) — also gives us her face position on screen
  let lastW = 0, lastH = 0;
  function layout() {
    const f = frames[shown]; if (!f) return;
    // Mobile browsers fire resize when the address bar hides; only re-size the canvas when it really changed
    if (canvas.clientWidth === lastW && Math.abs(canvas.clientHeight - lastH) < 2 && box) return;
    lastW = canvas.clientWidth; lastH = canvas.clientHeight;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * d); canvas.height = Math.round(canvas.clientHeight * d);
    const narrow = canvas.clientWidth < 860, cw = canvas.width, ch = canvas.height;
    const h = narrow ? Math.min(ch, 460 * d) : ch * 0.86, w = f.width * h / f.height;
    box = { x: Math.round(cw * (narrow ? 0.5 : 0.72) - w * FACE_X), y: ch - h, w, h, d };
    dirty = true;
  }

  // Cursor → target direction in degrees, as if she were turning to look at the cursor a little way
  // in front of the screen: small moves near her face matter, far away it eases toward full profile.
  function aim() {
    if (px == null || !box) return;
    const r = canvas.getBoundingClientRect();
    const fx = r.left + (box.x + box.w * FACE_X) / box.d, fy = r.top + (box.y + box.h * FACE_Y) / box.d;
    const depth = Math.max(innerWidth, 900) * 0.3, deg = 180 / Math.PI;
    tx = Math.max(-62, Math.min(62, Math.atan2(px - fx, depth) * deg * 1.1));
    // Up/down: the clips have only a few strongly tilted poses, so ease in gently near her eye line
    const ay = Math.atan2(py - fy, depth * 1.4) * deg;
    ty = Math.max(-30, Math.min(30, Math.sign(ay) * Math.pow(Math.abs(ay) / 30, 1.5) * 30));
  }

  function draw(img, alpha) {
    const { x: bx, y: by, w, h } = box, cw = canvas.width, fw = img.width, fh = img.height;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, bx, by, w, h);
    // The frame's backdrop is a smooth gradient: stretch its outer edge pixels to fill the rest of the hero
    if (bx > 0) ctx.drawImage(img, 0, 0, 1, fh, 0, by, bx + 1, h);
    if (bx + w < cw) ctx.drawImage(img, fw - 1, 0, 1, fh, bx + w - 1, by, cw - bx - w + 1, h);
    if (by > 0) {
      ctx.drawImage(img, 0, 0, fw, 1, bx, 0, w, by + 1);
      if (bx > 0) ctx.drawImage(img, 0, 0, 1, 1, 0, 0, bx + 1, by + 1);
      if (bx + w < cw) ctx.drawImage(img, fw - 1, 0, 1, 1, bx + w - 1, 0, cw - bx - w + 1, by + 1);
    }
  }
  function paint() {
    ctx.imageSmoothingQuality = "high";
    if (fade < 1 && frames[prev]) { draw(frames[prev], 1); draw(frames[shown], fade); }
    else draw(frames[shown], 1);
    ctx.globalAlpha = 1;
  }

  function tick(t) {
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05); lastT = t;
    if (!reduce && t - lastMove > 4000) {                  // idle / touch: look around on her own
      tx = Math.sin(t / 1900) * 42; ty = Math.sin(t / 2600 + 1) * 10;
    }
    // Critically damped spring: starts and stops softly, never overshoots, frame-rate independent
    const k = 60, damp = 2 * Math.sqrt(k);
    vx += ((tx - x) * k - vx * damp) * dt; vy += ((ty - y) * k - vy * damp) * dt;
    x += vx * dt; y += vy * dt;
    // Pick the closest pose; only switch when it's clearly closer, so she doesn't flicker between two
    const [best, bd] = closest(x, y);
    if (best >= 0 && best !== shown && (shown < 0 || bd < dist(shown, x, y) - 2)) {
      prev = fade < 0.5 ? prev : shown; shown = best; fade = 0;
    }
    if (fade < 1) { fade = Math.min(1, fade + dt / 0.09); dirty = true; }
    if (box && onScreen && dirty) { paint(); dirty = false; }
    requestAnimationFrame(tick);
  }

  fetch(base + "poses.json").then(r => r.json()).then(async list => {
    poses = list;
    // Load order: the straight-ahead frame first, then always the frame farthest (in pose) from those
    // already queued, so every direction works early and gaps fill in evenly
    const order = [], minGap = lite ? 5 : 0;
    let first = 0, fd = Infinity;
    poses.forEach((p, i) => { const d = p[0] * p[0] + p[1] * p[1]; if (d < fd) { fd = d; first = i; } });
    order.push(first);
    const near = poses.map(p => Math.hypot(p[0] - poses[first][0], p[1] - poses[first][1]));
    for (;;) {
      let far = -1, fdist = minGap;
      near.forEach((d, i) => { if (d > fdist) { fdist = d; far = i; } });
      if (far < 0) break;
      order.push(far);
      poses.forEach((p, i) => { near[i] = Math.min(near[i], Math.hypot(p[0] - poses[far][0], p[1] - poses[far][1])); });
    }
    if (!(await load(first))) return stage.removeAttribute("data-frames");
    shown = first;
    // Match the page background to the frame's backdrop (left edge, where the text sits)
    const p = document.createElement("canvas"); p.width = p.height = 1;
    const pc = p.getContext("2d"); pc.drawImage(frames[first], 0, Math.round(frames[first].height * 0.4), 1, 1, 0, 0, 1, 1);
    const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
    backdrop = `rgb(${r},${g},${b})`;
    stage.style.setProperty("--bg", backdrop);
    stage.classList.add("has-video"); // show the canvas first so it has a size to measure
    layout();
    addEventListener("resize", () => { layout(); aim(); });
    addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); aim(); }, { passive: true });
    addEventListener("scroll", aim, { passive: true });
    // Don't repaint while the hero is scrolled out of view (saves battery on phones)
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; dirty = true; }).observe(stage);
    requestAnimationFrame(tick);
    const rest = order.slice(1);
    for (let i = 0; i < rest.length; i += 6) await Promise.all(rest.slice(i, i + 6).map(load));
  }).catch(() => stage.removeAttribute("data-frames"));
})();
