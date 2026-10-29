import { Field, Flash } from "@/components/admin-ui";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { saveAplicativo, saveModulos } from "@/app/admin/actions";
import type { AplicativoRow } from "@/lib/admin-data";
import { MODULOS } from "@/lib/modulos";

export function AplicativoForm({
  existing,
  error,
  ok,
}: {
  existing?: AplicativoRow | null;
  error?: string;
  ok?: string;
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        kicker="Empresas Omie"
        title={existing ? `Editar ${existing.apelido}` : "Nova empresa"}
        subtitle="App Key e App Secret saem do Omie daquela empresa (Perfil → Aplicativos → API). O cadastro testa as chaves na hora."
      />
      <Flash ok={ok} error={error} />
      <Card>
        <form action={saveAplicativo} className="max-w-lg space-y-4">
          {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
          <Field label="Apelido no BI" name="apelido" required defaultValue={existing?.apelido} placeholder="Ex.: Instituto LM" />
          <Field label="App Key" name="app_key" required defaultValue={existing?.app_key} autoComplete="off" />
          <Field
            label={existing ? "App Secret (deixe em branco para manter)" : "App Secret"}
            name="app_secret"
            type="password"
            required={!existing}
            autoComplete="new-password"
            placeholder={existing ? "••••••••" : ""}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={existing ? existing.ativo : true} />
            Empresa ativa no BI
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sync_habilitado"
              defaultChecked={existing ? existing.sync_habilitado : true}
            />
            Incluir na atualização automática da madrugada
          </label>
          <button type="submit" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
            Testar na Omie e salvar
          </button>
        </form>
      </Card>
      {existing ? <ModulosForm existing={existing} /> : null}
    </div>
  );
}

function ModulosForm({ existing }: { existing: AplicativoRow }) {
  const desativados = new Set(existing.modulos_desativados ?? []);
  const grupos = ["Dashboards", "Relatórios"] as const;
  return (
    <Card>
      <h2 className="font-semibold">Telas desta empresa</h2>
      <p className="mb-4 mt-1 text-sm text-mist">
        Desmarque o que não faz sentido para o negócio dela. A tela some do menu e o endereço direto deixa de
        abrir. O Resumo fica sempre ligado. Na visão consolidada de várias empresas, uma tela desligada em
        qualquer uma delas fica oculta.
      </p>
      <form action={saveModulos} className="space-y-5">
        <input type="hidden" name="id" value={existing.id} />
        {grupos.map((grupo) => (
          <fieldset key={grupo}>
            <legend className="mb-2 text-[11px] uppercase tracking-[0.14em] text-mist">{grupo}</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MODULOS.filter((m) => m.grupo === grupo).map((m) => (
                <label key={m.id} className="flex items-start gap-2 rounded border border-line px-3 py-2 text-sm hover:border-cyan">
                  <input type="checkbox" name="modulo" value={m.id} defaultChecked={!desativados.has(m.id)} className="mt-0.5" />
                  <span>
                    {m.label}
                    {m.descricao ? <span className="block text-xs text-mist">{m.descricao}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
          Salvar telas
        </button>
      </form>
    </Card>
  );
}
