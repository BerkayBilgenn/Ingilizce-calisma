"use client";

import { useEffect, useState } from "react";
import type { LearnedWord } from "@/lib/store";

export default function ArchiveView() {
  const [words, setWords] = useState<LearnedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/archive");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kelimeler yüklenemedi.");
      setWords(data.words);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kelimeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return <section className="library-view" aria-labelledby="archive-title">
    <div className="view-heading">
      <div><span className="eyebrow">KALICI ARŞİV</span><h1 id="archive-title">Kelimelerim</h1></div>
      <span className="archive-count">{words.length} kelime</span>
    </div>
    <p className="view-intro">Üç tekrarı tamamladığın bütün kelimeler burada kalır.</p>
    {error && <div className="panel view-message" role="alert"><p>{error}</p><button className="button primary" onClick={() => void load()}>Tekrar dene</button></div>}
    {loading && <div className="panel view-message" role="status">Kelimelerin yükleniyor…</div>}
    {!loading && !error && words.length === 0 && <div className="panel view-message empty-archive"><span aria-hidden="true">☆</span><h2>Arşivin henüz boş</h2><p>Bir kelimede üç yıldızı tamamladığında burada görünecek.</p></div>}
    {!loading && !error && words.length > 0 && <ul className="archive-grid">{words.map((word) => <li className="panel archive-card" key={word.id}>
      <span className="archive-star" aria-hidden="true">★</span>
      <div><h2>{word.term}</h2><p>{word.meaning}</p>{word.pronunciation && <small>Okunuşu: {word.pronunciation}</small>}</div>
      <time dateTime={word.learnedDay}>{new Date(`${word.learnedDay}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}</time>
    </li>)}</ul>}
  </section>;
}
