import { $ } from "../lib/dom.js";

/* Kullanıcı seçim yapmadıysa cihazın açık/koyu ayarı izlenir; seçim yaparsa o hatırlanır. */
const kayitli = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
const sistem = matchMedia("(prefers-color-scheme: dark)");
const uygula = koyu => { if (koyu) document.documentElement.setAttribute("data-theme", "dark"); else document.documentElement.removeAttribute("data-theme"); };

let isDark = kayitli() ? kayitli() === "dark" : sistem.matches;
uygula(isDark);
sistem.addEventListener("change", e => { if (!kayitli()) { isDark = e.matches; uygula(isDark); } });

/* Hem Servis Saha ana ekranındaki hem İş Formları üst barındaki tema düğmesi */
["btnTheme", "ssTema"].map($).filter(Boolean).forEach(b => b.addEventListener("click", () => {
  isDark = !isDark;
  uygula(isDark);
  try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch { /* özel sekme */ }
}));
