import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, User as UserIcon, ExternalLink } from "lucide-react";

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.displayName || user?.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ds-focus-ring flex h-9 w-9 select-none items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[12px] font-semibold text-[var(--ds-text-primary)] transition hover:border-[var(--ds-border-strong)] hover:bg-[var(--ds-surface-3)]"
          aria-label="Menu utilisateur"
        >
          {initials || "?"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-60 border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-primary)]"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-2">
          <div className="truncate text-[13px] font-semibold text-[var(--ds-text-primary)]">
            {user?.displayName || "Compte"}
          </div>
          <div className="truncate text-[11.5px] font-normal text-[var(--ds-text-faint)]">
            {user?.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--ds-border)]" />
        <DropdownMenuItem
          onSelect={() => navigate("/app/settings")}
          className="gap-2 text-[13px] text-[var(--ds-text-secondary)] focus:bg-[var(--ds-surface-2)] focus:text-[var(--ds-text-primary)]"
        >
          <UserIcon size={13} /> Profil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate("/app/settings")}
          className="gap-2 text-[13px] text-[var(--ds-text-secondary)] focus:bg-[var(--ds-surface-2)] focus:text-[var(--ds-text-primary)]"
        >
          <Settings size={13} /> Paramètres
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate("/")}
          className="gap-2 text-[13px] text-[var(--ds-text-secondary)] focus:bg-[var(--ds-surface-2)] focus:text-[var(--ds-text-primary)]"
        >
          <ExternalLink size={13} /> Voir le portail public
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--ds-border)]" />
        <DropdownMenuItem
          onSelect={handleLogout}
          className="gap-2 text-[13px] text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
        >
          <LogOut size={13} /> Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
