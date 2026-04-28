import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Crown, Cpu, History, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 sm:pt-32 sm:pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
              <Sparkles className="w-3 h-3 text-primary" /> Powered by Stockfish
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter leading-[1.05]">
              Chess, distilled to its essence.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Play against the world's strongest chess engine. Track every game.
              Watch your rating climb. No clutter — just the board.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/play">
                <Button size="lg" className="font-medium">
                  <Crown className="w-4 h-4" /> Play now
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Create account</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-24 grid sm:grid-cols-3 gap-4">
          {[
            { icon: Cpu, title: "Stockfish AI", desc: "Adjustable difficulty from beginner to grandmaster." },
            { icon: History, title: "Game history", desc: "Every move saved as PGN. Review your blunders." },
            { icon: Crown, title: "Live rating", desc: "Elo-style rating updates after each game." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-lg border border-border bg-card">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Built with chess.js, Stockfish & Lovable Cloud
      </footer>
    </div>
  );
}
