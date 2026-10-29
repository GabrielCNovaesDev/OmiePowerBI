import { Wallet } from "lucide-react";
import { marcaBanco, marcaCliente, type Marca } from "@/lib/marcas";

// Selo decorativo ao lado do nome: o texto vizinho é o rótulo acessível.
export function MarcaSelo({ marca, size = 20 }: { marca: Marca; size?: number }) {
  if (marca.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={marca.logo}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        className="block shrink-0 rounded-[4px] bg-white object-contain ring-1 ring-black/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: marca.cor, fontSize: Math.round(size * 0.42) }}
    >
      {marca.sigla}
    </span>
  );
}

export function BancoNome({ codigo, nome }: { codigo?: string | null; nome: string }) {
  const marca = marcaBanco(codigo);
  return (
    <span className="inline-flex min-w-0 items-start gap-2 align-top">
      {marca ? (
        <MarcaSelo marca={marca} />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-paper text-mist ring-1 ring-black/10"
        >
          <Wallet size={12} />
        </span>
      )}
      <span className="min-w-0 leading-5">{nome}</span>
    </span>
  );
}

export function ClienteNome({ cnpj, nome }: { cnpj?: string | null; nome: string }) {
  const marca = marcaCliente(cnpj);
  if (!marca) return <span className="min-w-0 leading-5">{nome}</span>;
  return (
    <span className="inline-flex min-w-0 items-start gap-2 align-top" title={marca.nome}>
      <MarcaSelo marca={marca} />
      <span className="min-w-0 leading-5">{nome}</span>
    </span>
  );
}
