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

// Character mode (the "AI character" look): assets/hero/000.jpg … 047.jpg are frames from a clip
// where she turns from looking far LEFT (first) to far RIGHT (last). The cursor's X position picks
// the frame, so she appears to follow it. If the frames can't load, the drawn SVG character shows.
(function () {
  const stage = document.querySelector(".stage"), canvas = document.getElementById("stage-canvas");
  if (!stage || !canvas) return;
  const base = stage.dataset.frames, N = +stage.dataset.count || 0;
  if (!base || !N) return stage.removeAttribute("data-frames");

  const frames = new Array(N);
  const ctx = canvas.getContext("2d");
  const CHAR_X = 0.56; // where her face sits horizontally in the video frame (0..1)
  let target = 0.5, cur = 0.5, last = -1, lastMove = 0, backdrop = null, started = false;

  const load = i => new Promise(res => {
    const img = new Image();
    img.onload = () => { frames[i] = img; res(true); };
    img.onerror = () => res(false);
    img.src = base + String(i).padStart(3, "0") + ".jpg";
  });

  // Nearest frame that has loaded so far
  const nearest = idx => {
    for (let d = 0; d < N; d++) {
      if (frames[idx - d]) return frames[idx - d];
      if (frames[idx + d]) return frames[idx + d];
    }
  };

  const size = () => { const d = devicePixelRatio || 1; canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; last = -1; };

  function draw(t) {
    if (t && t - lastMove > 3000) target = 0.5 + 0.42 * Math.sin(t / 1800); // idle / touch: glance around
    cur += (target - cur) * 0.12;
    const idx = Math.round(Math.min(Math.max(cur, 0), 1) * (N - 1));
    const f = nearest(idx);
    if (f && (idx !== last || f !== frames[last])) {
      const cw = canvas.width, ch = canvas.height, d = devicePixelRatio || 1;
      const narrow = canvas.clientWidth < 860;
      const s = (narrow ? Math.min(ch, 460 * d) : ch * 0.9) / f.naturalHeight; // most of the height (desktop) or a 460px band (mobile)
      const dw = f.naturalWidth * s, dh = f.naturalHeight * s;
      const anchor = narrow ? 0.5 : 0.76;                                  // keep her clear of the text on desktop
      ctx.fillStyle = backdrop; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(f, cw * anchor - dw * CHAR_X, ch - dh, dw, dh);
      last = idx;
    }
    requestAnimationFrame(draw);
  }

  // Centre frame first so she appears quickly, then the rest
  const mid = Math.floor(N / 2);
  load(mid).then(ok => {
    if (!ok) return stage.removeAttribute("data-frames");
    // Match the page background to the video's backdrop so there's no visible edge
    const p = document.createElement("canvas"); p.width = p.height = 1;
    const pc = p.getContext("2d"); pc.drawImage(frames[mid], 6, 6, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = pc.getImageData(0, 0, 1, 1).data;
    backdrop = `rgb(${r},${g},${b})`;
    stage.style.setProperty("--bg", backdrop);
    stage.classList.add("has-video"); // show the canvas first so it has a size to measure
    addEventListener("resize", size); size();
    addEventListener("pointermove", e => { target = e.clientX / innerWidth; lastMove = performance.now(); }, { passive: true });
    if (!started) { started = true; requestAnimationFrame(draw); }
    for (let i = 0; i < N; i++) if (i !== mid) load(i);
  });
})();
