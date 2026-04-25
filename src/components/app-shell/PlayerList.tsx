import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

type PlayerEntry = {
  name: string;
  avatar: number;
  isHost: boolean;
  connected?: boolean;
  role?: string;
  id?: string;
};

interface PlayerListProps {
  players: PlayerEntry[];
  max?: number;
  accentColor?: string;
  roleLabel?: (role: string) => string;
  emptyLabel?: string;
}

export const PlayerList = ({
  players,
  max,
  accentColor = "#6366f1",
  roleLabel,
  emptyLabel = "En attente de joueurs…",
}: PlayerListProps) => (
  <div className="grid max-h-[40svh] gap-1.5 overflow-auto pr-1 sm:grid-cols-2">
    {players.length === 0 && (
      <div className="rounded-xl border border-dashed border-[#d8e2d9] px-4 py-6 text-center text-sm text-[#647067] sm:col-span-2">
        {emptyLabel}
      </div>
    )}
    {players.map((p, i) => (
      <div
        key={p.id ?? `${p.name}-${i}`}
        className="flex items-center justify-between rounded-xl border border-[#d8e2d9] bg-white/62 px-3 py-2.5"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border text-lg"
            style={{ borderColor: `${accentColor}25`, background: `${accentColor}10` }}
          >
            {AVATARS[p.avatar] ?? "?"}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#18211f]">{p.name}</div>
            {roleLabel && p.role && (
              <div className="text-[11px] text-[#647067]">{roleLabel(p.role)}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {p.connected !== false && (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
              En ligne
            </span>
          )}
          {p.connected === false && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400">
              Hors ligne
            </span>
          )}
          {p.isHost && (
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                borderColor: `${accentColor}35`,
                background: `${accentColor}10`,
                color: accentColor,
              }}
            >
              Hôte
            </span>
          )}
        </div>
      </div>
    ))}
    {max !== undefined && (
      <div className="col-span-full pt-1 text-right text-[11px] text-[#647067]">
        {players.length} / {max} joueurs
      </div>
    )}
  </div>
);
