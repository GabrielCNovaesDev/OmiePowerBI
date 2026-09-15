import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { SessionMenu } from "@/components/session-menu";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "/admin", label: "Painel" },
  { href: "/admin/aplicativos", label: "Empresas Omie" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/sync", label: "Atualização" },
];

export function AdminShell({
  children,
  userName,
  papel,
  pathname,
}: {
  children: React.ReactNode;
  userName?: string | null;
  papel?: string | null;
  pathname: string;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-black/20 bg-header px-4 py-3">
        <BrandMark />
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                pathname === item.href
                  ? "border-cyan bg-cyan text-white"
                  : "border-white/20 text-white/80 hover:bg-white/10"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-right text-[11px] text-white/60">
          <Link href="/" className="text-cyan hover:underline">
            Voltar ao BI
          </Link>
          {userName ? <SessionMenu name={userName} papel={papel || ""} /> : null}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p className={`mb-4 rounded-md border px-3 py-2 text-sm ${error ? "border-loss/40 bg-loss/10 text-loss" : "border-gain/40 bg-gain/10 text-gain"}`}>
      {error || ok}
    </p>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded border border-line bg-white px-3 py-2"
      />
    </label>
  );
}
