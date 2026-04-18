import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type ToolId = "planning-poker" | "retro-party" | "radar-party" | "draw-duel" | "retro-generator";

type Tool = {
  id: ToolId;
  label: string;
  tagline: string;
  icon: string;
  status: "live" | "soon";
  color: string;
  glow: string;
  participants: number | null;
  desc: string;
  hostRoute: string | null;
  joinRoute: (code: string) => string | null;
};

const TOOLS: Tool[] = [
  {
    id: "planning-poker",
    label: "Planning Poker",
    tagline: "Estimez ensemble, décidez vite",
    icon: "🃏",
    status: "live",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.3)",
    participants: 8,
    desc: "Votes synchronisés en temps réel, révélation simultanée, stats instantanées.",
    hostRoute: "/play?from=portal&experience=planning-poker",
    joinRoute: (code) => `/play?experience=planning-poker&code=${code}`,
  },
  {
    id: "retro-party",
    label: "Rétro Party",
    tagline: "Rétrospective en mode jeu",
    icon: "🎲",
    status: "live",
    color: "#ec4899",
    glow: "rgba(236,72,153,0.3)",
    participants: 12,
    desc: "Plateau de jeu collaboratif, questions Agile, mini-jeux d'équipe.",
    hostRoute: "/play?from=portal",
    joinRoute: (code) => `/play?code=${code}`,
  },
  {
    id: "radar-party",
    label: "Radar Party",
    tagline: "Visualisez la santé de votre équipe",
    icon: "📡",
    status: "live",
    color: "#10b981",
    glow: "rgba(16,185,129,0.3)",
    participants: 6,
    desc: "Questionnaire Agile, radar individuel & équipe, insights atelier.",
    hostRoute: "/radar-party?from=portal&mode=host",
    joinRoute: (code) => `/radar-party?mode=join&code=${code}`,
  },
  {
    id: "draw-duel",
    label: "Draw Duel",
    tagline: "Dessinez, devinez, riez",
    icon: "✏️",
    status: "soon",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.2)",
    participants: null,
    desc: "Mini-jeu de dessin collaboratif pour briser la glace.",
    hostRoute: null,
    joinRoute: () => null,
  },
  {
    id: "retro-generator",
    label: "Rétro Generator",
    tagline: "Formats de rétro sur mesure",
    icon: "⚙️",
    status: "soon",
    color: "#64748b",
    glow: "rgba(100,116,139,0.15)",
    participants: null,
    desc: "Génère des formats de rétrospective adaptés à votre contexte.",
    hostRoute: null,
    joinRoute: () => null,
  },
];

const RECENT_SESSIONS = [
  { tool: "Planning Poker", code: "XJ42", time: "il y a 2h", color: "#6366f1", icon: "🃏", members: 5 },
  { tool: "Radar Party", code: "K8RT", time: "hier", color: "#10b981", icon: "📡", members: 9 },
  { tool: "Rétro Party", code: "PZ91", time: "il y a 3j", color: "#ec4899", icon: "🎲", members: 7 },
];

const StatusBadge = ({ status }: { status: "live" | "soon" }) => {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
        Disponible
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-600/20 bg-slate-700/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
      Bientôt
    </span>
  );
};

const ToolCard = ({
  tool,
  isSelected,
  onClick,
}: {
  tool: Tool;
  isSelected: boolean;
  onClick: (id: ToolId) => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const active = isSelected || hovered;
  const isLive = tool.status === "live";

  return (
    <button
      type="button"
      onClick={() => isLive && onClick(tool.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200",
        isLive ? "cursor-pointer" : "cursor-default opacity-50",
      )}
      style={{
        background:
          active && isLive
            ? `linear-gradient(135deg, ${tool.color}12, ${tool.color}06)`
            : "rgba(255,255,255,0.02)",
        borderColor: active && isLive ? `${tool.color}55` : "rgba(255,255,255,0.06)",
        boxShadow:
          active && isLive ? `0 0 0 1px ${tool.color}30, 0 8px 32px ${tool.glow}` : "none",
      }}
    >
      {isSelected && isLive && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${tool.color}, transparent)` }}
        />
      )}

      <div className="flex items-start justify-between">
        <span className="text-3xl leading-none">{tool.icon}</span>
        <StatusBadge status={tool.status} />
      </div>

      <div>
        <div className="mb-1 text-[15px] font-bold leading-tight text-slate-100">{tool.label}</div>
        <div className="text-xs leading-relaxed text-slate-500">{tool.desc}</div>
      </div>

      {isLive && tool.participants !== null && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <div className="flex">
            {Array.from({ length: Math.min(3, tool.participants) }).map((_, i) => (
              <div
                key={i}
                className="h-4 w-4 rounded-full border-[1.5px] border-[#0a0a14]"
                style={{
                  background: `hsl(${i * 40 + 200}, 60%, 55%)`,
                  marginLeft: i > 0 ? "-5px" : undefined,
                }}
              />
            ))}
          </div>
          <span>{tool.participants} sessions actives</span>
        </div>
      )}
    </button>
  );
};

const QuickJoinBar = ({
  tool,
  onHost,
  onJoin,
}: {
  tool: Tool;
  onHost: () => void;
  onJoin: (code: string) => void;
}) => {
  const [code, setCode] = useState("");
  const canJoin = code.length >= 4;

  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        placeholder="Code room (ex: AB12)"
        className="flex-1 bg-transparent font-mono text-sm tracking-widest text-slate-100 outline-none placeholder:text-slate-600"
      />
      <button
        type="button"
        onClick={() => canJoin && onJoin(code)}
        className={cn(
          "rounded-lg px-4 py-2 text-[13px] font-semibold transition-all",
          canJoin ? "cursor-pointer text-white" : "cursor-default bg-white/5 text-slate-600",
        )}
        style={canJoin ? { background: tool.color } : undefined}
      >
        Rejoindre
      </button>
      <div className="h-5 w-px bg-white/[0.08]" />
      <button
        type="button"
        onClick={onHost}
        className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all"
        style={{
          background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
          boxShadow: `0 4px 12px ${tool.glow}`,
        }}
      >
        + Créer
      </button>
    </div>
  );
};

const StatChip = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="flex min-w-[80px] flex-col gap-0.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5">
    <span className="text-xl font-extrabold leading-none tracking-tight" style={{ color }}>
      {value}
    </span>
    <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
  </div>
);

export default function Portal() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ToolId>("planning-poker");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const selectedTool = TOOLS.find((t) => t.id === selected)!;

  const handleCreate = () => {
    if (selectedTool.hostRoute) navigate(selectedTool.hostRoute);
  };

  const handleJoin = (code: string) => {
    const route = selectedTool.joinRoute(code);
    if (route) navigate(route);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden text-slate-100"
      style={{ background: "#0a0a14", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 60% 40% at 20% 10%, rgba(99,102,241,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 30% at 80% 80%, rgba(236,72,153,0.06) 0%, transparent 70%)
          `,
        }}
      />

      <div
        className="relative z-10 mx-auto max-w-[900px] px-5 pb-16 pt-7"
        style={{
          opacity: mounted ? 1 : 0,
          transition: "opacity 0.4s ease, transform 0.4s ease",
          transform: mounted ? "translateY(0)" : "translateY(16px)",
        }}
      >
        {/* Header */}
        <header className="mb-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2.5 inline-flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm">
                  ⚡
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-400">
                  Agile Suite
                </span>
              </div>
              <h1 className="text-[clamp(22px,5vw,32px)] font-extrabold leading-none tracking-tight text-slate-50">
                Bonjour, Karl 👋
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                Quelle expérience lance-t-on aujourd'hui ?
              </p>
            </div>

            {/* User badge */}
            <div className="flex items-center gap-2.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3.5 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 text-xs font-bold">
                K
              </div>
              <span className="text-[13px] text-slate-400">karl.furgerot</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-6 flex flex-wrap gap-2.5">
            <StatChip label="Sessions" value="26" color="#6366f1" />
            <StatChip label="Actives" value="3" color="#10b981" />
            <StatChip label="Équipiers" value="47" color="#f59e0b" />
            <StatChip label="Ce mois" value="12" color="#ec4899" />
          </div>
        </header>

        {/* Tool grid */}
        <section className="mb-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
              Outils disponibles
            </h2>
            <span className="rounded-full border border-white/[0.05] bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-600">
              3 / 5 actifs
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                isSelected={selected === tool.id}
                onClick={setSelected}
              />
            ))}
          </div>
        </section>

        {/* Quick action zone */}
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="text-lg leading-none">{selectedTool.icon}</span>
            <div>
              <div className="text-sm font-bold text-slate-100">{selectedTool.label}</div>
              <div className="text-xs text-slate-500">{selectedTool.tagline}</div>
            </div>
          </div>
          <QuickJoinBar tool={selectedTool} onHost={handleCreate} onJoin={handleJoin} />
        </section>

        {/* Recent sessions */}
        <section className="mt-7">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
            Sessions récentes
          </h2>
          <div className="flex flex-col gap-1.5">
            {RECENT_SESSIONS.map((session) => (
              <div
                key={session.code}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3 transition-all hover:border-white/[0.08] hover:bg-white/[0.035]"
              >
                <span className="text-lg leading-none">{session.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-200">{session.tool}</div>
                  <div className="text-[11px] text-slate-500">
                    {session.members} participants · {session.time}
                  </div>
                </div>
                <div
                  className="rounded-md px-2 py-1 font-mono text-xs font-bold tracking-widest"
                  style={{
                    color: session.color,
                    background: `${session.color}15`,
                    border: `1px solid ${session.color}30`,
                  }}
                >
                  {session.code}
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
