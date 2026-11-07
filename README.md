# SLOTOLOG MOTION STUDIO

Tarayıcıda çalışan, Slotolog reklam videolarını sıfırdan oluşturmak için animasyonlu video editörü.
CapCut / After Effects gerekmez; MP4 doğrudan tarayıcıda (Chrome) oluşturulur, sunucu veya ücretli servis gerekmez.

**Teknoloji:** React 19 + TypeScript · Remotion 4 (`@remotion/player`, `@remotion/web-renderer`, `@remotion/media`) · Tailwind CSS 4 · Zustand · IndexedDB · Vite

---

## 1. Kurulum ve çalıştırma (MacBook)

1. **Node.js** kur (bir kerelik): https://nodejs.org → “LTS” sürümünü indir ve kur.
2. Proje klasöründe **`Baslat.command`** dosyasına çift tıkla.
   - İlk açılışta paketleri indirir (1–2 dk), sonra tarayıcıda `http://localhost:5173` açılır.
   - macOS “tanınmayan geliştirici” derse: dosyaya sağ tık → **Aç**.
3. Ya da Terminal ile:
   ```bash
   cd slotolog-motion-studio
   npm install
   npm run dev
   ```
   ve **Google Chrome**’da `http://localhost:5173` adresini aç.

> **Tarayıcı:** Google Chrome önerilir (MP4 oluşturma WebCodecs kullanır). Safari/Firefox’ta önizleme çalışır, MP4 dışa aktarma desteklenmeyebilir; uygulama bunu dışa aktarma penceresinde söyler.

### İnternette yayınlama (ücretsiz, isteğe bağlı)
Repo GitHub’a yüklendiğinde `.github/workflows/deploy.yml` uygulamayı **GitHub Pages**’e otomatik yayınlar (ücretsiz):
Repo → Settings → Pages → Source: **GitHub Actions**. Adres: `https://<kullanıcı>.github.io/slotolog-motion-studio/`.
Projeler ve medyalar yine sadece kendi tarayıcında saklanır, hiçbir sunucuya yüklenmez.

---

## 2. Arayüz

| Alan | İçerik |
|---|---|
| **Üst çubuk** | Proje adı, kayıt durumu, 9:16 / 1:1 / 16:9, geri al/yinele, Yeni, Projelerim, Proje dosyası indir/aç, **MP4 Dışa Aktar** |
| **Sol panel** | Medya (yükleme), Öğeler (çarpan, metin, buton, parçacık), Arka plan, Efektler, Şablonlar |
| **Orta** | Canlı önizleme. Tıkla = seç, sürükle = taşı, köşe = boyut, üst tutamaç = döndür (Shift: 15°). Merkeze yapışır (Alt: kapat). Dosyaları buraya sürükleyip bırakabilirsin. |
| **Sağ panel** | Seçili katmanın ayarları: zamanlama, konum/ölçek/açı/opaklık + keyframe, metin/buton/arka plan ayarları, efektler |
| **Alt** | Zaman çizelgesi: oynat/duraklat, cetvele tıkla/sürükle = ileri-geri sar, katman çubuğunu sürükle = başlangıcı değiştir, kenarlardan = kırp. Sarı ◆ = keyframe, ince sarı çizgi = efekt. |

**Kısayollar:** Boşluk oynat · Delete sil · ⌘Z geri al · ⌘⇧Z yinele · ⌘D çoğalt · Oklar 1px (Shift 10px) · Esc seçimi kaldır

---

## 3. Nasıl kullanılır

### Hızlı başlangıç
1. **Şablonlar** → “A · Çarpan animasyonu”.
2. **Medya** → Slotolog logonu (PNG/SVG) yükle.
3. Zaman çizelgesinde “Logo” katmanını seç → medya kartındaki **⇄** (Seçili katmana uygula). Konum, zamanlama ve efektler korunur.
4. Metinlere tıklayıp sağ panelden yazıyı değiştir (ör. `100.000TL`).
5. **MP4 Dışa Aktar** → **MP4 oluştur**. Bitince dosya otomatik iner.

### Görsel ekleme ve konumlandırma
PNG, SVG, JPG, WEBP, MP4/MOV/WEBM, MP3/WAV/M4A yükleyebilirsin. “Ekle” ile katman olur ya da önizlemeye sürükle-bırak.

### Animasyon (efektler)
Bir katman seç → **Efektler** sekmesi veya sağ panelde “+ Efekt ekle”. Efekt **oynatma çizgisinin olduğu yerden** başlar. Her efektin başlangıç, süre, hız ve şiddeti ayrı ayarlanır; bir katmana birden çok efekt eklenebilir.

| Efekt | Açıklama |
|---|---|
| Zıplama, Dans, Sağa sola sallanma | Sürekli hareket |
| 360° dönme | Kendi etrafında döner |
| Büyüme / küçülme | Nefes alır gibi |
| Uçarak giriş | Soldan/sağdan/yukarıdan/aşağıdan yaylı giriş |
| Parlama, Işık patlaması | Etrafında ışık / arkasında ışık patlaması (renk seçilebilir) |
| Titreme, Çarpma | Titreşim / büyükten küçülerek “çarpma” + sarsıntı |
| Ritim (BPM) | Girilen BPM’e göre vurur (müziğin temposunu yaz) |
| Altın yağmuru / patlaması, Parıltılar, Konfeti | Ayrı parçacık katmanı olarak eklenir |

### Keyframe
Sağ panelde bir özelliğin yanındaki **◇** → o karede keyframe oluşur (◆). Oynatma çizgisini taşı, değeri değiştir (veya önizlemede sürükle) → yeni keyframe otomatik eklenir. Keyframe listesinden geçiş tipini (Yumuşak, Esnek, Doğrusal…) seç.

### Hareketli arka plan
**Arka plan** sekmesi: Sarı-Turuncu Işınlar, Ateş Turuncusu, Akan Gradyan, Koyu Casino. Sağ panelden stil, renkler (#FF8E16, #1E1E1E…), huzme sayısı, hız ve ışık noktaları değişir.

### Kaydetme
- Her değişiklik **otomatik kaydedilir** (tarayıcının IndexedDB’si). “Projelerim” ile eski projeleri aç/sil.
- **Proje dosyası indir**: projeyi tüm medyasıyla tek `.slotolog.json` dosyası yapar (yedek / başka bilgisayar). **Dosya aç** ile geri yüklenir.
- Tarayıcı verilerini silersen kayıtlı projeler de silinir → önemli projeleri dosya olarak yedekle.

---

## 4. MP4 dışa aktarma hakkında

- MP4 (H.264, 30 fps, 1080×1920 / 1080×1080 / 1920×1080, ses varsa AAC) **tamamen tarayıcıda** `@remotion/web-renderer` ile oluşturulur. Sunucu, API anahtarı veya abonelik gerekmez.
- Test ortamında (ekran kartı olmayan sanal sunucu) 15 sn’lik 9:16 video ~4 dk sürdü. Bir MacBook’ta Chrome ile genelde çok daha hızlıdır. Render sırasında sekmeyi açık ve önde tut.
- Büyük oyun videoları render süresini artırır.

### Tarayıcıda render yetmezse (ileride)
| Seçenek | Maliyet | Not |
|---|---|---|
| **Yerel Node render** (`@remotion/renderer`, kendi Mac’inde Chrome ile) | Ücretsiz | Aynı kompozisyon kullanılır, daha hızlı ve uzun videolar için uygun |
| **Remotion Lambda** (AWS) | Ücretli (AWS kullanım ücreti) | Bulutta paralel render. **Onayın olmadan kurulmayacak.** |

### Remotion lisansı
Remotion; bireyler ve **en fazla 3 çalışanlı** şirketler için ücretsizdir (ticari kullanım dahil). Daha büyük bir şirket adına kullanılacaksa remotion.pro’dan şirket lisansı gerekir; anahtar dışa aktarma penceresindeki “Remotion lisansı” alanına girilir. Varsayılan: `free-license`. Ayrıntı: https://remotion.dev/license

---

## 5. Şablonlar

- **A · Çarpan animasyonu (15 sn):** sarı-turuncu ışın arka plan, parıltı + altın yağmuru, logo, başlık, 100X → 1000X sırayla çarparak gelir, dans eder ve parlar; 1000X’te altın patlaması; “HEMEN OYNA” butonu.
- **B · Bonus tanıtımı (10 sn):** logo, “HOŞ GELDİN BONUSU”, 100.000TL + 450FS, altın patlaması ve yağmuru, nabız atan “BONUSU AL” butonu.
- **C · Oyun videosu (15 sn):** koyu casino arka plan, üstte logo, ortada oyun videosu yeri (videonu yükle → ⇄), altta değiştirilebilir bonus metni ve buton. Video katmanı kısa ise “Döngü” ile tekrarlanır.

Logo şablonlarda yazı olarak yer alır; gerçek Slotolog logosunu yükleyip ⇄ ile değiştir.

---

## 6. MVP durumu

**Çalışan ve test edilen** (Chrome’da otomatik uçtan uca testle): editör arayüzü, 9:16/1:1/16:9, görsel/video/ses yükleme, katmanlar, sürükle/boyut/döndür, zaman çizelgesi, keyframe, 11 efekt, parçacıklar, hareketli arka plan, 3 şablon, canlı önizleme, MP4 dışa aktarma (görüntü + ses), otomatik kayıt, sayfa yenilenince geri yükleme, proje dosyası indir/aç, geri al/yinele.

**Sınırlamalar / sonraki aşama:**
- “Ritim” efekti BPM ile çalışır; sesi otomatik analiz edip vuruş algılama henüz yok.
- Tek yazı tipi (Montserrat). Ek font seçimi sonraki aşamada.
- Efektlerin zaman çizelgesinde sürüklenerek düzenlenmesi yok (sağ panelden ayarlanır).
- Ses dalga formu gösterimi ve ses kırpma (trim) yok.
- Safari’de dışa aktarma test edilmedi.

---

## 7. Proje yapısı

```
src/
  types.ts              Veri modeli (Project, Layer, Effect, Keyframe)
  store.ts              Editör durumu (Zustand), geri al/yinele, otomatik kayıt
  remotion/Main.tsx     Videonun kendisi: katmanlar, efektler, keyframe’ler
  remotion/Elements.tsx Çarpan, metin (SVG), buton, arka plan/parçacık canvas
  remotion/draw.ts      Arka plan ışınları, altın, parıltı, konfeti çizimi
  lib/anim.ts           Keyframe enterpolasyonu ve efekt matematiği
  lib/templates.ts      A/B/C şablonları
  lib/factory.ts        Katman/efekt üreticileri, hazır ayarlar
  lib/storage.ts        IndexedDB kayıt, proje dosyası
  lib/export.ts         Tarayıcıda MP4 render
  components/           TopBar, Library, Preview, Inspector, Timeline
```

Komutlar: `npm run dev` (geliştirme) · `npm run build` (üretim, `dist/`) · `npm run preview` · `npm run typecheck`
