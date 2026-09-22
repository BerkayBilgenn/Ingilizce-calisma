# Quiz, Kelime Arşivi ve Gece Özeti Tasarımı

## Amaç

Mevcut bordo İkra & Berkay çalışma ekranını koruyarak önceki günlerin quizlerini, doğru/yanlış geçmişini, kalıcı öğrenilen kelime arşivini ve her gece 00:00 WhatsApp özetini eklemek. Tüm yeni veriler mevcut libSQL/Turso veritabanında saklanır ve uygulama ya da gönderici yeniden başlatıldığında korunur.

## Kullanıcı deneyimi

Üst başlığa mobil ve masaüstünde çalışan bir hamburger düğmesi eklenir. Menüde **Çalışma**, **Quiz** ve **Kelimelerim** seçenekleri bulunur. Çalışma seçeneği mevcut ana ekranı açar; ana ekranın görsel düzeni değiştirilmez.

Quiz ekranı programın başlamış günlerini ayrı kartlar halinde listeler. Her kart gün numarasını, o günün 10 kelimesini, toplam cevap sayısını ve doğru cevap sayısını gösterir. Kullanıcı bir günü seçtiğinde o güne ait İngilizce kelimeler sırayla gelir ve dört Türkçe seçenek gösterilir. Seçimden sonra doğru seçenek ile kullanıcının sonucu hemen gösterilir. Aynı quiz tekrar çözülebilir; her cevap ayrı bir geçmiş kaydıdır.

Quiz geçmişi gün kartının altında en yeni cevap önce olacak şekilde gösterilir. Her satırda kelime, seçilen cevap, doğru cevap, doğru/yanlış sonucu ve zaman bulunur.

Kelimelerim ekranı bir kullanıcının herhangi bir gün 3/3 tamamladığı kelimeleri tekilleştirerek gösterir. Kelime daha sonra geri alınsa bile arşivden silinmez. Her satırda İngilizce, Türkçe, okunuş ve ilk öğrenilme tarihi bulunur.

## Quiz kuralları

- Quizler programın 1. gününden bugüne kadar açılmış günler için kullanılabilir; gelecek günler gösterilmez.
- Her günün quizinde yalnızca o güne atanmış 10 kelime sorulur.
- Her soru İngilizce kelime ve dört Türkçe seçenek içerir.
- Yanlış seçenekler aynı 1.000 kelimelik müfredattan alınır ve doğru cevapla aynı olamaz.
- Soru ve seçenek sırası her quiz başlangıcında karıştırılır.
- Doğru/yanlış kararı sunucuda verilir; istemciden gelen bir `correct` değeri kabul edilmez.
- Bir soruya birden fazla kez cevap verilebilir ve bütün denemeler geçmişte kalır.

## Kalıcı veri modeli

### `learned_words`

- `participant_id INTEGER NOT NULL`
- `word_id INTEGER NOT NULL`
- `learned_day TEXT NOT NULL`
- `learned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`
- Birincil anahtar: `(participant_id, word_id)`

Bir günlük tekrar 3'e yükseldiği anda `INSERT OR IGNORE` ile yazılır. Şema kurulurken mevcut `daily_checks.repeat_count >= 3` kayıtları geriye dönük eklenir. Geri alma işlemi bu tablodan silmez.

### `quiz_attempts`

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `participant_id INTEGER NOT NULL`
- `word_id INTEGER NOT NULL`
- `quiz_day INTEGER NOT NULL`
- `selected_meaning TEXT NOT NULL`
- `correct_meaning TEXT NOT NULL`
- `is_correct INTEGER NOT NULL`
- `attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`

Katılımcı, gün ve zaman sorguları için indeks eklenir. Kelime ya da kullanıcı silinmediği için deneme geçmişi kalıcıdır.

Mevcut `participants`, `sets`, `words`, `daily_checks`, `learning_notices` ve `send_runs` tabloları korunur. Turso kullanılan üretim ortamında veriler dağıtımdan bağımsızdır; yerel ortamda mevcut dosya veritabanı kullanılmaya devam eder.

## Sunucu arayüzleri

### `GET /api/quiz`

Oturum sahibi için açılmış günleri, gün başına kelime ve deneme özetlerini döndürür. `?day=N` verilirse o günün 10 sorusunu dört seçenekle ve o güne ait geçmişi döndürür. Gelecek ya da program dışı günler reddedilir.

### `POST /api/quiz`

`{ wordId, selectedMeaning }` alır. Kelimenin aktif 100 günlük programda ve açılmış bir güne ait olduğunu doğrular, sonucu sunucuda hesaplar, `quiz_attempts` kaydını ekler ve doğru cevapla sonucu döndürür.

### `GET /api/archive`

Oturum sahibinin `learned_words` kayıtlarını kelime bilgileriyle birlikte ilk öğrenilme tarihine göre döndürür.

Tüm uç noktalar mevcut oturum doğrulamasını kullanır ve başka katılımcının verisini döndürmez.

## Gece 00:00 WhatsApp özeti

İstanbul saatine göre her gün 00:00–00:59 aralığında `midnight-YYYY-MM-DD` anahtarıyla tek bir gönderim hakkı oluşturulur. Gönderici bu işi anlık öğrenme bildirimlerinden sonra, iki saatlik durum mesajından önce talep eder. Aynı gece yeniden başlasa bile `send_runs` benzersiz anahtarı ikinci gönderimi engeller.

Mesaj iki kullanıcı için ayrı bölümler içerir. Her bölümde kullanıcının bugüne kadar arşivlenen bütün kelimeleri `İngilizce — Türkçe` biçiminde listelenir ve toplam sayı yazılır. Hiç kelime yoksa bu açıkça belirtilir. Gece özeti gönderildikten sonraki normal 00:00 durum mesajı bir sonraki gönderici kontrolünde ayrıca işlenebilir.

## Bileşenler

- `components/app-menu.tsx`: hamburger düğmesi, klavye kullanımı, dışarı tıklamada kapanma ve görünüm seçimi.
- `components/quiz-view.tsx`: gün listesi, quiz oturumu, sonuç ve geçmiş.
- `components/archive-view.tsx`: kalıcı kelime listesi.
- `components/study-app.tsx`: mevcut çalışma görünümünü korur ve seçili görünümü yönetir.
- `lib/store.ts`: arşiv ve quiz sorguları ile cevap kaydı.
- `lib/agent.ts`: gece anahtarı, arşiv anlık görüntüsü ve mesaj biçimi.
- `app/api/quiz/route.ts` ve `app/api/archive/route.ts`: kimlik doğrulamalı JSON uç noktaları.
- `sender/schedule.cjs` ve `sender/index.cjs`: gece işini mevcut güvenli gönderim döngüsüne ekler.

## Hata davranışı

- Geçersiz gün, kelime veya seçenek 400 döndürür.
- Oturumsuz istek 401 döndürür.
- Quiz cevap kaydı başarısızsa istemci sonucu kalıcı saymaz ve tekrar deneme sunar.
- Gece mesajı için belirsiz WhatsApp sonucu mevcut davranışla `uncertain` kaydedilir ve aynı anahtarla otomatik tekrar edilmez.
- Arşiv boş olduğunda ekran açıklayıcı boş durum gösterir.

## Testler

- Veritabanı göçü yeni tabloları, indeksleri ve mevcut 3/3 kayıtların arşive taşınmasını doğrular.
- Store testleri kalıcı arşivi, kişi ayrımını, gün erişimini, seçenek doğrulamasını ve quiz geçmişini kapsar.
- API testleri oturum, geçersiz gün/kelime/seçenek ve doğru/yanlış cevapları kapsar.
- Agent testleri İstanbul 00:00 anahtarını, tek gönderimi ve iki kişinin tam arşiv mesajını kapsar.
- Sender testleri gece işinin anlık bildirim ve iki saatlik durum akışını durdurmadığını doğrular.
- Arayüz üretim derlemesi ve mobil hamburger menüsü görsel olarak kontrol edilir.

## Kapsam dışı

- Serbest metinle cevaplama, sesli telaffuz, puan tablosu ve kullanıcılar arası rekabet bu sürüme dahil değildir.
- Mevcut bordo tema, ana çalışma sayfası ve iki saatlik WhatsApp durum mesajı yeniden tasarlanmaz.
