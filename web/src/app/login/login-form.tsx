"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function LoginForm() {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("error") ? "Não foi possível entrar. Verifique e-mail e senha." : null
  );
  const [pending, setPending] = useState(false);
  const callbackUrl = params.get("callbackUrl") || "/";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);
    if (result?.error) {
      setError("E-mail ou senha inválidos, ou usuário inativo.");
      return;
    }
    window.location.assign(result?.url || callbackUrl);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block text-sm text-white/80">
        E-mail
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-1 w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white outline-none focus:border-cyan"
        />
      </label>
      <label className="block text-sm text-white/80">
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded border border-white/20 bg-white/5 px-3 py-2 text-white outline-none focus:border-cyan"
        />
      </label>
      {error ? <p className="text-sm text-[#ffb4b4]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-cyan px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
