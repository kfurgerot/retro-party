import type { ReactNode } from "react";

export type PreGameShellProps = {
  accentRgb: string;
  children: ReactNode;
  /** Largeur max du contenu. Default: max-w-3xl */
  maxWidthClassName?: string;
};

/**
 * Shell partagé pour les écrans pre-game v2 (IdentityStep, SessionLobby).
 * - Background dark + halo accent en haut
 * - Container centré, flex-col, padding standard
 * - `ds-fade-in` à l'entrée
 *
 * À utiliser conjointement avec <PreGameStickyFooter /> pour une mise en page
 * où le footer prend sa place naturellement (pas de overlap, pas de pb-* hack).
 */
export function PreGameShell({
  accentRgb,
  children,
  maxWidthClassName = "max-w-3xl",
}: PreGameShellProps) {
  return (
    <div
      className="relative flex min-h-svh flex-col text-[var(--ds-text-primary)]"
      style={{ background: "var(--ds-bg)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] opacity-80"
        style={{
          background: `radial-gradient(60% 60% at 50% 0%, rgba(${accentRgb},0.16), transparent 70%)`,
        }}
      />
      <main
        className={`relative mx-auto flex w-full ${maxWidthClassName} flex-1 flex-col px-5 pt-8`}
      >
        <div className="ds-fade-in flex flex-1 flex-col">{children}</div>
      </main>
    </div>
  );
}

export type PreGameStickyFooterProps = {
  children: ReactNode;
};

/**
 * Footer "sticky bottom-0 mt-auto" — réserve son espace dans le flow,
 * colle en bas du viewport au scroll, ne chevauche jamais le contenu.
 *
 * Doit être utilisé comme dernier enfant de PreGameShell.
 */
export function PreGameStickyFooter({ children }: PreGameStickyFooterProps) {
  return (
    <div
      className="sticky bottom-0 z-30 -mx-5 mt-auto border-t border-[var(--ds-border)] backdrop-blur-md"
      style={{ background: "rgba(10,10,20,0.88)" }}
    >
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}
