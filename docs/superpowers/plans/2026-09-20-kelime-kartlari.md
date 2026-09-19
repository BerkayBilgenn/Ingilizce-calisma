# Kelime Kartları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-person vocabulary review site for Vercel and a Mac-based WhatsApp group reminder that posts each person's remaining words every four hours.

**Architecture:** Next.js serves the mobile web interface and protected JSON endpoints. libSQL stores users, seven-day word sets, daily checks and send runs locally or in Turso. A separate long-running Node process on the first participant's Mac connects to their real WhatsApp Web session, claims each four-hour slot from the site, and sends one combined group message.

**Tech Stack:** Next.js App Router, TypeScript, React, libSQL, Vitest, Node.js 24, whatsapp-web.js, qrcode.

**Spec:** docs/superpowers/specs/2026-09-20-kelime-kartlari-design.md

## Global Constraints

- First version supports exactly two registered participants and one selected WhatsApp group.
- Daily boundaries use Europe/Istanbul. Slots are 00.00, 04.00, 08.00, 12.00, 16.00 and 20.00.
- A checked word disappears only for that participant on that day, reappears the next day, and stops after day seven.
- Phone numbers and secrets never enter source control. PINs are hashed. Session cookies are HttpOnly and Secure in production.
- The Mac sender is the only process that controls WhatsApp; it sends from the first participant's authenticated account. Never send automatic test messages to the real group.
- If both people have no remaining words, skip the group message. Do not replay all missed slots after downtime.
- Sender must not turn an uncertain WhatsApp result into an automatic duplicate.

## File map

- package.json, tsconfig.json, next.config.ts, vitest.config.ts: web app and test configuration.
- lib/db.ts, lib/migrate.ts: libSQL connection and schema creation.
- lib/study.ts: Istanbul date and seven-day card rules.
- lib/auth.ts: phone normalization, PIN verification and signed sessions.
- lib/store.ts: focused persistence functions for users, sets, words and checks.
- lib/agent.ts: four-hour slots, message format and send-run state.
- app/api/setup/route.ts, app/api/login/route.ts, app/api/logout/route.ts, app/api/checks/route.ts, app/api/sets/route.ts: browser actions.
- app/api/agent/claim/route.ts, app/api/agent/complete/route.ts, app/api/agent/heartbeat/route.ts: sender-only actions.
- app/page.tsx, app/layout.tsx, app/globals.css, components/study-app.tsx: responsive user interface.
- sender/package.json, sender/index.cjs, sender/whatsapp.cjs, sender/dashboard.cjs, sender/schedule.cjs, sender/api.cjs: Mac process and local setup page.
- tests/*.test.ts, sender/*.test.cjs: domain and integration tests.
- README.md, .env.example, .gitignore: local use and Vercel deployment instructions.

---

### Task 1: Web foundation, database and day rules

**Files:** Create package.json, tsconfig.json, next.config.ts, vitest.config.ts, lib/db.ts, lib/migrate.ts, lib/study.ts, tests/study.test.ts, tests/db.test.ts, .gitignore.

**Interfaces:** Produce createDb(url: string, token?: string): Client, getDb(): Client, ensureSchema(db?: Client): Promise<void>, istanbulDay(date: Date): string, dayIndex(startDay: string, currentDay: string): number, activeOn(startDay: string, currentDay: string): boolean.

- [ ] **Step 1: Write failing date tests.** Cover midnight in Istanbul, days 1 and 7 active, day 8 inactive.

~~~ts
expect(istanbulDay(new Date("2026-09-20T21:30:00Z"))).toBe("2026-09-21");
expect(dayIndex("2026-09-20", "2026-09-26")).toBe(7);
expect(activeOn("2026-09-20", "2026-09-27")).toBe(false);
~~~

- [ ] **Step 2: Run npm test and confirm missing study exports fail.**
- [ ] **Step 3: Add minimal Next.js/Vitest configuration and the pure date functions.** Use Intl.DateTimeFormat with timeZone Europe/Istanbul; compute day differences using UTC dates from YYYY-MM-DD to avoid DST arithmetic.
- [ ] **Step 4: Write a local database test.** Use createDb() with a temporary file URL, call ensureSchema(db), and assert participants, sets, words, daily_checks and send_runs tables exist. Give daily_checks a unique(participant_id, word_id, day) constraint and send_runs a unique(slot_key) constraint.
- [ ] **Step 5: Implement getDb() using DATABASE_URL (default file:./data/local.db) and DATABASE_AUTH_TOKEN when remote, and implement idempotent schema creation.** Never initialize a local database in a Vercel deployment; fail clearly when DATABASE_URL is absent there.
- [ ] **Step 6: Run npm test and npm run build; commit the foundation.**

### Task 2: Private setup, login and persistent study state

**Files:** Create lib/auth.ts, lib/store.ts, app/api/setup/route.ts, app/api/login/route.ts, app/api/logout/route.ts, app/api/checks/route.ts, app/api/sets/route.ts, tests/auth.test.ts, tests/store.test.ts.

**Interfaces:** Produce normalizePhone(raw: string): string, hashPin(pin: string): Promise<string>, verifyPin(pin: string, hash: string): Promise<boolean>, issueSession(participantId: number): string, readSession(token: string): number | null. Store exposes createInitialSetup(), authenticate(), createSet(), getDashboard(), setDailyCheck().

- [ ] **Step 1: Write failing authentication tests.** Normalize 0537..., +90537... and 90537... to the same +90 value; reject invalid numbers. Check PIN hash/verify and expired or altered sessions.

~~~ts
expect(normalizePhone("0537 000 00 00")).toBe("+905370000000");
expect(await verifyPin("123456", await hashPin("123456"))).toBe(true);
expect(readSession(issueSession(1) + "x")).toBeNull();
~~~

- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement auth helpers with Node crypto scrypt and HMAC.** Require SESSION_SECRET; no PIN or token appears in logs. Use constant-time signature comparison.
- [ ] **Step 4: Write store tests with a temporary database.** Assert setup creates exactly two users once, one user cannot alter the other's checks, a checked card disappears only today, next-day cards return, and day eight has no active cards.
- [ ] **Step 5: Implement focused SQL functions and browser routes.** Setup requires SETUP_SECRET and an empty users table. Login returns the same generic error for an unknown phone and wrong PIN, and persists per-phone attempts with a 15-minute lock after five failures. Mutating routes derive participant id from the signed cookie; only the admin role may create sets.
- [ ] **Step 6: Run focused tests, then npm test; commit auth and study persistence.**

### Task 3: Mobile card experience and admin word entry

**Files:** Create app/layout.tsx, app/page.tsx, app/globals.css, components/study-app.tsx, public/favicon.svg; modify app/api routes only as required for the UI.

**Interfaces:** app/page.tsx passes a typed Dashboard value from getDashboard() to StudyApp. StudyApp calls POST /api/checks with {wordId, checked} and admin POST /api/sets with {words:[{term,meaning}]}.

- [ ] **Step 1: Add a lightweight UI behavior test for check/uncheck state and the two participant totals, using a fake Dashboard.**
- [ ] **Step 2: Run the UI test and confirm failure.**
- [ ] **Step 3: Build the first coherent mobile screen.** Show phone/PIN login, current day of seven, progress, term/meaning cards, an accessible “Ezberledim” checkbox, undo, and a clear empty state. Admin can enter a multiline list as English = Turkish, preview it, and start a new seven-day set. Include loading and save-error feedback.
- [ ] **Step 4: Add a small site-specific favicon and responsive desktop layout.** Preserve readable card text, keyboard focus and reduced-motion behavior.
- [ ] **Step 5: Run UI test and npm run build; manually check narrow and wide screens; commit UI.**

### Task 4: Protected reminder snapshot and send idempotency

**Files:** Create lib/agent.ts, app/api/agent/claim/route.ts, app/api/agent/complete/route.ts, app/api/agent/heartbeat/route.ts, tests/agent.test.ts.

**Interfaces:** slotKey(date: Date): string | null returns YYYY-MM-DD-HH for one of the six five-minute slot windows; formatMessage(snapshot): string | null returns null when both users have no remaining words. POST /api/agent/claim returns {slotKey,message} or {skip:true}; POST /api/agent/complete accepts {slotKey,status,messageId?,error?}.

- [ ] **Step 1: Write failing tests for Istanbul slot boundaries, separate user sections, no-remaining-words skip, and second claim denial.**

~~~ts
expect(slotKey(new Date("2026-09-20T05:01:00Z"))).toBe("2026-09-20-08");
expect(formatMessage({day: "2026-09-20", people: [{name:"A",remaining:[]},{name:"B",remaining:[]}]})).toBeNull();
~~~

- [ ] **Step 2: Run focused tests and confirm failure.**
- [ ] **Step 3: Implement claim as an atomic insert into send_runs with unique slot_key.** Require bearer AGENT_SECRET with constant-time comparison. Claim computes current remaining words from the database; completion stores success/failure/uncertain without deleting the claimed row. Heartbeat records connection and group status for the admin screen.
- [ ] **Step 4: Add agent status and message preview to the admin interface.** Preview must use current data and cannot claim a scheduled slot.
- [ ] **Step 5: Run focused tests and npm run build; commit the agent API.**

### Task 5: Mac WhatsApp sender

**Files:** Create sender/package.json, sender/index.cjs, sender/whatsapp.cjs, sender/dashboard.cjs, sender/schedule.cjs, sender/api.cjs, sender/schedule.test.cjs, sender/.env.example.

**Interfaces:** createWhatsAppClient({sessionPath,onQr,onState}), listGroups(): Promise<Array<{id,name}>>, sendGroup(id,text): Promise<{messageId:string}>; createScheduler({now,claim,send,complete}) exposes tick() and start().

- [ ] **Step 1: Write failing scheduler tests with fake WhatsApp and API functions.** Assert one send in a four-hour window, no send after the five-minute window, no send when claim says skip, and uncertain send has no automatic retry.
- [ ] **Step 2: Run sender tests and confirm failure.**
- [ ] **Step 3: Implement scheduler and HTTP client.** Poll on startup and every 30 seconds, but only claim inside the first five minutes of each slot. Persist no credentials in source. Use AGENT_SECRET against SITE_URL over HTTPS outside localhost.
- [ ] **Step 4: Implement WhatsApp Web adapter with LocalAuth.** The real account is linked by QR. A local dashboard bound to 127.0.0.1 shows QR, connection state, available groups, selected group, last send, message preview, and a deliberate one-time send button. Save only selected group id and browser session under sender/data, both ignored by Git. Never select a group from its name alone when duplicates exist.
- [ ] **Step 5: Use a fake adapter for a full scheduler smoke test; do not send a real WhatsApp message.** Run sender tests, run the local dashboard, and commit.

### Task 6: Deployment handoff and final verification

**Files:** Create README.md, .env.example; finalize .gitignore and package scripts.

**Interfaces:** README gives an exact Vercel + Turso setup, both participant onboarding, WhatsApp QR/group selection, Mac auto-start, and troubleshooting steps. Document that Mac sleep/logout stops sends.

- [ ] **Step 1: Write the example environment files with variable names only.** Include DATABASE_URL, DATABASE_AUTH_TOKEN, SESSION_SECRET, SETUP_SECRET, AGENT_SECRET, SITE_URL and local sender PORT. No supplied phone numbers or credentials in committed files.
- [ ] **Step 2: Document local start, schema initialization, Vercel publication and Mac sender setup.** Include an optional macOS LaunchAgent template so the sender starts after login and restarts on crash.
- [ ] **Step 3: Run all tests, a production build, and local browser checks.** Verify two different logins keep separate state, next-day rules, and a fake sender message. Inspect Git status and committed files for phone numbers or secrets.
- [ ] **Step 4: Commit docs and verified fixes.** Report the working local preview and remaining user-owned connection steps without claiming that a real WhatsApp group has received messages.
