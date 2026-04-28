import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Palette, Zap, Crown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const FEATURES = [
  { icon: Palette, title: "Custom board themes", desc: "Personalise the look with exclusive piece sets and palettes." },
  { icon: Sparkles, title: "Unlimited AI analysis", desc: "Run as many post-game coach reviews as you like." },
  { icon: Zap, title: "Priority matchmaking", desc: "Get paired faster against opponents at your level." },
];

export function ProUpgradeDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Crown className="w-5 h-5 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Upgrade to Gambit Pro</DialogTitle>
          <DialogDescription>Unlock the full Gambit experience.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 py-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-medium text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Maybe later</Button>
          <Button onClick={() => onOpenChange(false)}>
            <Crown className="w-4 h-4" /> Coming soon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
