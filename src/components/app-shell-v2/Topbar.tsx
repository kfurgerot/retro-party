import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Search, Plus, LogIn, Menu } from "lucide-react";
import { UserMenu } from "./UserMenu";

type TopbarProps = {
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
};

export function Topbar({ onOpenPalette, onOpenMobileNav }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--ds-border)] bg-[var(--ds-bg)]/80 px-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="ds-focus-ring rounded-lg p-2 text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-1)] hover:text-[var(--ds-text-primary)] lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <Menu size={18} />
      </button>

      <button
        type="button"
        onClick={onOpenPalette}
        className={cn(
          "ds-focus-ring group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)]",
          "px-3 text-left text-[13px] text-[var(--ds-text-muted)] transition hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface-2)]",
          "max-w-md",
        )}
      >
        <Search size={15} className="shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate">Rechercher, lancer, rejoindre…</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-[var(--ds-border)] bg-[var(--ds-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ds-text-faint)] sm:flex">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link
          to="/join"
          className="ds-focus-ring hidden h-9 items-center gap-1.5 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 text-[13px] font-medium text-[var(--ds-text-secondary)] transition hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)] sm:flex"
        >
          <LogIn size={14} />
          Rejoindre
        </Link>

        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Lancer une session"
          className="ds-focus-ring flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-400/40 bg-indigo-500 px-3 text-[13px] font-semibold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Lancer une session</span>
          <span className="sm:hidden">Lancer</span>
        </button>

        <div className="ml-1 shrink-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
