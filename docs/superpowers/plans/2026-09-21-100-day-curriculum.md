# 100 Day Curriculum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing seven-day shared word list into a fixed 100-day curriculum of ten CSV-sourced words per day, with pronunciation, three-repeat progress, per-repeat WhatsApp notices, visible mobile identity, and star motion.

**Architecture:** Extend the existing `sets` and `words` tables so legacy sets keep their seven-day behavior while the imported curriculum becomes one idempotent 100-day set. Continue using `daily_checks` and rebuild `learning_notices` to key notices by repeat count. The dashboard selects only the ten words scheduled for the current program day; the client renders pronunciation and motion from the server-owned repeat state.

**Tech Stack:** Next.js 16, React 19, TypeScript, libSQL/Turso, Vitest, CSS animations, Node.js sender

**Spec:** `docs/superpowers/specs/2026-09-21-100-day-curriculum-design.md`

## Global Constraints

- The supplied CSV contains exactly 1,000 unique words with non-empty `İngilizce`, `Türkçe`, `Okunuş`, `Seviye`, and `Kategori` values.
- CSV order is authoritative: every consecutive ten records form the next program day.
- The new program begins at day 1 on its first activation day in `Europe/Istanbul`.
- Existing sets, words, checks, and sent notices must remain stored.
- Each word is complete only at 3/3 daily repeats.
- Every successful repeat increment creates its own WhatsApp notice; scheduled summaries remain every two hours.
- Motion must use compositor properties and respect `prefers-reduced-motion`.
- Do not send test messages to the real WhatsApp group.

---

### Task 1: Import and validate the 1,000-word curriculum

**Files:**
- Create: `content/curriculum.json`
- Create: `lib/curriculum.ts`
- Create: `tests/curriculum.test.ts`

**Interfaces:**
- Consumes: `/Users/kberkaybilgenn/Downloads/ingilizce-1000-kelime.csv`
- Produces: `curriculumWords: CurriculumWord[]`, where `CurriculumWord` has `term`, `meaning`, `pronunciation`, `level`, `category`, `dayNumber`, and `position`.

- [ ] **Step 1: Write the failing curriculum integrity test**

```ts
import { describe, expect, it } from "vitest";
import { curriculumWords } from "../lib/curriculum";

describe("100-day curriculum", () => {
  it("contains 100 complete days of ten unique words", () => {
    expect(curriculumWords).toHaveLength(1000);
    expect(new Set(curriculumWords.map((word) => word.term.toLocaleLowerCase("en"))).size).toBe(1000);
    for (let day = 1; day <= 100; day++) {
      expect(curriculumWords.filter((word) => word.dayNumber === day)).toHaveLength(10);
    }
    expect(curriculumWords.every((word) => word.term && word.meaning && word.pronunciation && word.level && word.category)).toBe(true);
  });

  it("preserves the CSV ordering and pronunciation", () => {
    expect(curriculumWords[0]).toMatchObject({ term: "accept", meaning: "kabul etmek", pronunciation: "ık-SEPT", dayNumber: 1, position: 0 });
    expect(curriculumWords[999]).toMatchObject({ term: "wheel", meaning: "tekerlek", pronunciation: "wiil", dayNumber: 100, position: 999 });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails because the curriculum module is absent**

Run: `npm test -- tests/curriculum.test.ts`
Expected: FAIL resolving `../lib/curriculum`.

- [ ] **Step 3: Convert the supplied CSV into the committed JSON asset**

Run this one-time conversion from the repository root:

```bash
python3 -c 'import csv,json; src="/Users/kberkaybilgenn/Downloads/ingilizce-1000-kelime.csv"; rows=list(csv.DictReader(open(src,encoding="utf-8-sig",newline=""))); assert len(rows)==1000; data=[{"term":r["İngilizce"].strip(),"meaning":r["Türkçe"].strip(),"pronunciation":r["Okunuş"].strip(),"level":r["Seviye"].strip(),"category":r["Kategori"].strip(),"dayNumber":i//10+1,"position":i} for i,r in enumerate(rows)]; open("content/curriculum.json","w",encoding="utf-8").write(json.dumps(data,ensure_ascii=False,indent=2)+"\n")'
```

- [ ] **Step 4: Add the typed curriculum module**

```ts
import source from "@/data/curriculum.json";

export type CurriculumWord = {
  term: string;
  meaning: string;
  pronunciation: string;
  level: string;
  category: string;
  dayNumber: number;
  position: number;
};

export const CURRICULUM_KEY = "english-1000-v1";
export const CURRICULUM_DAYS = 100;
export const curriculumWords = source satisfies CurriculumWord[];
```

- [ ] **Step 5: Run the curriculum test**

Run: `npm test -- tests/curriculum.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit the validated source asset**

```bash
git add content/curriculum.json lib/curriculum.ts tests/curriculum.test.ts
git commit -m "feat: add 100 day word curriculum"
```

### Task 2: Extend and migrate the database safely

**Files:**
- Modify: `lib/db.ts`
- Modify: `tests/db.test.ts`

**Interfaces:**
- Consumes: legacy databases containing the current `sets`, `words`, and `learning_notices` schemas.
- Produces: `sets.duration_days`, `sets.program_key`, word metadata columns, and `learning_notices.repeat_count` with unique `(participant_id, word_id, day, repeat_count)` rows.

- [ ] **Step 1: Write failing migration tests**

Add tests that create the legacy tables before calling `ensureSchema`, then assert:

```ts
const sets = await db.execute("PRAGMA table_info(sets)");
expect(sets.rows.map((row) => row.name)).toEqual(expect.arrayContaining(["duration_days", "program_key"]));
const words = await db.execute("PRAGMA table_info(words)");
expect(words.rows.map((row) => row.name)).toEqual(expect.arrayContaining(["pronunciation", "level", "category", "scheduled_day"]));
const notices = await db.execute("PRAGMA table_info(learning_notices)");
expect(notices.rows.map((row) => row.name)).toContain("repeat_count");
```

Insert one legacy notice before migration, run `ensureSchema`, and verify it survives with `repeat_count = 1`. Insert a second notice for the same participant, word, and day with `repeat_count = 2` and verify both rows exist.

- [ ] **Step 2: Run the migration tests and observe the missing columns/unique-key failure**

Run: `npm test -- tests/db.test.ts`
Expected: FAIL because the new columns and notice uniqueness do not exist.

- [ ] **Step 3: Add idempotent column migrations**

Add a focused helper:

```ts
async function addColumn(db: Client, table: string, column: string, definition: string) {
  const columns = await db.execute(`PRAGMA table_info(${table})`);
  if (!columns.rows.some((row) => row.name === column)) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
```

Call it for:

```ts
await addColumn(db, "sets", "duration_days", "INTEGER NOT NULL DEFAULT 7");
await addColumn(db, "sets", "program_key", "TEXT");
await addColumn(db, "words", "pronunciation", "TEXT NOT NULL DEFAULT ''");
await addColumn(db, "words", "level", "TEXT NOT NULL DEFAULT ''");
await addColumn(db, "words", "category", "TEXT NOT NULL DEFAULT ''");
await addColumn(db, "words", "scheduled_day", "INTEGER NOT NULL DEFAULT 1");
await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS sets_program_key ON sets(program_key) WHERE program_key IS NOT NULL");
```

- [ ] **Step 4: Rebuild legacy learning notices in one transaction**

Detect a missing `repeat_count`, rename the old table, create the new table with:

```sql
UNIQUE(participant_id, word_id, day, repeat_count)
```

Copy all legacy columns plus literal `1` for `repeat_count`, then drop the renamed table. Keep IDs, statuses, message IDs, errors, and timestamps unchanged.

- [ ] **Step 5: Run database tests**

Run: `npm test -- tests/db.test.ts`
Expected: all database tests PASS.

- [ ] **Step 6: Commit the migration**

```bash
git add lib/db.ts tests/db.test.ts
git commit -m "feat: migrate storage for 100 day curriculum"
```

### Task 3: Activate the curriculum and select ten words per day

**Files:**
- Modify: `lib/study.ts`
- Modify: `lib/store.ts`
- Modify: `lib/server.ts`
- Modify: `tests/study.test.ts`
- Modify: `tests/store.test.ts`

**Interfaces:**
- Produces: `activeOn(startDay, currentDay, durationDays)`, `activateCurriculum(db, startDay)`, and dashboard set metadata `{ durationDays, programKey }`.
- Consumes: `curriculumWords` from Task 1 and migrated columns from Task 2.

- [ ] **Step 1: Write failing duration and activation tests**

```ts
expect(activeOn("2026-09-21", "2026-12-29", 100)).toBe(true);
expect(activeOn("2026-09-21", "2026-12-30", 100)).toBe(false);
```

In `tests/store.test.ts`, activate the curriculum on `2026-09-21` twice and assert one program set and 1,000 words exist. Assert day 1 terms equal CSV positions 0–9, day 100 terms equal positions 990–999, and day 101 has no active set.

- [ ] **Step 2: Run the tests and verify the seven-day implementation fails them**

Run: `npm test -- tests/study.test.ts tests/store.test.ts`
Expected: FAIL on the 100-day boundary and missing activation function.

- [ ] **Step 3: Parameterize active duration**

```ts
export function activeOn(startDay: string, currentDay: string, durationDays = 7): boolean {
  const day = dayIndex(startDay, currentDay);
  return day >= 1 && day <= durationDays;
}
```

Return `durationDays` and `programKey` from `getLatestSet`, and pass the duration at every active-set check.

- [ ] **Step 4: Add idempotent curriculum activation**

Implement `activateCurriculum(db, startDay)` so it:

1. Returns the existing set ID when `program_key = english-1000-v1` exists.
2. Inserts one 100-day set.
3. Inserts all curriculum words with metadata and scheduled day in chunked database batches.
4. Deletes the new set if word insertion fails, so the next call can retry cleanly.
5. Verifies the final word count is exactly 1,000 before returning.

- [ ] **Step 5: Activate after schema readiness**

In `readyDb`, after `ensureSchema`, check whether participants exist. When setup is complete, call:

```ts
await activateCurriculum(db, istanbulDay(new Date()));
```

This makes the first post-deployment request the start of day 1 without affecting a brand-new setup form before participants exist.

- [ ] **Step 6: Filter program dashboards by scheduled day**

Add this condition only for program sets:

```sql
AND (? IS NULL OR w.scheduled_day = ?)
```

Pass the program key and current `dayIndex`. Include pronunciation, level, and category in `StudyWord`. Reject add/remove operations when `programKey` is present.

- [ ] **Step 7: Run study and store tests**

Run: `npm test -- tests/study.test.ts tests/store.test.ts`
Expected: all tests PASS, including day 1, day 100, day 101, idempotency, and legacy seven-day behavior.

- [ ] **Step 8: Commit the program state**

```bash
git add lib/study.ts lib/store.ts lib/server.ts tests/study.test.ts tests/store.test.ts
git commit -m "feat: activate 100 day study program"
```

### Task 4: Queue a WhatsApp notice for every repeat

**Files:**
- Modify: `lib/store.ts`
- Modify: `lib/agent.ts`
- Modify: `tests/store.test.ts`
- Modify: `tests/agent.test.ts`
- Modify: `tests/api.test.ts`

**Interfaces:**
- `setDailyCheck` continues to return the authoritative repeat count.
- `learning_notices.repeat_count` identifies the 1/3, 2/3, or 3/3 event.

- [ ] **Step 1: Write failing per-repeat notice tests**

Call `setDailyCheck(..., true, ...)` three times and assert messages equal:

```ts
[
  "📚 Ada “accept” kelimesini 1 kez ezberledi. 2 tekrar kaldı.",
  "📚 Ada “accept” kelimesini 2 kez ezberledi. 1 tekrar kaldı.",
  "⭐ Ada “accept” kelimesini bugün 3 kez ezberledi. Tamamlandı!",
]
```

Assert repeat counts are `[1, 2, 3]`, an extra increment creates no fourth row, undo from 3 cancels only a pending repeat-3 notice, and redoing a sent repeat-3 notice does not duplicate it.

- [ ] **Step 2: Run notice tests and observe only the first event exists**

Run: `npm test -- tests/store.test.ts tests/agent.test.ts tests/api.test.ts`
Expected: FAIL because the current code queues only the first repeat.

- [ ] **Step 3: Generate and upsert a message for each actual increment**

Use a pure formatter:

```ts
function repeatNotice(name: string, term: string, count: number) {
  if (count === 3) return `⭐ ${name} “${term}” kelimesini bugün 3 kez ezberledi. Tamamlandı!`;
  return `📚 ${name} “${term}” kelimesini ${count} kez ezberledi. ${3 - count} tekrar kaldı.`;
}
```

Insert with the four-part unique key and only when `nextCount > count`. On undo, cancel the pending notice whose `repeat_count` equals the count being removed.

- [ ] **Step 4: Keep scheduled summaries aligned with the daily ten words**

No new message format is needed: `buildSnapshot` uses the dashboard, which now returns only the current ten words. Retain `0 kere ezberlendi, kalan ezberlenme 3` through `2 kere ezberlendi, kalan ezberlenme 1` for incomplete words.

- [ ] **Step 5: Run store, agent, and API tests**

Run: `npm test -- tests/store.test.ts tests/agent.test.ts tests/api.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Commit WhatsApp progress notices**

```bash
git add lib/store.ts lib/agent.ts tests/store.test.ts tests/agent.test.ts tests/api.test.ts
git commit -m "feat: notify each word repetition"
```

### Task 5: Rebuild the dashboard for 100 days and pronunciation

**Files:**
- Modify: `components/study-app.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: `Dashboard.set.durationDays`, `Dashboard.set.dayNumber`, and `StudyWord.pronunciation`.
- Removes: `WordEditor` from the active curriculum view; legacy setup components remain available for databases with no participants.

- [ ] **Step 1: Replace seven-day copy and tracker markup**

Render:

```tsx
<span className="eyebrow">100 GÜNLÜK YOLCULUK</span>
<h2>Gün {initial.set.dayNumber} <span>/ {initial.set.durationDays}</span></h2>
<div className="program-progress" role="progressbar" aria-label="100 günlük program ilerlemesi"
  aria-valuenow={initial.set.dayNumber} aria-valuemin={1} aria-valuemax={initial.set.durationDays}>
  <span style={{ width: `${initial.set.dayNumber / initial.set.durationDays * 100}%` }} />
</div>
```

Remove the seven-item `day-track`. Keep the daily completion count as `completed.length / words.length`.

- [ ] **Step 2: Add pronunciation to each card**

Immediately after the meaning, render:

```tsx
<div className="pronunciation">
  <span>OKUNUŞU</span>
  <strong>{word.pronunciation}</strong>
</div>
```

Keep repeat stars, count copy, and button below it.

- [ ] **Step 3: Keep the username visible on mobile**

Replace the mobile `.header-name{display:none}` rule with constrained visible text:

```css
.header-name{display:block;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.header-actions{gap:8px;min-width:0}
```

At 420px, reduce the logo name and action font sizes without hiding either identity or logout.

- [ ] **Step 4: Remove curriculum editing from the dashboard**

Render `WordEditor` only for a legacy set:

```tsx
{!initial.set.programKey && <WordEditor words={words} />}
```

Update empty, footer, setup, and README copy from seven days to 100 days where the fixed program is active.

- [ ] **Step 5: Build and inspect TypeScript output**

Run: `npm run build`
Expected: successful compile and TypeScript check.

- [ ] **Step 6: Commit the 100-day dashboard**

```bash
git add components/study-app.tsx app/globals.css README.md
git commit -m "feat: show daily curriculum and pronunciation"
```

### Task 6: Add restrained star atmosphere and button burst

**Files:**
- Create: `components/star-field.tsx`
- Create: `components/star-burst.tsx`
- Modify: `components/study-app.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `StarField` is decorative and hidden from accessibility APIs.
- `StarBurst` receives a numeric `burstKey`; changing the key remounts six decorative particles.

- [ ] **Step 1: Add deterministic decorative components**

```tsx
export function StarField() {
  return <div className="star-field" aria-hidden="true">
    {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ "--star": index } as React.CSSProperties}>★</i>)}
  </div>;
}

export function StarBurst({ burstKey }: { burstKey: number }) {
  if (!burstKey) return null;
  return <span className="star-burst" key={burstKey} aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => <i key={index} style={{ "--ray": index } as React.CSSProperties}>★</i>)}
  </span>;
}
```

- [ ] **Step 2: Trigger a burst from the clicked card**

Store `{ wordId, key }` in dashboard state. Increment the key before each optimistic repeat increase. Position `StarBurst` inside the check button without changing its accessible label or disabling pointer handling after the request completes.

- [ ] **Step 3: Add compositor-only motion**

Use `opacity` and `transform` only. The burst duration is 520ms with six rotated rays. Background stars use a slow 8–14 second drift/twinkle with deterministic delay and placement selectors. Keep the star layer behind panels with `pointer-events:none`.

- [ ] **Step 4: Disable decorative motion for reduced motion**

```css
@media(prefers-reduced-motion:reduce){
  .star-field i,.star-burst i{animation:none!important}
  .star-burst{display:none}
}
```

- [ ] **Step 5: Verify desktop, mobile, and reduced-motion states in the local browser**

Start a local production preview with a temporary database. Confirm:

- `Merhaba, <ad>` is visible at a 390px viewport.
- Ten cards render without horizontal overflow.
- Pronunciation appears under meaning.
- Repeat text updates 0/3 → 1/3 → 2/3 → completed.
- A short star burst originates at the clicked button.
- With reduced motion enabled, the burst and ambient movement are absent while stars/counts remain visible.

- [ ] **Step 6: Commit motion and polish**

```bash
git add components/star-field.tsx components/star-burst.tsx components/study-app.tsx app/globals.css
git commit -m "feat: add accessible star feedback"
```

### Task 7: Full verification, documentation, and PR update

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-21-100-day-curriculum-design.md` only if implementation evidence requires a correction

**Interfaces:**
- Produces a tested branch update for PR #1.

- [ ] **Step 1: Run all web tests**

Run: `npm test`
Expected: 0 failures across all test files.

- [ ] **Step 2: Run all sender tests**

Run: `cd sender && npm test`
Expected: every sender test script reports passed.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Next.js compile, TypeScript, page collection, and static generation all succeed.

- [ ] **Step 4: Check source consistency**

Run:

```bash
rg -n "7 günlük|7 GÜNLÜK|dört saat|4 saat" README.md app components lib sender tests
```

Expected: no stale active-product copy. Historical migration test names may mention legacy seven-day behavior.

Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 5: Update the existing PR branch**

```bash
git push origin feature/three-repeats-two-hour-reminders
```

Update PR #1 title/body so it includes the 100-day curriculum, CSV import, pronunciation, per-repeat notices, mobile identity, and star motion. Attach the existing PR artifact again after updating it.
