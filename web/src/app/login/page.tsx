import { Suspense } from "react";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-header px-4">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#32383f] p-8 shadow-xl">
        <BrandMark />
        <p className="mt-6 text-[11px] uppercase tracking-[0.18em] text-cyan-2">Acesso</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Entrar no Costa Novaes BI</h1>
        <p className="mt-2 text-sm text-white/60">Use o e-mail e a senha cadastrados pela equipe.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
