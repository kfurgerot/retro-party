import { Link } from "react-router-dom";
import { ArrowLeft, Construction } from "lucide-react";

type Props = {
  title: string;
  description: string;
  eta?: string;
};

export default function ComingSoon({ title, description, eta }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--ds-border)] bg-[var(--ds-surface-2)] text-[var(--ds-text-muted)]">
        <Construction size={22} />
      </div>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight text-[var(--ds-text-primary)]">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-[14px] text-[var(--ds-text-muted)]">{description}</p>
      {eta ? (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-3 py-1 text-[11.5px] font-medium uppercase tracking-wider text-[var(--ds-text-faint)]">
          {eta}
        </span>
      ) : null}
      <Link
        to="/app"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-1)] px-4 text-[13px] font-medium text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-2)] hover:text-[var(--ds-text-primary)]"
      >
        <ArrowLeft size={13} />
        Retour au dashboard
      </Link>
    </div>
  );
}
