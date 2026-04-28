import { Link, useNavigate } from "@tanstack/react-router";
import { Moon, Sun, LogOut, User as UserIcon, Crown } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header() {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Crown className="w-5 h-5 text-primary" />
          <span>Gambit</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/play">
            <Button variant="ghost" size="sm">Play</Button>
          </Link>
          {user && (
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <UserIcon className="w-4 h-4" /> Profile
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
