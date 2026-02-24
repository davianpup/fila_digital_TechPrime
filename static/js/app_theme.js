// /static/js/theme.js
(function () {
  const KEY = "theme"; // "dark" | "light"

  function getTheme() {
    const t = (localStorage.getItem(KEY) || "").toLowerCase();
    return (t === "light" || t === "dark") ? t : "dark";
  }

  function setTheme(theme) {
    // html
    document.documentElement.setAttribute("data-theme", theme);

    // body classes
    document.body.classList.remove("theme-dark", "theme-light");
    document.body.classList.add(theme === "dark" ? "theme-dark" : "theme-light");

    localStorage.setItem(KEY, theme);

    // ícone
    const btn =
      document.getElementById("btnTheme") ||
      document.querySelector("[data-theme-toggle]") ||
      null;

    if (btn) {
      const icon = btn.querySelector("i");
      if (icon) icon.className = theme === "dark" ? "bi bi-moon" : "bi bi-sun";
    }
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || getTheme();
    const next = cur === "dark" ? "light" : "dark";
    setTheme(next);
  }

  function init() {
    // garante body existir
    setTheme(getTheme());

    const btn =
      document.getElementById("btnTheme") ||
      document.querySelector("[data-theme-toggle]") ||
      null;

    if (!btn) {
      console.warn("[theme] botão de tema não encontrado");
      return;
    }

    btn.addEventListener("click", toggleTheme);
    console.log("[theme] ok, tema atual:", getTheme());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnTheme");
  if (!btn) return;

  const html = document.documentElement;

  // aplica tema salvo
  const saved = localStorage.getItem("theme");
  if (saved) html.setAttribute("data-theme", saved);

  btn.addEventListener("click", () => {
    const current = html.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";

    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
});