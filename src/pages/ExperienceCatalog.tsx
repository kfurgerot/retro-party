import { useEffect, useMemo, useState } from "react";
import { api, type DashboardActivitiesResponse } from "@/net/api";
import { EXPERIENCE_CATEGORIES, EXPERIENCES } from "@/design-system/tokens";
import { ExperienceCard } from "@/components/app-shell-v2/ExperienceCard";

export default function ExperienceCatalog() {
  const [data, setData] = useState<DashboardActivitiesResponse | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getDashboardActivities()
      .then((res) => {
        if (alive) setData(res);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, { totalActivities: number; lastActivityAt: string | null }>();
    data?.modules.forEach((m) =>
      map.set(m.moduleId, {
        totalActivities: m.totalActivities,
        lastActivityAt: m.lastActivityAt,
      }),
    );
    return map;
  }, [data]);

  return (
    <div className="space-y-10 pb-12">
      <header className="flex flex-col gap-1.5">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-[var(--ds-text-faint)]">
          Experiences
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ds-text-primary)] sm:text-[32px]">
          Choisissez votre rituel
        </h1>
        <p className="max-w-2xl text-[14px] text-[var(--ds-text-muted)]">
          Quatre intentions, une suite. Chaque experience peut être lancée à la volée ou préparée à
          l'avance avec un template.
        </p>
      </header>

      <div className="space-y-12">
        {EXPERIENCE_CATEGORIES.map((cat) => {
          const items = EXPERIENCES.filter((e) => e.category === cat.id);
          if (!items.length) return null;
          return (
            <section key={cat.id}>
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: `rgb(${cat.rgb})` }} />
                <h2 className="text-[15px] font-semibold text-[var(--ds-text-primary)]">
                  {cat.label}
                </h2>
                <span className="text-[12.5px] text-[var(--ds-text-faint)]">— {cat.tagline}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {items.map((exp) => {
                  const s = stats.get(exp.id);
                  return (
                    <ExperienceCard
                      key={exp.id}
                      experience={exp}
                      totalActivities={s?.totalActivities ?? 0}
                      lastActivityAt={s?.lastActivityAt ?? null}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
