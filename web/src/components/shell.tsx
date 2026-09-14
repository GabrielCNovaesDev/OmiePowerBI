import { BrandMark } from "./brand";
import { DashTabs, ReportNav } from "./nav";
import { FilterRail, type FilterOptions } from "./filters";

export function Shell({
  children,
  company,
  lastSync,
  filterOptions,
}: {
  children: React.ReactNode;
  company?: string | null;
  lastSync?: string | null;
  filterOptions?: FilterOptions | null;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-black/20 bg-header px-4 py-3">
        <div className="min-w-[168px]">
          <BrandMark />
        </div>
        <div className="min-w-0 flex-1">
          <DashTabs />
        </div>
        <div className="text-right text-[11px] text-white/60">
          <p className="text-white/80">{company || "Omie"}</p>
          <p>{lastSync ? `Atualizado ${lastSync}` : "Aguardando primeira carga"}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        <aside className="bg-header px-4 py-5 lg:min-h-[calc(100vh-64px)]">
          <ReportNav />
          <div className="mt-8">
            <FilterRail options={filterOptions} />
          </div>
        </aside>
        <main className="min-w-0 px-4 py-5 md:px-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-2">{kicker}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 max-w-3xl text-sm text-mist">{subtitle}</p> : null}
    </header>
  );
}
