import { Nav } from "./nav";

export function Shell({
  children,
  company,
  lastSync,
}: {
  children: React.ReactNode;
  company?: string | null;
  lastSync?: string | null;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[240px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-line bg-ink-2 px-5 py-8 flex flex-col gap-10">
        <div>
          <p className="font-serif text-2xl tracking-tight text-gold-2">Nexo</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-mist">Financeiro</p>
        </div>
        <Nav />
        <div className="mt-auto text-[11px] text-mist leading-relaxed">
          <p className="text-paper/80">{company || "Omie BI"}</p>
          {lastSync ? <p className="mt-1">Atualizado {lastSync}</p> : <p className="mt-1">Aguardando primeira carga</p>}
        </div>
      </aside>
      <main className="px-6 py-8 md:px-10 max-w-[1400px] w-full">{children}</main>
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
    <header className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{kicker}</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-2 text-mist max-w-2xl">{subtitle}</p> : null}
    </header>
  );
}
