import { useCallback, useEffect, useRef, useState } from "react";
import "./download-lab.css";

/**
 * An interactive picture of how GEE-Assist downloads an area that is too big for
 * one Earth Engine request: the area is split into chunks, each chunk is fetched
 * as small requests eight at a time, finished chunks are merged into one GeoTIFF,
 * and a request that runs out of memory is split into four. The visitor picks the
 * area and chunk size, can try the single request first, pause, change speed, and
 * click a square that is downloading to make it run out of memory.
 *
 * Everything is simulated and time is sped up; nothing is fetched.
 */

const LIMIT_BYTES = 50_331_648; // Earth Engine's limit for one request (48 MB)
const PARALLEL = 8;
const CHUNK_OPTIONS = [250, 500, 1000];
const MERGE_SECONDS = 0.45;

type Status = "idle" | "running" | "paused" | "done";
type Terrain = "water" | "forest" | "crop" | "grass" | "soil";

interface Part {
  x: number;
  y: number;
  s: number;
  state: "wait" | "run" | "done";
  start: number;
  dur: number;
}

interface Cell {
  chunk: number;
  parts: Part[];
  split: boolean;
  oomAt: number;
}

interface Piece {
  ids: number[];
}

interface LogLine {
  id: number;
  kind: "ok" | "err" | "out" | "blue";
  text: string;
}

interface Sim {
  g: number;
  cells: Cell[];
  chunks: number;
  totalMb: number;
  cellMb: number;
  t: number;
  small: boolean;
  chunkDone: boolean[];
  pieces: Piece[];
  merging: { a: Piece; b: Piece; start: number } | null;
  doneMb: number;
  log: LogLine[];
  logId: number;
  finished: boolean;
}

/** Sentinel-2, four bands at 10 m, 32-bit: megabytes for a square area. */
const sizeMb = (sideKm: number) => Math.round(sideKm * sideKm * 0.16);

const fmtMb = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(mb >= 10000 ? 0 : 1)} GB` : `${Math.round(mb)} MB`);

function terrain(u: number, v: number): Terrain {
  const river = Math.abs(v - (0.58 + 0.12 * Math.sin(u * 7) + 0.04 * Math.sin(u * 19)));
  if (river < 0.045) return "water";
  if (Math.hypot(u - 0.24, (v - 0.22) * 1.3) < 0.11) return "water";
  const n =
    Math.sin(u * 9.1 + Math.sin(v * 5.3) * 1.7) * 0.5 + Math.sin(v * 8.3 - u * 3.1) * 0.35 + Math.sin((u * 2 + v) * 21) * 0.15;
  if (n > 0.38) return "forest";
  if (n > -0.1) return "crop";
  if (n > -0.48) return "grass";
  return "soil";
}

const shade = (u: number, v: number) => 0.78 + 0.22 * ((Math.sin(u * 53 + v * 31) + 1) / 2);

function build(sideKm: number, chunkMb: number): Sim {
  const totalMb = sizeMb(sideKm);
  const g = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(totalMb / 4))));
  const n = g * g;
  const chunks = Math.min(n, Math.max(1, Math.ceil(totalMb / chunkMb)));
  const cells: Cell[] = Array.from({ length: n }, (_, i) => ({
    chunk: Math.floor((i * chunks) / n),
    parts: [{ x: i % g, y: Math.floor(i / g), s: 1, state: "wait", start: 0, dur: 0 }],
    split: false,
    oomAt: -10,
  }));
  return {
    g,
    cells,
    chunks,
    totalMb,
    cellMb: totalMb / n,
    t: 0,
    small: false,
    chunkDone: Array(chunks).fill(false),
    pieces: [],
    merging: null,
    doneMb: 0,
    log: [],
    logId: 0,
    finished: false,
  };
}

function say(sim: Sim, kind: LogLine["kind"], text: string) {
  sim.log.push({ id: sim.logId++, kind, text });
  if (sim.log.length > 6) sim.log.shift();
}

function splitCell(cell: Cell) {
  const p = cell.parts[0];
  const h = p.s / 2;
  cell.parts = [
    { x: p.x, y: p.y, s: h, state: "wait", start: 0, dur: 0 },
    { x: p.x + h, y: p.y, s: h, state: "wait", start: 0, dur: 0 },
    { x: p.x, y: p.y + h, s: h, state: "wait", start: 0, dur: 0 },
    { x: p.x + h, y: p.y + h, s: h, state: "wait", start: 0, dur: 0 },
  ];
  cell.split = true;
}

const pieceLabel = (p: Piece) =>
  p.ids.length === 1 ? `chunk ${p.ids[0] + 1}` : `chunks ${Math.min(...p.ids) + 1}–${Math.max(...p.ids) + 1}`;

function step(sim: Sim, dt: number) {
  if (sim.finished) return;
  sim.t += dt;
  let running = 0;

  for (const cell of sim.cells) {
    for (const p of cell.parts) {
      if (p.state === "run" && sim.t >= p.start + p.dur) {
        p.state = "done";
        sim.doneMb += sim.cellMb * p.s * p.s;
      }
      if (p.state === "run") running++;
    }
  }

  // Chunks whose squares have all arrived are written to disk.
  for (let c = 0; c < sim.chunks; c++) {
    if (sim.chunkDone[c]) continue;
    const complete = sim.cells.every((cell) => cell.chunk !== c || cell.parts.every((p) => p.state === "done"));
    if (complete) {
      sim.chunkDone[c] = true;
      sim.pieces.push({ ids: [c] });
      say(sim, "ok", `✓ chunk ${c + 1}/${sim.chunks} written to disk`);
    }
  }

  // Merge as soon as two pieces exist.
  if (sim.merging && sim.t >= sim.merging.start + MERGE_SECONDS) {
    const merged = { ids: [...sim.merging.a.ids, ...sim.merging.b.ids] };
    sim.pieces.unshift(merged);
    sim.merging = null;
    if (sim.chunks > 1) say(sim, "blue", `⇢ merged into ${pieceLabel(merged)}`);
  }
  if (!sim.merging && sim.pieces.length >= 2) {
    const [a, b] = sim.pieces.splice(0, 2);
    sim.merging = { a, b, start: sim.t };
  }

  // Keep eight requests in flight.
  for (const cell of sim.cells) {
    if (running >= PARALLEL) break;
    for (let i = 0; i < cell.parts.length && running < PARALLEL; i++) {
      let p = cell.parts[i];
      if (p.state !== "wait") continue;
      if (sim.small && !cell.split) {
        splitCell(cell);
        p = cell.parts[0];
      }
      p.state = "run";
      p.start = sim.t;
      p.dur = (0.55 + Math.random() * 0.9) * (p.s < 1 ? 0.45 : 1);
      running++;
    }
  }

  if (sim.chunkDone.every(Boolean) && !sim.merging && sim.pieces.length === 1) {
    sim.finished = true;
    say(sim, "ok", `✓ done: one GeoTIFF, ${fmtMb(sim.totalMb)}`);
  }
}

export default function DownloadLab() {
  const [side, setSide] = useState(120);
  const [chunkMb, setChunkMb] = useState(500);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [rejected, setRejected] = useState(false);
  const [, setFrame] = useState(0);
  const sim = useRef<Sim>(build(120, 500));

  const reset = useCallback((s: number, c: number) => {
    sim.current = build(s, c);
    setStatus("idle");
    setRejected(false);
    setFrame((f) => f + 1);
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * speed;
      last = now;
      step(sim.current, dt);
      setFrame((f) => f + 1);
      if (sim.current.finished) {
        setStatus("done");
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, speed]);

  const s = sim.current;

  const start = () => {
    setRejected(false);
    if (s.t === 0) say(s, "out", `→ ${fmtMb(s.totalMb)} in ${s.chunks} chunk${s.chunks > 1 ? "s" : ""}, ${PARALLEL} requests at a time`);
    setStatus("running");
  };

  const oom = (index: number) => {
    const cell = s.cells[index];
    if (!cell || cell.split || cell.parts[0].state !== "run") return;
    splitCell(cell);
    cell.oomAt = s.t;
    if (!s.small) {
      s.small = true;
      say(s, "err", "✗ Earth Engine ran out of memory on a request");
      say(s, "out", "  split into 4; the rest continue at the smaller size");
    } else {
      say(s, "err", "✗ out of memory again, split into 4");
    }
    setFrame((f) => f + 1);
  };

  const oomTarget = s.cells.findIndex((c) => !c.split && c.parts[0].state === "run");

  const inFlight = s.cells.reduce((n, c) => n + c.parts.filter((p) => p.state === "run").length, 0);
  const pct = Math.round((s.doneMb / s.totalMb) * 100);
  const chunksWritten = s.chunkDone.filter(Boolean).length;
  const gap = 0.07;
  const bytes = s.totalMb * 1_000_000;
  const busy = status === "running" || status === "paused";

  return (
    <figure className="dl-lab" aria-label="Interactive demonstration of a chunked download">
      <div className="dl-controls">
        <label className="dl-field dl-area">
          <span>
            Area <strong>{side} × {side} km</strong>
          </span>
          <input
            type="range"
            min={20}
            max={200}
            step={10}
            value={side}
            disabled={busy}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSide(v);
              reset(v, chunkMb);
            }}
          />
          <small>
            Sentinel-2, 4 bands at 10 m ≈ <strong>{fmtMb(s.totalMb)}</strong>
          </small>
        </label>

        <div className="dl-field">
          <span id="dl-chunk-label">Chunk size</span>
          <div className="dl-seg" role="group" aria-labelledby="dl-chunk-label">
            {CHUNK_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={chunkMb === c}
                disabled={busy}
                onClick={() => {
                  setChunkMb(c);
                  reset(side, c);
                }}
              >
                {c} MB
              </button>
            ))}
          </div>
        </div>

        <div className="dl-field">
          <span id="dl-speed-label">Speed</span>
          <div className="dl-seg" role="group" aria-labelledby="dl-speed-label">
            {[1, 3].map((v) => (
              <button key={v} type="button" aria-pressed={speed === v} onClick={() => setSpeed(v)}>
                {v}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dl-stage">
        <div className={`dl-map${rejected ? " is-rejected" : ""}${status === "done" ? " is-done" : ""}`}>
          <svg viewBox={`0 0 ${s.g} ${s.g}`} role="img" aria-label={`Study area split into ${s.g * s.g} squares, ${pct}% downloaded`}>
            {s.cells.map((cell, ci) =>
              cell.parts.map((p, pi) => {
                const cx = (p.x + p.s / 2) / s.g;
                const cy = (p.y + p.s / 2) / s.g;
                const inset = status === "done" ? 0 : gap * p.s;
                const cls =
                  p.state === "done"
                    ? `done t-${terrain(cx, cy)}`
                    : p.state === "run"
                      ? `run${!cell.split ? " can-oom" : ""}`
                      : `wait c${cell.chunk % 2}`;
                return (
                  <rect
                    key={`${ci}-${pi}`}
                    className={`dl-p ${cls}`}
                    x={p.x + inset}
                    y={p.y + inset}
                    width={p.s - inset * 2}
                    height={p.s - inset * 2}
                    rx={status === "done" ? 0 : 0.06 * p.s}
                    style={p.state === "done" ? { fillOpacity: shade(cx, cy) } : undefined}
                    onClick={p.state === "run" && !cell.split ? () => oom(ci) : undefined}
                  />
                );
              }),
            )}
            {s.cells.map((cell, ci) =>
              s.t - cell.oomAt < 0.9 ? (
                <rect
                  key={`oom-${ci}`}
                  className="dl-oom"
                  x={cell.parts[0].x + 0.02}
                  y={cell.parts[0].y + 0.02}
                  width={0.96}
                  height={0.96}
                  rx={0.08}
                />
              ) : null,
            )}
          </svg>

          {rejected && (
            <div className="dl-overlay dl-overlay-err" role="status">
              <strong>Request rejected</strong>
              <code>
                Total request size ({bytes.toLocaleString("en-US")} bytes) must be less than or equal to{" "}
                {LIMIT_BYTES.toLocaleString("en-US")} bytes.
              </code>
            </div>
          )}
          {status === "done" && (
            <div className="dl-overlay dl-overlay-ok" role="status">
              <strong>output.tif</strong>
              <span>
                {fmtMb(s.totalMb)} · {s.chunks} chunk{s.chunks > 1 ? "s" : ""} merged
              </span>
            </div>
          )}
        </div>

        <div className="dl-side">
          <div className="dl-progress" aria-hidden="true">
            <div style={{ width: `${pct}%` }} />
          </div>
          <dl className="dl-stats">
            <div>
              <dt>Written</dt>
              <dd>
                {fmtMb(s.doneMb)} <span>/ {fmtMb(s.totalMb)}</span>
              </dd>
            </div>
            <div>
              <dt>Chunks</dt>
              <dd>
                {chunksWritten} <span>/ {s.chunks}</span>
              </dd>
            </div>
          </dl>

          <div className="dl-block">
            <span className="dl-label">Requests in flight</span>
            <div className="dl-slots" aria-label={`${inFlight} of ${PARALLEL} requests in flight`}>
              {Array.from({ length: PARALLEL }, (_, i) => (
                <i key={i} className={i < inFlight ? "on" : ""} />
              ))}
            </div>
            <small>{s.small ? "about 1 MB each, after the split" : "about 4 MB each"}</small>
          </div>

          <div className="dl-block">
            <span className="dl-label">On disk</span>
            <div className="dl-pieces">
              {s.pieces.length === 0 && !s.merging && <small>Nothing yet.</small>}
              {s.merging && (
                <span className="dl-piece is-merging">
                  {pieceLabel({ ids: [...s.merging.a.ids, ...s.merging.b.ids] })}
                </span>
              )}
              {s.pieces.map((p) => (
                <span key={p.ids.join("-")} className={`dl-piece${status === "done" ? " is-final" : ""}`}>
                  {status === "done" ? "output.tif" : pieceLabel(p)}
                </span>
              ))}
            </div>
          </div>

          <ol className="dl-log" aria-live="polite">
            {s.log.length === 0 && <li className="out">Waiting to start.</li>}
            {s.log.map((l) => (
              <li key={l.id} className={l.kind}>
                {l.text}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="dl-actions">
        {status === "idle" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRejected(true)} disabled={rejected}>
              Send as one request
            </button>
            <button type="button" className="btn btn-primary" onClick={start}>
              Download with GEE-Assist
            </button>
          </>
        )}
        {status === "running" && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setStatus("paused")}>
              Pause
            </button>
            <button type="button" className="btn btn-danger" onClick={() => oom(oomTarget)} disabled={oomTarget < 0}>
              Run out of memory
            </button>
          </>
        )}
        {status === "paused" && (
          <button type="button" className="btn btn-primary" onClick={() => setStatus("running")}>
            Resume
          </button>
        )}
        {status !== "idle" && (
          <button type="button" className="btn btn-quiet" onClick={() => reset(side, chunkMb)}>
            Start over
          </button>
        )}
      </div>

      <figcaption>
        {status === "running" ? (
          <>
            <strong>Click a pulsing square</strong> to make Earth Engine run out of memory on it.
          </>
        ) : (
          <>Change the area and chunk size, then try sending it as one request first.</>
        )}{" "}
        A demonstration: time is sped up and nothing is downloaded.
      </figcaption>
    </figure>
  );
}
