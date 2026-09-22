# Quiz, Kelime Arşivi ve Gece Özeti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Açılmış günlere ait quizleri, kalıcı öğrenilen kelime arşivini ve İstanbul saatiyle 00:00 WhatsApp özetini mevcut bordo İkra & Berkay uygulamasına eklemek.

**Architecture:** Mevcut libSQL/Turso şeması `learned_words` ve `quiz_attempts` tablolarıyla genişletilecek. Store katmanı quiz ve arşiv iş kurallarını uygulayacak, kimlik doğrulamalı API uçları bunları sunacak, React bileşenleri hamburger menüden erişilen iki yeni görünümü oluşturacak. Gece özeti mevcut agent claim ve `send_runs` tekilleştirme akışını kullanacak.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, libSQL/Turso, Vitest, Node.js WhatsApp sender.

**Spec:** `docs/superpowers/specs/2026-09-22-quiz-archive-midnight-design.md`

## Global Constraints

- Mevcut bordo İkra & Berkay teması ve çalışma ekranının yapısı korunacak.
- Quizler yalnızca 100 günlük programda açılmış günleri gösterecek; gelecek günler reddedilecek.
- Bir kelime ilk kez 3/3 olduğunda arşivlenecek ve geri alma arşivi silmeyecek.
- Quiz doğruluğu yalnızca sunucuda hesaplanacak.
- Gece özeti Europe/Istanbul saat diliminde 00:00–00:59 arasında günde bir kez gönderilecek.
- Yeni kalıcı veriler libSQL/Turso’da tutulacak; tarayıcı depolaması kullanılmayacak.

---

### Task 1: Kalıcı arşiv şeması ve öğrenme akışı

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/store.ts`
- Modify: `tests/db.test.ts`
- Modify: `tests/store.test.ts`

**Interfaces:**
- Produces: `LearnedWord`, `getLearnedWords(db, participantId)`, `learned_words(participant_id, word_id, learned_day, learned_at)`.
- Consumes: mevcut `setDailyCheck`, `participants`, `words`, `daily_checks` tabloları.

- [ ] **Step 1: Şema ve arşiv davranışı için başarısız testleri yaz**

```ts
it("backfills completed checks into the permanent learned archive", async () => {
  // legacy 3/3 daily_check oluştur, ensureSchema çağır
  expect(await db.execute("SELECT participant_id, word_id FROM learned_words")).toHaveLength(1);
});

it("archives a word at 3/3 and keeps it after undo", async () => {
  await setDailyCheck(db, participantId, wordId, true, day);
  await setDailyCheck(db, participantId, wordId, true, day);
  await setDailyCheck(db, participantId, wordId, true, day);
  await setDailyCheck(db, participantId, wordId, false, day);
  expect((await getLearnedWords(db, participantId)).map((word) => word.term)).toEqual(["apple"]);
});
```

- [ ] **Step 2: Testlerin eksik tablo ve fonksiyon yüzünden başarısız olduğunu doğrula**

Run: `npm test -- tests/db.test.ts tests/store.test.ts`
Expected: FAIL; `learned_words` veya `getLearnedWords` bulunmuyor.

- [ ] **Step 3: Şemayı ve arşiv sorgularını uygula**

```ts
export type LearnedWord = {
  id: number; term: string; meaning: string; pronunciation: string;
  learnedDay: string; learnedAt: string;
};

export async function getLearnedWords(db: Client, participantId: number): Promise<LearnedWord[]> {
  // learned_words ile words tablolarını birleştir; katılımcıya göre filtrele
}
```

`setDailyCheck` içinde `nextCount === 3` olduğunda aynı transaction içinde `INSERT OR IGNORE INTO learned_words` çalıştır. `ensureSchema` sonunda mevcut `daily_checks.repeat_count >= 3` kayıtlarını arşive taşı.

- [ ] **Step 4: Arşiv testlerini yeşile getir**

Run: `npm test -- tests/db.test.ts tests/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Değişiklikleri kaydet**

```bash
git add lib/db.ts lib/store.ts tests/db.test.ts tests/store.test.ts
git commit -m "feat: persist learned word archive"
```

### Task 2: Günlük quizler, sonuç kontrolü ve geçmiş

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/store.ts`
- Create: `app/api/quiz/route.ts`
- Create: `app/api/archive/route.ts`
- Modify: `tests/store.test.ts`
- Modify: `tests/api.test.ts`

**Interfaces:**
- Produces: `QuizDaySummary`, `QuizQuestion`, `QuizAttempt`, `getQuizOverview(db, participantId, day)`, `getQuizDay(db, participantId, quizDay, day)`, `answerQuiz(db, participantId, wordId, selectedMeaning, day)`.
- Produces: `GET /api/quiz`, `POST /api/quiz`, `GET /api/archive`.
- Consumes: Task 1 `getLearnedWords`; mevcut `sessionId`, `readyDb`, `istanbulDay`.

- [ ] **Step 1: Quiz store davranışları için başarısız testleri yaz**

```ts
it("lists only opened curriculum days and records server-checked answers", async () => {
  expect((await getQuizOverview(db, id, "2026-09-22")).map((day) => day.day)).toEqual([1, 2]);
  const quiz = await getQuizDay(db, id, 1, "2026-09-22");
  expect(quiz.questions).toHaveLength(10);
  expect(quiz.questions.every((question) => question.options.length === 4)).toBe(true);
  const result = await answerQuiz(db, id, quiz.questions[0].wordId, "yanlış cevap", "2026-09-22");
  expect(result.correct).toBe(false);
  expect((await getQuizDay(db, id, 1, "2026-09-22")).history).toHaveLength(1);
});
```

Gelecek gün, başka program kelimesi ve dört seçenek dışında kalan cevap için ayrı reddetme testleri ekle.

- [ ] **Step 2: Store testlerinin eksik quiz fonksiyonları yüzünden başarısız olduğunu doğrula**

Run: `npm test -- tests/store.test.ts`
Expected: FAIL; quiz fonksiyonları bulunmuyor.

- [ ] **Step 3: Quiz tablosunu ve store iş kurallarını uygula**

`quiz_attempts` tablosunu indeksleriyle oluştur. `getQuizDay` her kelime için doğru anlamı ve müfredattan üç benzersiz yanlış anlamı karıştırarak döndürsün. `answerQuiz` seçilen anlamın o sorunun üretilebilir dört seçeneğinden biri olduğunu doğrulasın, doğru cevabı sunucuda hesaplayıp geçmişi yazsın.

- [ ] **Step 4: Store quiz testlerini yeşile getir**

Run: `npm test -- tests/store.test.ts`
Expected: PASS.

- [ ] **Step 5: API davranışları için başarısız testleri yaz**

```ts
expect((await quiz.GET(authedRequest("/api/quiz"))).status).toBe(200);
expect((await quiz.GET(new NextRequest("http://localhost:3000/api/quiz"))).status).toBe(401);
expect((await quiz.POST(authedJson("/api/quiz", { wordId, selectedMeaning }))).status).toBe(200);
expect((await archive.GET(authedRequest("/api/archive"))).status).toBe(200);
```

- [ ] **Step 6: API testlerinin 404/modül eksikliğiyle başarısız olduğunu doğrula**

Run: `npm test -- tests/api.test.ts`
Expected: FAIL; route modülleri bulunmuyor.

- [ ] **Step 7: Kimlik doğrulamalı quiz ve arşiv route'larını uygula**

Route'lar oturumu `sessionId` ile doğrulasın, günü `istanbulDay(new Date())` ile belirlesin, doğrulama hatalarını 400 ve oturumsuz istekleri 401 döndürsün.

- [ ] **Step 8: API testlerini yeşile getir ve kaydet**

Run: `npm test -- tests/store.test.ts tests/api.test.ts`
Expected: PASS.

```bash
git add lib/db.ts lib/store.ts app/api/quiz/route.ts app/api/archive/route.ts tests/store.test.ts tests/api.test.ts
git commit -m "feat: add daily quizzes and history"
```

### Task 3: İstanbul 00:00 WhatsApp arşiv özeti

**Files:**
- Modify: `lib/agent.ts`
- Modify: `app/api/agent/claim/route.ts`
- Modify: `tests/agent.test.ts`
- Modify: `tests/api.test.ts`

**Interfaces:**
- Produces: `midnightSlotKey(date)`, `buildArchiveSnapshot(db)`, `formatArchiveMessage(snapshot)`.
- Consumes: Task 1 `getLearnedWords`; mevcut `claimSlot`, `send_runs`, learning notice claim akışı.

- [ ] **Step 1: Gece anahtarı, mesaj ve öncelik için başarısız testleri yaz**

```ts
expect(midnightSlotKey(new Date("2026-09-21T21:15:00.000Z"))).toBe("midnight-2026-09-22");
expect(midnightSlotKey(new Date("2026-09-21T22:15:00.000Z"))).toBeNull();
expect(formatArchiveMessage(snapshot)).toContain("Ada · 2 kelime");
```

API testinde bekleyen öğrenme bildiriminin önce, ardından gece özetinin, ardından normal iki saatlik slotun claim edildiğini doğrula.

- [ ] **Step 2: Agent testlerinin yeni fonksiyonlar bulunmadığı için başarısız olduğunu doğrula**

Run: `npm test -- tests/agent.test.ts tests/api.test.ts`
Expected: FAIL; gece fonksiyonları bulunmuyor.

- [ ] **Step 3: Gece özeti üretimini ve claim önceliğini uygula**

00:00–00:59 İstanbul saati dışında `midnightSlotKey` null döndürsün. Claim route sırası: bekleyen öğrenme bildirimi, gece özeti, normal iki saatlik özet. Gece özeti de `claimSlot` kullansın; bu sayede yeniden başlatmada aynı `midnight-YYYY-MM-DD` anahtarı tekrar gönderilmesin.

- [ ] **Step 4: Agent ve API testlerini yeşile getir ve kaydet**

Run: `npm test -- tests/agent.test.ts tests/api.test.ts`
Expected: PASS.

```bash
git add lib/agent.ts app/api/agent/claim/route.ts tests/agent.test.ts tests/api.test.ts
git commit -m "feat: send nightly learned word summary"
```

### Task 4: Hamburger menü, Quiz ve Kelimelerim görünümleri

**Files:**
- Create: `components/app-menu.tsx`
- Create: `components/quiz-view.tsx`
- Create: `components/archive-view.tsx`
- Modify: `components/study-app.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `AppMenu({ view, onSelect })`, `QuizView`, `ArchiveView`.
- Consumes: Task 2 JSON API sözleşmeleri; mevcut `Logo`, çalışma görünümü ve bordo CSS değişkenleri.

- [ ] **Step 1: Bileşenleri mevcut bordo kabuk içinde uygula**

`DashboardView` içine `study | quiz | archive` görünüm durumu ekle. Başlıkta erişilebilir hamburger düğmesi `aria-expanded`, `aria-controls` ve Escape/dış tıklama kapanışı kullansın. Menü öğeleri Çalışma, Quiz ve Kelimelerim olsun. Kullanıcı adı mobilde görünmeye devam etsin.

- [ ] **Step 2: Quiz görünümünü API üzerinden bağla**

Gün kartlarını, dört cevap düğmesini, anlık doğru/yanlış geri bildirimini ve geçmiş satırlarını göster. Yeni quiz başlatıldığında `GET /api/quiz?day=N`, cevapta `POST /api/quiz` kullan.

- [ ] **Step 3: Arşiv görünümünü API üzerinden bağla**

`GET /api/archive` sonucunu İngilizce, Türkçe, okunuş ve ilk öğrenilme tarihiyle göster. Boş arşivde açıklayıcı durum göster.

- [ ] **Step 4: Bordo tasarım ve mobil düzeni tamamla**

Yeni sınıflar mevcut `--ink`, `--paper`, `--line`, `--gold`, `--mint` değişkenlerini kullansın. 800px altında menü, quiz seçenekleri ve geçmiş tek sütuna insin; minimum 44px dokunma hedefleri ve `:focus-visible` davranışı korunsun.

- [ ] **Step 5: TypeScript üretim derlemesini doğrula ve kaydet**

Run: `npm run build`
Expected: Next.js production build exits 0.

```bash
git add components/app-menu.tsx components/quiz-view.tsx components/archive-view.tsx components/study-app.tsx app/globals.css
git commit -m "feat: add quiz and learned words navigation"
```

### Task 5: Tam doğrulama ve GitHub push

**Files:**
- Verify: all changed files

**Interfaces:**
- Consumes: Tasks 1–4 tamamlanmış uygulama.
- Produces: doğrulanmış GitHub branch.

- [ ] **Step 1: Tüm testleri çalıştır**

Run: `npm test`
Expected: bütün Vitest testleri PASS, failure 0.

- [ ] **Step 2: Üretim derlemesini yeniden çalıştır**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 3: Diff ve şartname kapsamını kontrol et**

Run: `git diff origin/main...HEAD --check && git status --short`
Expected: whitespace hatası yok; yalnızca planlanan dosyalar değişmiş.

- [ ] **Step 4: Branch'i GitHub'a gönder**

```bash
git push -u origin feature/quiz-archive-midnight
```

GitHub push çıktısındaki branch URL'sini ve son doğrulama sayılarını kullanıcıya bildir.
