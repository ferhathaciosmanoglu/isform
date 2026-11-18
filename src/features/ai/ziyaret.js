import { doc, getDoc, updateDoc, writeBatch } from "../../veri/firestore.js";
import { onAuthStateChanged } from "../../veri/auth.js";
import { auth, db } from "../../veri/init.js";
import { state } from "../../core/state.js";
import { logYaz, yoneticiMi } from "../../core/session.js";
import { $ } from "../../lib/dom.js";
import { htmlGuvenli } from "../../lib/text.js";
import { ikon } from "../../lib/ikon.js";
import { ziyaretFotodanOku } from "./ziyaret-oku.js";
import { raporKayitYama, raporVerisi } from "../reports/rapor-veri.js";
import { aiZiyaret, formdanZiyaret, ziyaretOzetle, ziyaretVar } from "../../lib/ziyaret.js";

/* ===== ZİYARET GEÇMİŞİ: "Bu firmaya ENORPA'dan kim, ne zaman, kaç kez gitti?" =====
   1) Firma kartında özet (herkes görür): kişi başına ziyaret sayısı + tarih listesi.
   2) Yönetici ⋯ menüsünden "Ziyaretleri AI ile oku": uygulamada oluşturulan formlar (formVerisi) yapay zekâsız,
      taranmış kâğıt formlar fotoğraftan Gemini ile okunur; sonuç her form belgesinde `ziyaret` alanına yazılır. */

const TARIH = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) : "tarih yok";
const bekle = ms => new Promise(r => setTimeout(r, ms));

/* ---- 1) Firma kartı bölümü ---- */
const kutu = document.createElement("div");
kutu.id = "fkZiyaret"; kutu.style.cssText = "padding:0 18px 6px";
$("fkZaman").insertAdjacentElement("beforebegin", kutu);

function ziyaretCiz(L) {
  const o = ziyaretOzetle(L);
  if (!o.toplam) { kutu.innerHTML = ""; return; }
  const kisiler = o.kisiler.map(k => `<span class="zy-kisi"><b>${htmlGuvenli(k.ad)}</b> ${k.sayi} kez</span>`).join("");
  const liste = o.ziyaretler.slice(0, 30).map(z => `<div class="bakim-satir zaman-satir"><div class="bs-bilgi"><b>${htmlGuvenli(z.personel.join(", ") || "Personel okunmamış")}</b><small>${z.formKodu ? "#" + htmlGuvenli(z.formKodu) : ""}</small></div><small class="zs-tarih">${TARIH(z.tarih)}</small></div>`).join("");
  kutu.innerHTML = `<div class="alt-baslik">${ikon("user", 14)} ENORPA ziyaretleri · toplam ${o.toplam}</div>`
    + (kisiler ? `<div class="zy-kisiler" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px;font-size:.82rem">${kisiler}</div>` : "")
    + (o.okunmamis ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">${o.okunmamis} formun personeli henüz okunmadı${yoneticiMi() ? " (⋯ menüsü → Ziyaretleri AI ile oku)" : ""}.</div>` : "")
    + `<details><summary style="cursor:pointer;font-size:.85rem;font-weight:700">Tarihler${o.ziyaretler.length > 30 ? " (son 30)" : ""}</summary>${liste}</details>`;
  kutu.querySelectorAll(".zy-kisi").forEach(e => { e.style.cssText = "padding:4px 10px;border-radius:999px;background:var(--primary-soft)"; });
}

/* Firma kartı kayıtları yüklenince (yaklasan.js tanımlar) ziyaret bölümü de çizilir */
const fkZamanCiz = window.fkZamanCiz;
window.fkZamanCiz = function (L) { ziyaretCiz(L); return fkZamanCiz.apply(this, arguments); };
const fkAc = window.firmaKartiAc;
window.firmaKartiAc = function () { kutu.innerHTML = ""; return fkAc.apply(this, arguments); };

/* ---- 2) Toplu okuma (yönetici) ---- */
const fotoKaynagi = async v => {
  if (v.fotograf) return v.fotograf;
  if (!v.fotoId) return "";
  const s = await getDoc(doc(db, "formFotograflari", v.fotoId));
  return s.exists() ? String(s.data().base64 || "") : "";
};

async function fotodanOku(v) {
  const src = await fotoKaynagi(v);
  return src.startsWith("data:") ? ziyaretFotodanOku(src) : null;   // fotoğraf yok / bozuk: işaretleme, sonra tekrar denenebilsin
}

let calisiyor = false, durdur = false;
async function topluOku(btn) {
  if (calisiyor) { durdur = true; btn.textContent = "Durduruluyor…"; return; }
  if (!yoneticiMi()) { showToast("Bu işlem için yönetici olmalısınız", "error"); return; }
  const eski = btn.textContent; calisiyor = true; durdur = false;
  try {
    btn.textContent = "Kayıtlar inceleniyor…";
    const snap = await raporVerisi(), formden = [], fotodan = [];
    snap.forEach(d => { const v = d.data(); if (ziyaretVar(v)) return; (formdanZiyaret(v) ? formden : fotodan).push({ id: d.id, v }); });
    if (!formden.length && !fotodan.length) { showToast("Tüm formların ziyaret bilgisi zaten çıkarılmış", "success"); return; }
    if (!confirm(`${formden.length} form (uygulamada oluşturulan) yapay zekâsız, ${fotodan.length} taranmış form fotoğraftan AI ile okunacak (form başına 1 AI isteği ve 1 yazma).\nBüyük işlerde ücretsiz kota dolabilir; iş kaldığı yerden devam eder. Başlamadan önce ⋯ → Tam yedek almanız önerilir. Devam edilsin mi?`)) return;

    let yazilan = 0;
    for (let i = 0; i < formden.length; i += 400) {   // 1) formVerisi'nden: toplu yazma
      const b = writeBatch(db), grup = formden.slice(i, i + 400);
      grup.forEach(x => b.update(doc(db, "formlar", x.id), { ziyaret: formdanZiyaret(x.v) }));
      await b.commit(); await Promise.all(grup.map(x => raporKayitYama(x.id, { ziyaret: formdanZiyaret(x.v) }))); yazilan += grup.length;
    }
    let okunan = 0, okunamayan = 0, atlanan = 0;
    for (let i = 0; i < fotodan.length && !durdur; i++) {   // 2) fotoğraftan: tek tek
      const { id, v } = fotodan[i];
      btn.textContent = `⏹ Okunuyor ${i + 1}/${fotodan.length} (durdurmak için dokunun)`;
      let c;
      try { c = await fotodanOku(v); }
      catch (e) { console.error(e); showToast("AI: " + e.message + " — bu ana kadarki sonuçlar kaydedildi, tekrar çalıştırınca devam eder", "error"); break; }
      if (!c) { atlanan++; continue; }
      const z = c.okundu === false ? { personel: [], tarih: "", kaynak: "ai", surum: 1 } : aiZiyaret(c, String(v.tarih || "").slice(0, 10));
      if (c.okundu === false || !z.personel.length) okunamayan++; else okunan++;
      await updateDoc(doc(db, "formlar", id), { ziyaret: z }); await raporKayitYama(id, { ziyaret: z });
      await bekle(4500);   // dakikalık istek sınırlarına takılmamak için
    }
    logYaz("Ziyaretler okundu", "", `formVerisi: ${yazilan}, AI: ${okunan}, okunamayan: ${okunamayan}, fotoğrafı olmayan: ${atlanan}`);
    showToast(`Bitti: ${yazilan} formdan, ${okunan} fotoğraftan okundu${okunamayan ? `, ${okunamayan} formda personel okunamadı` : ""}${atlanan ? `, ${atlanan} formun fotoğrafı yok` : ""}${durdur ? " (durduruldu)" : ""}`, "success");
  } catch (e) { console.error(e); showToast("Hata: " + e.message, "error"); }
  finally { calisiyor = false; durdur = false; btn.textContent = eski; }
}

const btn = $("btnZiyaretOku");
btn.addEventListener("click", () => topluOku(btn));
onAuthStateChanged(auth, u => { if (u) state.rolHazir.then(ok => { if (ok) btn.style.display = yoneticiMi() ? "block" : "none"; }); });
