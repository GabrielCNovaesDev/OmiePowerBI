import { Field, Flash } from "@/components/admin-ui";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { saveAplicativo } from "@/app/admin/actions";
import type { AplicativoRow } from "@/lib/admin-data";

export function AplicativoForm({
  existing,
  error,
}: {
  existing?: AplicativoRow | null;
  error?: string;
}) {
  return (
    <div>
      <PageHeader
        kicker="Empresas Omie"
        title={existing ? `Editar ${existing.apelido}` : "Nova empresa"}
        subtitle="App Key e App Secret saem do Omie daquela empresa (Perfil → Aplicativos → API). O cadastro testa as chaves na hora."
      />
      <Flash error={error} />
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
    </div>
  );
}
