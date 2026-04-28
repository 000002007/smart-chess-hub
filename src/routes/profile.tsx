import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Trophy, Skull, Minus, Gamepad2, Percent, User as UserIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
        supabase
          .from("games")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      if (p) setProfile(p);
      if (g) setGames(g as Game[]);
    })();
  }, [user]);

  const wins = games.filter((g) => g.result === "win").length;
  const losses = games.filter((g) => g.result === "loss").length;
  const draws = games.filter((g) => g.result === "draw").length;
  const total = games.length;
  const winRate = total ? Math.round((wins / total) * 100) : 0;

  // Build rating history (oldest -> newest), starting from current rating walked backwards
  const chartData = useMemo(() => {
    if (!profile || games.length === 0) return [] as { idx: number; rating: number; date: string }[];
    const ordered = [...games].reverse(); // oldest first
    let r = profile.rating - ordered.reduce((s, g) => s + g.rating_change, 0);
    const points = [{ idx: 0, rating: r, date: "Start" }];
    ordered.forEach((g, i) => {
      r += g.rating_change;
      points.push({
        idx: i + 1,
        rating: r,
        date: new Date(g.created_at).toLocaleDateString(),
      });
    });
    return points;
  }, [games, profile]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10">
        {/* Header card */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6 flex items-center gap-5 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-border flex items-center justify-center text-primary">
            <UserIcon className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Player</div>
            <h1 className="text-3xl font-bold tracking-tight">{profile?.username ?? "…"}</h1>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Rating</div>
            <div className="text-4xl font-bold text-primary tabular-nums">{profile?.rating ?? "—"}</div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Stat icon={Gamepad2} label="Games" value={total} tone="text-foreground" />
          <Stat icon={Trophy} label="Wins" value={wins} tone="text-success" />
          <Stat icon={Skull} label="Losses" value={losses} tone="text-destructive" />
          <Stat icon={Minus} label="Draws" value={draws} tone="text-muted-foreground" />
          <Stat icon={Percent} label="Win rate" value={`${winRate}%`} tone="text-primary" />
        </div>

        {/* Rating chart */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
            Rating history
          </h2>
          {chartData.length < 2 ? (
            <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
              Play a few games to see your rating history.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="idx" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent games */}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent games</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {games.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No games yet. Time to play your first match.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-background/50">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Date</th>
                    <th className="text-left font-medium px-4 py-2">Result</th>
                    <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Color</th>
                    <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Moves</th>
                    <th className="text-right font-medium px-4 py-2">Δ Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {games.slice(0, 20).map((g) => (
                    <tr key={g.id}>
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(g.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <ResultBadge result={g.result} />
                      </td>
                      <td className="px-4 py-2.5 capitalize text-muted-foreground hidden sm:table-cell">
                        {g.player_color}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{g.moves_count}</td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                          g.rating_change > 0
                            ? "text-success"
                            : g.rating_change < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {g.rating_change > 0 ? "+" : ""}
                        {g.rating_change}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-card border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const styles =
    result === "win"
      ? "bg-success/15 text-success border-success/30"
      : result === "loss"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize border ${styles}`}
    >
      {result}
    </span>
  );
}
