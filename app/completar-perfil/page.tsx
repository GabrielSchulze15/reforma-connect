"use client";

import { useState, useEffect } from "react";
import { auth, db } from "../../src/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function CompletarPerfilPage() {
  const router = useRouter();

  const [nome, setNome]         = useState("");
  const [foto, setFoto]         = useState<string | null>(null);
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState("");

  // Carrega nome e foto já vindos do Google
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { router.push("/login"); return; }
    setNome(user.displayName ?? "");
    setFoto(user.photoURL ?? null);
  }, [router]);

  function formatarTelefone(valor: string) {
    const numeros = valor.replace(/\D/g, "").slice(0, 11);
    if (numeros.length <= 2)  return `(${numeros}`;
    if (numeros.length <= 7)  return `(${numeros.slice(0,2)}) ${numeros.slice(2)}`;
    if (numeros.length <= 11) return `(${numeros.slice(0,2)}) ${numeros.slice(2,7)}-${numeros.slice(7)}`;
    return valor;
  }

  async function handleSalvar() {
    if (!telefone || telefone.length < 14) { setErro("Informe um telefone válido."); return; }
    if (!endereco.trim())                  { setErro("Informe seu endereço."); return; }

    setLoading(true);
    setErro("");

    try {
      const user = auth.currentUser;
      if (!user) { router.push("/login"); return; }

      await updateDoc(doc(db, "users", user.uid), {
        telefone,
        endereco,
      });

      // Lê o tipo e redireciona para a dashboard certa
      const snap = await getDoc(doc(db, "users", user.uid));
      const tipo = snap.data()?.tipo;

      if (tipo === "admin")          router.push("/admin");
      else if (tipo === "prestador") router.push("/prestador");
      else                           router.push("/cliente");

    } catch {
      setErro("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handlePularPorAgora() {
    router.push("/cliente");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center">

      {/* SEÇÃO SUPERIOR — fundo bege */}
      <div className="w-full bg-[#f0ede6] flex flex-col items-center justify-center py-10 gap-3">
        <img src="/logo.png" alt="Logo" className="w-28" />

        {/* Foto vinda do Google */}
        <div className="relative">
          {foto ? (
            <img
              src={foto}
              alt="Foto de perfil"
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-orange-500 border-4 border-white shadow-sm flex items-center justify-center text-white text-2xl font-bold">
              {nome.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Badge de verificado */}
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <p className="text-base font-bold text-zinc-700">{nome}</p>
        <p className="text-xs text-zinc-400">Conta Google conectada ✓</p>
      </div>

      {/* SEÇÃO INFERIOR — formulário */}
      <div className="w-full max-w-sm px-6 pt-8 pb-10">

        {/* TÍTULO */}
        <h1 className="text-3xl font-bold text-zinc-700 mb-1">Quase lá!</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Só precisamos de mais alguns dados para completar seu cadastro.
        </p>

        {/* ERRO */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <p className="text-xs text-red-500">{erro}</p>
          </div>
        )}

        {/* INPUT TELEFONE */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <rect x="7" y="2" width="10" height="20" rx="2" ry="2" />
            <circle cx="12" cy="17" r="1" />
          </svg>
          <input
            type="tel"
            placeholder="Telefone / WhatsApp"
            value={telefone}
            onChange={e => setTelefone(formatarTelefone(e.target.value))}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* INPUT ENDEREÇO */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <input
            type="text"
            placeholder="Rua, número, bairro"
            value={endereco}
            onChange={e => setEndereco(e.target.value)}
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* INPUT CIDADE */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-3 mb-6">
          <svg className="w-5 h-5 text-zinc-400 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" />
            <path d="M9 22V12h6v10" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Cidade / Estado"
            className="flex-1 outline-none text-zinc-600 placeholder-zinc-400 bg-transparent text-sm"
          />
        </div>

        {/* BOTÃO SALVAR */}
        <button
          onClick={handleSalvar}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 active:scale-[0.98] transition text-white font-bold py-4 rounded-full text-base disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Concluir cadastro"}
        </button>

        {/* PULAR */}
        <button
          onClick={handlePularPorAgora}
          className="w-full text-center text-zinc-400 text-sm mt-4 hover:text-zinc-600 transition"
        >
          Preencher depois
        </button>

      </div>
    </div>
  );
}