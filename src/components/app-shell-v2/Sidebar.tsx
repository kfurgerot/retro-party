import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Sparkles, Users, FolderKanban, History, Settings } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  soon?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/experiences", label: "Experiences", icon: Sparkles },
  { to: "/app/sessions", label: "Sessions", icon: History },
  { to: "/app/templates", label: "Templates", icon: FolderKanban },
  { to: "/app/teams", label: "Équipes", icon: Users },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-[var(--ds-border)] bg-[var(--ds-bg)]">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-sm font-bold text-white shadow-md">
          A
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-[var(--ds-text-primary)]">AgileSuite</div>
          <div className="text-[11px] text-[var(--ds-text-faint)]">Workspace personnel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ds-text-faint)]">
          Navigation
        </div>
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition",
                "ds-focus-ring",
                isActive
                  ? "bg-[var(--ds-surface-2)] text-[var(--ds-text-primary)]"
                  : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-1)] hover:text-[var(--ds-text-primary)]",
              )
            }
          >
            <item.icon size={16} className="opacity-80 group-hover:opacity-100" />
            <span className="flex-1">{item.label}</span>
            {item.soon ? (
              <span className="rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[var(--ds-text-faint)]">
                soon
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--ds-border)] p-3">
        <NavLink
          to="/app/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
              isActive
                ? "bg-[var(--ds-surface-2)] text-[var(--ds-text-primary)]"
                : "text-[var(--ds-text-muted)] hover:bg-[var(--ds-surface-1)] hover:text-[var(--ds-text-primary)]",
            )
          }
        >
          <Settings size={16} />
          Paramètres
        </NavLink>
      </div>
    </aside>
  );
}
