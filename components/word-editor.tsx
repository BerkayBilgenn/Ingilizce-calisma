"use client";

import { useState, type FormEvent } from "react";
import type { StudyWord } from "@/lib/store";

async function changeWord(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch("/api/words", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Liste güncellenemedi. Yeniden deneyin.");
}

export default function WordEditor({ words }: { words: StudyWord[] }) {
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await changeWord("POST", { term, meaning });
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kelime eklenemedi. Yeniden deneyin.");
      setBusy(false);
    }
  }

  async function remove(word: StudyWord) {
    setError("");
    setRemoving(word.id);
    try {
      await changeWord("DELETE", { wordId: word.id });
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kelime çıkarılamadı. Yeniden deneyin.");
      setRemoving(null);
    }
  }

  return <section className="panel word-editor" aria-labelledby="weekly-words-title">
    <span className="eyebrow">ORTAK LİSTE</span>
    <h2 id="weekly-words-title">Haftalık kelimeler</h2>
    <p>İkiniz de bu listeye kelime ekleyip çıkarabilirsiniz.</p>
    <form className="word-editor-form" onSubmit={add}>
      <label className="field">İngilizce kelime<input name="term" value={term} onChange={(event) => setTerm(event.target.value)} maxLength={100} required placeholder="apple" /></label>
      <label className="field">Türkçesi<input name="meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} maxLength={300} required placeholder="elma" /></label>
      <button className="button primary" disabled={busy || removing !== null}>{busy ? "Ekleniyor…" : "Kelime ekle"}</button>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {words.length > 0 ? <ul className="word-editor-list">{words.map((word) => <li key={word.id}>
      <span><strong>{word.term}</strong> <span>— {word.meaning}</span></span>
      <button type="button" onClick={() => remove(word)} disabled={removing !== null || busy} aria-label={`${word.term} kelimesini listeden çıkar`}>{removing === word.id ? "Çıkarılıyor…" : "Çıkar"}</button>
    </li>)}</ul> : <p className="word-editor-empty">Listede kelime yok. Yukarıdan yeni bir kelime ekleyin.</p>}
  </section>;
}
