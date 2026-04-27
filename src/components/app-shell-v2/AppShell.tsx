import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { X } from "lucide-react";

export function AppShell() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div
        className="flex min-h-svh items-center justify-center text-[var(--ds-text-muted)]"
        style={{ background: "var(--ds-bg)" }}
      >
        Chargement…
      </div>
    );
  }

  return (
    <div className="min-h-svh text-[var(--ds-text-primary)]" style={{ background: "var(--ds-bg)" }}>
      <div className="flex min-h-svh">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <main className="ds-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
            <div className="mx-auto w-full max-w-[1200px] ds-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative h-full">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
      ) : null}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
