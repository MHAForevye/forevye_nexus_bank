# Forevye Nexus — Oyun İçi Sanal Banka

Gerçek banka veya ödeme ağı değildir; oyun içi bakiye, profil ve alışveriş deneyimi için sanal banka arayüzü.
Bu ilk sürümde **banka arayüzü** ve **kart oluşturma (editör) mekaniği** vardır. Ekonomi, hesap ve sunucu sonraki aşamalardır.

Kaynak şartname: [`docs/kart-tasarim-sartnamesi-v1.pdf`](docs/kart-tasarim-sartnamesi-v1.pdf)

## Nexus'a bağlı mod (kart editörü)

`config.js` içindeki `NEXUS_URL` doluysa bu site yalnızca **kart editörü** olarak çalışır ve `forevye-nexus` ile bağlanır:

1. Kullanıcı Nexus'ta **Kartını tasarla**'ya basar → Nexus tek kullanımlık bir bilet üretip buraya `#t=<bilet>` ile yollar.
2. Editör bileti jetona çevirir (`POST /api/editor/exchange`), adres çubuğundan siler; jeton yalnızca bu sekmenin `sessionStorage`'ında durur.
3. **Kaydet** → `PUT /api/editor/card`. Sunucu `js/rules.js` ile (aynı dosya) yeniden doğrular; sürümü ve geçmişi Nexus yazar.
4. **Çık** → `NEXUS/#/cards/<id>`.

Oturum yoksa bir **giriş kapısı** çıkar ve kullanıcı Nexus'a yönlendirilir; giriş orada **FOREVYE ID ile** yapılır (parola bu siteye hiç gelmez). Nexus tarafında `EDITOR_URL` bu sitenin adresi olmalıdır (CORS yalnızca o kaynağa açılır). `NEXUS_URL` boşsa eski yerel demo çalışır.

> `js/rules.js` iki depoda (bu depo ve `forevye-nexus/shared/card-rules.js`) BİREBİR aynı kalmalıdır; `js/render.js` de `forevye-nexus/public/js/card-render.js` ile aynıdır.

## Çalıştırma

Derleme adımı yok; düz HTML/CSS/JS.

- **Yerelde:** `index.html` dosyasını doğrudan açabilirsin ya da klasörde `python3 -m http.server 8080` çalıştırıp `http://localhost:8080` adresine git.
- **GitHub Pages:** depoyu GitHub'a yükle → *Settings → Pages → Deploy from a branch → main / (root)*. `.nojekyll` hazır.
- **Cloudflare Pages:** build komutu boş, çıktı klasörü `/` olarak bağla.

> Yazı tipi (Jost) Google Fonts'tan yüklenir; çevrimdışıyken sistem yazı tipine düşer.

## Şu an neler var

**Banka arayüzü:** Ana sayfa (kart, sanal bakiye, örnek hareketler), Kartım (numara / güvenlik kodu göster-gizle), Hareketler / Mağaza / Ayarlar için yer tutucular. Mobilde alt menü.

**Kart editörü (`#/editor`):**
- 4 şablon: Classic, Signature, Creative, Dağ (görseldeki dört kart)
- 14 zemin (düz + gradient, 3 renge kadar, açı), 4 yüzey: Mat, Parlak, Metal folyo, Holografik
- 14 şekil/desen, 3 çip görünümü, nesne efektleri: gölge, kabartma, buzlu cam
- Sürükle, köşeden boyutlandır, üst noktadan döndür; merkez ve kenar boşluğu kılavuzları
- X/Y/boyut/dönüş/opaklık/renk/çizgi/çevirme/oran koruma alanları
- Katman paneli: sürükle-bırak sıralama, görünürlük, kilit, kopyala, sil, öne/arkaya
- Geri al / yinele (Ctrl+Z / Ctrl+Y), otomatik taslak, önizleme, sıfırla, kaydet
- Klavye: Delete, ok tuşları (Shift ile 10 birim), Ctrl+D, Esc

## Koruma mantığı (şartname bölüm 2 ve 4)

| Alan | Davranış |
|---|---|
| Banka adı + logo, çip, kart numarası/bilgileri | Editörde seçilemez; katman listesinde "sistem" olarak kilitli. Veri modelinde **yer almaz**, çizim anında sistem kaydından eklenir. |
| Çip / logo / bilgi bölgeleri | `js/rules.js` içindeki `ZONES`. Küçük–orta nesne bölgeyle kesişirse bırakınca en yakın güvenli konuma itilir, olmazsa eski yerine döner. Katman sırası bunu aşamaz. |
| Büyük nesneler (kartın %35'inden fazla) | Serbesttir, ancak çip ve logo bölgesi çizimde **kesilir**; üstünü örtemez. |
| Kullanıcı adı | 2–18 karakter; harf, rakam, boşluk ve `. - _ '`. HTML, kontrol ve görünmez karakterler temizlenir. Konum sabit, uzun ad otomatik küçülür. |
| Okunabilirlik (marka + ad) | Logo/banka adı/kart bilgisi rengini **sistem** seçer: zemindeki her renge karşı en okunaklı açık/koyu ton; hiçbir ton yeterli (3:1) olmazsa markanın arkasına sistem kendi yarı saydam plakasını koyar. Özel ad rengi zeminle 3:1'in altındaysa kaydedilemez (`validateDesign` hata verir) ve çizimde uygulanmaz. |
| Ödeme ağı logoları | Kütüphanede yok. |

`js/rules.js` DOM'dan bağımsızdır: **aynı dosya Cloudflare Worker'da sunucu doğrulaması için kullanılabilir** (`module.exports` var). `validateDesign()` gelen JSON'u izin listesine göre yeniden kurar, `system_*` katmanlarını reddeder, alan çakışmalarını denetler. İstemci kontrolleri yalnızca deneyim içindir.

## Dosya yapısı

```
index.html        banka kabuğu + editör iskeleti
css/style.css
js/rules.js       kurallar, doğrulama, çakışma (Nexus Worker'ında da aynı dosya çalışır)
js/connect.js     Nexus bağlantısı: bilet→jeton, kaydet (persist), çık, giriş kapısı
config.js         NEXUS_URL
js/library.js     şekil, zemin, efekt, çip listeleri
js/render.js      tasarım + sistem kaydı → SVG
js/templates.js   4 şablon
js/editor.js      editör
js/app.js         banka sayfaları, yönlendirme, yerel sistem kaydı
assets/           logo ikonu (SVG) ve yazı tipi logosu (PNG)
docs/             şartname PDF, seçilen logo/kart görseli
```

## Bilinen sınırlar (bu sürüm)

- Veriler `localStorage`'da: `fnx.design` (kayıtlı), `fnx.draft` (taslak), `fnx.system` (kart numarası/CVV — **sunucu gelince Worker atayacak**). Sayfa verisini temizlemek hepsini sıfırlar.
- Para birimi **FN**'dir (banka ile aynı). Bakiye ve hareketler hâlâ örnek veridir; gerçek bakiye ve kristal borsası `forevye-nexus` deposundadır, bağlama sonraki adımdır.
- Kullanıcı görsel yükleme kapalı (şartnamedeki dosya kontrolleri yazılana kadar).
- Banka yazı tipi logosu, seçilen görselden şeffaf PNG olarak çıkarıldı (`assets/wordmark.png`, 1422×303). Vektör/SVG orijinali varsa değiştirmek tek dosyalık iş.

## Sıradaki adımlar

1. **Aşama 5:** Cloudflare Worker + D1: e-posta oturumu, `/api/card-designs`, sürüm çakışması, `rules.js` ile sunucu doğrulaması
2. **Aşama 4:** Güvenli görsel yükleme (R2), ek doku/efektler
3. **Aşama 6:** Sanal bakiye, katalog, sunucu taraflı işlem kayıtları
