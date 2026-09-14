"use client";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div className="rounded-xl border border-loss/40 bg-panel p-8">
      <p className="text-[11px] uppercase tracking-[0.2em] text-loss">Falha ao ler o banco</p>
      <h1 className="mt-2 font-serif text-3xl">Não foi possível montar o painel</h1>
      <p className="mt-3 max-w-xl text-mist">{error.message}</p>
      <p className="mt-4 text-sm text-mist">
        Confira se o schema está aplicado no Neon e se a carga `npm run load` já gravou dimensões e fatos.
      </p>
    </div>
  );
}
