"use client";

import { useEffect, useState } from "react";
import type { QuizAttempt, QuizDay, QuizDaySummary } from "@/lib/store";

type AnswerResult = { wordId: number; selected: string; correct: boolean; correctMeaning: string };

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Quiz yüklenemedi.");
  return data;
}

export default function QuizView() {
  const [days, setDays] = useState<QuizDaySummary[]>([]);
  const [quiz, setQuiz] = useState<QuizDay | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState("");

  async function loadDays() {
    setLoading(true);
    setError("");
    try {
      setDays((await getJson<{ days: QuizDaySummary[] }>("/api/quiz")).days);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quizler yüklenemedi.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadDays(); }, []);

  async function openDay(day: number) {
    setLoading(true);
    setError("");
    try {
      setQuiz(await getJson<QuizDay>(`/api/quiz?day=${day}`));
      setQuestionIndex(0);
      setResult(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Quiz yüklenemedi.");
    } finally { setLoading(false); }
  }

  async function answer(selectedMeaning: string) {
    const question = quiz?.questions[questionIndex];
    if (!question || result) return;
    setAnswering(true);
    setError("");
    try {
      const response = await fetch("/api/quiz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wordId: question.wordId, selectedMeaning }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cevap kaydedilemedi.");
      setResult({ wordId: question.wordId, selected: selectedMeaning, correct: data.correct, correctMeaning: data.correctMeaning });
      const [freshQuiz, overview] = await Promise.all([
        getJson<QuizDay>(`/api/quiz?day=${quiz.day}`),
        getJson<{ days: QuizDaySummary[] }>("/api/quiz"),
      ]);
      setQuiz((current) => current ? { ...current, history: freshQuiz.history } : current);
      setDays(overview.days);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cevap kaydedilemedi.");
    } finally { setAnswering(false); }
  }

  function nextQuestion() {
    if (!quiz) return;
    setResult(null);
    setQuestionIndex((current) => current + 1);
  }

  const question = quiz?.questions[questionIndex];
  const finished = Boolean(quiz && questionIndex >= quiz.questions.length);

  return <section className="quiz-view" aria-labelledby="quiz-title">
    <div className="view-heading"><div><span className="eyebrow">GÜNLÜK TEKRARLAR</span><h1 id="quiz-title">Quiz</h1></div>{quiz && <button className="back-button" onClick={() => { setQuiz(null); setResult(null); }}>← Günlere dön</button>}</div>
    {!quiz && <p className="view-intro">Açılan günlerden birini seç ve o günün 10 kelimesini yeniden dene.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <div className="panel view-message" role="status">Quiz hazırlanıyor…</div>}
    {!loading && !quiz && <div className="quiz-days">{days.map((item) => <button className="panel quiz-day-card" key={item.day} onClick={() => void openDay(item.day)}>
      <span className="quiz-day-number">{item.day}</span><div><strong>Gün {item.day}</strong><small>{item.wordCount} kelime</small></div><span className="quiz-day-score">{item.answered ? `${item.correct}/${item.answered} doğru` : "Başla"}</span>
    </button>)}</div>}
    {!loading && !quiz && days.length === 0 && <div className="panel view-message"><p>Henüz açılmış bir quiz günü yok.</p></div>}
    {!loading && quiz && question && <div className="quiz-session">
      <div className="quiz-progress"><span>Gün {quiz.day}</span><strong>{questionIndex + 1} / {quiz.questions.length}</strong></div>
      <article className="panel quiz-question">
        <span className="eyebrow">DOĞRU TÜRKÇEYİ SEÇ</span><h2>{question.term}</h2>{question.pronunciation && <p className="quiz-pronunciation">/{question.pronunciation}/</p>}
        <div className="quiz-options">{question.options.map((option) => {
          const answered = result?.wordId === question.wordId;
          const state = answered ? option === result.correctMeaning ? "correct" : option === result.selected ? "wrong" : "" : "";
          return <button className={state} key={option} disabled={answering || answered} onClick={() => void answer(option)}>{option}{state === "correct" && <span aria-hidden="true">✓</span>}{state === "wrong" && <span aria-hidden="true">×</span>}</button>;
        })}</div>
        <div className="quiz-feedback" role="status">{result && <><strong>{result.correct ? "Doğru cevap!" : "Bu kez olmadı."}</strong><span>Doğru cevap: {result.correctMeaning}</span><button className="button primary" onClick={nextQuestion}>Sıradaki kelime →</button></>}</div>
      </article>
    </div>}
    {!loading && finished && quiz && <div className="panel quiz-finished"><span aria-hidden="true">★</span><h2>Gün {quiz.day} quizi tamamlandı</h2><p>Cevapların geçmişe kaydedildi. İstersen aynı günü yeniden çözebilirsin.</p><button className="button primary" onClick={() => void openDay(quiz.day)}>Yeniden çöz</button></div>}
    {quiz && quiz.history.length > 0 && <QuizHistory attempts={quiz.history} />}
  </section>;
}

function QuizHistory({ attempts }: { attempts: QuizAttempt[] }) {
  return <section className="quiz-history" aria-labelledby="history-title"><div className="section-heading"><div><span className="eyebrow">QUIZ GEÇMİŞİ</span><h2 id="history-title">Son cevaplar</h2></div></div>
    <ul>{attempts.map((attempt) => <li key={attempt.id} className={attempt.correct ? "correct" : "wrong"}>
      <span aria-hidden="true">{attempt.correct ? "✓" : "×"}</span><div><strong>{attempt.term}</strong><small>Seçimin: {attempt.selectedMeaning}</small>{!attempt.correct && <small>Doğrusu: {attempt.correctMeaning}</small>}</div><time dateTime={attempt.attemptedAt}>{new Date(attempt.attemptedAt.replace(" ", "T") + "Z").toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
    </li>)}</ul>
  </section>;
}
