"use client";

import { useState, type FormEvent } from "react";
import type { Dashboard, StudyWord } from "@/lib/store";
import WordEditor from "./word-editor";

type Props = { setupNeeded: boolean; initial: Dashboard | null; today: string };

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
  return data;
}

function parseWords(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    if (separator < 1 || !line.slice(separator + 1).trim()) throw new Error("Her satırı İngilizce = Türkçe biçiminde yazın.");
    return { term: line.slice(0, separator).trim(), meaning: line.slice(separator + 1).trim() };
  });
}

function Logo() { return <div className="brand"><span className="brand-mark" aria-hidden="true">İ<span>&</span>B</span><span className="brand-name">İkra <span>&</span> Berkay<small>İngilizce öğreniyor</small></span></div>; }
function EntryShell({ children, label }: { children: React.ReactNode; label: string }) { return <div className="entry-shell"><header className="entry-header"><Logo /><span className="eyebrow">{label}</span></header><main className="entry-main">{children}</main></div>; }
function RepeatStars({ count }: { count: number }) {
  return <span className="repeat-stars" aria-label={`Bugün 3 tekrardan ${count} tanesi tamamlandı`}>
    {[1, 2, 3].map((star) => <span key={star} className={star <= count ? "active" : ""} aria-hidden="true">★</span>)}
  </span>;
}

function SetupForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true); const data = new FormData(event.currentTarget);
    const people = [1, 2].map((n) => ({ name: String(data.get("name" + n) || ""), phone: String(data.get("phone" + n) || ""), pin: String(data.get("pin" + n) || "") }));
    try { await post("/api/setup", { secret: data.get("secret"), people }); await post("/api/login", { phone: people[0].phone, pin: people[0].pin }); const words = String(data.get("words") || "").trim(); if (words) await post("/api/sets", { words: parseWords(words) }); location.reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Kurulum tamamlanamadı."); setBusy(false); }
  }
  return <EntryShell label="İKİ KİŞİLİK ÇALIŞMA ALANI"><section className="entry-copy"><span className="pill">7 günlük tekrar</span><h1>Kelimeler akılda kalsın.</h1><p>İki kişi aynı listeyi çalışır, herkes kendi hızında ilerler.</p></section><form className="panel entry-panel" method="post" action="/api/setup" onSubmit={submit}><div className="panel-heading"><span className="eyebrow">İLK KURULUM</span><h2>Çalışma alanını oluştur</h2><p>Numaralar yalnızca giriş ve ilerleme kaydı için kullanılır.</p>{error && <p className="form-error" role="alert">{error}</p>}</div><label className="field">Kurulum anahtarı<input name="secret" type="password" required autoComplete="off" /></label>{[1, 2].map((n) => <div key={n} className="person-block"><div className="person-title"><span>{n}</span><strong>{n === 1 ? "Grubu kuran kişi" : "İkinci kişi"}</strong></div><div className="form-grid"><label className="field">Ad<input name={"name" + n} required maxLength={60} /></label><label className="field">Telefon<input name={"phone" + n} type="tel" inputMode="tel" required placeholder="05•• ••• •• ••" /></label></div><label className="field">6 haneli PIN<input name={"pin" + n} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label></div>)}<label className="field">İlk kelime listeniz <span className="optional">isteğe bağlı</span><textarea name="words" rows={5} placeholder={"apple = elma\nbook = kitap\nlearn = öğrenmek"} /><small>Her satır: İngilizce = Türkçe</small></label><button className="button primary wide" disabled={busy}>{busy ? "Oluşturuluyor…" : "Çalışma alanını oluştur"}<span aria-hidden="true">↗</span></button></form></EntryShell>;
}

function LoginForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setBusy(true); const data = new FormData(event.currentTarget); try { await post("/api/login", { phone: data.get("phone"), pin: data.get("pin") }); location.reload(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Giriş yapılamadı."); setBusy(false); } }
  return <EntryShell label="HER GÜN BİRAZ DAHA İYİ"><section className="entry-copy"><span className="pill">Bugünün kelimeleri seni bekliyor</span><h1>Kaldığın yerden devam et.</h1><p>Telefon numaranla giriş yap. Bugünkü kartlarını işaretle.</p><div className="login-art" aria-hidden="true"><span>learn</span><strong>öğren</strong><i>✓</i></div></section><form className="panel entry-panel login-panel" onSubmit={submit}><div className="panel-heading"><span className="eyebrow">TEKRAR HOŞ GELDİN</span><h2>Giriş yap</h2><p>Çalışmaya devam etmek için bilgilerini gir.</p></div><label className="field">Telefon numarası<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="05•• ••• •• ••" /></label><label className="field">6 haneli PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary wide" disabled={busy}>{busy ? "Giriş yapılıyor…" : "Kelimelerime git"}<span aria-hidden="true">↗</span></button></form></EntryShell>;
}

function NewSet({ onDone }: { onDone: () => void }) {
  const [raw, setRaw] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { await post("/api/sets", { words: parseWords(raw) }); onDone(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Liste kaydedilemedi."); setBusy(false); } }
  return <form className="panel new-set" onSubmit={submit}><span className="eyebrow">YENİ 7 GÜNLÜK TUR</span><h2>Kelime listesini oluştur</h2><p>İkiniz de aynı kelimeleri göreceksiniz.</p><label className="field">Kelimeler<textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={7} required placeholder={"apple = elma\nbook = kitap\nlearn = öğrenmek"} /><small>Her satır: İngilizce = Türkçe</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? "Kaydediliyor…" : "7 günlük turu başlat"}<span aria-hidden="true">↗</span></button></form>;
}

function DashboardView({ initial, today }: { initial: Dashboard; today: string }) {
  const [words, setWords] = useState(initial.words); const [error, setError] = useState(""); const [pending, setPending] = useState<number | null>(null);
  const remaining = words.filter((word) => !word.checked); const completed = words.filter((word) => word.checked); const percent = words.length ? Math.round(completed.length / words.length * 100) : 0;
  async function changeRepeat(word: StudyWord, increase: boolean) {
    const optimisticCount = Math.max(0, Math.min(3, word.repeatCount + (increase ? 1 : -1)));
    setPending(word.id); setError("");
    setWords((current) => current.map((item) => item.id === word.id ? { ...item, repeatCount: optimisticCount, checked: optimisticCount >= 3 } : item));
    try {
      const result = await post("/api/checks", { wordId: word.id, checked: increase });
      setWords((current) => current.map((item) => item.id === word.id ? { ...item, repeatCount: result.repeatCount, checked: result.repeatCount >= 3 } : item));
    } catch (caught) {
      setWords((current) => current.map((item) => item.id === word.id ? word : item));
      setError(caught instanceof Error ? caught.message : "Kart kaydedilemedi.");
    } finally { setPending(null); }
  }
  async function logout() { await post("/api/logout", {}); location.reload(); }
  return <div className="site-shell"><header className="site-header"><div className="header-inner"><Logo /><div className="header-actions"><span className="header-name">Merhaba, {initial.person.name}</span><button className="text-button" onClick={logout}>Çıkış yap</button></div></div></header><main className="dashboard"><section className="welcome"><div><span className="eyebrow">BUGÜNÜN ÇALIŞMASI · {new Date(today + "T12:00:00Z").toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span><h1>Küçük tekrarlar,<br /><em>kalıcı kelimeler.</em></h1><p>Her kelimeyi günde üç kez işaretle. Üç yıldız dolduğunda bugünkü çalışma tamamlanır.</p></div><div className="hero-accent" aria-hidden="true"><span>learn</span><strong>öğren</strong><i>★</i></div></section>{initial.set ? <><section className="panel progress-panel"><div className="progress-top"><div><span className="eyebrow">7 GÜNLÜK YOLCULUK</span><h2>Bugün {initial.set.dayNumber}. gün</h2></div><div className="progress-count"><strong>{completed.length}<span> / {words.length}</span></strong><small>3 tekrarı tamamlandı</small></div></div><div className="progress-track" role="progressbar" aria-label="Bugün üç tekrarı tamamlanan kelimeler" aria-valuenow={completed.length} aria-valuemin={0} aria-valuemax={words.length}><span style={{ width: String(percent) + "%" }} /></div><ol className="day-track">{Array.from({ length: 7 }, (_, index) => <li key={index} className={index + 1 === initial.set?.dayNumber ? "current" : index + 1 < (initial.set?.dayNumber || 0) ? "past" : "future"}><span>{index + 1 < (initial.set?.dayNumber || 0) ? "✓" : index + 1}</span><small>Gün {index + 1}</small></li>)}</ol></section><div className="section-heading"><div><span className="eyebrow">SIRADAKİ KARTLAR</span><h2>Bugün kalan kelimeler <b>{remaining.length}</b></h2></div><p>Bir kelime, üç tekrar tamamlanana kadar burada kalır.</p></div>{error && <p className="form-error" role="alert">{error}</p>}{words.length === 0 ? <div className="panel done-state"><h3>Haftalık listede kelime yok.</h3><p>Aşağıdan kelime eklediğinizde ikinizin kartlarında görünür.</p></div> : remaining.length ? <ul className="word-grid">{remaining.map((word, index) => <li className="word-card" key={word.id}><div className="word-top"><span>KELİME {String(index + 1).padStart(2, "0")}</span><RepeatStars count={word.repeatCount} /></div><h3>{word.term}</h3><span className="translation-label">TÜRKÇESİ</span><p>{word.meaning}</p><div className="repeat-copy">{word.repeatCount > 0 ? <><strong>{word.repeatCount} kez ezberlendi</strong><span>{3 - word.repeatCount} tekrar kaldı</span></> : <><strong>3 tekrar hedefi</strong><span>Henüz başlanmadı</span></>}</div><button className="check-button" onClick={() => changeRepeat(word, true)} disabled={pending === word.id}><span aria-hidden="true">✓</span>{pending === word.id ? "Kaydediliyor…" : `Ezberledim · ${word.repeatCount + 1}/3`}</button></li>)}</ul> : <div className="panel done-state"><span aria-hidden="true">★</span><h3>Bugünlük hepsi tamam!</h3><p>Tüm kelimelerde üç tekrarı tamamladın. Yarın yeniden karşına çıkacaklar.</p></div>}{completed.length > 0 && <section className="completed-section"><div className="section-heading"><div><span className="eyebrow">BUGÜN TAMAMLANANLAR</span><h2>Üç tekrarı biten kelimeler <b>{completed.length}</b></h2></div></div><ul className="completed-list">{completed.map((word) => <li key={word.id}><RepeatStars count={word.repeatCount} /><strong>{word.term}</strong><span>{word.meaning}</span><button onClick={() => changeRepeat(word, false)} disabled={pending === word.id}>Bir tekrarı geri al</button></li>)}</ul></section>}<WordEditor words={words} /></> : <><section className="panel empty-work"><span className="eyebrow">YENİ BİR BAŞLANGIÇ</span><h2>Şu anda aktif kelime listesi yok.</h2><p>{initial.person.role === "admin" ? "Yeni listeyi başlattığında yedi günlük tekrar başlayacak." : "Listeyi grubu kuran kişi eklediğinde kartların burada görünecek."}</p></section>{initial.person.role === "admin" && <NewSet onDone={() => location.reload()} />}</>}<footer className="site-footer"><span>Her gün üç tekrar. Yedi günde sağlam bir öğrenme.</span><span>İkra & Berkay © 2026</span></footer></main></div>;
}

export default function StudyApp({ setupNeeded, initial, today }: Props) { if (setupNeeded) return <SetupForm />; if (!initial) return <LoginForm />; return <DashboardView initial={initial} today={today} />; }
