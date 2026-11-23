# 23.11.2026 düzeltme paketi

- Şekil/desen/ışık kütüphanesindeki tüm türler için SVG çizicileri eklendi (diamond, rect, dots, rings, rays, hexgrid, glow, beam).
- Bilinmeyen veya eski tasarım türü artık editörü çökertmiyor; güvenli yer tutucu çiziliyor.
- Kart çizicisi artık tasarımın yönüne göre 856×540 (yatay) veya 540×856 (dikey) tuval kullanıyor.
- Dikey kartta marka, çip, QR, kart kodu, kart numarası ve kullanıcı adı için dikey yerleşim tanımlandı.
- Kart numarası görselde tekrar gösteriliyor; kullanıcı adıyla çakışmaması için alt yerleşim düzenlendi.

Kontroller:
- Tüm JavaScript dosyaları `node --check` ile sözdizimi kontrolünden geçti.
- 21 şekil/desen/ışık türü çizim testi geçti.
- 11 şablonun yatay ve dikey kart oluşturma testi geçti.
