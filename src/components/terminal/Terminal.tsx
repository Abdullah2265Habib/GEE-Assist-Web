import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { newSession, run, type Line } from "./engine";
import "./terminal.css";

interface Props {
  /** Commands typed automatically, one after another, before the visitor takes over. */
  script?: string[];
  user?: string;
  /** Height of the output area. */
  height?: number | string;
  autoFocus?: boolean;
  title?: string;
}

const PROMPT_PATH = "~";

export default function Terminal({ script = [], user = "guest", height = 360, autoFocus = false, title = "gkonsol" }: Props) {
  const sessionRef = useRef(newSession(user));
  const [lines, setLines] = useState<Line[]>([
    { kind: "muted", text: "gkonsol, the GEE-Assist command line. This copy runs in your browser and downloads nothing." },
    { kind: "muted", text: "Type help, or try: ask NDVI of Lahore for summer 2024 from Sentinel-2" },
  ]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [histIndex, setHistIndex] = useState<number | null>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const scriptStarted = useRef(false);

  const prompt = `${sessionRef.current.user}@gkonsol ${PROMPT_PATH} $`;

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const append = (more: Line[]) => setLines((prev) => [...prev, ...more]);

  const animateProgress = async (sizeMb: number, chunks: number) => {
    const token = { cancelled: false };
    cancelRef.current = token;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps = reduce ? 1 : 28;
    const width = 24;
    setLines((prev) => [...prev, { kind: "progress", text: "" }]);
    for (let i = 1; i <= steps; i++) {
      if (token.cancelled) {
        setLines((prev) => [...prev, { kind: "muted", text: "^C  Stopped following. The download goes on." }]);
        return;
      }
      await new Promise((r) => setTimeout(r, reduce ? 0 : 90 + Math.random() * 90));
      const pct = i / steps;
      const filled = Math.round(pct * width);
      const done = sizeMb * pct;
      const speed = pct < 0.12 ? 0 : 6 + Math.random() * 9;
      const chunk = Math.min(chunks, Math.floor(pct * chunks) + 1);
      const bar = "█".repeat(filled) + "░".repeat(width - filled);
      const text = `[${bar}] ${String(Math.round(pct * 100)).padStart(3)} %  ${done.toFixed(1)} / ${sizeMb.toFixed(1)} MB  ${speed.toFixed(1)} MB/s  chunk ${chunk}/${chunks}${speed === 0 ? "  (GEE is computing)" : ""}`;
      setLines((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = { kind: "progress", text };
        return copy;
      });
    }
    const d = sessionRef.current.downloads.at(-1);
    if (d) d.done = true;
    append([
      { kind: "ok", text: `✓ Download complete. ${chunks > 1 ? `${chunks} chunks merged into one GeoTIFF.` : "Saved as a GeoTIFF."}` },
      { kind: "muted", text: `  ${d?.name}.tif` },
    ]);
  };

  const execute = async (cmd: string) => {
    let command = cmd;
    const hist = sessionRef.current.history;
    if (command.trim() === "!!") command = hist.at(-1) ?? "";
    else if (/^!\d+$/.test(command.trim())) command = hist[Number(command.trim().slice(1)) - 1] ?? "";

    append([{ kind: "input", text: `${prompt} ${cmd}` }]);
    const res = run(sessionRef.current, command);
    if (res.clear) {
      setLines([]);
      return;
    }
    append(res.lines);
    if (res.progress) {
      setBusy(true);
      await animateProgress(res.progress.sizeMb, res.progress.chunks);
      setBusy(false);
    }
  };

  // Type the demo script once, character by character, when the terminal scrolls into view.
  useEffect(() => {
    if (script.length === 0) return;
    const el = outRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stopped = false;

    const play = async () => {
      if (scriptStarted.current) return;
      scriptStarted.current = true;
      setBusy(true);
      for (const cmd of script) {
        if (stopped) break;
        if (!reduce) {
          for (let i = 1; i <= cmd.length; i++) {
            if (stopped) break;
            setValue(cmd.slice(0, i));
            await new Promise((r) => setTimeout(r, 22 + Math.random() * 30));
          }
          await new Promise((r) => setTimeout(r, 260));
        }
        setValue("");
        await execute(cmd);
        await new Promise((r) => setTimeout(r, reduce ? 0 : 650));
      }
      setBusy(false);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void play();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      stopped = true;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = sessionRef.current.history;
    if (e.key === "c" && e.ctrlKey) {
      cancelRef.current.cancelled = true;
      return;
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
      return;
    }
    if (busy) return;
    if (e.key === "Enter") {
      const cmd = value;
      setValue("");
      setHistIndex(null);
      void execute(cmd);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hist.length === 0) return;
      const i = histIndex === null ? hist.length - 1 : Math.max(0, histIndex - 1);
      setHistIndex(i);
      setValue(hist[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIndex === null) return;
      const i = histIndex + 1;
      if (i >= hist.length) {
        setHistIndex(null);
        setValue("");
      } else {
        setHistIndex(i);
        setValue(hist[i]);
      }
    }
  };

  return (
    <div className="term" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
      <div className="term-bar">
        <span className="term-title">
          <span className="term-glyph" aria-hidden="true">&gt;_</span> {title}
        </span>
        <span className="term-hint">
          <kbd>↑</kbd> history · <kbd>Ctrl</kbd>+<kbd>L</kbd> clear
        </span>
      </div>
      <div
        className="term-out"
        ref={outRef}
        style={{ height }}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
      >
        {lines.map((l, i) => (
          <div key={i} className={`term-line k-${l.kind}`}>
            {l.text || " "}
          </div>
        ))}
        <label className="term-input-row">
          <span className="term-prompt">{prompt}</span>
          <input
            ref={inputRef}
            className="term-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-label="Type a gkonsol command"
            readOnly={busy}
          />
        </label>
      </div>
    </div>
  );
}
