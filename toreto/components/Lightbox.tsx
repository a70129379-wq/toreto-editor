"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { films, type Film } from "@/lib/content";

// The glass panel that plays an edit, with every other edit one click away.
export default function Lightbox({ film, onClose, onPick }: { film: Film; onClose: () => void; onPick: (f: Film) => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const index = films.indexOf(film);
  const step = (by: number) => onPick(films[(index + by + films.length) % films.length]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    return () => before?.focus?.();
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onPick(films[(index + 1) % films.length]);
      if (e.key === "ArrowLeft") onPick(films[(index - 1 + films.length) % films.length]);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [index, onClose, onPick]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={film.title} onClick={onClose}>
      <article className="glass" style={{ "--pc": film.accent } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
        <header className="glass-head">
          <h3>{film.title}</h3>
          <p>{film.discipline} · {film.length}. {film.note}</p>
          <button ref={closeBtn} className="glass-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="glass-stage">
          <video key={film.id} src={film.full} poster={`/media/${film.id}-poster.jpg`} controls autoPlay playsInline />
        </div>
        <footer className="glass-foot">
          <div className="glass-thumbs">
            {films.map((f) => (
              <button
                key={f.id}
                aria-label={f.title}
                aria-current={f === film ? "true" : undefined}
                style={{ backgroundImage: `url(/media/${f.id}-poster.jpg)` }}
                onClick={() => onPick(f)}
              />
            ))}
          </div>
          <nav className="glass-nav" aria-label="Edits">
            <button onClick={() => step(-1)} aria-label="Previous edit">←</button>
            <button onClick={() => step(1)} aria-label="Next edit">→</button>
          </nav>
        </footer>
      </article>
    </div>,
    document.body
  );
}
