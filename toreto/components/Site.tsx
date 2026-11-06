"use client";
import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { films, process, rotating, skills, youtube, type Film } from "../lib/content";
import { LAST, NAV, SCREENS_PER_SHOT, shotIndex, shotU, type Shot } from "../lib/shots";
import { createWorld, type World } from "../lib/world";
import Lightbox from "./Lightbox";
import Mark from "./Mark";

// Each caption shows while the camera is near its span of shots.
function Caption({ from, to = from, className = "", children }: { from: Shot; to?: Shot; className?: string; children: React.ReactNode }) {
  return (
    <section className={`cap ${className}`} data-from={shotIndex(from)} data-to={shotIndex(to)}>
      {children}
    </section>
  );
}

export default function Site() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const world = useRef<World | null>(null);
  const lenis = useRef<Lenis | null>(null);
  const [mode, setMode] = useState<"loading" | "live" | "static">("loading");
  const [progress, setProgress] = useState(0);
  const [frame, setFrame] = useState(-1);
  const [film, setFilm] = useState<Film | null>(null);
  const [menu, setMenu] = useState(false);
  const [word, setWord] = useState(0);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % rotating.length), 2400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    history.scrollRestoration = "manual";
    scrollTo(0, 0);

    const caps = Array.from(overlay.current!.querySelectorAll<HTMLElement>(".cap"));
    const onTick = (u: number) => {
      const s = u * LAST;
      caps.forEach((el) => {
        const a = Number(el.dataset.from);
        const b = Number(el.dataset.to);
        const before = a === 0 ? 1 : THREE_step(s, a - 0.42, a - 0.14);
        const after = b === LAST ? 1 : 1 - THREE_step(s, b + 0.14, b + 0.42);
        const o = Math.min(before, after);
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${(1 - before) * 34 - (1 - after) * 34}px, 0)`;
        el.style.visibility = o < 0.01 ? "hidden" : "visible";
        el.classList.toggle("on", o > 0.5);
      });
      if (bar.current) bar.current.style.transform = `scaleY(${u})`;
    };

    const w = createWorld(canvas.current!, {
      onLoad: setProgress,
      onReady: () => setMode("live"),
      onTick,
      onFrame: setFrame,
    });
    if (!w) {
      setMode("static");
      return;
    }
    world.current = w;

    const l = new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false });
    lenis.current = l;
    let raf = 0;
    const tick = (t: number) => {
      l.raf(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const report = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      w.setScroll(max > 0 ? Math.min(scrollY / max, 1) : 0);
    };
    l.on("scroll", report);
    addEventListener("scroll", report, { passive: true });
    const move = (e: PointerEvent) => w.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    addEventListener("pointermove", move, { passive: true });
    onTick(0);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", report);
      removeEventListener("pointermove", move);
      l.destroy();
      w.dispose();
    };
  }, []);

  useEffect(() => {
    if (mode !== "live") return;
    const wait = Math.max(0, 1500 - performance.now());
    const a = setTimeout(() => setOpen(true), wait + 350);
    const b = setTimeout(() => world.current?.begin(), wait + 650);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [mode]);

  useEffect(() => {
    if (film) lenis.current?.stop();
    else lenis.current?.start();
  }, [film]);

  // The menu never cuts: it flies you there.
  const fly = (shot: Shot) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu(false);
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = shotU(shot) * max;
    if (lenis.current) lenis.current.scrollTo(y, { duration: 2.6, easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) });
    else scrollTo(0, y);
  };

  const onStage = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a,button,input,textarea,label")) return;
    const i = world.current?.pick(e.clientX, e.clientY) ?? -1;
    if (i >= 0) setFilm(films[i]);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("sent");
        setMessage("Got it. I'll reply to the address you gave me.");
        form.reset();
      } else {
        setState("error");
        setMessage(data.error === "not-connected" ? "The form isn't connected yet, so nothing was sent. Please message me on YouTube." : data.error ?? "That didn't go through. Please try again.");
      }
    } catch {
      setState("error");
      setMessage("That didn't go through. Please try again.");
    }
  };

  const form = (
    <form onSubmit={submit} className="form">
      <label><span>Name</span><input name="name" required autoComplete="name" placeholder="Who's asking" /></label>
      <label><span>Email</span><input name="email" type="email" required autoComplete="email" placeholder="Where I should reply" /></label>
      <label><span>The edit</span><textarea name="project" required rows={2} placeholder="Footage, deadline and the feeling you want" /></label>
      <input className="trap" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="form-row">
        <button type="submit" className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending" : "Start the episode ↗"}</button>
        <a className="btn btn-line" href={youtube} target="_blank" rel="noreferrer">YouTube</a>
      </div>
      <p className={`form-note ${state}`} role="status" aria-live="polite">{message}</p>
    </form>
  );

  if (mode === "static") {
    return (
      <main className="static">
        <h1>Toreto</h1>
        <p>Video editor. I take raw footage and cut it until it hits like an anime finale.</p>
        <h2>Work</h2>
        <ul>
          {films.map((f) => (
            <li key={f.id}>
              <button onClick={() => setFilm(f)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/${f.id}-poster.jpg`} alt="" />
                <strong>{f.title}</strong> <span>{f.discipline}, {f.length}</span>
              </button>
            </li>
          ))}
        </ul>
        <h2>Your video</h2>
        {form}
        {film && <Lightbox film={film} onClose={() => setFilm(null)} onPick={setFilm} />}
      </main>
    );
  }

  const live = frame >= 0 ? films[frame] : null;

  return (
    <>
      <canvas ref={canvas} className="stage" aria-hidden="true" />
      <div className="scroller" style={{ height: `${LAST * SCREENS_PER_SHOT * 100 + 100}vh` }} onClick={onStage} />

      <div ref={overlay} className="overlay" onClick={onStage}>
        <Caption from="hero-front" className={`c-hero ${open ? "in" : ""}`}>
          <p className="c-word" key={word}>{rotating[word]}</p>
          <h1 className="sr">Toreto</h1>
          <p className="c-role">Video editor. Every cut lands.</p>
          <p className="c-hint">Scroll to fly</p>
        </Caption>

        <Caption from="hero-side" className="c-big c-left c-narrow">
          <h2>I take raw footage and cut it until it hits like an anime finale.</h2>
        </Caption>

        <Caption from="hero-leave" className="c-big c-right">
          <h2>Long stories, fast cars, loud brands, quiet grades.</h2>
        </Caption>

        <Caption from="strip-wide" className="c-big c-left c-low">
          <p className="c-kana" aria-hidden="true">第一話</p>
          <h2>Eight edits. Dive in.</h2>
          <p>Scroll from screen to screen. Press any screen to watch.</p>
        </Caption>

        <Caption from="frame-0" to="frame-7" className="c-film">
          {live && (
            <button className="wl" key={live.id} style={{ "--pc": live.accent } as React.CSSProperties} onClick={() => setFilm(live)} aria-label={`${live.title}, ${live.discipline}. Watch`}>
              <span className="wl-row"><span>{String(frame + 1).padStart(2, "0")}</span><i aria-hidden="true" /><span>{live.discipline} · {live.length}</span></span>
              <strong className="wl-name">{live.title}</strong>
              <span className="wl-cta">Watch with sound <b aria-hidden="true">↗</b></span>
            </button>
          )}
          <ol className="film-index" aria-label="All edits">
            {films.map((f, i) => (
              <li key={f.id}>
                <a href="#" className={i === frame ? "on" : ""} style={{ "--pc": f.accent } as React.CSSProperties} aria-current={i === frame ? "true" : undefined} onClick={fly(`frame-${i}` as Shot)}>
                  <span>{String(i + 1).padStart(2, "0")}</span>{f.title}
                </a>
              </li>
            ))}
          </ol>
        </Caption>

        <Caption from="car-chase" className="c-big c-left">
          <p className="c-kana" aria-hidden="true">速</p>
          <h2>Speed runs on rhythm.</h2>
        </Caption>

        <Caption from="car-close" className="c-big c-right">
          <h2>Every cut lands on the beat.</h2>
        </Caption>

        {(["prop-camera", "prop-clapper", "prop-headphones"] as Shot[]).map((shot, i) => (
          <Caption key={shot} from={shot} className={`c-big ${i % 2 ? "c-right" : "c-left"}`}>
            <p className="c-kana" aria-hidden="true">{skills[i].kana}</p>
            <h2>{skills[i].title}</h2>
            <p>{skills[i].body}</p>
          </Caption>
        ))}

        <Caption from="process" className="c-process">
          <h2>How an edit gets made</h2>
          <ol>
            {process.map((p, i) => (
              <li key={p.title}><span>{i + 1}</span><strong>{p.title}</strong><small>{p.body}</small></li>
            ))}
          </ol>
        </Caption>

        <Caption from="dawn" className="c-contact">
          <h2>Next episode:<br />your video.</h2>
          {form}
          <p className="c-foot">To be continued. © 2026 Toreto</p>
        </Caption>
      </div>

      <i className="rail" aria-hidden="true"><span ref={bar} /></i>

      <header className={`nav ${open ? "in" : ""}`}>
        <a className="nav-brand" href="#" onClick={fly("hero-front")} aria-label="Toreto, back to start">
          <Mark className="nav-mark" /><span>Toreto</span>
        </a>
        <div className="nav-right">
          <a className="nav-cta" href="#" onClick={fly("dawn")}>Start a project</a>
          <button className="nav-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu}>{menu ? "Close" : "Menu"}</button>
        </div>
        {menu && (
          <nav className="nav-menu" aria-label="Sections">
            {NAV.map((n) => <a key={n.label} href="#" onClick={fly(n.shot)}>{n.label}</a>)}
          </nav>
        )}
      </header>

      <div className={`loader ${open ? "done" : ""}`} role="status" aria-label="Loading">
        <div className="loader-half loader-half-a" />
        <div className="loader-half loader-half-b" />
        <div className="loader-core">
          <svg className="loader-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="92" className="track" />
            <circle cx="100" cy="100" r="92" className="fill" pathLength={100} style={{ strokeDashoffset: 100 - progress * 100 }} />
            <circle cx="100" cy="100" r="78" className="perfs" />
          </svg>
          <Mark className="loader-mark" />
        </div>
        <p className="loader-name" aria-hidden="true">
          {"TORETO".split("").map((c, i) => (
            <span key={i} style={{ opacity: progress * 6.2 > i ? 1 : 0.12, transform: progress * 6.2 > i ? "none" : "translateY(14px)" }}>{c}</span>
          ))}
        </p>
        <p className="loader-cap">Video editor</p>
        <b className="loader-num">{String(Math.round(progress * 100)).padStart(3, "0")}</b>
        <i className="loader-slash" />
      </div>

      {film && <Lightbox film={film} onClose={() => setFilm(null)} onPick={setFilm} />}
    </>
  );
}

function THREE_step(x: number, a: number, b: number) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
