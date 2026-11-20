import { $ } from "../../lib/dom.js";
import { csvIndir, htmlGuvenli } from "../../lib/text.js";
import { tarihiInputaCevir } from "../../lib/dates.js";
import { yoneticiMi } from "../../core/session.js";
import { personelOzetle } from "../../lib/ziyaret.js";

/* ===== RAPOR: GİDEN PERSONEL =====
   Formu kimin eklediği değil, forma giden ENORPA personeli: kişi başına form (ziyaret) sayısı, farklı firma sayısı,
   son ziyaret, en çok gittiği firmalar, işlem tipleri ve en sık birlikte gittiği kişiler. Dönem seçilebilir. */

const TARIH = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "—";
let formlar = [], sonOzet = null;

function donemler(L) {
  const yillar = [...new Set(L.map(v => String((v.ziyaret && v.ziyaret.tarih) || v.tarih || "").slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
  const bugun = new Date(), once = new Date(bugun); once.setFullYear(bugun.getFullYear() - 1);
  const g = d => d.toISOString().slice(0, 10);
  return [["", "Tüm zamanlar", "", ""], ["12ay", "Son 12 ay", g(once), g(bugun)], ...yillar.map(y => [y, y, `${y}-01-01`, `${y}-12-31`])];
}

function ciz() {
  const sec = $("prDonem"), d = donemler(formlar).find(x => x[0] === sec.value) || ["", "", "", ""];
  const o = sonOzet = personelOzetle(formlar, { bas: d[2], bit: d[3] });
  const okunan = o.formSayisi - o.okunmamis;
  $("prOzet").textContent = o.formSayisi
    ? `${o.formSayisi} formun ${okunan} tanesinde personel belli${o.okunmamis ? ` · ${o.okunmamis} form okunmamış ya da boş` : ""}`
    : "Bu dönemde form yok";
  const enCok = o.kisiler[0] ? o.kisiler[0].sayi : 1;
  $("listePersonel").innerHTML = o.kisiler.length ? o.kisiler.map(k => `
    <details class="pr-kisi">
      <summary>
        <span class="pr-ad">${htmlGuvenli(k.ad)}</span>
        <span class="pr-sayi"><b>${k.sayi}</b> form · ${k.firmaSayisi} firma</span>
        <span class="pr-cubuk" aria-hidden="true"><i style="width:${Math.max(4, Math.round(k.sayi / enCok * 100))}%"></i></span>
        <small class="pr-son">Son ziyaret: ${htmlGuvenli(TARIH(k.son))}</small>
      </summary>
      <div class="pr-detay">
        <div class="pr-alt">En çok gittiği firmalar</div>
        ${k.firmalar.slice(0, 8).map(f => `<div class="rapor-item"><span>${htmlGuvenli(f.ad)}</span><strong>${f.sayi}</strong></div>`).join("")}
        ${k.firmalar.length > 8 ? `<small class="pr-son">ve ${k.firmalar.length - 8} firma daha</small>` : ""}
        <div class="pr-alt">İşlem tipleri</div>
        <div class="chip-liste pr-cipler">${k.tipler.map(t => `<span>${htmlGuvenli(t.ad)} <b>${t.sayi}</b></span>`).join("")}</div>
        ${k.ekip.length ? `<div class="pr-alt">En sık birlikte gittiği</div><div class="chip-liste pr-cipler">${k.ekip.slice(0, 5).map(t => `<span>${htmlGuvenli(t.ad)} <b>${t.sayi}</b></span>`).join("")}</div>` : ""}
      </div>
    </details>`).join("")
    : `<div class="rapor-item"><span>Henüz personeli okunmuş form yok${yoneticiMi() ? " (⋯ menüsü → Ziyaretleri AI ile oku)" : ""}.</span></div>`;
}

/* rapor-ui.js "Verileri analiz et" sonrasında çağırır */
export function personelRaporCiz(L) {
  formlar = L || [];
  const sec = $("prDonem"), eski = sec.value;
  sec.innerHTML = donemler(formlar).map(([k, ad]) => `<option value="${k}">${htmlGuvenli(ad)}</option>`).join("");
  if ([...sec.options].some(o => o.value === eski)) sec.value = eski;
  ciz();
}

$("prDonem").addEventListener("change", ciz);
$("btnPersonelCsv").addEventListener("click", () => {
  if (!sonOzet || !sonOzet.kisiler.length) { showToast("Önce verileri analiz edin!", "error"); return; }
  const donem = $("prDonem").selectedOptions[0]?.textContent || "";
  const satirlar = [["Personel", "Form (ziyaret) sayısı", "Farklı firma", "Son ziyaret", "En çok gittiği firmalar", "İşlem tipleri", "Dönem"],
    ...sonOzet.kisiler.map(k => [k.ad, k.sayi, k.firmaSayisi, k.son,
      k.firmalar.slice(0, 5).map(f => `${f.ad} (${f.sayi})`).join(", "), k.tipler.map(t => `${t.ad} (${t.sayi})`).join(", "), donem])];
  csvIndir(satirlar, `ENORPA_Personel_Raporu_${tarihiInputaCevir()}.csv`);
  showToast("Excel dosyası indiriliyor", "success");
});
