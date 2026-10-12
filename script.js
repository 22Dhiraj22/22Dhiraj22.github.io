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

// Character mode: assets/hero/r{row}c{col}.jpg is a grid of head poses of the same portrait.
// Columns turn from looking screen-LEFT (c0) to screen-RIGHT; rows tilt from looking UP (r0) to DOWN.
// The cursor's direction from HER FACE picks a point in that grid, and the 4 nearest poses are
// blended, so she looks wherever the cursor is. If the frames can't load, the SVG character shows.
(function () {
  const stage = document.querySelector(".stage"), canvas = document.getElementById("stage-canvas");
  if (!stage || !canvas) return;
  const base = stage.dataset.frames, COLS = +stage.dataset.cols || 0, ROWS = +stage.dataset.rows || 0;
  if (!base || !COLS || !ROWS) return stage.removeAttribute("data-frames");

  const FACE_X = 0.48, FACE_Y = 0.32; // her face position inside a frame (0..1)
  const CC = (COLS - 1) / 2, CR = (ROWS - 1) / 2; // the pose looking straight at you
  const frames = {}, ctx = canvas.getContext("2d"), reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let backdrop = "#0a0a0a", backdropRGB = "10,10,10";
  let tx = CC, ty = CR, x = CC, y = CR, vx = 0, vy = 0, drawnX = -1, drawnY = -1;
  let px = null, py = null, box = null, dirty = true, lastMove = -1e9, lastT = 0;

  const key = (r, c) => r * COLS + c;
  const load = (r, c) => new Promise(res => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => res(false);
    img.onload = async () => {
      // Decode up front so showing a pose never stalls the animation
      try { frames[key(r, c)] = await createImageBitmap(img); } catch (e) { try { await img.decode(); } catch (_) {} frames[key(r, c)] = img; }
      dirty = true; res(true);
    };
    img.src = `${base}r${r}c${c}.jpg`;
  });
  // Closest loaded pose (while the rest are still loading)
  function pose(r, c) {
    if (frames[key(r, c)]) return frames[key(r, c)];
    let best = null, bd = 1e9;
    for (const k in frames) { const d = Math.abs((k / COLS | 0) - r) + Math.abs(k % COLS - c); if (d < bd) { bd = d; best = frames[k]; } }
    return best;
  }

  // Where the frame is drawn (device px) — also gives us her face position on screen
  function layout() {
    const f = pose(CR, CC); if (!f) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * d); canvas.height = Math.round(canvas.clientHeight * d);
    const narrow = canvas.clientWidth < 860, cw = canvas.width, ch = canvas.height;
    const s = (narrow ? Math.min(ch, 460 * d) : ch * 0.9) / f.height;
    const w = f.width * s, h = f.height * s;
    box = { x: cw * (narrow ? 0.5 : 0.76) - w * FACE_X, y: ch - h, w, h, d };
    dirty = true;
  }

  // Cursor → grid point. Treat the cursor as a point some distance in front of the screen and turn
  // toward it, so near her face small moves matter and far away the turn eases toward its limit.
  function aim() {
    if (px == null || !box) return;
    const r = canvas.getBoundingClientRect();
    const fx = r.left + (box.x + box.w * FACE_X) / box.d, fy = r.top + (box.y + box.h * FACE_Y) / box.d;
    const depth = Math.max(innerWidth, 900) * 0.32;
    const ax = Math.atan2(px - fx, depth), ay = Math.atan2(py - fy, depth);
    const MAX_X = 1.05, MAX_Y = 0.85; // radians at which she reaches the last column / row
    tx = CC + Math.max(-1, Math.min(1, ax / MAX_X)) * CC;
    ty = CR + Math.max(-1, Math.min(1, ay / MAX_Y)) * CR;
  }

  // Draw the 4 surrounding poses with bilinear weights. Drawn in sequence with alpha a_k, image k
  // ends up with weight a_k * Π(1 - a_later), so solve for alphas that give the bilinear weights.
  function paint(gx, gy) {
    const c0 = Math.min(Math.floor(gx), COLS - 2), r0 = Math.min(Math.floor(gy), ROWS - 2);
    const fx = gx - c0, fy = gy - r0;
    const layers = [
      [pose(r0, c0), (1 - fx) * (1 - fy)], [pose(r0, c0 + 1), fx * (1 - fy)],
      [pose(r0 + 1, c0), (1 - fx) * fy], [pose(r0 + 1, c0 + 1), fx * fy],
    ];
    const { x: bx, y: by, w, h } = box;
    ctx.globalAlpha = 1; ctx.fillStyle = backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    let rest = 1, first = true;
    for (const [img, wgt] of layers) {                 // rest = weight still to be laid down
      if (!img) { rest -= wgt; continue; }
      const a = first ? 1 : wgt / rest;
      if (first || a > 0.004) { ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, bx, by, w, h); first = false; }
      rest -= wgt;
    }
    ctx.globalAlpha = 1;
    // Soften the frame's left/right edges into the backdrop so no seam shows
    const fade = w * 0.08;
    for (const [gx2, from, to] of [[bx, 1, 0], [bx + w - fade, 0, 1]]) {
      const g = ctx.createLinearGradient(gx2, 0, gx2 + fade, 0);
      g.addColorStop(0, `rgba(${backdropRGB},${from})`); g.addColorStop(1, `rgba(${backdropRGB},${to})`);
      ctx.fillStyle = g; ctx.fillRect(gx2, by, fade, h);
    }
  }

  function tick(t) {
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05); lastT = t;
    if (!reduce && t - lastMove > 4000) {               // idle / touch: look around on her own
      tx = CC + Math.sin(t / 1900) * CC * 0.6;
      ty = CR + Math.sin(t / 2700 + 1) * CR * 0.45;
    }
    // Critically damped spring: starts and stops softly, never overshoots, frame-rate independent
    const k = 90, damp = 2 * Math.sqrt(k);
    vx += ((tx - x) * k - vx * damp) * dt; vy += ((ty - y) * k - vy * damp) * dt;
    x += vx * dt; y += vy * dt;
    x = Math.min(Math.max(x, 0), COLS - 1); y = Math.min(Math.max(y, 0), ROWS - 1);
    if (box && (dirty || Math.abs(x - drawnX) > 0.002 || Math.abs(y - drawnY) > 0.002)) {
      paint(x, y); drawnX = x; drawnY = y; dirty = false;
    }
    requestAnimationFrame(tick);
  }

  load(CR, CC).then(ok => {
    if (!ok) return stage.removeAttribute("data-frames");
    // Match the page background to the frames' backdrop so there's no visible edge
    const p = document.createElement("canvas"); p.width = p.height = 1;
    const pc = p.getContext("2d"); pc.drawImage(frames[key(CR, CC)], 4, 4, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
    backdropRGB = `${r},${g},${b}`; backdrop = `rgb(${backdropRGB})`;
    stage.style.setProperty("--bg", backdrop);
    stage.classList.add("has-video"); // show the canvas first so it has a size to measure
    layout();
    addEventListener("resize", () => { layout(); aim(); });
    addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); aim(); }, { passive: true });
    addEventListener("scroll", aim, { passive: true });
    requestAnimationFrame(tick);
    // Load the rest outside-in: corners and middles first so every direction works early, then fill in
    const order = [], seen = new Set([key(CR, CC)]);
    const add = (r, c) => { if (!seen.has(key(r, c))) { seen.add(key(r, c)); order.push([r, c]); } };
    for (const step of [4, 2, 1]) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
      if ((c % step === 0 || c === COLS - 1) && (r % Math.min(step, 2) === 0 || r === ROWS - 1)) add(r, c);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) add(r, c);
    (async () => { for (let i = 0; i < order.length; i += 6) await Promise.all(order.slice(i, i + 6).map(([r, c]) => load(r, c))); })();
  });
})();
