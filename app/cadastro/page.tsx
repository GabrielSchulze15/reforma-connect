"use client";

import { useState, useRef } from "react";
import { auth, provider, db } from "../../src/lib/firebase";
import { signInWithPopup, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CadastroPage() {
  const router = useRouter();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [nome, setNome]               = useState("");
  const [email, setEmail]             = useState("");
  const [senha, setSenha]             = useState("");
  const [confirmar, setConfirmar]     = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [mostrarSenha, setMostrarSenha]         = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState("");

  // ─── Foto ────────────────────────────────────────────────────────────────────

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Validação ────────────────────────────────────────────────────────────────

  function validar() {
    if (!nome.trim())              return "Informe seu nome completo.";
    if (!email.trim())             return "Informe seu e-mail.";
    if (senha.length < 6)          return "A senha deve ter pelo menos 6 caracteres.";
    if (senha !== confirmar)        return "As senhas não coincidem.";
    return null;
  }

  // ─── Cadastro com e-mail ──────────────────────────────────────────────────────

  async function handleCadastrar() {
    const erroValidacao = validar();
    if (erroValidacao) { setErro(erroValidacao); return; }

    setLoading(true);
    setErro("");

    try {
      const result = await createUserWithEmailAndPassword(auth, email, senha);
      const user = result.user;

      await updateProfile(user, { displayName: nome });

      await setDoc(doc(db, "users", user.uid), {
        nome,
        email,
        foto:      fotoPreview ?? null,
        tipo:      "cliente",
        aprovado:  false,
        criadoEm: serverTimestamp(),
      });

      router.push("/cliente");
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code;
      if (msg === "auth/email-already-in-use") setErro("Este e-mail já está cadastrado.");
      else if (msg === "auth/invalid-email")   setErro("E-mail inválido.");
      else                                      setErro("Erro ao criar conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Cadastro com Google ──────────────────────────────────────────────────────

  async function handleGoogleCadastro() {
    setLoading(true);
    setErro("");
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      await setDoc(doc(db, "users", user.uid), {
        nome:      user.displayName,
        email:     user.email,
        foto:      user.photoURL,
        tipo:      "cliente",
        aprovado:  false,
        criadoEm: serverTimestamp(),
      }, { merge: true });

      router.push("/cliente");
    } catch {
      setErro("Erro ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">

      {/* SEÇÃO SUPERIOR — fundo bege com logo + foto */}
      <div className="w-full bg-[#f0ede6] flex flex-col items-center justify-center py-10 gap-4">
        <img src="/logo.png" alt="Logo" className="w-32" />

        {/* Avatar / foto */}
        <button
          onClick={() => inputFotoRef.current?.click()}
          className="relative w-20 h-20 rounded-full bg-white border-2 border-orange-400 flex items-center justify-center overflow-hidden shadow-sm hover:opacity-90 transition"
        >
          {fotoPreview ? (
            <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[9px] text-orange-400 font-medium">Adicionar foto</span>
            </div>
          )}

          {/* Ícone de câmera sobre a foto */}
          {fotoPreview && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
          )}
        </button>
        <p className="text-xs text-zinc-400">Toque para adicionar sua foto</p>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFotoChange}
        />
      </div>

      {/* SEÇÃO INFERIOR — formulário */}
      <div className="w-full max-w-sm px-6 pt-8 pb-10">

        {/* TÍTULO */}
        <h1 className="text-4xl font-bold text-zinc-700 mb-2">Criar conta</h1>
        <p className="text-sm text-zinc-400 mb-6">Preencha os dados para se cadastrar.</p>

        {/* ERRO */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-red-500">{erro}</p>
          </div>
        )}

        {/* INPUT NOME */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <input
            type="text"
            placeholder="Nome completo"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* INPUT EMAIL */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
            <circle cx="12" cy="17" r="1" />
          </svg>
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* INPUT SENHA */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <input
            type={mostrarSenha ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
          <button onClick={() => setMostrarSenha(v => !v)} className="ml-2 shrink-0">
            {mostrarSenha ? (
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* INPUT CONFIRMAR SENHA */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-6">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
            <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" />
          </svg>
          <input
            type={mostrarConfirmar ? "text" : "password"}
            placeholder="Confirmar senha"
            value={confirmar}
            onChange={e => setConfirmar(e.target.value)}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
          <button onClick={() => setMostrarConfirmar(v => !v)} className="ml-2 shrink-0">
            {mostrarConfirmar ? (
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* BOTÃO CADASTRAR */}
        <button
          onClick={handleCadastrar}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition text-white font-bold py-4 rounded-full text-base disabled:opacity-60"
        >
          {loading ? "Criando conta..." : "Criar conta"}
        </button>

        {/* DIVISOR */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-[1px] bg-zinc-200" />
          <span className="text-zinc-400 text-sm">ou</span>
          <div className="flex-1 h-[1px] bg-zinc-200" />
        </div>

        {/* BOTÃO GOOGLE */}
        <button
          onClick={handleGoogleCadastro}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-zinc-200 rounded-full py-4 text-zinc-700 text-sm font-medium hover:bg-zinc-50 active:scale-[0.98] transition disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continuar com Google
        </button>

        {/* TERMOS */}
        <p className="text-center text-zinc-400 text-xs mt-5 leading-relaxed px-2">
          Ao criar conta, você concorda com os{" "}
          <span className="text-orange-500 font-medium cursor-pointer">Termos de Uso</span>
          {" "}e o{" "}
          <span className="text-orange-500 font-medium cursor-pointer">Contrato Digital</span>.
        </p>

        {/* JÁ TEM CONTA */}
        <p className="text-center text-zinc-500 text-sm mt-4">
          Já tem conta?{" "}
          <span
            onClick={() => router.push("/login")}
            className="text-orange-500 font-bold cursor-pointer"
          >
            Entrar
          </span>
        </p>

      </div>
    </div>
  );
}