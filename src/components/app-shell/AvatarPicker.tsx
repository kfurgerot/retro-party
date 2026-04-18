import { AVATARS } from "@/types/game";
import { cn } from "@/lib/utils";

interface AvatarPickerProps {
  value: number;
  onChange: (index: number) => void;
  accentColor?: string;
  compact?: boolean;
}

export const AvatarPicker = ({
  value,
  onChange,
  accentColor = "#6366f1",
  compact = false,
}: AvatarPickerProps) => (
  <div
    className={cn(
      "grid gap-2",
      compact ? "grid-cols-6 sm:grid-cols-8" : "grid-cols-5 sm:grid-cols-7 lg:grid-cols-9",
    )}
  >
    {AVATARS.map((a, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onChange(i)}
        aria-label={`Avatar ${i + 1}`}
        className={cn(
          "flex aspect-square items-center justify-center rounded-xl border text-xl transition-all focus-visible:outline-none",
          i === value
            ? "border-white/25 bg-white/[0.08]"
            : "border-white/[0.05] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
        )}
        style={i === value ? { boxShadow: `0 0 0 2px ${accentColor}` } : undefined}
      >
        {a}
      </button>
    ))}
  </div>
);
