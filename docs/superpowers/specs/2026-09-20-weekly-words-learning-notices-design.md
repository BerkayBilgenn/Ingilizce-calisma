# Ortak haftalık kelimeler ve öğrenme bildirimi

## Amaç

İki kayıtlı kişi aktif yedi günlük setteki ortak kelimeleri giriş yaptıktan sonra ekleyip çıkarabilir. Kişilerden biri bir kelimeyi o gün ilk kez “Ezberledim” olarak işaretlediğinde, mevcut WhatsApp grubuna kişi adı ve kelimeyi içeren ayrı bir bildirim gider.

## Kelime listesi

- Düzenleme iki giriş yapmış kişiye de açıktır. Yeni yedi günlük set başlatma yetkisi kurucuda kalır.
- Yalnızca aktif sette değişiklik yapılır. Kelime ve anlam zorunludur; mevcut uzunluk ve 100 aktif kelime sınırları korunur. Aynı kelime büyük/küçük harf farkıyla ikinci kez eklenmez.
- Çıkarma kelimeyi iki kişinin bugünkü ve sonraki kartlarından çıkarır. Önceki öğrenme kayıtları veritabanında saklanır. Çıkarılmış kelime tekrar eklenirse aynı kayıt yeniden etkinleşir.
- Diğer kişinin açık sayfası yeni listeyi sayfa yenilemesinde görür. Ekleme ve çıkarma sonrası işlemi yapanın sayfası yenilenir.

## WhatsApp bildirimi

- İlk başarılı günlük işaretleme ile aynı veritabanı işleminde tek bir bildirim kaydı oluşur. Metin `📚 <ad> “<kelime>” kelimesini ezberledi.` biçimindedir; telefon numarası içermez.
- Mac göndericisi Vercel'deki kuyruğu yaklaşık 10 saniyede bir kontrol eder. Bu, sürekli açık WhatsApp oturumuyla mümkün olan yakın zamanlı teslimdir; anlık teslim garantisi değildir.
- Öğrenme bildirimleri dört saatlik toplu hatırlatmalardan ayrı kaydedilir. Her kişi, kelime ve gün için en çok bir bildirim gönderilir. İşaret geri alınırsa henüz gönderilmeyen bildirim iptal edilir. Sonradan tekrar işaretlenirse iptal edilmiş kayıt yeniden beklemeye alınabilir; gönderilmiş kayıt tekrarlanmaz.
- Gönderici kapalıyken bekleyen bildirimler 30 dakika sonra sona erer; yeniden açıldığında eski bildirimler toplu gönderilmez. WhatsApp sonucu belirsizse otomatik tekrar yapılmaz.
- Aktif listeden çıkarılan kelimeye ait bekleyen bildirimler iptal edilir.

## Veri ve arayüz

- Çıkarılan kelimeler için ayrı tablo, bildirimler için ayrı kuyruk tablosu eklenir. Var olan tablolara yıkıcı şema değişikliği yapılmaz.
- Mevcut oturum çerezi iki kişinin ekleme/çıkarma yetkisini belirler. Form, mevcut panel ve kart tasarımının içinde görünür; alanlar etiketli, hatalar görünür ve ekran okuyucuya duyurulur.
- Hatalı veya gecikmiş WhatsApp bağlantısı kart işaretlemeyi geri almaz; kuyruk teslim durumu ayrı kaydedilir.

## Doğrulama

- İki kişi de ekleme/çıkarma yapabilir; çıkarma geçmişi korur; yanlış/çift kelime reddedilir.
- İşaretleme tek bildirim oluşturur; tekrar tıklama, geri alma, yeniden işaretleme ve sona erme davranışları sınanır.
- Gönderici öğrenme bildirimini dört saatlik mesaja karıştırmadan alır; belirsiz gönderimi yeniden denemez. Gerçek gruba test mesajı gönderilmez.
