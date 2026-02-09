import React from "react";
import { AVATARS } from "@/types/game";

const BG_TILE_CLASSES = [
  "left-[10%] top-[67%] bg-tile-blue",
  "left-[18%] top-[56%] bg-tile-red",
  "left-[27%] top-[64%] bg-tile-green",
  "left-[36%] top-[51%] bg-tile-violet",
  "left-[45%] top-[60%] bg-tile-star",
  "left-[54%] top-[47%] bg-tile-blue",
  "left-[63%] top-[56%] bg-tile-red",
  "left-[72%] top-[43%] bg-tile-green",
  "left-[80%] top-[51%] bg-tile-violet",
  "left-[40%] top-[36%] bg-tile-star",
  "left-[50%] top-[33%] bg-tile-blue",
] as const;

const BG_CHARACTERS = [
  { avatar: AVATARS[0], className: "left-[6%] top-[18%] rotate-[-8deg]" },
  { avatar: AVATARS[12], className: "right-[7%] top-[14%] rotate-[7deg]" },
  { avatar: AVATARS[14], className: "left-[10%] bottom-[10%] rotate-[5deg]" },
  { avatar: AVATARS[16], className: "right-[9%] bottom-[8%] rotate-[-6deg]" },
  { avatar: AVATARS[6], className: "left-[42%] top-[9%] rotate-[4deg]" },
  { avatar: AVATARS[3], className: "right-[30%] bottom-[18%] rotate-[6deg]" },
] as const;

export const RetroScreenBackground: React.FC = () => {
  return (
    <>
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 h-[72%] w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-cyan-300/20 bg-slate-900/25 shadow-[0_0_60px_rgba(34,211,238,0.22)] backdrop-blur-[1px]" />
        <div className="absolute inset-0 opacity-75">
          {BG_TILE_CLASSES.map((tile, idx) => (
            <div
              key={`bg-tile-${idx}`}
              className={`absolute h-12 w-12 rounded-md border-2 border-slate-950/80 shadow-[0_0_18px_rgba(34,211,238,0.2)] ${tile} ${idx % 2 === 0 ? "animate-pulse" : ""}`}
            />
          ))}
          <div className="absolute left-[13%] top-[70%] h-1.5 w-[17%] rotate-[-24deg] bg-cyan-200/50" />
          <div className="absolute left-[30%] top-[58%] h-1.5 w-[16%] rotate-[24deg] bg-cyan-200/50" />
          <div className="absolute left-[48%] top-[56%] h-1.5 w-[17%] rotate-[-24deg] bg-cyan-200/50" />
          <div className="absolute left-[66%] top-[47%] h-1.5 w-[16%] rotate-[24deg] bg-cyan-200/50" />
          <div className="absolute left-[43%] top-[40%] h-1.5 w-[11%] rotate-[-22deg] bg-cyan-200/50" />
        </div>
        <div className="absolute inset-0">
          {BG_CHARACTERS.map((character, idx) => (
            <div
              key={`bg-character-${idx}`}
              className={`absolute flex h-16 w-16 items-center justify-center rounded-full border border-cyan-200/45 bg-slate-900/45 text-4xl shadow-[0_0_26px_rgba(34,211,238,0.32)] backdrop-blur-[1px] ${idx % 2 === 0 ? "animate-pulse" : ""} ${character.className}`}
            >
              {character.avatar}
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.3),transparent_35%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.28),transparent_35%),linear-gradient(to_bottom,rgba(15,23,42,0.82),rgba(2,6,23,0.96))]"
        aria-hidden="true"
      />
    </>
  );
};
