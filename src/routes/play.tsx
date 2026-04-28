import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useStockfish } from "@/lib/stockfish";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RotateCcw, Flag, Cpu, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/play")({ component: PlayPage });

const LEVELS = [
  { label: "Easy", depth: 2 },
  { label: "Medium", depth: 8 },
  { label: "Hard", depth: 15 },
];

function PlayPage() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { ready, getBestMove } = useStockfish();

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [levelIdx, setLevelIdx] = useState(1);
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<string>("Your move");
  const [over, setOver] = useState(false);
  const savedRef = useRef(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");

  async function analyseGame() {
    const pgn = gameRef.current.pgn();
    if (!pgn.trim()) {
      toast.error("No moves to analyse yet.");
      return;
    }
    setAnalysisOpen(true);
    setAnalysing(true);
    setAnalysis("");
    try {
      const { data, error } = await supabase.functions.invoke("analyse-game", {
        body: { pgn },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalysis((data as any).analysis ?? "No analysis returned.");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to analyse game";
      setAnalysis("");
      toast.error(msg);
      if (msg.toLowerCase().includes("rate")) {
        setAnalysis("Rate limit reached. Please try again in a moment.");
      } else if (msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("payment")) {
        setAnalysis("AI credits exhausted. Add credits to your Lovable workspace.");
      } else {
        setAnalysis("Something went wrong. " + msg);
      }
    } finally {
      setAnalysing(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  function refresh() {
    setFen(gameRef.current.fen());
  }

  function evaluateEnd(): "win" | "loss" | "draw" | null {
    const g = gameRef.current;
    if (!g.isGameOver()) return null;
    if (g.isCheckmate()) {
      // The side to move just got checkmated
      const loserColor = g.turn() === "w" ? "white" : "black";
      return loserColor === playerColor ? "loss" : "win";
    }
    return "draw";
  }

  async function saveResult(result: "win" | "loss" | "draw") {
    if (savedRef.current || !user) return;
    savedRef.current = true;
    const ratingChange = result === "win" ? 15 : result === "loss" ? -10 : 2;
    const pgn = gameRef.current.pgn();
    const movesCount = gameRef.current.history().length;
    try {
      const { error: gErr } = await supabase.from("games").insert({
        user_id: user.id,
        result,
        pgn,
        player_color: playerColor,
        moves_count: movesCount,
        rating_change: ratingChange,
        ai_level: LEVELS[levelIdx].depth,
      });
      if (gErr) throw gErr;
      const { data: prof } = await supabase.from("profiles").select("rating").eq("id", user.id).single();
      if (prof) {
        await supabase.from("profiles").update({ rating: Math.max(100, prof.rating + ratingChange) }).eq("id", user.id);
      }
      toast.success(`Game saved · ${result === "win" ? "+" : ""}${ratingChange} rating`);
    } catch (e: any) {
      toast.error("Could not save game: " + e.message);
    }
  }

  async function makeAiMove() {
    const g = gameRef.current;
    if (g.isGameOver()) return;
    setThinking(true);
    const move = await getBestMove(g.fen(), LEVELS[levelIdx].depth);
    setThinking(false);
    if (!move) return;
    try {
      g.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
      refresh();
      checkEnd();
    } catch {
      // ignore
    }
  }

  function checkEnd() {
    const g = gameRef.current;
    if (g.isGameOver()) {
      const r = evaluateEnd();
      if (r) {
        setOver(true);
        setStatus(r === "win" ? "Checkmate — you won!" : r === "loss" ? "Checkmate — you lost." : "Draw");
        saveResult(r);
      }
    } else {
      setStatus(g.turn() === playerColor[0] ? "Your move" : "Engine thinking…");
    }
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare || over || thinking) return false;
    const g = gameRef.current;
    if (g.turn() !== playerColor[0]) return false;
    try {
      const move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!move) return false;
    } catch {
      return false;
    }
    setSelectedSquare(null);
    refresh();
    checkEnd();
    if (!gameRef.current.isGameOver()) {
      setTimeout(() => makeAiMove(), 500);
    }
    return true;
  }

  function onSquareClick({ square }: { square: string }) {
    if (over || thinking) return;
    const g = gameRef.current;
    if (g.turn() !== playerColor[0]) return;
    if (selectedSquare && selectedSquare !== square) {
      // try to move
      try {
        const move = g.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          setSelectedSquare(null);
          refresh();
          checkEnd();
          if (!gameRef.current.isGameOver()) setTimeout(() => makeAiMove(), 500);
          return;
        }
      } catch {
        // fall through to selection
      }
    }
    const piece = g.get(square as any);
    if (piece && piece.color === playerColor[0]) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }

  function newGame(color: "white" | "black" = playerColor) {
    gameRef.current = new Chess();
    savedRef.current = false;
    setSelectedSquare(null);
    setPlayerColor(color);
    setOver(false);
    setStatus("Your move");
    refresh();
    if (color === "black") {
      setTimeout(() => makeAiMove(), 300);
    }
  }

  function resign() {
    if (over) return;
    setOver(true);
    setStatus("You resigned.");
    saveResult("loss");
  }

  const squareStyles = useMemo(() => {
    if (!selectedSquare) return {};
    const g = gameRef.current;
    const moves = g.moves({ square: selectedSquare as any, verbose: true }) as Array<{ to: string; captured?: string }>;
    const styles: Record<string, React.CSSProperties> = {
      [selectedSquare]: { background: "rgba(255, 217, 102, 0.45)" },
    };
    for (const m of moves) {
      styles[m.to] = m.captured
        ? {
            background:
              "radial-gradient(circle, transparent 0%, transparent 55%, rgba(0,0,0,0.35) 56%, rgba(0,0,0,0.35) 65%, transparent 66%)",
          }
        : {
            background:
              "radial-gradient(circle, rgba(0,0,0,0.28) 18%, transparent 22%)",
          };
    }
    return styles;
  }, [selectedSquare, fen]);

  const boardOptions = useMemo(
    () => ({
      position: fen,
      onPieceDrop,
      onSquareClick,
      squareStyles,
      boardOrientation: playerColor,
      darkSquareStyle: { backgroundColor: theme === "dark" ? "#779556" : "#b58863" },
      lightSquareStyle: { backgroundColor: theme === "dark" ? "#ebecd0" : "#f0d9b5" },
      id: "main-board",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fen, playerColor, theme, over, thinking, squareStyles],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="relative aspect-square w-full max-w-[640px] mx-auto rounded-lg overflow-hidden border border-border shadow-sm">
              <Chessboard options={boardOptions} />
              {thinking && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px] pointer-events-none">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border shadow-md text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Stockfish is thinking…
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Cpu className="w-4 h-4" /> Stockfish {ready ? "" : "loading…"}
              </div>
              <div className="text-lg font-semibold">{status}</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Difficulty</div>
                <div className="grid grid-cols-3 gap-1">
                  {LEVELS.map((l, i) => (
                    <button
                      key={l.label}
                      onClick={() => setLevelIdx(i)}
                      className={`text-xs py-1.5 rounded-md border transition-colors ${
                        i === levelIdx
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Play as</div>
                <div className="grid grid-cols-2 gap-1">
                  {(["white", "black"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => newGame(c)}
                      className={`text-xs py-1.5 rounded-md border capitalize transition-colors ${
                        c === playerColor
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => newGame(playerColor)}>
                <RotateCcw className="w-4 h-4" /> New game
              </Button>
              <Button variant="outline" className="flex-1" onClick={resign} disabled={over}>
                <Flag className="w-4 h-4" /> Resign
              </Button>
            </div>

            {over && (
              <Button className="w-full" onClick={analyseGame} disabled={analysing}>
                {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analyse game
              </Button>
            )}

            <Link to="/profile" className="block text-center text-sm text-muted-foreground hover:text-foreground">
              View your game history →
            </Link>
          </aside>
        </div>
      </main>

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> Game analysis
            </DialogTitle>
            <DialogDescription>AI coach review of your last game.</DialogDescription>
          </DialogHeader>
          {analysing ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing your moves…
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {analysis}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
