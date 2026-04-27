import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "@/net/api";
import { ArrowRight, Sparkles } from "lucide-react";

const CODE_LEN = 4;

export default function Join() {
  const params = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const seed = (params.code || searchParams.get("code") || "").toUpperCase().slice(0, CODE_LEN);
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array.from({ length: CODE_LEN }, () => "");
    for (let i = 0; i < seed.length; i++) arr[i] = seed[i];
    return arr;
  });
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");
  const complete = code.length === CODE_LEN && digits.every((d) => d !== "");

  useEffect(() => {
    const firstEmpty = digits.findIndex((d) => !d);
    const idx = firstEmpty === -1 ? CODE_LEN - 1 : firstEmpty;
    inputsRef.current[idx]?.focus();
    // Mount-only focus; subsequent digit changes manage focus inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!complete || resolving) return;
    void resolve(code);
    // resolve is stable in scope; resolving is guarded above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, code]);

  const setAt = (i: number, value: string) => {
    setError(null);
    const ch = value
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = ch;
      return next;
    });
    if (ch && i < CODE_LEN - 1) inputsRef.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[i - 1] = "";
        return next;
      });
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputsRef.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && i < CODE_LEN - 1) {
      inputsRef.current[i + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Enter" && complete) {
      void resolve(code);
    }
  };

  const onPaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData
      .getData("text")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    if (!text) return;
    e.preventDefault();
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < text.length && i + k < CODE_LEN; k++) next[i + k] = text[k];
      return next;
    });
    const lastIdx = Math.min(i + text.length, CODE_LEN) - 1;
    inputsRef.current[lastIdx]?.focus();
  };

  const resolve = async (raw: string) => {
    setResolving(true);
    setError(null);
    try {
      const res = await api.resolveRoom(raw);
      if (res.module === "skills-matrix")
        navigate(`/skills-matrix?mode=join&code=${raw}`, { replace: true });
      else if (res.module === "radar-party")
        navigate(`/radar-party?mode=join&code=${raw}`, { replace: true });
      else navigate(`/play?mode=join&code=${raw}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code introuvable");
      setResolving(false);
      setDigits(Array.from({ length: CODE_LEN }, () => ""));
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    }
  };

  return (
    <div
      className="relative flex min-h-svh flex-col text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background: "radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.18), transparent 70%)",
        }}
      />

      <header className="relative flex items-center justify-between px-5 pt-6">
        <a
          href="/"
          className="flex items-center gap-2 text-[13px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)]"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-pink-500 to-emerald-500 text-[11px] font-bold text-white">
            A
          </div>
          AgileSuite
        </a>
        <a
          href="/app"
          className="hidden items-center gap-1 text-[12.5px] font-medium text-[var(--ds-text-muted)] hover:text-[var(--ds-text-primary)] sm:flex"
        >
          Animer une session
          <ArrowRight size={12} />
        </a>
      </header>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 pb-12 pt-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)]">
          <Sparkles size={20} className="text-indigo-300" />
        </div>
        <h1 className="mt-5 text-center text-[28px] font-semibold tracking-tight">
          Rejoindre une session
        </h1>
        <p className="mt-1.5 text-center text-[14px] text-[var(--ds-text-muted)]">
          Saisissez le code à 4 caractères partagé par l'animateur.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 sm:gap-2.5">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.currentTarget.select()}
              disabled={resolving}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={1}
              aria-label={`Caractère ${i + 1} du code`}
              className="ds-focus-ring h-14 w-11 rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface-1)] text-center font-mono text-2xl font-semibold text-[var(--ds-text-primary)] caret-indigo-400 transition focus:border-indigo-400/60 focus:bg-[var(--ds-surface-2)] disabled:opacity-50 sm:h-16 sm:w-12 sm:text-3xl"
              style={d ? { borderColor: "rgba(99,102,241,0.45)" } : undefined}
            />
          ))}
        </div>

        <div className="mt-4 h-5 text-center text-[13px]" aria-live="polite">
          {resolving ? (
            <span className="text-[var(--ds-text-muted)]">Recherche de la session…</span>
          ) : error ? (
            <span className="text-rose-300">{error}</span>
          ) : (
            <span className="text-[var(--ds-text-faint)]">
              Le code est saisi en majuscules, peu importe la casse
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!complete || resolving}
          onClick={() => resolve(code)}
          className="ds-focus-ring mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {resolving ? "Connexion…" : "Rejoindre"}
          {!resolving ? <ArrowRight size={14} /> : null}
        </button>

        <p className="mt-8 text-center text-[12px] text-[var(--ds-text-faint)]">
          Pas de code ?{" "}
          <a href="/app" className="underline hover:text-[var(--ds-text-muted)]">
            Lancez votre propre session
          </a>
        </p>
      </main>
    </div>
  );
}
