import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, MapPin, Crown } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
  head: () => ({
    meta: [
      { title: "Leaderboard — Gambit" },
      { name: "description", content: "Top chess players by rating on Gambit." },
    ],
  }),
});

interface Row {
  id: string;
  username: string;
  rating: number;
  city: string | null;
  is_pro: boolean;
}

function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [city, setCity] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, rating, city, is_pro")
        .order("rating", { ascending: false })
        .limit(500);
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.city && set.add(r.city));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (city !== "__all__") list = list.filter((r) => (r.city ?? "") === city);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.username.toLowerCase().includes(q) || (r.city ?? "").toLowerCase().includes(q),
      );
    }
    return list.slice(0, 10);
  }, [rows, city, search]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Top 10 players by rating.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Search by username or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="__all__">All cities ({rows.length})</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">No players found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-background/50">
                <tr>
                  <th className="text-left font-medium px-4 py-2 w-10">#</th>
                  <th className="text-left font-medium px-4 py-2">Player</th>
                  <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">City</th>
                  <th className="text-right font-medium px-4 py-2">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r, i) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-4 py-3 font-medium flex items-center gap-2">
                      {r.username}
                      {r.is_pro && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          <Crown className="w-3 h-3" /> Pro
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {r.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {r.city}
                        </span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                      {r.rating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
