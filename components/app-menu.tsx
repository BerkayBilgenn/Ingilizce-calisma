"use client";

import { useEffect, useRef, useState } from "react";

export type AppView = "study" | "quiz" | "archive";

const items: { view: AppView; label: string; icon: string }[] = [
  { view: "study", label: "Çalışma", icon: "★" },
  { view: "quiz", label: "Quiz", icon: "?" },
  { view: "archive", label: "Kelimelerim", icon: "✓" },
];

export default function AppMenu({ view, onSelect }: { view: AppView; onSelect: (view: AppView) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="app-menu" ref={rootRef}>
    <button ref={triggerRef} className="menu-trigger" type="button" aria-label="Menüyü aç" aria-expanded={open} aria-controls="app-navigation" onClick={() => setOpen((current) => !current)}>
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
    </button>
    {open && <nav id="app-navigation" className="menu-popover" aria-label="Uygulama menüsü">
      {items.map((item, index) => <button
        key={item.view}
        ref={index === 0 ? firstItemRef : undefined}
        type="button"
        className={view === item.view ? "active" : ""}
        aria-current={view === item.view ? "page" : undefined}
        onClick={() => { onSelect(item.view); setOpen(false); }}
      ><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}
    </nav>}
  </div>;
}
