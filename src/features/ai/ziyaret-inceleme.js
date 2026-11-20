import { doc, getDoc, updateDoc } from "../../veri/firestore.js";
import { onAuthStateChanged } from "../../veri/auth.js";
import { auth, db } from "../../veri/init.js";
import { state } from "../../core/state.js";
import { logYaz, yoneticiMi } from "../../core/session.js";
import { $ } from "../../lib/dom.js";
import { htmlGuvenli, metniNormalizeEt } from "../../lib/text.js";
import { ikon } from "../../lib/ikon.js";
import { disaridanKapat, temizSay } from "../../ui/modal.js";
import { bilinenPersonel } from "./ziyaret-oku.js";
import { raporKayitYama, raporVerisi } from "../reports/rapor-veri.js";
import { adTemizle, adlariTemizle, elleZiyaret, gunMu, incelemeDurumu } from "../../lib/ziyaret.js";

/* ===== ZİYARET OKUMALARINI GÖZDEN GEÇİR (yönetici) =====
   AI'ın formlardan okuduğu personeli tek tek fotoğrafla yan yana gösterir; yönetici düzeltir ya da onaylar.
   Kaydedilen bilgi `ziyaret.kaynak = "elle"` olur ve toplu AI okuması onu bir daha değiştirmez. */

const FILTRELER = [
  ["bos", "Personel boş"], ["listeDisi", "Listede olmayan isim"], ["okunmadi", "Henüz okunmamış"],
  ["ai", "AI okumaları"], ["elle", "Düzeltilenler"]
];
const TARIH = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "tarih yok";

let m = null, tumu = [], liste = [], sira = 0, filtre = "bos", arama = "", secili = [], donus = 0;
const fotoOnbellek = new Map();

const personelAdlari = () => bilinenPersonel().map(adTemizle).sort((a, b) => a.localeCompare(b, "tr-TR"));
const listeNorm = () => new Set(personelAdlari().map(metniNormalizeEt));

async function fotoAl(v) {
  if (v.fotograf) return v.fotograf;
  if (!v.fotoId) return "";
  if (fotoOnbellek.has(v.fotoId)) return fotoOnbellek.get(v.fotoId);
  const p = getDoc(doc(db, "formFotograflari", v.fotoId)).then(s => (s.exists() ? String(s.data().base64 || "") : "")).catch(() => "");
  fotoOnbellek.set(v.fotoId, p);
  if (fotoOnbellek.size > 6) fotoOnbellek.delete(fotoOnbellek.keys().next().value);   // telefonda belleği şişirmesin
  return p;
}

function pencereKur() {
  m = document.createElement("div"); m.className = "personel-modal zi-modal"; m.id = "ziModal";
  m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "ziBaslik");
  m.innerHTML = `<div class="edit-card zi-kart">
    <div class="zi-ust"><div class="card-title" id="ziBaslik" style="margin:0">Ziyaret okumalarını gözden geçir</div>
      <button type="button" class="fk-x" id="ziKapat" aria-label="Kapat">${ikon("x", 18)}</button></div>
    <div class="zi-filtreler" id="ziFiltreler" role="tablist"></div>
    <div class="form-floating" style="margin-bottom:10px"><input type="search" id="ziAra" placeholder=" " autocomplete="off"><label for="ziAra">Firma ya da personel ara</label></div>
    <div id="ziIcerik"></div></div>`;
  document.body.appendChild(m);
  disaridanKapat(m, kapat, "Bu formdaki değişiklik kaydedilmedi. Pencere kapatılsın mı?");
  m.querySelector("#ziKapat").onclick = () => { if (m.dataset.kirli === "1" && !confirm("Bu formdaki değişiklik kaydedilmedi. Pencere kapatılsın mı?")) return; kapat(); };
  m.addEventListener("keydown", e => { if (e.key === "Escape") m.querySelector("#ziKapat").click(); });
  m.querySelector("#ziFiltreler").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b || !degisiklikKaybolsunMu()) return;
    filtre = b.dataset.f; listeyiKur(); ciz();
  });
  let zm; m.querySelector("#ziAra").addEventListener("input", e => {
    clearTimeout(zm); zm = setTimeout(() => { arama = metniNormalizeEt(e.target.value.trim()); temizSay(m); listeyiKur(); ciz(); }, 250);
  });
}

const kapat = () => { if (m) { m.style.display = "none"; temizSay(m); } };
const degisiklikKaybolsunMu = () => m.dataset.kirli !== "1" || confirm("Bu formdaki değişiklik kaydedilmedi. Devam edilsin mi?");

function listeyiKur() {
  const ln = listeNorm();
  tumu.forEach(x => { x.durum = incelemeDurumu(x.v, ln); });
  const sayilar = {}; tumu.forEach(x => { sayilar[x.durum] = (sayilar[x.durum] || 0) + 1; });
  m.querySelector("#ziFiltreler").innerHTML = FILTRELER.map(([k, ad]) =>
    `<button type="button" role="tab" data-f="${k}" class="zi-filtre${k === filtre ? " secili" : ""}" aria-selected="${k === filtre}">${ad} <b>${sayilar[k] || 0}</b></button>`).join("");
  const eslesir = x => {
    if (!arama) return true;
    const z = x.v.ziyaret || {};
    return metniNormalizeEt([x.v.firmaAdi, x.v.aramaFirma, x.v.formKodu, ...(z.personel || []), ...(z.ham || [])].join(" ")).includes(arama);
  };
  liste = tumu.filter(x => x.durum === filtre && eslesir(x))
    .sort((a, b) => String(b.v.tarih || "").localeCompare(String(a.v.tarih || "")));
  sira = 0;
}

function ciz() {
  const kutu = m.querySelector("#ziIcerik");
  temizSay(m);
  if (!liste.length) {
    kutu.innerHTML = `<div class="zi-bos">${ikon("check", 28)}<p>${arama ? "Aramaya uyan form yok." : "Bu grupta gözden geçirilecek form kalmadı."}</p></div>`;
    return;
  }
  if (sira >= liste.length) sira = liste.length - 1;
  const { id, v } = liste[sira], z = v.ziyaret || {};
  secili = adlariTemizle(z.personel);
  donus = 0;
  const formTarih = String(v.tarih || "").slice(0, 10);
  const ham = adlariTemizle(z.ham);
  const hamFarkli = ham.length && ham.join("|") !== secili.join("|");
  kutu.innerHTML = `
    <div class="zi-gezinti">
      <button type="button" class="btn btn-ikincil zi-ok" id="ziOnceki" aria-label="Önceki form" ${sira ? "" : "disabled"}>‹</button>
      <span><b>${sira + 1}</b> / ${liste.length}</span>
      <button type="button" class="btn btn-ikincil zi-ok" id="ziSonraki" aria-label="Sonraki form" ${sira < liste.length - 1 ? "" : "disabled"}>›</button>
    </div>
    <div class="zi-firma"><b>${htmlGuvenli(v.firmaAdi || v.aramaFirma || "")}</b>
      <small>${v.formKodu ? "#" + htmlGuvenli(v.formKodu) + " · " : ""}${htmlGuvenli(TARIH(formTarih))}${v.islemTipi ? " · " + htmlGuvenli(v.islemTipi) : ""}</small></div>
    <div class="zi-foto" id="ziFoto"><span class="zi-foto-yaz">Fotoğraf yükleniyor…</span></div>
    <div class="zi-foto-arac">
      <button type="button" class="btn btn-ikincil" id="ziDondur">↻ Döndür</button>
      <button type="button" class="btn btn-ikincil" id="ziBuyut">Büyüt</button>
    </div>
    ${hamFarkli ? `<p class="zi-not">AI formda şöyle okudu: <i>${htmlGuvenli(ham.join(", "))}</i></p>` : ""}
    <p class="zi-not" id="ziSorumlu"></p>
    ${z.kaynak === "elle" ? `<p class="zi-not">${ikon("check", 13)} ${htmlGuvenli(z.onaylayan || "")} düzeltti${z.onayTarihi ? ", " + htmlGuvenli(TARIH(String(z.onayTarihi).slice(0, 10))) : ""}.</p>` : ""}
    <div class="alt-baslik" style="margin-top:10px">${ikon("users", 14)} Forma giden personel</div>
    <div class="zi-cipler" id="ziCipler"></div>
    <div class="form-floating select-wrapper" style="margin:8px 0 10px"><select id="ziEkle" aria-label="Personel ekle"></select><label for="ziEkle">Personel ekle</label></div>
    <div class="form-floating"><input type="date" id="ziTarih" placeholder=" " value="${gunMu(z.tarih) ? z.tarih : gunMu(formTarih) ? formTarih : ""}"><label for="ziTarih">Ziyaret tarihi</label></div>
    <div class="zi-alt">
      <button type="button" class="btn btn-ikincil" id="ziAtla">Atla</button>
      <button type="button" class="btn btn-primary" id="ziKaydet">${ikon("check", 16)} Kaydet ve sonraki</button>
    </div>`;
  ciplerCiz();
  kutu.querySelector("#ziOnceki").onclick = () => { if (degisiklikKaybolsunMu()) { sira--; ciz(); } };
  kutu.querySelector("#ziSonraki").onclick = () => { if (degisiklikKaybolsunMu()) { sira++; ciz(); } };
  kutu.querySelector("#ziAtla").onclick = () => { if (!degisiklikKaybolsunMu()) return; if (sira < liste.length - 1) { sira++; ciz(); } else showToast("Bu gruptaki son formdasınız", "info"); };
  kutu.querySelector("#ziKaydet").onclick = () => kaydet(id, v);
  kutu.querySelector("#ziEkle").onchange = e => {
    const s = e.target; let ad = s.value; s.value = "";
    if (!ad) return;
    if (ad === "__yeni__") { ad = adTemizle(prompt("Listede olmayan personelin adı soyadı:") || ""); if (ad.length < 3) return; }
    if (!secili.some(a => metniNormalizeEt(a) === metniNormalizeEt(ad))) { secili.push(ad); m.dataset.kirli = "1"; ciplerCiz(); }
  };
  kutu.querySelector("#ziDondur").onclick = () => { donus = (donus + 90) % 360; const img = kutu.querySelector("#ziFoto img"); if (img) img.style.transform = `rotate(${donus}deg)`; };
  kutu.querySelector("#ziBuyut").onclick = e => { const f = kutu.querySelector("#ziFoto"); f.classList.toggle("buyuk"); e.target.textContent = f.classList.contains("buyuk") ? "Küçült" : "Büyüt"; };
  fotoGoster(v, id);
  const sonraki = liste[sira + 1]; if (sonraki) fotoAl(sonraki.v);   // bir sonrakini önceden indir
}

function ciplerCiz() {
  const ln = listeNorm();
  /* İmzadaki servis sorumlusu personelde yoksa tek dokunuşla eklenebilsin */
  const sor = adTemizle((liste[sira]?.v.ziyaret || {}).sorumlu), sk = m.querySelector("#ziSorumlu");
  if (sor && !secili.some(a => metniNormalizeEt(a) === metniNormalizeEt(sor))) {
    sk.innerHTML = `İmzadaki servis sorumlusu: <b>${htmlGuvenli(sor)}</b>${ln.has(metniNormalizeEt(sor)) ? "" : " (personel listesinde yok)"} <button type="button" class="zi-mini" id="ziSorEkle">${ikon("plus", 12)} Ekle</button>`;
    sk.querySelector("#ziSorEkle").onclick = () => { secili.push(sor); m.dataset.kirli = "1"; ciplerCiz(); };
  } else sk.innerHTML = "";
  m.querySelector("#ziCipler").innerHTML = secili.length
    ? secili.map((ad, i) => {
      const disi = !ln.has(metniNormalizeEt(ad));
      return `<span class="zi-cip${disi ? " disi" : ""}" title="${disi ? "Personel listesinde yok" : ""}">${htmlGuvenli(ad)}${disi ? " ⚠" : ""}<button type="button" data-sil="${i}" aria-label="${htmlGuvenli(ad)} kaldır">${ikon("x", 12)}</button></span>`;
    }).join("")
    : `<span class="zi-not" style="margin:0">Personel yok. Aşağıdan ekleyin; formda gerçekten personel yazmıyorsa boş kaydedebilirsiniz.</span>`;
  m.querySelectorAll("[data-sil]").forEach(b => { b.onclick = () => { secili.splice(+b.dataset.sil, 1); m.dataset.kirli = "1"; ciplerCiz(); }; });
  const s = m.querySelector("#ziEkle"), varolan = new Set(secili.map(metniNormalizeEt));
  s.innerHTML = '<option value=""></option>' + personelAdlari().filter(a => !varolan.has(metniNormalizeEt(a)))
    .map(a => `<option value="${htmlGuvenli(a)}">${htmlGuvenli(a)}</option>`).join("") + '<option value="__yeni__">＋ Listede olmayan isim…</option>';
}

async function fotoGoster(v, id) {
  const src = await fotoAl(v);
  if (!m || liste[sira]?.id !== id) return;   // bu arada başka forma geçildi
  const f = m.querySelector("#ziFoto");
  if (!src) { f.innerHTML = '<span class="zi-foto-yaz">Bu formun fotoğrafı yok.</span>'; return; }
  const img = new Image(); img.alt = "Form fotoğrafı"; img.src = src;
  f.innerHTML = ""; f.appendChild(img);
}

async function kaydet(id, v) {
  const b = m.querySelector("#ziKaydet"); b.disabled = true;
  try {
    const z = elleZiyaret(secili, m.querySelector("#ziTarih").value, v.ziyaret, auth.currentUser?.email || "");
    await updateDoc(doc(db, "formlar", id), { ziyaret: z });
    v.ziyaret = z; await raporKayitYama(id, { ziyaret: z });
    logYaz("Ziyaret düzeltildi", v.formKodu || v.firmaAdi || id, z.personel.join(", ").slice(0, 200) || "personel yok");
    temizSay(m);
    showToast("Kaydedildi", "success");
    // Kaydedilen form artık "Düzeltilenler" grubunda; listeden çıkar, aynı sıradaki sonraki forma geç
    if (filtre !== "elle") { liste.splice(sira, 1); listeSayilariniGuncelle(); } else sira++;
    ciz();
  } catch (e) { console.error(e); showToast("Kaydedilemedi: " + e.message, "error"); b.disabled = false; }
}

function listeSayilariniGuncelle() {
  const ln = listeNorm(), sayilar = {};
  tumu.forEach(x => { x.durum = incelemeDurumu(x.v, ln); sayilar[x.durum] = (sayilar[x.durum] || 0) + 1; });
  m.querySelectorAll("[data-f]").forEach(b => { b.querySelector("b").textContent = sayilar[b.dataset.f] || 0; });
}

async function ac() {
  if (!yoneticiMi()) { showToast("Bu işlem için yönetici olmalısınız", "error"); return; }
  if (!m) pencereKur();
  m.style.display = "flex";
  m.querySelector("#ziIcerik").innerHTML = '<p class="zi-not" style="text-align:center">Formlar yükleniyor…</p>';
  try {
    const snap = await raporVerisi(); tumu = [];
    snap.forEach(d => tumu.push({ id: d.id, v: d.data() }));
    listeyiKur();
    if (!liste.length && filtre === "bos") {   // boş grup bittiyse ilk dolu gruba geç
      const ilk = FILTRELER.find(([k]) => tumu.some(x => x.durum === k));
      if (ilk) { filtre = ilk[0]; listeyiKur(); }
    }
    ciz();
  } catch (e) { console.error(e); showToast("Formlar alınamadı: " + e.message, "error"); kapat(); }
}

const btn = $("btnZiyaretIncele");
btn.addEventListener("click", ac);
onAuthStateChanged(auth, u => { if (u) state.rolHazir.then(ok => { if (ok) btn.style.display = yoneticiMi() ? "block" : "none"; }); else kapat(); });
