import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/analysis/$gameId")({
  component: AnalysisPage,
  head: () => ({
    meta: [{ title: "Game analysis — Gambit" }],
  }),
});

type MoveComment = {
  ply: number;
  san: string;
  comment: string;
  quality: "best" | "good" | "ok" | "inaccuracy" | "mistake" | "blunder";
};

type KeyMistake = {
  ply: number;
  san: string;
  why_bad: string;
  better: string;
};

type Analysis = {
  summary: string;
  move_comments: MoveComment[];
  key_mistakes: KeyMistake[];
};

const QUALITY_COLOR: Record<MoveComment["quality"], string> = {
  best: "text-emerald-500",
  good: "text-emerald-400",
  ok: "text-muted-foreground",
  inaccuracy: "text-yellow-500",
  mistake: "text-orange-500",
  blunder: "text-red-500",
};

function AnalysisPage() {
  const { gameId } = Route.useParams();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [pgn, setPgn] = useState<string>("");
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [history, setHistory] = useState<{ san: string; fen: string }[]>([]);
  const [ply, setPly] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Load game
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("pgn, player_color")
        .eq("id", gameId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoadErr("Game not found.");
        return;
      }
      setPgn(data.pgn);
      setPlayerColor((data.player_color as "white" | "black") ?? "white");
      try {
        const g = new Chess();
        g.loadPgn(data.pgn);
        const verbose = g.history({ verbose: true }) as Array<{ san: string; before: string; after: string }>;
        const replay = new Chess();
        const items: { san: string; fen: string }[] = [];
        for (const m of verbose) {
          replay.move(m.san);
          items.push({ san: m.san, fen: replay.fen() });
        }
        setHistory(items);
        setPly(items.length);
      } catch (e) {
        setLoadErr("Could not parse PGN.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, user]);

  async function runAnalysis() {
    if (!pgn) return;
    setAnalysing(true);
    setAnalysis(null);
    try {
      const moves = history.map((h) => h.san);
      const { data, error } = await supabase.functions.invoke("analyse-game", {
        body: { pgn, moves },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const parsed = (data as any)?.analysis as Analysis | null;
      if (!parsed) throw new Error("No analysis returned");
      setAnalysis(parsed);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to analyse game");
    } finally {
      setAnalysing(false);
    }
  }

  const fen = ply === 0 ? new Chess().fen() : history[ply - 1]?.fen ?? new Chess().fen();

  const boardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation: playerColor,
      allowDragging: false,
      darkSquareStyle: { backgroundColor: theme === "dark" ? "#779556" : "#b58863" },
      lightSquareStyle: { backgroundColor: theme === "dark" ? "#ebecd0" : "#f0d9b5" },
      id: "analysis-board",
    }),
    [fen, playerColor, theme],
  );

  function jump(p: number) {
    setPly(Math.max(0, Math.min(history.length, p)));
  }

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") jump(ply - 1);
      else if (e.key === "ArrowRight") jump(ply + 1);
      else if (e.key === "Home") jump(0);
      else if (e.key === "End") jump(history.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ply, history.length]);

  const commentByPly = useMemo(() => {
    const m: Record<number, MoveComment> = {};
    analysis?.move_comments?.forEach((c) => (m[c.ply] = c));
    return m;
  }, [analysis]);

  if (loadErr) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{loadErr}</p>
            <Link to="/profile" className="text-primary underline">
              Back to profile
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentComment = ply > 0 ? commentByPly[ply] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Game analysis</h1>
          <Button onClick={runAnalysis} disabled={analysing || !pgn}>
            {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analysis ? "Re-analyse" : "Analyse with AI"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div>
            <div className="aspect-square w-full max-w-[640px] mx-auto rounded-lg overflow-hidden border border-border shadow-sm">
              <Chessboard options={boardOptions} />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" onClick={() => jump(0)} disabled={ply === 0}>
                <ChevronFirst className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => jump(ply - 1)} disabled={ply === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-2 rounded-md bg-card border border-border text-sm font-mono min-w-[80px] text-center">
                {ply} / {history.length}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => jump(ply + 1)}
                disabled={ply >= history.length}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => jump(history.length)}
                disabled={ply >= history.length}
              >
                <ChevronLast className="w-4 h-4" />
              </Button>
            </div>

            {currentComment && (
              <div className="mt-4 max-w-[640px] mx-auto rounded-lg border border-border bg-card p-4">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-mono font-semibold">
                    {Math.ceil(currentComment.ply / 2)}
                    {currentComment.ply % 2 === 1 ? "." : "..."} {currentComment.san}
                  </span>
                  <span className={`text-xs font-medium uppercase ${QUALITY_COLOR[currentComment.quality]}`}>
                    {currentComment.quality}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{currentComment.comment}</p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {analysis?.summary && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Summary</div>
                <p className="text-sm">{analysis.summary}</p>
              </div>
            )}

            {analysis?.key_mistakes && analysis.key_mistakes.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Key mistakes
                </div>
                <ul className="space-y-3">
                  {analysis.key_mistakes.map((m, i) => (
                    <li key={i} className="text-sm">
                      <button
                        onClick={() => jump(m.ply)}
                        className="font-mono font-semibold text-primary hover:underline"
                      >
                        {Math.ceil(m.ply / 2)}
                        {m.ply % 2 === 1 ? "." : "..."} {m.san}
                      </button>
                      <p className="text-muted-foreground text-xs mt-0.5">{m.why_bad}</p>
                      <p className="text-emerald-500 text-xs mt-0.5">Better: {m.better}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Moves</div>
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 text-sm font-mono max-h-[400px] overflow-y-auto">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                  const wPly = i * 2 + 1;
                  const bPly = i * 2 + 2;
                  const w = history[wPly - 1];
                  const b = history[bPly - 1];
                  return (
                    <div key={i} className="contents">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {w ? (
                        <button
                          onClick={() => jump(wPly)}
                          className={`text-left px-1 rounded ${
                            ply === wPly ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          } ${commentByPly[wPly] ? QUALITY_COLOR[commentByPly[wPly].quality] : ""}`}
                        >
                          {w.san}
                        </button>
                      ) : (
                        <span />
                      )}
                      {b ? (
                        <button
                          onClick={() => jump(bPly)}
                          className={`text-left px-1 rounded ${
                            ply === bPly ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          } ${commentByPly[bPly] ? QUALITY_COLOR[commentByPly[bPly].quality] : ""}`}
                        >
                          {b.san}
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Link
              to="/profile"
              className="block text-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to profile
            </Link>
          </aside>
        </div>
      </main>
    </div>
  );
}
