# Kelime Günlüğü

İki kişinin aynı kelime listesini yedi gün boyunca çalıştığı küçük bir web uygulaması. Her kişi telefon numarası ve kendi PIN'iyle girer; ikisi de aktif haftalık listeye kelime ekleyip çıkarabilir. “Bugün ezberledim” işareti sadece o kişinin o günkü kartını kaldırır ve gruba kişi adı ile kelimeyi içeren ayrı bir WhatsApp bildirimi sıraya alır. Dört saatlik hatırlatmaları da Mac'te çalışan gönderici, birinci kişinin bağlı WhatsApp hesabından seçilen gruba yollar.

## Yerelde çalıştırma

1. Node.js 20 veya üzeri kurulu olsun.
2. .env.example dosyasını .env.local olarak kopyalayın ve en az SESSION_SECRET ile SETUP_SECRET değerlerini değiştirin.
3. `npm install` ve `npm run dev -- --port 3001` çalıştırın.
4. http://127.0.0.1:3001 adresinde ilk kurulum anahtarını, iki kişiyi ve isterseniz kelimeleri girin.

Kelime biçimi her satırda İngilizce = Türkçe şeklindedir. Sonraki listeler, admin hesabı giriş yaptıktan sonra aktif turun bitmesini bekler.

## Vercel

Vercel'de projeye Marketplace üzerinden Turso Cloud veritabanı bağlayın. Entegrasyonun eklediği `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN` uygulama tarafından otomatik kullanılır. Ayrıca Vercel Project Settings içinde güçlü `SESSION_SECRET`, `SETUP_SECRET` ve `AGENT_SECRET` değerleri ayarlayın. Önceden eklenmiş boş `DATABASE_URL` ve `DATABASE_AUTH_TOKEN` değerleri Turso ayarlarını engellemez; `DATABASE_URL=file:` ise Vercel'de kullanılamaz. Ortam değişkenlerini ekledikten sonra projeyi yeniden yayınlayın ve ana sayfayı açıp kurulumu bir kez tamamlayın.

## Mac WhatsApp göndericisi

Gönderim için birinci telefonun WhatsApp hesabı gerçek QR bağlantısıyla Mac'e bağlanır. Bu işlem gönderici hesabın WhatsApp Web oturumunu kullanır; numara taklidi yapılmaz.

1. sender klasöründe npm install çalıştırın.
2. sender/.env.example dosyasını sender/.env olarak kopyalayın. SITE_URL değerini web uygulamasının portuyla aynı yapın (ör. `http://127.0.0.1:3001`) ve AGENT_SECRET değerini doldurun.
3. İlk bağlantı için sender klasöründe `npm start` çalıştırın. Terminalde çıkan QR kodu birinci telefonda WhatsApp → Bağlı cihazlar → Cihaz bağla menüsünden okutun.
4. `WHATSAPP_GROUP_NAME=Kalan İngilizce Kelimeler` olarak bırakın. Gönderici grup adını otomatik bulur ve bulduğu kimliği `sender/.env` içine kaydeder. Aynı adla birden fazla grup varsa veya WhatsApp Web grup listesini veremezse terminalde listelenen kimliği `WHATSAPP_GROUP_ID` olarak ekleyip yeniden başlatabilirsiniz.

Mac'te kalıcı çalıştırma için ilk QR bağlantısından sonra sender terminalini Ctrl+C ile kapatın. Proje kökünde `npm run build` ve `npm run local:install` çalıştırın. Bu, siteyi 127.0.0.1:3001 adresinde ve göndericiyi Mac kullanıcı oturumunda ayrı servisler olarak başlatır; oturum açıkken kapanırlarsa tekrar açar. Kurulumdan sonra ayrı `npm start` terminalleri açmayın. Site adresi http://127.0.0.1:3001/.

Anlık mesaj için proje kökünde `npm run local:send-now` çalıştırın; açık olan göndericiye tek gönderim talimatı verir. Durumu `sender/data/sender.log` dosyasından kontrol edin. WhatsApp kütüphanesi mesaj kimliğini döndürmezse gönderim *belirsiz* kaydedilir. Aynı mesajı tekrar istemeden önce grupta görünüp görünmediğini kontrol edin.

Gönderici her 10 saniyede bir kontrol eder. Yeni bir günlük işaret varsa `Ad “kelime” kelimesini ezberledi.` bildirimini seçilmiş gruba yollar. Bekleyen öğrenme bildirimleri 30 dakika sonra sona erer; gönderici geç açılırsa eski bildirimler topluca gönderilmez. İstanbul saatine göre 00.00, 04.00, 08.00, 12.00, 16.00 ve 20.00 ile başlayan dört saatlik dilimlerin her birinde de bir toplu hatırlatma talep eder. Site veya Mac o dilim içinde geç açılırsa o dilimin hatırlatması gönderilir; geçmiş dilimler topluca gönderilmez. Kişi o gün tüm kartlarını işaretlediyse hatırlatmada öğrendiği kelimeler ve tamamladığı bilgisi yer alır. Belirsiz gönderim sonucu otomatik tekrar edilmez.

Bu WhatsApp Web yöntemi resmî WhatsApp Business API değildir. WhatsApp otomatik veya toplu mesajları kısıtlayabileceği için hesap ve bağlantı riski vardır; QR bağlantısını yalnızca kendi hesabınız ve izin verdiğiniz grup için kullanın.

## Kontroller

`npm test` web uygulaması testlerini, sender klasöründeki `npm test` gönderici testlerini, `npm run build` üretim derlemesini çalıştırır. Gerçek gruba otomatik test mesajı gönderilmez.
