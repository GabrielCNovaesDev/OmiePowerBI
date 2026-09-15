import { logoutAction } from "@/app/actions/auth";
import Link from "next/link";

export function SessionMenu({ name, papel, showAdmin }: { name: string; papel: string; showAdmin?: boolean }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-2">
      {showAdmin ? (
        <Link href="/admin" className="text-[11px] text-cyan hover:underline">
          Painel admin
        </Link>
      ) : null}
      <form action={logoutAction} className="flex items-center gap-2">
        <span className="max-w-[140px] truncate text-[10px] text-white/50">
          {name} · {papel}
        </span>
        <button type="submit" className="text-[11px] text-cyan hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}
