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

// Optional video mode (the "AI character" look): drop a clip at assets/hero.mp4 where the
// character turns from looking far LEFT (start) to far RIGHT (end). The cursor's X position
// then picks the frame, so the character appears to follow it. Without the file, the SVG stays.
(async function () {
  const stage = document.querySelector(".stage"), canvas = document.getElementById("stage-canvas");
  if (!stage || !canvas || !window.createImageBitmap) return;
  const src = "assets/hero.mp4";
  try { if (!(await fetch(src, { method: "HEAD" })).ok) return; } catch (e) { return; }

  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = src;
  try {
    await new Promise((ok, fail) => { v.addEventListener("loadeddata", ok, { once: true }); v.addEventListener("error", fail, { once: true }); });
  } catch (e) { return; }

  // Pre-extract frames once so moving the cursor is instant (no laggy video seeking)
  const N = 40, frames = [];
  const w = Math.min(v.videoWidth, innerWidth < 860 ? 640 : 1100);
  for (let i = 0; i < N; i++) {
    v.currentTime = Math.max(0, v.duration - 0.05) * i / (N - 1);
    await new Promise(r => v.addEventListener("seeked", r, { once: true }));
    frames.push(await createImageBitmap(v, { resizeWidth: w, resizeQuality: "high" }));
  }
  stage.classList.add("has-video");

  const ctx = canvas.getContext("2d");
  let target = 0.5, cur = 0.5, last = -1;
  addEventListener("pointermove", e => { target = e.clientX / innerWidth; }, { passive: true });
  const size = () => { const d = devicePixelRatio || 1; canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; last = -1; };
  addEventListener("resize", size); size();

  (function draw() {
    cur += (target - cur) * 0.12;
    const idx = Math.round(Math.min(Math.max(cur, 0), 1) * (N - 1));
    if (idx !== last) {
      const f = frames[idx], s = Math.max(canvas.width / f.width, canvas.height / f.height);
      const dw = f.width * s, dh = f.height * s;
      ctx.drawImage(f, (canvas.width - dw) / 2, canvas.height - dh, dw, dh); // cover, bottom-aligned
      last = idx;
    }
    requestAnimationFrame(draw);
  })();
})();
