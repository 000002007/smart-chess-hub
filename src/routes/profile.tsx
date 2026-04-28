import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Trophy, Skull, Minus } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

interface Game {
  id: string;
  result: "win" | "loss" | "draw";
  player_color: string;
  moves_count: number;
  rating_change: number;
  ai_level: number;
  created_at: string;
}

interface Profile {
  username: string;
  rating: number;
}

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: g }] = await Promise.all([
        supabase.from("profiles").select("username, rating").eq("id", user.id).single(),
        supabase.from("games").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      if (p) setProfile(p);
      if (g) setGames(g as Game[]);
    })();
  }, [user]);

  const wins = games.filter((g) => g.result === "win").length;
  const losses = games.filter((g) => g.result === "loss").length;
  const draws = games.filter((g) => g.result === "draw").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex items-baseline justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Player</div>
              <h1 className="text-3xl font-bold tracking-tight">{profile?.username ?? "…"}</h1>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Rating</div>
              <div className="text-4xl font-bold text-primary tabular-nums">{profile?.rating ?? "—"}</div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat icon={Trophy} label="Wins" value={wins} tone="text-success" />
            <Stat icon={Skull} label="Losses" value={losses} tone="text-destructive" />
            <Stat icon={Minus} label="Draws" value={draws} tone="text-muted-foreground" />
          </div>
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent games</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {games.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No games yet. Time to play your first match.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {games.map((g) => (
                <li key={g.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        g.result === "win" ? "bg-success" : g.result === "loss" ? "bg-destructive" : "bg-muted-foreground"
                      }`}
                    />
                    <span className="font-medium capitalize w-12">{g.result}</span>
                    <span className="text-muted-foreground capitalize">as {g.player_color}</span>
                    <span className="text-muted-foreground hidden sm:inline">· {g.moves_count} moves</span>
                    <span className="text-muted-foreground hidden sm:inline">· depth {g.ai_level}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums font-medium ${g.rating_change > 0 ? "text-success" : g.rating_change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {g.rating_change > 0 ? "+" : ""}{g.rating_change}
                    </span>
                    <span className="text-muted-foreground text-xs hidden sm:inline">
                      {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-background border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="w-3 h-3" />{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
