import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Plus, Link as LinkIcon, Users } from "lucide-react";

export const Route = createFileRoute("/multiplayer")({
  component: MultiplayerLobby,
  head: () => ({
    meta: [
      { title: "Multiplayer — Gambit" },
      { name: "description", content: "Play chess online with friends via shareable room links." },
    ],
  }),
});

function MultiplayerLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [joinInput, setJoinInput] = useState("");

  async function createRoom() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("rooms")
      .insert({ created_by: user.id, white_id: user.id })
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not create room");
      return;
    }
    const link = `${window.location.origin}/multiplayer/${data.id}`;
    setShareLink(link);
    toast.success("Room created!");
  }

  function copyLink() {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    toast.success("Link copied");
  }

  function joinFromInput() {
    const value = joinInput.trim();
    if (!value) return;
    const match = value.match(/multiplayer\/([0-9a-f-]{36})/i);
    const id = match ? match[1] : value;
    navigate({ to: "/multiplayer/$roomId", params: { roomId: id } });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <div className="flex items-center gap-2 mb-8">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-semibold tracking-tight">Multiplayer</h1>
        </div>

        <section className="rounded-lg border border-border bg-card p-6 mb-6">
          <h2 className="font-semibold mb-1">Create a room</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Start a new game and share the link with a friend.
          </p>
          <Button onClick={createRoom} disabled={creating}>
            <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create Room"}
          </Button>

          {shareLink && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <Input value={shareLink} readOnly className="flex-1 font-mono text-xs" />
              <Button variant="outline" onClick={copyLink}>
                <Copy className="w-4 h-4" /> Copy link
              </Button>
              <Button
                onClick={() => {
                  const id = shareLink.split("/").pop()!;
                  navigate({ to: "/multiplayer/$roomId", params: { roomId: id } });
                }}
              >
                Enter room
              </Button>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-semibold mb-1">Join by link</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Paste a room link or ID to join your friend's game.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="https://…/multiplayer/abcd-1234…"
              className="flex-1"
            />
            <Button variant="outline" onClick={joinFromInput}>
              <LinkIcon className="w-4 h-4" /> Join
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
