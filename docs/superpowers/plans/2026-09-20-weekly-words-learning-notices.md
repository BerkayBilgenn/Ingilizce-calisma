# Weekly Words and Learning Notices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let both participants edit the active weekly word list and notify the WhatsApp group when one first learns a word that day.

**Architecture:** Keep removals and learning notices in separate tables so old check history survives. Add authenticated word editing routes and a near-time notice queue consumed by the existing Mac sender. Keep four-hour reminders and uncertain-send protection intact.

**Tech Stack:** Next.js 16, React 19, libSQL/Turso, Node.js CommonJS sender, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-weekly-words-learning-notices-design.md`

## Global Constraints

- Both registered participants may edit only the active seven-day set.
- No automatic real WhatsApp test message and no retry after uncertain delivery.
- Past daily checks remain stored when a word is removed.
- A pending notice expires after 30 minutes.

---

## Task 1: Shared active-set editing

**Files:** `lib/db.ts`, `lib/store.ts`, `app/api/words/route.ts`, `tests/db.test.ts`, `tests/store.test.ts`, `tests/api.test.ts`.

- [ ] Write failing store and route tests for both participants adding/removing words, duplicate validation, inactive-set rejection, and preserved history.
- [ ] Run focused tests and confirm the intended failures.
- [ ] Add the removal table, store functions, dashboard filtering, and authenticated API route.
- [ ] Run focused tests and confirm they pass.

## Task 2: Learning notice queue

**Files:** `lib/db.ts`, `lib/store.ts`, `lib/agent.ts`, `app/api/agent/claim/route.ts`, `app/api/agent/complete/route.ts`, `tests/store.test.ts`, `tests/agent.test.ts`.

- [ ] Write failing tests for one notice per new daily check, pending cancellation, expiration, claim, and completion.
- [ ] Run focused tests and confirm the intended failures.
- [ ] Store notice creation with the check transaction; claim pending notices before four-hour reminders and complete by notice id.
- [ ] Run focused tests and confirm they pass.

## Task 3: Sender and dashboard

**Files:** `sender/index.cjs`, `sender/schedule.test.cjs`, `components/study-app.tsx`, `app/globals.css`, `README.md`.

- [ ] Add a meaningful sender test for notice priority and no uncertain retry; run it red.
- [ ] Set sender polling to about 10 seconds while preserving the four-hour deduplication.
- [ ] Add a labelled add-word form and removal controls to the active-set dashboard; refresh after success and show save errors.
- [ ] Run web tests, sender tests, production build, and diff checks; inspect mobile and keyboard behavior where UI access permits.
