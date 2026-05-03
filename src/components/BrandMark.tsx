import { cn } from "@/lib/utils";

type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function BrandMark({ size = 32, className, title = "AgileSuite" }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <defs>
        <radialGradient id="bm-glow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ec4899" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0a0a14" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bm-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#ec4899" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="14" ry="14" fill="#0a0a14" />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.5"
        ry="13.5"
        fill="none"
        stroke="url(#bm-edge)"
        strokeWidth="1"
        opacity="0.9"
      />
      <circle cx="32" cy="34" r="22" fill="url(#bm-glow)" />

      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5">
        <polyline points="14,48 32,30 50,48" stroke="#10b981" />
        <polyline points="14,40 32,22 50,40" stroke="#ec4899" />
        <polyline points="14,32 32,14 50,32" stroke="#6366f1" />
      </g>
    </svg>
  );
}
