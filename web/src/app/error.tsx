"use client";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div className="rounded-md border border-loss/40 bg-card p-8">
      <p className="text-[11px] uppercase tracking-[0.2em] text-loss">Erro no painel</p>
      <h1 className="mt-2 text-2xl font-semibold">Não foi possível montar esta página</h1>
      <p className="mt-3 max-w-xl text-mist">
        {error.message?.includes("omitted in production")
          ? "O servidor falhou ao montar os dados. Tente atualizar; se persistir, o Neon pode estar acordando (primeira consulta) ou a sessão expirou — saia e entre de novo."
          : error.message}
      </p>
    </div>
  );
}
