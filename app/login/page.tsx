"use client";

import { useState } from "react";
import { auth, provider, db } from "../../src/lib/firebase";
import { signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [erro, setErro]       = useState("");
  const [loading, setLoading] = useState(false);

  // ─── Redireciona conforme o tipo do usuário ───────────────────────────────
  async function redirecionarPorTipo(uid: string) {
    const snap = await getDoc(doc(db, "users", uid));
    const tipo = snap.data()?.tipo;

    if (tipo === "admin")          router.push("/admin");
    else if (tipo === "prestador") router.push("/prestador");
    else                           router.push("/cliente");
  }

  // ─── Login com e-mail e senha ─────────────────────────────────────────────
  async function handleEmailLogin() {
    if (!email.trim() || !senha.trim()) {
      setErro("Preencha o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const result = await signInWithEmailAndPassword(auth, email, senha);
      await redirecionarPorTipo(result.user.uid);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErro("E-mail ou senha incorretos.");
      } else if (code === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else {
        setErro("Erro ao entrar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ─── Login com Google ─────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    setLoading(true);
    setErro("");

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(doc(db, "users", user.uid), {
        nome:  user.displayName,
        email: user.email,
        foto:  user.photoURL,
        tipo:  "cliente",
      }, { merge: true });

      await redirecionarPorTipo(user.uid);
    } catch {
      setErro("Erro ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">

      {/* SEÇÃO SUPERIOR — fundo bege com logo */}
      <div className="w-full bg-[#f0ede6] flex items-center justify-center py-12">
        <img src="/logo.png" alt="Logo" className="w-44" />
      </div>

      {/* SEÇÃO INFERIOR — formulário */}
      <div className="w-full max-w-sm px-6 pt-8 pb-10">

        {/* TÍTULO */}
        <h1 className="text-4xl font-bold text-zinc-700 mb-6">Olá!</h1>

        {/* ERRO */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-red-500">{erro}</p>
          </div>
        )}

        {/* INPUT EMAIL */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
            <circle cx="12" cy="17" r="1" />
          </svg>
          <input
            type="text"
            placeholder="E-mail ou telefone"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEmailLogin()}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* INPUT SENHA */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-2">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEmailLogin()}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* ESQUECEU SENHA */}
        <p className="text-right text-orange-500 text-sm mb-6 cursor-pointer">
          Esqueceu sua senha?
        </p>

        {/* BOTÃO ENTRAR */}
        <button
          onClick={handleEmailLogin}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition text-white font-bold py-4 rounded-full text-base disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {/* DIVISOR */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-zinc-200" />
          <span className="text-zinc-400 text-sm">ou</span>
          <div className="flex-1 h-[1px] bg-zinc-200" />
        </div>

        {/* BOTÃO GOOGLE */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-zinc-200 rounded-full py-4 text-zinc-700 text-sm font-medium hover:bg-zinc-50 active:scale-[0.98] transition disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Entrar com Google
        </button>

        {/* CRIAR CONTA */}
        <p className="text-center text-zinc-500 text-sm mt-6">
          Nao tem conta?{" "}
          <span
            onClick={() => router.push("/cadastro")}
            className="text-orange-500 font-bold cursor-pointer"
          >
            Criar Conta
          </span>
        </p>

      </div>
    </div>
  );
}