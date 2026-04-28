import { useEffect, useRef, useState } from "react";

// Load Stockfish from CDN via a blob worker so Vite doesn't try to bundle
// the npm package's Node-style entry point.
const STOCKFISH_CDN = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export type EngineMove = { from: string; to: string; promotion?: string };

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((m: EngineMove | null) => void) | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const blob = new Blob([`importScripts("${STOCKFISH_CDN}");`], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    workerRef.current = w;

    w.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      if (line === "uciok") {
        w.postMessage("isready");
      } else if (line === "readyok") {
        setReady(true);
      } else if (line.startsWith("bestmove")) {
        const parts = line.split(" ");
        const move = parts[1];
        if (resolveRef.current) {
          if (!move || move === "(none)") {
            resolveRef.current(null);
          } else {
            resolveRef.current({
              from: move.slice(0, 2),
              to: move.slice(2, 4),
              promotion: move.length > 4 ? move.slice(4, 5) : undefined,
            });
          }
          resolveRef.current = null;
        }
      }
    };

    w.postMessage("uci");

    return () => {
      w.terminate();
      URL.revokeObjectURL(url);
    };
  }, []);

  function getBestMove(fen: string, depth: number): Promise<EngineMove | null> {
    return new Promise((resolve) => {
      const w = workerRef.current;
      if (!w) return resolve(null);
      resolveRef.current = resolve;
      w.postMessage("ucinewgame");
      w.postMessage(`position fen ${fen}`);
      w.postMessage(`go depth ${depth}`);
    });
  }

  return { ready, getBestMove };
}
