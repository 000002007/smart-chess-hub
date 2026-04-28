import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/multiplayer/$roomId")({
  component: RoomPage,
});

type Room = {
  id: string;
  created_by: string;
  white_id: string | null;
  black_id: string | null;
  opponent_id: string | null;
  status: "waiting" | "active" | "finished";
  current_fen: string;
  pgn: string;
  result: string | null;
};

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [room, setRoom] = useState<Room | null>(null);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Loading…");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const savedFinishRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  // Initial fetch + auto-join
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Room not found");
        navigate({ to: "/multiplayer" });
        return;
      }
      let r = data as Room;

      if (!r.opponent_id && r.created_by !== user.id) {
        const { data: updated, error: upErr } = await supabase
          .from("rooms")
          .update({ opponent_id: user.id, black_id: user.id, status: "active" })
          .eq("id", roomId)
          .select()
          .single();
        if (!upErr && updated) r = updated as Room;
      }

      applyRoom(r);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !room) return;
    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      try {
        gameRef.current.move(payload.move);
        setFen(gameRef.current.fen());
        updateStatusFromGame();
      } catch {
        // out of sync — refetch
        supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .single()
          .then(({ data }) => data && applyRoom(data as Room));
      }
    });

    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => {
        const next = payload.new as Room;
        setRoom(next);
        if (next.current_fen && next.current_fen !== gameRef.current.fen()) {
          try {
            const g = new Chess();
            if (next.pgn) g.loadPgn(next.pgn);
            else g.load(next.current_fen);
            gameRef.current = g;
            setFen(g.fen());
          } catch {
            /* ignore */
          }
        }
      },
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id, room?.id]);

  async function applyRoom(r: Room) {
    setRoom(r);
    try {
      const g = new Chess();
      if (r.pgn) g.loadPgn(r.pgn);
      else if (r.current_fen) g.load(r.current_fen);
      gameRef.current = g;
      setFen(g.fen());
    } catch {
      /* ignore */
    }
    // Fetch usernames
    const ids = [r.white_id, r.black_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p.username));
      setUsernames(map);
    }
    updateStatusFromGame(r);
  }

  function updateStatusFromGame(r: Room | null = room) {
    const g = gameRef.current;
    if (g.isGameOver()) {
      if (g.isCheckmate()) {
        const loserColor = g.turn() === "w" ? "white" : "black";
        const winnerId = loserColor === "white" ? r?.black_id : r?.white_id;
        setStatus(`Checkmate — ${winnerId === user?.id ? "you won!" : "you lost."}`);
        finishGame(winnerId === r?.white_id ? "white" : "black");
      } else {
        setStatus("Draw");
        finishGame("draw");
      }
      return;
    }
    if (!r) return;
    if (r.status === "waiting") {
      setStatus("Waiting for opponent…");
    } else {
      const turnId = g.turn() === "w" ? r.white_id : r.black_id;
      setStatus(turnId === user?.id ? "Your move" : "Opponent's move");
    }
  }

  async function finishGame(result: "white" | "black" | "draw") {
    if (savedFinishRef.current || !room) return;
    savedFinishRef.current = true;
    await supabase.from("rooms").update({ status: "finished", result }).eq("id", roomId);
  }

  function myColor(): "white" | "black" | null {
    if (!room || !user) return null;
    if (room.white_id === user.id) return "white";
    if (room.black_id === user.id) return "black";
    return null;
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare || !room || !user) return false;
    if (room.status !== "active") return false;
    const color = myColor();
    if (!color) return false;
    const g = gameRef.current;
    if (g.turn() !== color[0]) return false;

    let move;
    try {
      move = g.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;

    setFen(g.fen());
    const payloadMove = { from: sourceSquare, to: targetSquare, promotion: "q" };
    channelRef.current?.send({ type: "broadcast", event: "move", payload: { move: payloadMove } });
    supabase
      .from("rooms")
      .update({ current_fen: g.fen(), pgn: g.pgn() })
      .eq("id", roomId)
      .then(({ error }) => error && toast.error(error.message));
    updateStatusFromGame();
    return true;
  }

  const orientation = myColor() ?? "white";
  const opponentId = orientation === "white" ? room?.black_id : room?.white_id;
  const myId = user?.id;
  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/multiplayer/${roomId}` : "";

  const boardOptions = useMemo(
    () => ({
      position: fen,
      onPieceDrop,
      boardOrientation: orientation,
      darkSquareStyle: { backgroundColor: theme === "dark" ? "#779556" : "#b58863" },
      lightSquareStyle: { backgroundColor: theme === "dark" ? "#ebecd0" : "#f0d9b5" },
      id: "mp-board",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fen, orientation, theme, room?.status],
  );

  if (!room) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </main>
      </div>
    );
  }

  if (room.status === "waiting") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <h1 className="text-2xl font-semibold mb-2">Waiting for opponent…</h1>
            <p className="text-sm text-muted-foreground mb-4">Share this link to invite a friend:</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input value={shareLink} readOnly className="flex-1 font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  toast.success("Link copied");
                }}
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10">
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          <div>
            <div className="flex items-center justify-between mb-2 px-1 text-sm">
              <span className="font-medium">
                {opponentId ? usernames[opponentId] ?? "Opponent" : "Waiting…"}
              </span>
              <span className="text-muted-foreground">{orientation === "white" ? "Black" : "White"}</span>
            </div>
            <div className="aspect-square w-full max-w-[640px] mx-auto rounded-lg overflow-hidden border border-border shadow-sm">
              <Chessboard options={boardOptions} />
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-sm">
              <span className="font-medium">{myId ? usernames[myId] ?? "You" : "You"}</span>
              <span className="text-muted-foreground">{orientation === "white" ? "White" : "Black"}</span>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Status</div>
              <div className="text-lg font-semibold">{status}</div>
            </div>
            {room.status === "finished" && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm">Game ended: <span className="font-semibold">{room.result}</span></div>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/multiplayer" })}>
              Back to lobby
            </Button>
          </aside>
        </div>
      </main>
    </div>
  );
}
