# 100 Günlük İngilizce Programı Tasarımı

## Amaç

Uygulama, verilen 1.000 kelimelik CSV'yi 100 güne bölen sabit bir çalışma programına dönüşür. Her gün iki kullanıcı da aynı 10 kelimeyi görür. Bir kelime o gün üç kez “Ezberledim” olarak işaretlendiğinde tamamlanır. Arayüz ve WhatsApp bildirimleri her kelimenin 0/3–3/3 ilerlemesini aynı kaynaktan gösterir.

Program etkinleştirildiği İstanbul takvim gününü 1. gün kabul eder. Önceki yedi günlük listeler ve öğrenme kayıtları veritabanında korunur; yeni program aktif çalışma kaynağı olur.

## Kaynak veri ve günlük dağılım

- Kaynak dosya **ingilizce-1000-kelime.csv** tam 1.000 benzersiz kayıt içerir.
- Zorunlu alanlar İngilizce, Türkçe, Okunuş, Seviye ve Kategori sütunlarıdır. Kaynakta bu alanların hiçbiri boş değildir.
- Dosya sırası korunur. 1–10. kayıtlar 1. güne, 11–20. kayıtlar 2. güne ve aynı yöntemle 991–1000. kayıtlar 100. güne atanır.
- Kaynak, uygulama paketine doğrulanmış JSON verisi olarak eklenir. Çalışma zamanında kullanıcının Downloads klasörüne bağımlılık olmaz.
- Aynı program anahtarı yalnızca bir kez etkinleştirilir. Tekrarlanan başlangıç istekleri yeni program veya kelime kopyaları oluşturmaz.

## Veri modeli ve geçiş

Mevcut **sets**, **words**, **daily_checks** ve **learning_notices** akışı korunarak genişletilir:

- **sets** tablosuna **duration_days** ve benzersiz, isteğe bağlı **program_key** alanları eklenir. Eski setler 7 gün çalışmaya devam eder.
- **words** tablosuna **pronunciation**, **level**, **category** ve **scheduled_day** alanları eklenir. Program kelimeleri 1–100 arası bir gün taşır.
- Yeni set **english-1000-v1** program anahtarını, 100 günlük süreyi ve etkinleştirme gününü kullanır.
- Yeni set son set olduğu için gösterge tablosu onu seçer. Eski setler, kelimeler ve günlük kayıtlar silinmez.
- **learning_notices** tablosu güvenli bir tablo yeniden oluşturma geçişiyle **repeat_count** alanını ve kişi–kelime–gün–tekrar düzeyinde benzersizliği kazanır. Var olan bildirimler ilk tekrar olarak korunur.
- Şema ve program etkinleştirme işlemleri tekrar çalıştırılabilir ve yarım veri bırakmayacak işlemler içinde yürütülür.

## Gün ve ilerleme kuralları

- Program yalnızca 1–100. günlerde aktiftir.
- Gösterge tablosu aktif gün için planlanan 10 kelimeyi getirir.
- Her kişi için tekrar sayıları ayrıdır ve her takvim gününde yeniden 0/3 başlar.
- İlk ve ikinci tıklamada kelime kalan kartlarda durur. Üçüncü tıklamada tamamlananlara taşınır.
- Geri alma tekrar sayısını bir azaltır. 3/3'ten 2/3'e dönen kelime yeniden kalan kartlarda görünür.
- Kalan kelime sayısı yalnızca 3/3 olmayan günlük kelimeleri sayar.
- Günlük tamamlanma çubuğu, 3/3 olan kelime sayısını 10 üzerinden gösterir. Program çubuğu ayrıca mevcut günü 100 üzerinden gösterir.
- 100. gün bittiğinde program tamamlanmış görünür; yeni bir otomatik tur başlatılmaz.

## WhatsApp davranışı

- Her başarılı artırma ayrı bir bildirim üretir:
  - **📚 Berkay “accept” kelimesini 1 kez ezberledi. 2 tekrar kaldı.**
  - **📚 Berkay “accept” kelimesini 2 kez ezberledi. 1 tekrar kaldı.**
  - **⭐ Berkay “accept” kelimesini bugün 3 kez ezberledi. Tamamlandı!**
- Aynı kişi, kelime, gün ve tekrar için en fazla bir bildirim gönderilir.
- Geri alınan tekrara ait bekleyen bildirim iptal edilir. Daha önce gönderilmiş mesaj geri alınmaz ve tekrar gönderilmez.
- İki saatlik toplu mesajlar İstanbul saatiyle çift saatlerde devam eder. Her eksik kelime için yapılan ve kalan tekrar sayısı yazılır.
- Anlık bildirim kuyruğu iki saatlik toplu mesajlardan önce işlenmeye devam eder.

## Arayüz

### Başlık ve program özeti

- Mobil başlıkta logo, **Merhaba, ad** ve çıkış düğmesi birlikte görünür. Kullanıcı adı dar ekranda gizlenmez; gerektiğinde kısaltılır.
- “7 günlük yolculuk” metinleri “100 günlük yolculuk” olarak değiştirilir.
- Özet, **Gün 1 / 100** metnini ve program boyunca ilerleyen ayrı bir çubuğu gösterir. Yüz adet küçük gün dairesi kullanılmaz.

### Kelime kartı

Her kart şu sırayı kullanır:

1. İngilizce kelime
2. Türkçe anlamı
3. **Okunuşu** etiketi ve Türkçe okunuş
4. Üç yıldızlı tekrar göstergesi
5. Yapılan ve kalan tekrar metni
6. **Ezberledim · 1/3**, **2/3** veya **3/3** düğmesi

Sabit 1.000 kelimelik programın bütününü ana sayfada düzenlemek günlük akışı bozacağı için ortak liste düzenleyicisi program ekranından kaldırılır. Kaynak kelimeler CSV/JSON içinde yönetilir.

### Yıldızlar ve hareket

- Sayfa arka planında bordo–altın palete uyan düşük kontrastlı yıldız katmanı bulunur. Yıldızlar yavaşça parlayıp hafifçe yer değiştirir; metin okunabilirliğini etkilemez.
- Tekrar yıldızları boş durumda soluk, tamamlanan tekrarlar altın renkte görünür.
- “Ezberledim” tıklamasında düğmenin çevresinden altı küçük yıldız çıkar. Hareket yalnızca dönüşüm ve saydamlık kullanır, kısa sürer ve sonraki tıklamayı engellemez.
- Hareket azaltma ayarı açıkken arka plan hareketi ve yıldız patlaması kapatılır; sayaç, renk ve metin geri bildirimi korunur.

## Hata ve eşzamanlılık davranışı

- Arayüz tıklamayı geçici olarak iyimser gösterir. API başarısız olursa kart sunucudaki önceki tekrar sayısına döner ve görünür hata mesajı gösterir.
- Bir kelime kaydedilirken aynı kartın düğmesi devre dışı kalır. Diğer kartlar kullanılabilir.
- Sunucu tekrar sayısını 0–3 aralığında sınırlar. Fazladan tıklama 3'ü aşmaz.
- CSV doğrulaması kayıt sayısı, zorunlu alanlar, benzersiz İngilizce kelimeler ve günlük 10 kelime dağılımını kontrol eder.

## Doğrulama

- Eski yedi günlük setler 7 gün davranışını korur; yeni program 100 gün aktif kalır.
- 1. ve 100. gün tam 10 doğru kelimeyi gösterir; 101. gün aktif program bulunmaz.
- İki kullanıcının tekrarları birbirine karışmaz.
- 1/3, 2/3, 3/3, geri alma ve sayfa yenileme durumları doğru kalır.
- Her tekrar için doğru anlık WhatsApp metni oluşur ve aynı tekrar iki kez kuyruğa girmez.
- İki saatlik mesaj günlük 10 kelimenin güncel tekrar sayılarını gösterir.
- Mobil kullanıcı adı görünür; kartlar dar ve geniş ekranlarda taşmaz.
- Yıldız patlaması görsel olarak kontrol edilir; hareket azaltma ayarında animasyon oluşmaz.
- Web testleri, gönderici testleri ve üretim derlemesi başarıyla tamamlanır. Gerçek WhatsApp grubuna otomatik test mesajı gönderilmez.
