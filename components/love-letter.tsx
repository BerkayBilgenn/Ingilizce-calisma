"use client";

import { useEffect, useReducer, useRef, type CSSProperties } from "react";

export type LoveLetterState = { open: boolean; celebration: number };
export type LoveLetterAction = { type: "open" } | { type: "close" };

export function loveLetterReducer(state: LoveLetterState, action: LoveLetterAction): LoveLetterState {
  if (action.type === "open") return { open: true, celebration: state.celebration + 1 };
  return { ...state, open: false };
}

const particles = [
  ["♥", "-245px", "-205px", "-24deg", "0ms"],
  ["✦", "-168px", "-285px", "18deg", "35ms"],
  ["♥", "-76px", "-245px", "12deg", "85ms"],
  ["✧", "35px", "-290px", "-14deg", "20ms"],
  ["♥", "135px", "-255px", "22deg", "70ms"],
  ["✦", "230px", "-185px", "28deg", "105ms"],
  ["♥", "270px", "-70px", "-18deg", "45ms"],
  ["✧", "245px", "75px", "22deg", "120ms"],
  ["♥", "145px", "145px", "-16deg", "80ms"],
  ["✦", "28px", "175px", "12deg", "25ms"],
  ["♥", "-105px", "155px", "18deg", "110ms"],
  ["✧", "-225px", "105px", "-24deg", "55ms"],
  ["♥", "-280px", "10px", "16deg", "95ms"],
  ["✦", "-275px", "-105px", "-12deg", "10ms"],
] as const;

const paperEdges = ["top", "right", "bottom", "left"] as const;
const edgeSymbols = ["♥", "✦", "♥", "✧", "♥", "✦", "♥", "✧"] as const;

export default function LoveLetter() {
  const [state, dispatch] = useReducer(loveLetterReducer, { open: false, celebration: 0 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (state.open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add("love-letter-is-open");
      wasOpen.current = true;
      return;
    }

    if (!state.open && dialog.open) dialog.close();
    if (!state.open && wasOpen.current) {
      document.body.classList.remove("love-letter-is-open");
      triggerRef.current?.focus();
      wasOpen.current = false;
    }

    return () => document.body.classList.remove("love-letter-is-open");
  }, [state.open]);

  return <>
    <button
      ref={triggerRef}
      className="love-letter-trigger"
      type="button"
      aria-haspopup="dialog"
      onClick={() => dispatch({ type: "open" })}
    >
      <span className="love-letter-callout">
        <span>Sevgilinden sana</span>
        <strong>bir mesaj var</strong>
        <i aria-hidden="true">↘</i>
      </span>
      <span className="love-envelope" aria-hidden="true">
        <span className="love-envelope-letter">♥</span>
        <span className="love-envelope-flap" />
        <span className="love-envelope-front" />
      </span>
    </button>

    <dialog
      ref={dialogRef}
      className="love-letter-dialog"
      aria-labelledby="love-letter-title"
      onCancel={(event) => {
        event.preventDefault();
        dispatch({ type: "close" });
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dispatch({ type: "close" });
      }}
    >
      <div className="love-letter-stage">
        <div className="love-particles" key={state.celebration} aria-hidden="true">
          {particles.map(([symbol, x, y, rotation, delay], index) => <i
            key={`${state.celebration}-${index}`}
            style={{ "--love-x": x, "--love-y": y, "--love-rotation": rotation, "--love-delay": delay } as CSSProperties}
          >{symbol}</i>)}
        </div>

        <div className="love-open-envelope" aria-hidden="true">
          <span className="love-open-envelope-back" />
          <span className="love-open-envelope-flap" />
          <span className="love-open-envelope-front" />
        </div>

        <article className="love-letter-paper">
          <div className="love-letter-edges" key={`edges-${state.celebration}`} aria-hidden="true">
            {paperEdges.map((edge) => <span
              className={`love-letter-edge love-letter-edge-${edge}`}
              data-paper-edge={edge}
              key={edge}
            >
              {edgeSymbols.map((symbol, index) => <i key={`${edge}-${index}`}>{symbol}</i>)}
            </span>)}
          </div>
          <button
            className="love-letter-close"
            type="button"
            aria-label="Mektubu kapat"
            autoFocus
            onClick={() => dispatch({ type: "close" })}
          >
            <span aria-hidden="true">×</span>
          </button>
          <div className="love-letter-scroll">
            <div className="love-letter-content">
              <span className="love-letter-kicker">MELEĞİME</span>
              <h2 id="love-letter-title">Sevgilinden sana bir mektup</h2>
              <p>
                Meleğim, seni çok seviyorum ve seni ne kadar sevdiğimi her yerde söylemek istiyorum.
                Benim için çok özelsin, çok değerlisin. Birbirimiz için yaratılmış gibiyiz.
              </p>
              <p>
                Her zaman gözlerini güldüreceğim; hem arkadaş hem sevgili olacağız birbirimize.
                Seni çok seviyorum meleğim. Her şeyin en iyisine, en özeline layıksın.
              </p>
              <p>
                Senin gibi bir sevgilim olduğu için çok çok çok şanslıyım.
                İyi ki’msin aşkımmmmmmmm
                <span className="love-letter-inline-sparkles" aria-hidden="true">
                  <i>♥</i><i>✦</i><i>♥</i><i>✧</i>
                </span>
              </p>
              <footer>
                <strong>Kaan Berkay Bilgen</strong>
                <i aria-hidden="true">♥</i>
              </footer>
            </div>
          </div>
        </article>
      </div>
    </dialog>
  </>;
}
