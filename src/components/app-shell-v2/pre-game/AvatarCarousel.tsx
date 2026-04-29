import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

export type AvatarCarouselProps = {
  value: number;
  onChange: (next: number) => void;
  accentRgb: string;
  /** Liste optionnelle. Par défaut : tous les AVATARS du jeu. */
  avatars?: readonly string[];
  /** "compact" = grid mobile-friendly, "carousel" = snap horizontal */
  layout?: "carousel" | "grid";
  className?: string;
};

export function AvatarCarousel({
  value,
  onChange,
  accentRgb,
  avatars = AVATARS,
  layout = "carousel",
  className,
}: AvatarCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (layout !== "carousel") return;
    const node = itemRefs.current[value];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [value, layout]);

  const select = (i: number) => {
    const next = ((i % avatars.length) + avatars.length) % avatars.length;
    onChange(next);
  };

  const nudge = (dir: -1 | 1) => select(value + dir);

  if (layout === "grid") {
    return (
      <div className={cn("grid grid-cols-6 gap-2 sm:grid-cols-8", className)}>
        {avatars.map((char, i) => {
          const active = i === value;
          return (
            <button
              key={`${char}-${i}`}
              type="button"
              onClick={() => select(i)}
              aria-label={`Avatar ${i + 1}`}
              aria-pressed={active}
              className={cn(
                "ds-focus-ring relative flex aspect-square items-center justify-center rounded-xl border text-[22px] transition",
                "hover:scale-[1.04]",
              )}
              style={
                active
                  ? {
                      borderColor: `rgba(${accentRgb},0.7)`,
                      background: `linear-gradient(135deg, rgba(${accentRgb},0.22), rgba(${accentRgb},0.06))`,
                      boxShadow: `0 0 0 1px rgba(${accentRgb},0.5), 0 6px 18px rgba(${accentRgb},0.25)`,
                    }
                  : {
                      borderColor: "var(--ds-border)",
                      background: "var(--ds-surface-0)",
                    }
              }
            >
              <span aria-hidden>{char}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full min-w-0 max-w-full overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => nudge(-1)}
        aria-label="Avatar précédent"
        className="ds-focus-ring absolute left-1 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)]/80 text-[var(--ds-text-secondary)] backdrop-blur transition hover:bg-[var(--ds-surface-2)]"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        onClick={() => nudge(1)}
        aria-label="Avatar suivant"
        className="ds-focus-ring absolute right-1 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-bg-elevated)]/80 text-[var(--ds-text-secondary)] backdrop-blur transition hover:bg-[var(--ds-surface-2)]"
      >
        <ChevronRight size={16} />
      </button>

      <div
        ref={scrollerRef}
        className="ds-scroll flex w-full min-w-0 max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-12 py-2"
        style={{ scrollPadding: "0 48px" }}
      >
        {avatars.map((char, i) => {
          const active = i === value;
          return (
            <button
              key={`${char}-${i}`}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              onClick={() => select(i)}
              aria-label={`Avatar ${i + 1}`}
              aria-pressed={active}
              className={cn(
                "ds-focus-ring relative flex shrink-0 snap-center items-center justify-center rounded-2xl border text-[34px] transition-all",
                active ? "h-20 w-20" : "h-14 w-14 opacity-60 hover:opacity-100",
              )}
              style={
                active
                  ? {
                      borderColor: `rgba(${accentRgb},0.7)`,
                      background: `linear-gradient(135deg, rgba(${accentRgb},0.22), rgba(${accentRgb},0.06))`,
                      boxShadow: `0 0 0 1px rgba(${accentRgb},0.5), 0 10px 28px rgba(${accentRgb},0.28)`,
                    }
                  : {
                      borderColor: "var(--ds-border)",
                      background: "var(--ds-surface-0)",
                    }
              }
            >
              <span aria-hidden>{char}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
