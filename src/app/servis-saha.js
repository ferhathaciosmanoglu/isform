import { $ } from "../lib/dom.js";
import { htmlGuvenli } from "../lib/text.js";
import { UYGULAMALAR } from "../config/uygulamalar.js";
import { auth } from "../veri/init.js";
import { signOut } from "../veri/auth.js";
import { state } from "../core/state.js";

/* ===== SERVİS - SAHA ANA EKRANI =====
   Girişten sonra saha ekibinin uygulamaları kart olarak listelenir (src/config/uygulamalar.js).
   İç modüller (İş Formları) adres çubuğunda #<id> ile açılır: telefonun geri tuşu ana ekrana döner.
   Diğer uygulamalar kendi adreslerinde, yeni sekmede açılır. */

const svg = (yol, boyut = 24) => `<svg viewBox="0 0 24 24" width="${boyut}" height="${boyut}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${yol}</svg>`;
const DIS = '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>';
const OK = '<path d="M9 6l6 6-6 6"/>';

function kart(u) {
  const ic = `<span class="ss-ik" style="--a:${u.renk[0]};--b:${u.renk[1]}">${svg(u.simge)}</span>
    <span class="ss-yazi"><b>${htmlGuvenli(u.ad)}</b><small>${htmlGuvenli(u.acik)}</small></span>
    <span class="ss-yon" title="${u.ic ? "" : "Yeni sekmede açılır"}">${svg(u.ic ? OK : DIS, 18)}</span>`;
  return u.ic
    ? `<button type="button" class="ss-kart ss-ic" data-uyg="${u.id}">${ic}</button>`
    : `<a class="ss-kart${u.eski ? " ss-eski" : ""}" href="${htmlGuvenli(u.url)}" target="_blank" rel="noopener" data-uyg-dis="${u.id}">${ic}</a>`;
}

const asil = UYGULAMALAR.filter(u => !u.eski), eski = UYGULAMALAR.filter(u => u.eski);
$("ssListe").innerHTML = asil.map(kart).join("");
$("ssEski").innerHTML = eski.length ? `<details class="ss-eski-kutu"><summary>Eski sürümler (${eski.length})</summary><div class="ss-izgara">${eski.map(kart).join("")}</div></details>` : "";

const selam = () => { const h = new Date().getHours(); return h < 6 ? "İyi geceler" : h < 12 ? "Günaydın" : h < 18 ? "İyi günler" : "İyi akşamlar"; };
const adCevir = mail => { const a = String(mail || "").split("@")[0].split(/[._-]/)[0]; return a ? a.charAt(0).toLocaleUpperCase("tr-TR") + a.slice(1) : ""; };

/* Hangi ekran: giriş yapılmışsa adres #is-formlari ise İş Formları, değilse ana ekran */
let hubdanGeldi = false;
function goster() {
  if (!state.aktifKullaniciMail || !state.girisHazir) return;   // giriş ekranını auth.js yönetir
  const isFormlari = location.hash === "#is-formlari";
  $("hubEkrani").style.display = isFormlari ? "none" : "block";
  $("mainApp").style.display = isFormlari ? "block" : "none";
  document.title = isFormlari ? "İş Formları · Servis - Saha" : "Servis - Saha";
  if (!isFormlari) {
    $("ssSelam").textContent = selam() + (adCevir(state.aktifKullaniciMail) ? ", " + adCevir(state.aktifKullaniciMail) : "");
    $("ssTarih").textContent = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  }
  window.scrollTo(0, 0);
}
window.servisSahaGoster = () => { state.girisHazir = true; goster(); };
window.servisSahaGizle = () => { state.girisHazir = false; $("hubEkrani").style.display = "none"; };
window.addEventListener("hashchange", goster);

$("ssListe").addEventListener("click", e => {
  const b = e.target.closest("[data-uyg]"); if (!b) return;
  hubdanGeldi = true; location.hash = b.dataset.uyg;
});

/* İş Formları üst barındaki "Servis Saha" düğmesi: ana ekrandan gelindiyse geri gider (geçmiş temiz kalır) */
$("btnServisSaha").addEventListener("click", () => {
  if (hubdanGeldi && history.length > 1) { hubdanGeldi = false; history.back(); return; }
  history.replaceState(null, "", location.pathname + location.search); goster();
});

$("ssCikis").addEventListener("click", () => signOut(auth));
