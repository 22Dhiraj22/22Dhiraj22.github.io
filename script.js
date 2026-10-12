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

// Character mode (the "AI character" look): assets/hero/000.jpg … are frames from a clip where she
// turns from looking far LEFT (first) to far RIGHT (last); frame data-center looks straight ahead.
// The frame is chosen from where the cursor is relative to HER FACE, and neighbouring frames are
// cross-faded so the turn is smooth. If the frames can't load, the drawn SVG character shows.
(function () {
  const stage = document.querySelector(".stage"), canvas = document.getElementById("stage-canvas");
  if (!stage || !canvas) return;
  const base = stage.dataset.frames, N = +stage.dataset.count || 0, C = +stage.dataset.center || (N >> 1);
  if (!base || !N) return stage.removeAttribute("data-frames");

  const FACE_X = 0.48, FACE_Y = 0.33; // her face position inside a frame (0..1)
  // Phones: keeping every full-size frame decoded can exceed the browser's memory limit and crash the
  // tab, so use every 2nd frame at a smaller size there.
  const lite = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 600;
  const STEP = lite ? 2 : 1;
  const LO = C - Math.floor(C / STEP) * STEP, HI = C + Math.floor((N - 1 - C) / STEP) * STEP;
  const frames = new Array(N), ctx = canvas.getContext("2d");
  let backdrop = "#0a0a0a", target = C, cur = C, drawn = -1, lastMove = -1e9, lastT = 0;
  let px = null, py = null, box = null, dirty = true;

  const load = i => new Promise(res => {
    const img = new Image();
    img.decoding = "async";
    img.onerror = () => res(false);
    img.onload = async () => {
      // Decode up front so showing a frame never stalls the animation
      try { frames[i] = await (lite ? createImageBitmap(img, { resizeWidth: 640, resizeHeight: Math.round(640 * img.naturalHeight / img.naturalWidth), resizeQuality: "high" }) : createImageBitmap(img)); } catch (e) { try { await img.decode(); } catch (_) {} frames[i] = img; }
      dirty = true; res(true);
    };
    img.src = base + String(i).padStart(3, "0") + ".jpg";
  });
  const nearest = i => { for (let d = 0; d < N; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; } };

  // Where the frame is drawn (device px) — also gives us her face position on screen
  let lastW = 0, lastH = 0;
  function layout() {
    const f = frames[C] || nearest(C); if (!f) return;
    // Mobile browsers fire resize when the address bar hides; only re-size the canvas when it really changed
    if (canvas.clientWidth === lastW && Math.abs(canvas.clientHeight - lastH) < 2 && box) return;
    lastW = canvas.clientWidth; lastH = canvas.clientHeight;
    const d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * d); canvas.height = Math.round(canvas.clientHeight * d);
    const narrow = canvas.clientWidth < 860, cw = canvas.width, ch = canvas.height;
    const s = (narrow ? Math.min(ch, 460 * d) : ch * 0.9) / f.height;
    const w = f.width * s, h = f.height * s;
    const x = cw * (narrow ? 0.5 : 0.76) - w * FACE_X, y = ch - h;
    box = { x, y, w, h, d };
    dirty = true;
  }

  // Cursor → frame index, measured from her face: on her face = look straight, further away = turn more
  function aim() {
    if (px == null || !box) return;
    const r = canvas.getBoundingClientRect();
    const fx = r.left + (box.x + box.w * FACE_X) / box.d;
    const dx = px - fx;
    const reach = dx < 0 ? Math.max(fx - r.left, 240) : Math.max(r.right - fx, 240);
    const k = Math.min(Math.abs(dx) / (reach * 0.9), 1);
    const eased = 1 - Math.pow(1 - k, 1.6);            // responsive near her, gentle at the edges
    target = dx < 0 ? C - (C - LO) * eased : C + (HI - C) * eased;
  }

  function paint(pos) {
    const i0 = Math.min(C + Math.floor((pos - C) / STEP) * STEP, HI), i1 = Math.min(i0 + STEP, HI), a = (pos - i0) / STEP;
    const f0 = frames[i0] || nearest(i0), f1 = frames[i1] || f0;
    const { x, y, w, h } = box;
    ctx.globalAlpha = 1; ctx.fillStyle = backdrop; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(f0, x, y, w, h);
    if (a > 0.02 && f1 !== f0) { ctx.globalAlpha = a; ctx.drawImage(f1, x, y, w, h); ctx.globalAlpha = 1; }
    // Soften the frame's left/right edges into the backdrop so no seam shows
    const fade = w * 0.08;
    for (const [gx, from, to] of [[x, 1, 0], [x + w - fade, 0, 1]]) {
      const g = ctx.createLinearGradient(gx, 0, gx + fade, 0);
      g.addColorStop(0, `rgba(${backdropRGB},${from})`); g.addColorStop(1, `rgba(${backdropRGB},${to})`);
      ctx.fillStyle = g; ctx.fillRect(gx, y, fade, h);
    }
  }

  let backdropRGB = "10,10,10", onScreen = true;
  function tick(t) {
    const dt = Math.min((t - lastT) / 1000 || 0.016, 0.05); lastT = t;
    if (t - lastMove > 4000) target = C + Math.sin(t / 1600) * (N * 0.32);  // idle / touch: glance around
    cur += (target - cur) * (1 - Math.exp(-dt * 10));                     // smooth, frame-rate independent
    cur = Math.min(Math.max(cur, LO), HI);
    if (box && onScreen && (dirty || Math.abs(cur - drawn) > 0.004)) { paint(cur); drawn = cur; dirty = false; }
    requestAnimationFrame(tick);
  }

  load(C).then(ok => {
    if (!ok) return stage.removeAttribute("data-frames");
    // Match the page background to the video's backdrop so there's no visible edge
    const p = document.createElement("canvas"); p.width = p.height = 1;
    const pc = p.getContext("2d"); pc.drawImage(frames[C], 4, 4, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
    backdropRGB = `${r},${g},${b}`; backdrop = `rgb(${backdropRGB})`;
    stage.style.setProperty("--bg", backdrop);
    stage.classList.add("has-video"); // show the canvas first so it has a size to measure
    layout();
    addEventListener("resize", () => { layout(); aim(); });
    addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; lastMove = performance.now(); aim(); }, { passive: true });
    addEventListener("scroll", aim, { passive: true });
    // Don't repaint while the hero is scrolled out of view (saves battery on phones)
    if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; dirty = true; }).observe(stage);
    requestAnimationFrame(tick);
    // Load the rest coarse-to-fine so the full turn range is available early
    const order = [];
    for (const step of [8, 4, 2, 1]) for (let i = LO; i <= HI; i += step * STEP) if (!order.includes(i) && i !== C) order.push(i);
    if (!order.includes(HI) && HI !== C) order.splice(1, 0, HI);
    (async () => { for (let k = 0; k < order.length; k += 6) await Promise.all(order.slice(k, k + 6).map(load)); })();
  });
})();
