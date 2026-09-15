import { Field, Flash } from "@/components/admin-ui";
import { PageHeader } from "@/components/shell";
import { Card } from "@/components/ui";
import { saveUsuario } from "@/app/admin/actions";
import type { AplicativoRow } from "@/lib/admin-data";

export function UsuarioForm({
  existing,
  apps,
  error,
}: {
  existing?: {
    id: string;
    nome: string;
    email: string;
    papel: string;
    ativo: boolean;
    aplicativoIds: string[];
  } | null;
  apps: AplicativoRow[];
  error?: string;
}) {
  return (
    <div>
      <PageHeader
        kicker="Usuários"
        title={existing ? `Editar ${existing.nome}` : "Novo usuário"}
        subtitle="Interno = time Costa Novaes (todas as empresas). Cliente = só as empresas marcadas abaixo."
      />
      <Flash error={error} />
      <Card>
        <form action={saveUsuario} className="max-w-lg space-y-4">
          {existing ? <input type="hidden" name="id" value={existing.id} /> : null}
          <Field label="Nome" name="nome" required defaultValue={existing?.nome} />
          <Field label="E-mail" name="email" type="email" required defaultValue={existing?.email} />
          <Field
            label={existing ? "Nova senha (opcional)" : "Senha (mínimo 10)"}
            name="password"
            type="password"
            required={!existing}
            autoComplete="new-password"
          />
          <label className="block text-sm">
            Papel
            <select name="papel" defaultValue={existing?.papel || "cliente"} className="mt-1 w-full rounded border border-line bg-white px-3 py-2">
              <option value="admin">Admin — gerencia a plataforma</option>
              <option value="interno">Interno — vê todas as empresas no BI</option>
              <option value="cliente">Cliente — só as empresas marcadas</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativo" defaultChecked={existing ? existing.ativo : true} />
            Usuário ativo
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Empresas (obrigatório para cliente)</legend>
            {apps.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="apps"
                  value={a.id}
                  defaultChecked={existing?.aplicativoIds.includes(a.id)}
                />
                {a.apelido}
              </label>
            ))}
            {!apps.length ? <p className="text-sm text-mist">Cadastre uma empresa Omie antes de criar um cliente.</p> : null}
          </fieldset>
          <button type="submit" className="rounded bg-cyan px-4 py-2 text-sm font-semibold text-white">
            Salvar usuário
          </button>
        </form>
      </Card>
    </div>
  );
}
