import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircle2, Users } from "lucide-react";
import { api, type ActivityKind, type Team } from "@/net/api";
import { cn } from "@/lib/utils";

type Props = {
  teams: Team[];
  currentTeamId: string | null;
  kind: ActivityKind;
  itemId: string;
  onChange: (teamId: string | null) => void;
};

export function TeamPicker({ teams, currentTeamId, kind, itemId, onChange }: Props) {
  const [pending, setPending] = useState(false);
  const current = teams.find((t) => t.id === currentTeamId) ?? null;

  const select = async (e: Event, teamId: string | null) => {
    if (teamId === currentTeamId) return;
    setPending(true);
    try {
      await api.setItemTeam({ kind, id: itemId, teamId });
      onChange(teamId);
    } catch {
      // ignored — caller can refresh
    } finally {
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "ds-focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium transition",
          current
            ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/15"
            : "border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-[var(--ds-text-faint)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]",
          pending ? "opacity-60" : "",
        )}
      >
        <Users size={11} />
        <span className="max-w-[120px] truncate">{current ? current.name : "Aucune équipe"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="min-w-[200px] border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] text-[var(--ds-text-primary)]"
      >
        {teams.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-[var(--ds-text-faint)]">
            Aucune équipe — créez-en une dans /app/teams
          </div>
        ) : (
          <>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onSelect={(e) => void select(e, team.id)}
                className="gap-2 text-[12.5px] text-[var(--ds-text-secondary)] focus:bg-[var(--ds-surface-2)] focus:text-[var(--ds-text-primary)]"
              >
                <Users size={12} />
                <span className="flex-1 truncate">{team.name}</span>
                {team.id === currentTeamId ? (
                  <CheckCircle2 size={12} className="text-emerald-400" />
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-[var(--ds-border)]" />
            <DropdownMenuItem
              onSelect={(e) => void select(e, null)}
              className="gap-2 text-[12.5px] text-[var(--ds-text-faint)] focus:bg-[var(--ds-surface-2)] focus:text-[var(--ds-text-primary)]"
            >
              Retirer de l'équipe
              {currentTeamId === null ? (
                <CheckCircle2 size={12} className="ml-auto text-emerald-400" />
              ) : null}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
