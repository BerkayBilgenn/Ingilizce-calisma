# İki kişilik kelime kartları ve WhatsApp hatırlatıcısı

## Amaç

İki kişi aynı İngilizce kelime listesini yedi gün boyunca her gün tekrar eder. Her kişinin günlük ilerlemesi ayrı tutulur. Dört saatte bir, o gün henüz işaretlenmemiş kelimeler tek bir WhatsApp grup mesajında kişi kişi gösterilir. Site Vercel'de yayınlanır; WhatsApp göndereni birinci kişinin sürekli açık Mac bilgisayarında çalışır.

## Kullanıcı akışı

1. Kurucu, yalnızca başlangıç gizli anahtarıyla açılan ilk kurulum ekranında iki telefon numarasını, her kişiye özel bir PIN'i ve kelime listesini girer. Kurulum tamamlanınca bu ekran kapanır. Numaralar kaynak koda yazılmaz.
2. Her kişi kendi telefon numarası ve PIN'i ile siteye girer. Oturumu koruyan çerez yalnızca o kişinin verilerine erişim sağlar. Kurucu listeyi ve katılımcıları yönetebilir.
3. Bir kelime seti başladığı yerel takvim gününden itibaren yedi gün aktiftir. Gün sınırı `Europe/Istanbul` saat dilimine göre belirlenir. Her gün aynı kelimeler yeniden görünür.
4. “Ezberledim” işareti o kişinin kartını yalnızca o günün kalanından çıkarır. Yanlışlıkla işaretleme geri alınabilir. Ertesi gün işaretler sıfırdan başlar; geçmiş günlerin kayıtları korunur.
5. Kullanıcı, bugün tamamlanan ve kalan kelime sayısını, yedi günlük takvimi ve geçmiş günlerdeki işaretlerini görür.
6. Yedinci günün sonunda set arşivlenir ve o set için hatırlatma durur. Kurucu yeni bir set başlatabilir.

## WhatsApp gönderimi

Mac'te çalışan ayrı bir gönderici, birinci numaranın gerçek WhatsApp hesabına QR kodla bağlanır. Kurucu mevcut gruplar arasından hedef grubu seçer. Gönderici her gün İstanbul saatiyle 00.00'dan başlayarak iki saatte bir sitenin korumalı uç noktasından iki kişinin güncel kalan ve o gün öğrendiği kelimeleri alır. Mesajda her kişinin seçtiği görünen ad kullanılır; telefon numaraları grup mesajında gösterilmez. Bir kişi tüm kelimeleri bitirdiyse kendi bölümünde tamamladığı ve o gün öğrendiği kelimeler yazılır. Aktif sette o gün hiç işaretlenmiş kelime yoksa mesaj gönderilmez.

Gönderici aynı zaman diliminde tek mesaj hedefler. Gönderim sonucu kaydedilir; sonuç belirsizse otomatik yeniden deneme yapıp grubu aynı mesajla doldurmaz. Bir bağlantı kesintisi veya Mac'in uyku durumu yaşanırsa arayüzde son durum ve son başarılı gönderim gösterilir. Mac yeniden açıldığında geçmiş dilimlerin tamamı yollanmaz; sıradaki dilimde güncel kalan kelimeler gönderilir. Kurucu, mesaj önizlemesini ve bir defalık elle gönderme seçeneğini kullanabilir.

WhatsApp Web üzerinden otomasyon resmî bir entegrasyon değildir; WhatsApp'ın otomatik mesaj kuralları nedeniyle oturum bozulabilir veya hesap kısıtlanabilir. Sistem bu durumu açıkça gösterir ve bağlantı koptuğunda gönderilmiş gibi raporlamaz. Bu risk tasarım görüşmesinde kullanıcıya bildirildi.

## Mimari ve veri

- **Web uygulaması:** Vercel'e uygun Next.js uygulaması. Mobil ekranda kartlar, ilerleme, giriş ve kurucu ayarları bulunur.
- **Kalıcı veri:** Yerelde SQLite, Vercel'de Turso/libSQL. Aynı SQL şeması ve uygulama mantığı kullanılır. Vercel dağıtımında veritabanı adresi ve anahtarı ortam değişkenlerinden alınır.
- **Temel kayıtlar:** Katılımcı (normalize telefon, PIN özeti, rol, görünen ad); set (başlangıç ve bitiş günü); kelime (set, İngilizce sözcük, Türkçe anlam); günlük işaret (katılımcı, kelime, gün); gönderim kaydı (gün/dilim, durum, zaman, hata özeti).
- **Güvenlik:** PIN'ler düz metin tutulmaz. Giriş denemeleri sınırlandırılır. Oturum çerezleri imzalı, `HttpOnly` ve yayın ortamında `Secure` olur. Katılımcı yalnızca kendi işaretlerini değiştirebilir. İlk kurulumun ve Mac göndericisinin uç noktaları farklı gizli anahtarlarla korunur; anahtarlar tarayıcıya gönderilmez.
- **Saat ve tekrar:** Dört saatlik zaman dilimi anahtarı İstanbul gününe göre üretilir. Günlük işaretlerin tekilliği ve gönderim diliminin tekilliği veritabanında zorlanır.

Vercel'in sürekli açık bir WhatsApp Web oturumu barındırmaması nedeniyle zamanlayıcı Mac göndericisindedir. Sitedeki ilerleme ise Mac kapansa da veritabanında kalır.

## Hata durumları

- Yanlış numara veya PIN genel bir giriş hatası verir; hangi numaranın kayıtlı olduğu söylenmez.
- Veritabanı erişilemezse kart işaretinin kaydedilmediği açıkça gösterilir.
- WhatsApp oturumu koparsa QR ile yeniden bağlanma gerekir. Gönderici yalnızca seçilmiş gruba mesaj yollar.
- Kelime seti yoksa, günlük tüm kartlar işaretliyse veya yedi gün bitmişse uygun boş durum gösterilir.
- Aynı kelimenin tekrar girilmesi veya boş anlam gibi giriş hataları kurulum sırasında doğrulanır.

## Doğrulama

Gün sınırları, yedi günlük bitiş, kişilerin birbirinden bağımsız işaretleri, iki saatlik mesaj içeriği ve aynı dilimde tekrar gönderimin engellenmesi test edilir. WhatsApp gönderimi sahte bir göndericiyle sınanır; gerçek gruba otomatik deneme mesajı atılmaz. Gerçek bağlantı, kurucunun QR kodu taraması ve grubu seçmesiyle ayrı bir son kontrol gerektirir.

## Dağıtım koşulları

Kurucu Vercel'de siteyi ve Turso veritabanını bağlar; gerekli gizli değerleri Vercel ayarlarına girer. Mac göndericisi Vercel adresini ve kendine ait gizli anahtarı kullanır. Mac açık, internete bağlı ve WhatsApp oturumu geçerli oldukça otomatik gönderim yapılır. İlk sürüm yalnızca iki kayıtlı kişiyi ve tek WhatsApp grubunu destekler.
