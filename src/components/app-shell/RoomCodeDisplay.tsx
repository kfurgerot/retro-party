import { useState, useRef } from "react";

interface RoomCodeDisplayProps {
  code: string;
  accentColor?: string;
  hint?: string;
}

export const RoomCodeDisplay = ({ code, accentColor = "#6366f1", hint }: RoomCodeDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Code room</div>
          <div
            className="mt-0.5 font-mono text-2xl font-bold tracking-[0.15em]"
            style={{ color: accentColor }}
          >
            {code}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-[#cbd8cd] bg-white/75 px-3 py-1.5 text-sm font-semibold text-[#24443d] transition hover:border-[#aebcaf] hover:bg-white"
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      {hint && <p className="mt-2 text-xs text-[#647067]">{hint}</p>}
    </div>
  );
};
