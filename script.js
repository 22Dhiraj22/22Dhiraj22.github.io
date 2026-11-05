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

// Work by theme: filter chips with counts
(function () {
  const items = [...document.querySelectorAll(".worklist .wi")];
  const btns = [...document.querySelectorAll(".filters button")];
  if (!items.length) return;
  btns.forEach(b => {
    const f = b.dataset.f, n = f === "all" ? items.length : items.filter(i => i.dataset.t.split(" ").includes(f)).length;
    b.insertAdjacentHTML("beforeend", `<span>${n}</span>`);
    b.addEventListener("click", () => {
      btns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      items.forEach(i => { i.hidden = f !== "all" && !i.dataset.t.split(" ").includes(f); });
    });
  });
})();
