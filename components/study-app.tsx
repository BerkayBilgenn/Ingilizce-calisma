"use client";

import { useState, type FormEvent } from "react";
import type { Dashboard, StudyWord } from "@/lib/store";
import StarBurst from "./star-burst";
import StarField from "./star-field";
import WordEditor from "./word-editor";

type Props = { setupNeeded: boolean; initial: Dashboard | null; today: string };

async function post(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

function Logo() {
  return <div className="brand">
    <span className="brand-mark" aria-hidden="true">İ<span>&</span>B</span>
    <span className="brand-name">İkra <span>&</span> Berkay<small>İngilizce öğreniyor</small></span>
  </div>;
}

function EntryShell({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="entry-shell">
    <StarField />
    <header className="entry-header"><Logo /><span className="eyebrow">{label}</span></header>
    <main className="entry-main">{children}</main>
  </div>;
}

function RepeatStars({ count }: { count: number }) {
  return <span className="repeat-stars" aria-label={`Bugün 3 tekrardan ${count} tanesi tamamlandı`}>
    {[1, 2, 3].map((star) => <span key={star} className={star <= count ? "active" : ""} aria-hidden="true">★</span>)}
  </span>;
}

function SetupForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const people = [1, 2].map((number) => ({
      name: String(data.get(`name${number}`) || ""),
      phone: String(data.get(`phone${number}`) || ""),
      pin: String(data.get(`pin${number}`) || ""),
    }));
    try {
      await post("/api/setup", { secret: data.get("secret"), people });
      await post("/api/login", { phone: people[0].phone, pin: people[0].pin });
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kurulum tamamlanamadı.");
      setBusy(false);
    }
  }

  return <EntryShell label="İKİ KİŞİLİK ÇALIŞMA ALANI">
    <section className="entry-copy">
      <span className="pill">100 günlük program</span>
      <h1>Kelimeler akılda kalsın.</h1>
      <p>Her gün 10 yeni kelime, üç güçlü tekrar ve ortak bir öğrenme yolculuğu.</p>
    </section>
    <form className="panel entry-panel" method="post" action="/api/setup" onSubmit={submit}>
      <div className="panel-heading">
        <span className="eyebrow">İLK KURULUM</span>
        <h2>Çalışma alanını oluştur</h2>
        <p>Numaralar yalnızca giriş ve ilerleme kaydı için kullanılır.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <label className="field">Kurulum anahtarı<input name="secret" type="password" required autoComplete="off" /></label>
      {[1, 2].map((number) => <div key={number} className="person-block">
        <div className="person-title"><span>{number}</span><strong>{number === 1 ? "Grubu kuran kişi" : "İkinci kişi"}</strong></div>
        <div className="form-grid">
          <label className="field">Ad<input name={`name${number}`} required maxLength={60} /></label>
          <label className="field">Telefon<input name={`phone${number}`} type="tel" inputMode="tel" required placeholder="05•• ••• •• ••" /></label>
        </div>
        <label className="field">6 haneli PIN<input name={`pin${number}`} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
      </div>)}
      <button className="button primary wide" disabled={busy}>{busy ? "Oluşturuluyor…" : "100 günlük programı başlat"}<span aria-hidden="true">↗</span></button>
    </form>
  </EntryShell>;
}

function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      await post("/api/login", { phone: data.get("phone"), pin: data.get("pin") });
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Giriş yapılamadı.");
      setBusy(false);
    }
  }

  return <EntryShell label="HER GÜN 10 YENİ KELİME">
    <section className="entry-copy">
      <span className="pill">Bugünün kelimeleri seni bekliyor</span>
      <h1>Kaldığın yerden devam et.</h1>
      <p>Telefon numaranla giriş yap. Her kelimede üç yıldızı tamamla.</p>
      <div className="login-art" aria-hidden="true"><span>learn</span><strong>öğren</strong><i>★</i></div>
    </section>
    <form className="panel entry-panel login-panel" onSubmit={submit}>
      <div className="panel-heading"><span className="eyebrow">TEKRAR HOŞ GELDİN</span><h2>Giriş yap</h2><p>Çalışmaya devam etmek için bilgilerini gir.</p></div>
      <label className="field">Telefon numarası<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="05•• ••• •• ••" /></label>
      <label className="field">6 haneli PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary wide" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Kelimelerime git"}<span aria-hidden="true">↗</span></button>
    </form>
  </EntryShell>;
}

function DashboardView({ initial, today }: { initial: Dashboard; today: string }) {
  const [words, setWords] = useState(initial.words);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [burst, setBurst] = useState({ wordId: 0, key: 0 });
  const remaining = words.filter((word) => !word.checked);
  const completed = words.filter((word) => word.checked);
  const dailyPercent = words.length ? Math.round(completed.length / words.length * 100) : 0;
  const currentDay = initial.set?.dayNumber || 1;
  const windowStart = Math.min(Math.max(currentDay - 3, 1), 94);
  const visibleDays = Array.from({ length: 7 }, (_, index) => windowStart + index);

  async function changeRepeat(word: StudyWord, increase: boolean) {
    const optimisticCount = Math.max(0, Math.min(3, word.repeatCount + (increase ? 1 : -1)));
    if (increase && optimisticCount > word.repeatCount) {
      setBurst((current) => ({ wordId: word.id, key: current.key + 1 }));
    }
    setPending(word.id);
    setError("");
    setWords((current) => current.map((item) => item.id === word.id ? { ...item, repeatCount: optimisticCount, checked: optimisticCount >= 3 } : item));
    try {
      const result = await post("/api/checks", { wordId: word.id, checked: increase });
      setWords((current) => current.map((item) => item.id === word.id ? { ...item, repeatCount: result.repeatCount, checked: result.repeatCount >= 3 } : item));
    } catch (caught) {
      setWords((current) => current.map((item) => item.id === word.id ? word : item));
      setError(caught instanceof Error ? caught.message : "Kart kaydedilemedi.");
    } finally {
      setPending(null);
    }
  }

  async function logout() {
    await post("/api/logout", {});
    location.reload();
  }

  return <div className="site-shell">
    <StarField />
    <header className="site-header">
      <div className="header-inner">
        <Logo />
        <div className="header-actions"><span className="header-name">Merhaba, {initial.person.name}</span><button className="text-button" onClick={logout}>Çıkış yap</button></div>
      </div>
    </header>
    <main className="dashboard">
      <section className="welcome">
        <div>
          <span className="eyebrow">BUGÜNÜN ÇALIŞMASI · {new Date(`${today}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span>
          <h1>Küçük tekrarlar,<br /><em>kalıcı kelimeler.</em></h1>
          <p>Her kelimeyi günde üç kez işaretle. Üç yıldız dolduğunda bugünkü çalışma tamamlanır.</p>
        </div>
        <div className="hero-accent" aria-hidden="true"><span>learn</span><strong>öğren</strong><i>★</i></div>
      </section>

      {initial.set ? <>
        <section className="panel progress-panel">
          <div className="progress-top">
            <div><span className="eyebrow">{initial.set.durationDays} GÜNLÜK YOLCULUK</span><h2>Bugün {initial.set.dayNumber}. gün</h2></div>
            <div className="progress-count"><strong>{completed.length}<span> / {words.length}</span></strong><small>3 tekrarı tamamlandı</small></div>
          </div>
          <div className="progress-track" role="progressbar" aria-label="Bugün üç tekrarı tamamlanan kelimeler" aria-valuenow={completed.length} aria-valuemin={0} aria-valuemax={words.length}><span style={{ width: `${dailyPercent}%` }} /></div>
          <ol className="day-track">{visibleDays.map((day) => <li key={day} className={day === currentDay ? "current" : day < currentDay ? "past" : "future"}><span>{day < currentDay ? "✓" : day}</span><small>Gün {day}</small></li>)}</ol>
        </section>

        <div className="section-heading"><div><span className="eyebrow">SIRADAKİ KARTLAR</span><h2>Bugün kalan kelimeler <b>{remaining.length}</b></h2></div><p>Bir kelime, üç tekrar tamamlanana kadar burada kalır.</p></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {remaining.length ? <ul className="word-grid">{remaining.map((word, index) => <li className="word-card" key={word.id}>
          <div className="word-top"><span>KELİME {String(index + 1).padStart(2, "0")}</span><RepeatStars count={word.repeatCount} /></div>
          <h3>{word.term}</h3>
          <span className="translation-label">TÜRKÇE ANLAMI</span>
          <p className="word-meaning">{word.meaning}</p>
          {word.pronunciation && <div className="pronunciation"><span>OKUNUŞU</span><strong>{word.pronunciation}</strong></div>}
          <div className="repeat-copy">{word.repeatCount > 0 ? <><strong>{word.repeatCount} kez ezberlendi</strong><span>{3 - word.repeatCount} tekrar kaldı</span></> : <><strong>3 tekrar hedefi</strong><span>Henüz başlanmadı</span></>}</div>
          <button className="check-button" onClick={() => changeRepeat(word, true)} disabled={pending === word.id}>
            <span className="check-icon" aria-hidden="true">★</span>
            {pending === word.id ? "Kaydediliyor…" : `Ezberledim · ${word.repeatCount + 1}/3`}
            <StarBurst burstKey={burst.wordId === word.id ? burst.key : 0} />
          </button>
        </li>)}</ul> : <div className="panel done-state"><span aria-hidden="true">★</span><h3>Bugünlük hepsi tamam!</h3><p>Bugünün 10 kelimesinde üç tekrarı tamamladın. Yarın 10 yeni kelime seni bekliyor.</p></div>}

        {completed.length > 0 && <section className="completed-section">
          <div className="section-heading"><div><span className="eyebrow">BUGÜN TAMAMLANANLAR</span><h2>Üç tekrarı biten kelimeler <b>{completed.length}</b></h2></div></div>
          <ul className="completed-list">{completed.map((word) => <li key={word.id}><RepeatStars count={word.repeatCount} /><strong>{word.term}</strong><span>{word.meaning}</span><button onClick={() => changeRepeat(word, false)} disabled={pending === word.id}>Bir tekrarı geri al</button></li>)}</ul>
        </section>}
        {!initial.set.programKey && <WordEditor words={words} />}
      </> : <section className="panel empty-work"><span className="eyebrow">100 GÜNLÜK YOLCULUK</span><h2>Program tamamlandı.</h2><p>1.000 kelimeyi 100 güne bölerek tamamladınız.</p></section>}

      <footer className="site-footer"><span>Her gün 10 kelime, her kelimede üç tekrar.</span><span>İkra & Berkay © 2026</span></footer>
    </main>
  </div>;
}

export default function StudyApp({ setupNeeded, initial, today }: Props) {
  if (setupNeeded) return <SetupForm />;
  if (!initial) return <LoginForm />;
  return <DashboardView initial={initial} today={today} />;
}
