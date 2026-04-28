import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gambit — Play Chess vs Stockfish" },
      { name: "description", content: "A clean, modern chess app. Play vs Stockfish AI, track your rating and game history." },
      { property: "og:title", content: "Gambit — Play Chess vs Stockfish" },
      { property: "og:description", content: "A clean, modern chess app. Play vs Stockfish AI, track your rating and game history." },
      { name: "twitter:title", content: "Gambit — Play Chess vs Stockfish" },
      { name: "twitter:description", content: "A clean, modern chess app. Play vs Stockfish AI, track your rating and game history." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f44a179e-c1c3-48fa-8edb-8a86ae5608b6/id-preview-36ed3b5c--55b412aa-f027-4f31-a3bd-1abc04950614.lovable.app-1777400861143.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f44a179e-c1c3-48fa-8edb-8a86ae5608b6/id-preview-36ed3b5c--55b412aa-f027-4f31-a3bd-1abc04950614.lovable.app-1777400861143.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
