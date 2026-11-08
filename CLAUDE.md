# Slotolog Motion Studio — geliştirme kuralları

- Kullanıcı (Berkay) Türkçe konuşur; arayüz ve yanıtlar Türkçe.
- Kullanıcı hiçbir şey kurmaz; uygulamayı yalnızca https://slotolog.github.io/slotolog-motion-studio/ adresinden Chrome ile kullanır.
- Mevcut özellikleri, şablonları ve animasyon sistemini bozma/silme. Eski proje dosyaları (.slotolog.json, IndexedDB) açılmaya devam etmeli: veri modeline alan eklerken isteğe bağlı (optional) ekle.
- Her değişiklik akışı:
  1. Kodla, sonra `bash tests/run_all.sh` (typecheck + build + Chrome e2e + MP4 doğrulama). Yeni özellik için tests/e2e altına test ekle.
  2. Testler geçerse `main`'e commit + push. `deploy.yml` derleyip `gh-pages` dalına yayınlar; `Kontrol` akışı tip kontrolü yapar.
  3. Actions durumunu `https://api.github.com/repos/slotolog/slotolog-motion-studio/actions/runs` ile kontrol et, canlı adresi tarayıcı aracıyla doğrula (çalışma ortamının shell'i github.io'ya erişemez).
- Ücretli servis (Remotion Lambda vb.) kullanıcı onayı olmadan kurulmaz. Repo herkese açık: şifre/anahtar ekleme.
- Remotion paket sürümleri birebir aynı kalmalı (şu an 4.0.541).
- Ses efektleri `tools/make_sfx.py` ile üretilir (özgün). Yeni ses gerekirse aynı yöntemle sentezle; telifli kayıt ekleme.
- Test müziği `tools/make_test_music.py` ile üretilir; `tests/e2e/music.py` BPM/vuruş doğruluğunu ve önizleme↔MP4 / ses senkronunu ölçer.
- `window.__slotolog` testler için store erişimidir.
- Telifli müzik (ör. kullanıcının yüklediği şarkılar) ve bunları içeren MP4/.slotolog.json dosyaları ASLA repoya veya public/ klasörüne konmaz; /home/claude/music-work gibi repo dışı klasörde tutulur.
