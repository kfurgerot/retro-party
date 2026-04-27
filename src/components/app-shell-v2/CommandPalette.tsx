import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EXPERIENCES } from "@/design-system/tokens";
import { Sparkles, Settings2, LogIn, LayoutDashboard, ArrowRight } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] overflow-hidden border-[var(--ds-border)] bg-[var(--ds-bg-elevated)] p-0 text-[var(--ds-text-primary)]">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Recherche, lancement de session ou rejoindre par code.
        </DialogDescription>

        <Command
          label="Command palette"
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-[var(--ds-text-faint)]"
        >
          <Command.Input
            autoFocus
            placeholder="Rechercher une experience, une action…"
            className="h-12 w-full border-b border-[var(--ds-border)] bg-transparent px-4 text-[14px] text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-faint)] focus:outline-none"
          />
          <Command.List className="ds-scroll max-h-[420px] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-[13px] text-[var(--ds-text-faint)]">
              Aucun résultat.
            </Command.Empty>

            <Command.Group heading="Actions rapides">
              <PaletteItem
                icon={LogIn}
                onSelect={() => go("/join")}
                label="Rejoindre une session par code"
              />
              <PaletteItem
                icon={LayoutDashboard}
                onSelect={() => go("/app")}
                label="Aller au dashboard"
              />
              <PaletteItem
                icon={Sparkles}
                onSelect={() => go("/app/experiences")}
                label="Catalogue des experiences"
              />
            </Command.Group>

            <Command.Group heading="Lancer une session">
              {EXPERIENCES.map((exp) => (
                <PaletteItem
                  key={`launch-${exp.id}`}
                  icon={Sparkles}
                  label={`Lancer ${exp.label}`}
                  hint={exp.tagline}
                  color={exp.accent}
                  onSelect={() => go(exp.hostRoute)}
                />
              ))}
            </Command.Group>

            <Command.Group heading="Préparer une session">
              {EXPERIENCES.filter((e) => e.prepareRoute).map((exp) => (
                <PaletteItem
                  key={`prepare-${exp.id}`}
                  icon={Settings2}
                  label={`Préparer ${exp.label}`}
                  hint="Templates et configuration"
                  color={exp.accent}
                  onSelect={() => go(exp.prepareRoute!)}
                />
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-[var(--ds-border)] bg-[var(--ds-surface-0)] px-3 py-2 text-[11px] text-[var(--ds-text-faint)]">
            <span>↑↓ naviguer</span>
            <span>↵ sélectionner</span>
            <span>esc fermer</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

type PaletteItemProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  hint?: string;
  color?: string;
  onSelect: () => void;
};

function PaletteItem({ icon: Icon, label, hint, color, onSelect }: PaletteItemProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] text-[var(--ds-text-secondary)] aria-selected:bg-[var(--ds-surface-2)] aria-selected:text-[var(--ds-text-primary)]"
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ds-border)]"
        style={color ? { background: `${color}1a`, borderColor: `${color}55`, color } : undefined}
      >
        <Icon size={14} />
      </span>
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="hidden truncate text-[12px] text-[var(--ds-text-faint)] sm:block">
          {hint}
        </span>
      ) : null}
      <ArrowRight
        size={13}
        className="text-[var(--ds-text-faint)] opacity-0 transition group-aria-selected:opacity-100"
      />
    </Command.Item>
  );
}
