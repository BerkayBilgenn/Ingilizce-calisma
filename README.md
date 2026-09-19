# Kelime Günlüğü

İki kişinin aynı kelime listesini yedi gün boyunca çalıştığı küçük bir web uygulaması. Her kişi telefon numarası ve kendi PIN'iyle girer; “Bugün ezberledim” işareti sadece o kişinin o günkü kartını kaldırır. Dört saatlik hatırlatmaları Mac'te çalışan gönderici, birinci kişinin bağlı WhatsApp hesabından seçilen gruba yollar.

## Yerelde çalıştırma

1. Node.js 20 veya üzeri kurulu olsun.
2. .env.example dosyasını .env.local olarak kopyalayın ve en az SESSION_SECRET ile SETUP_SECRET değerlerini değiştirin.
3. npm install ve npm run dev çalıştırın.
4. http://localhost:3000 adresinde ilk kurulum anahtarını, iki kişiyi ve isterseniz kelimeleri girin.

Kelime biçimi her satırda İngilizce = Türkçe şeklindedir. Sonraki listeler, admin hesabı giriş yaptıktan sonra aktif turun bitmesini bekler.

## Vercel

Vercel'de projeye Marketplace üzerinden Turso/libSQL veya başka bir kalıcı SQL sağlayıcısı bağlayın. DATABASE_URL, DATABASE_AUTH_TOKEN, SESSION_SECRET, SETUP_SECRET ve AGENT_SECRET ortam değişkenlerini Vercel Project Settings içine ekleyin. DATABASE_URL Vercel'de file: olamaz. İlk deploydan sonra ana sayfayı açıp kurulumu bir kez tamamlayın.

## Mac WhatsApp göndericisi

Gönderim için birinci telefonun WhatsApp hesabı gerçek QR bağlantısıyla Mac'e bağlanır. Bu işlem gönderici hesabın WhatsApp Web oturumunu kullanır; numara taklidi yapılmaz.

1. sender klasöründe npm install çalıştırın.
2. sender/.env.example dosyasını sender/.env olarak kopyalayın. SITE_URL ve AGENT_SECRET değerlerini doldurun.
3. npm start çalıştırın. Terminalde çıkan QR kodu birinci telefonda WhatsApp → Bağlı cihazlar → Cihaz bağla menüsünden okutun.
4. WHATSAPP_GROUP_ID boşsa program grupları ve kimliklerini listeler. Hedef grubun kimliğini .env içine yazıp yeniden başlatın.

Gönderici her 30 saniyede bir kontrol eder; yalnızca İstanbul saatine göre 00.00, 04.00, 08.00, 12.00, 16.00 ve 20.00 dilimlerinin ilk beş dakikasında gönderim talep eder. Mac uyur veya WhatsApp bağlantısı koparsa o aralık kaçırılır; geçmiş dilimler topluca gönderilmez. Belirsiz gönderim sonucu otomatik tekrar edilmez.

Bu WhatsApp Web yöntemi resmî WhatsApp Business API değildir. WhatsApp otomatik veya toplu mesajları kısıtlayabileceği için hesap ve bağlantı riski vardır; QR bağlantısını yalnızca kendi hesabınız ve izin verdiğiniz grup için kullanın.

## Kontroller

npm test web uygulaması testlerini, node sender/schedule.test.cjs gönderici zamanlama testini, npm run build Vercel üretim derlemesini çalıştırır. Gerçek gruba otomatik test mesajı gönderilmez.
