"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "../../src/lib/firebase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NavId = "inicio" | "pedidos" | "chat" | "historico" | "perfil";

type CategoriaServico = {
  id: string;
  emoji: string;
  label: string;
};

type StatusPedido = "aguardando_prestador" | "negociando" | "aguardando_pagamento" | "em_andamento" | "concluido" | "cancelado";

type Pedido = {
  id: string;
  tipo: string;
  emoji: string;
  prestador?: string;
  iniciais?: string;
  valor?: number;
  status: StatusPedido;
  data: string;
  endereco: string;
};

type MensagemChat = {
  id: string;
  texto: string;
  de: "cliente" | "prestador" | "sistema";
  hora: string;
};

// ─── Dados mockados (substituir por Firestore) ────────────────────────────────

const categoriasMock: CategoriaServico[] = [
  { id: "piso",    emoji: "🪵", label: "Piso"     },
  { id: "chuveiro",emoji: "🚿", label: "Chuveiro" },
  { id: "torneira",emoji: "🚰", label: "Torneira" },
  { id: "pintura", emoji: "🎨", label: "Pintura"  },
  { id: "armario", emoji: "🗄️", label: "Armário"  },
  { id: "outro",   emoji: "➕", label: "Outro"    },
];

const pedidoAtivo: Pedido = {
  id: "p1",
  tipo: "Piso vinílico",
  emoji: "🪵",
  prestador: "João Carlos",
  iniciais: "JC",
  valor: 400,
  status: "em_andamento",
  data: "Hoje, 09:15",
  endereco: "Rua das Flores, 142",
};

const historicoMock: Pedido[] = [
  { id: "h1", tipo: "Pintura sala",       emoji: "🎨", prestador: "Carlos M.", iniciais: "CM", valor: 320, status: "concluido",  data: "15/05/2025", endereco: "Rua das Flores, 142" },
  { id: "h2", tipo: "Chuveiro elétrico",  emoji: "🚿", prestador: "Marcos T.", iniciais: "MT", valor: 180, status: "concluido",  data: "02/05/2025", endereco: "Rua das Flores, 142" },
  { id: "h3", tipo: "Montagem armário",   emoji: "🗄️", prestador: "Pedro R.",  iniciais: "PR", valor: 250, status: "cancelado",  data: "28/04/2025", endereco: "Rua das Flores, 142" },
];

const mensagensMock: MensagemChat[] = [
  { id: "m0", texto: "Pedido enviado para prestadores próximos.", de: "sistema",   hora: "09:00" },
  { id: "m1", texto: "Olá! Aceito o serviço. Posso ir às 14h, tudo bem?",          de: "prestador", hora: "09:05" },
  { id: "m2", texto: "Ótimo! Qual o valor que você cobra?",                         de: "cliente",   hora: "09:06" },
  { id: "m3", texto: "Para 20m² de piso vinílico fico com R$400 incluindo mão de obra.", de: "prestador", hora: "09:07" },
  { id: "m4", texto: "Combinado! Vou efetuar o pagamento agora.",                   de: "cliente",   hora: "09:08" },
  { id: "m5", texto: "Pagamento confirmado. Até às 14h!", de: "sistema",            hora: "09:09" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badgePedido(status: StatusPedido) {
  const map: Record<StatusPedido, { bg: string; text: string; label: string }> = {
    aguardando_prestador: { bg: "bg-orange-100", text: "text-orange-600", label: "Buscando prestador" },
    negociando:           { bg: "bg-yellow-100", text: "text-yellow-700", label: "Negociando"         },
    aguardando_pagamento: { bg: "bg-blue-100",   text: "text-blue-600",   label: "Aguard. pagamento"  },
    em_andamento:         { bg: "bg-green-100",  text: "text-green-600",  label: "Em andamento"       },
    concluido:            { bg: "bg-zinc-100",   text: "text-zinc-500",   label: "Concluído"          },
    cancelado:            { bg: "bg-red-100",    text: "text-red-500",    label: "Cancelado"          },
  };
  return map[status];
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Avatar({
  iniciais,
  cor = "bg-orange-500",
  size = "w-10 h-10",
}: {
  iniciais: string;
  cor?: string;
  size?: string;
}) {
  return (
    <div className={`${size} rounded-full ${cor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
      {iniciais}
    </div>
  );
}

// ─── Modal de nova solicitação ────────────────────────────────────────────────

function ModalNovoServico({
  categoria,
  onFechar,
  onEnviar,
}: {
  categoria: CategoriaServico;
  onFechar: () => void;
  onEnviar: (descricao: string, endereco: string) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco]   = useState("");

  function handleEnviar() {
    if (!descricao.trim() || !endereco.trim()) return;
    onEnviar(descricao, endereco);
    onFechar();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onFechar} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 bg-white rounded-t-3xl p-6 flex flex-col gap-4">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-2" />

        {/* Título */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">{categoria.emoji}</span>
          <div>
            <p className="text-base font-bold text-zinc-800">Solicitar {categoria.label}</p>
            <p className="text-xs text-zinc-400">Preencha os detalhes do serviço</p>
          </div>
        </div>

        {/* Endereço */}
        <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 gap-2">
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          <input
            value={endereco}
            onChange={e => setEndereco(e.target.value)}
            placeholder="Endereço do serviço"
            className="flex-1 text-sm text-zinc-600 outline-none placeholder-zinc-400 bg-transparent"
          />
        </div>

        {/* Descrição */}
        <textarea
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder={`Descreva o serviço de ${categoria.label.toLowerCase()}...`}
          rows={3}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-600 placeholder-zinc-400 outline-none resize-none"
        />

        <p className="text-[11px] text-zinc-400 text-center -mt-1">
          Seu pedido será enviado para prestadores próximos. O primeiro a aceitar inicia a negociação.
        </p>

        {/* Botões */}
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-3 rounded-full border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={!descricao.trim() || !endereco.trim()}
            className="flex-1 py-3 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition disabled:opacity-40"
          >
            Enviar pedido
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Modal confirmar conclusão ────────────────────────────────────────────────

function ModalConfirmarConclusao({
  pedido,
  onFechar,
  onConfirmar,
}: {
  pedido: Pedido;
  onFechar: () => void;
  onConfirmar: () => void;
}) {
  const [avaliacao, setAvaliacao] = useState(5);
  const [comentario, setComentario] = useState("");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onFechar} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 bg-white rounded-t-3xl p-6 flex flex-col gap-4">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-2" />

        <div className="text-center">
          <span className="text-3xl">{pedido.emoji}</span>
          <p className="text-base font-bold text-zinc-800 mt-2">Serviço concluído?</p>
          <p className="text-xs text-zinc-400 mt-1">
            Confirme apenas se o serviço foi realizado com sucesso. O pagamento de{" "}
            <span className="font-semibold text-zinc-600">R${pedido.valor},00</span> será liberado para {pedido.prestador}.
          </p>
        </div>

        {/* Avaliação */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-500">Avalie o prestador</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setAvaliacao(n)}
                className={`text-2xl transition ${n <= avaliacao ? "opacity-100" : "opacity-30"}`}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        {/* Comentário */}
        <textarea
          value={comentario}
          onChange={e => setComentario(e.target.value)}
          placeholder="Deixe um comentário (opcional)..."
          rows={2}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3 text-sm text-zinc-600 placeholder-zinc-400 outline-none resize-none"
        />

        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-3 rounded-full border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition"
          >
            Ainda não
          </button>
          <button
            onClick={() => { onConfirmar(); onFechar(); }}
            className="flex-1 py-3 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700 active:scale-[0.98] transition"
          >
            Confirmar conclusão
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Seções ───────────────────────────────────────────────────────────────────

function SecaoInicio({
  pedidoAtual,
  onConfirmarConclusao,
  onAbrirChat,
  onSolicitarServico,
}: {
  pedidoAtual: Pedido | null;
  onConfirmarConclusao: () => void;
  onAbrirChat: () => void;
  onSolicitarServico: (cat: CategoriaServico) => void;
}) {
  return (
    <div className="flex flex-col gap-5">

      {/* Card serviço ativo */}
      {pedidoAtual && (
        <div className="bg-orange-500 rounded-2xl p-4 text-white">
          <p className="text-xs opacity-80 mb-1">Serviço em andamento</p>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{pedidoAtual.emoji}</span>
            <div className="flex-1">
              <p className="text-base font-bold">{pedidoAtual.tipo}</p>
              <p className="text-xs opacity-80">{pedidoAtual.prestador} · Iniciado às 09:15</p>
            </div>
            <p className="text-lg font-bold">R${pedidoAtual.valor}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAbrirChat}
              className="flex-1 py-2.5 rounded-full border border-white/30 bg-white/15 text-white text-xs font-medium hover:bg-white/25 transition"
            >
              Ver chat
            </button>
            <button
              onClick={onConfirmarConclusao}
              className="flex-1 py-2.5 rounded-full bg-white text-orange-500 text-xs font-semibold hover:bg-orange-50 transition"
            >
              Confirmar conclusão
            </button>
          </div>
        </div>
      )}

      {/* Solicitar serviço */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Solicitar serviço</p>
        <div className="grid grid-cols-3 gap-2">
          {categoriasMock.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSolicitarServico(cat)}
              className={`flex flex-col items-center py-3 rounded-2xl border transition active:scale-[0.97] ${
                cat.id === "outro"
                  ? "border-dashed border-orange-300 bg-orange-50 hover:bg-orange-100"
                  : "border-zinc-200 bg-zinc-50 hover:border-orange-300 hover:bg-orange-50"
              }`}
            >
              <span className="text-2xl mb-1">{cat.emoji}</span>
              <span className={`text-xs font-medium ${cat.id === "outro" ? "text-orange-500" : "text-zinc-600"}`}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Histórico recente */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Recentes</p>
        <div className="flex flex-col gap-2">
          {historicoMock.slice(0, 2).map(p => {
            const badge = badgePedido(p.status);
            return (
              <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-700 truncate">{p.tipo}</p>
                  <p className="text-[10px] text-zinc-400">{p.prestador} · R${p.valor}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SecaoPedidos() {
  const todos = pedidoAtivo ? [pedidoAtivo, ...historicoMock] : historicoMock;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Meus pedidos</p>
      {todos.map(p => {
        const badge = badgePedido(p.status);
        return (
          <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
                {p.emoji}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-700">{p.tipo}</p>
                <p className="text-[10px] text-zinc-400">{p.data} · {p.endereco}</p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <div className="flex items-center gap-2">
                {p.iniciais && (
                  <Avatar iniciais={p.iniciais} cor="bg-zinc-200" size="w-6 h-6" />
                )}
                <p className="text-xs text-zinc-500">{p.prestador ?? "Aguardando prestador"}</p>
              </div>
              {p.valor && (
                <p className="text-sm font-bold text-zinc-700">R$ {p.valor},00</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SecaoChat() {
  const [mensagens, setMensagens] = useState<MensagemChat[]>(mensagensMock);
  const [texto, setTexto]         = useState("");

  function handleEnviar() {
    if (!texto.trim()) return;
    const nova: MensagemChat = {
      id:    `m${Date.now()}`,
      texto: texto.trim(),
      de:    "cliente",
      hora:  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMensagens(prev => [...prev, nova]);
    setTexto("");
    // TODO: salvar no Firestore na coleção chats/{pedidoId}/mensagens
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header do chat */}
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-zinc-100">
        <Avatar iniciais="JC" cor="bg-zinc-700" />
        <div>
          <p className="text-sm font-semibold text-zinc-700">João Carlos</p>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <p className="text-[10px] text-zinc-400">Online agora</p>
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto pb-4">
        {mensagens.map(m => {
          if (m.de === "sistema") {
            return (
              <p key={m.id} className="text-center text-[10px] text-zinc-400 bg-zinc-50 rounded-full px-3 py-1.5 mx-auto">
                {m.texto}
              </p>
            );
          }
          const ehCliente = m.de === "cliente";
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${ehCliente ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                ehCliente
                  ? "bg-orange-500 text-white rounded-br-sm"
                  : "bg-zinc-100 text-zinc-700 rounded-bl-sm"
              }`}>
                {m.texto}
              </div>
              <p className="text-[9px] text-zinc-300">{m.hora}</p>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEnviar()}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-sm text-zinc-600 placeholder-zinc-400 outline-none"
        />
        <button
          onClick={handleEnviar}
          disabled={!texto.trim()}
          className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 active:scale-[0.95] transition disabled:opacity-40"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function SecaoHistorico() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Histórico completo</p>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Serviços",  valor: "7"      },
          { label: "Gasto",     valor: "R$1.4k" },
          { label: "Avaliações",valor: "⭐ 4.8"  },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 text-center">
            <p className="text-base font-bold text-zinc-700">{s.valor}</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {historicoMock.map(p => {
        const badge = badgePedido(p.status);
        return (
          <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
                {p.emoji}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-700">{p.tipo}</p>
                <p className="text-[10px] text-zinc-400">{p.data}</p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <p className="text-xs text-zinc-500">{p.prestador}</p>
              <p className="text-sm font-bold text-zinc-700">R$ {p.valor},00</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SecaoPerfil() {
  const [usuario, setUsuario]       = useState<{ nome: string; email: string; foto: string | null } | null>(null);
  const [editando, setEditando]     = useState(false);
  const [novoNome, setNovoNome]     = useState("");
  const [salvando, setSalvando]     = useState(false);
  const [sucesso, setSucesso]       = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setUsuario({
      nome:  user.displayName ?? "",
      email: user.email ?? "",
      foto:  user.photoURL,
    });
    setNovoNome(user.displayName ?? "");
  }, []);

  async function handleSalvar() {
    const user = auth.currentUser;
    if (!user || !novoNome.trim()) return;
    setSalvando(true);
    try {
      await updateProfile(user, { displayName: novoNome });
      await updateDoc(doc(db, "users", user.uid), { nome: novoNome });
      setUsuario(prev => prev ? { ...prev, nome: novoNome } : prev);
      setEditando(false);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    } catch {
      alert("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleSair() {
    await auth.signOut();
    document.cookie = "firebaseToken=; path=/; max-age=0";
    router.push("/login");
  }

  const iniciais = usuario?.nome
    ? usuario.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <div className="flex flex-col gap-5">
      {/* Card do usuário */}
      <div className="flex flex-col items-center py-6 bg-[#f0ede6] rounded-2xl gap-3">
        {usuario?.foto ? (
          <img src={usuario.foto} alt="Foto" className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
            {iniciais}
          </div>
        )}
        <div className="text-center">
          <p className="text-base font-bold text-zinc-800">{usuario?.nome ?? "..."}</p>
          <p className="text-xs text-zinc-500">{usuario?.email ?? ""}</p>
        </div>
        <button
          onClick={() => setEditando(true)}
          className="px-5 py-2 rounded-full border border-zinc-300 bg-white text-xs text-zinc-600 hover:bg-zinc-50 transition"
        >
          Editar perfil
        </button>
      </div>

      {/* Sucesso */}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <p className="text-xs text-green-600 text-center">✅ Perfil atualizado com sucesso!</p>
        </div>
      )}

      {/* Modal de edição */}
      {editando && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setEditando(false)} />
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 bg-white rounded-t-3xl p-6 flex flex-col gap-4">
            <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-2" />
            <p className="text-base font-bold text-zinc-800">Editar perfil</p>

            <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 gap-2">
              <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                value={novoNome}
                onChange={e => setNovoNome(e.target.value)}
                placeholder="Seu nome"
                className="flex-1 text-sm text-zinc-600 outline-none placeholder-zinc-400 bg-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditando(false)}
                className="flex-1 py-3 rounded-full border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando || !novoNome.trim()}
                className="flex-1 py-3 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Opções */}
      <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
        {[
          { emoji: "📍", label: "Meus endereços"         },
          { emoji: "💳", label: "Pagamentos"              },
          { emoji: "🔔", label: "Notificações"            },
          { emoji: "📄", label: "Contrato digital"        },
          { emoji: "🎧", label: "Suporte"                 },
          { emoji: "🔒", label: "Privacidade e segurança" },
        ].map((item, i) => (
          <button key={i} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition text-left">
            <span className="text-lg">{item.emoji}</span>
            <p className="flex-1 text-sm text-zinc-700">{item.label}</p>
            <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>

      <button
        onClick={handleSair}
        className="w-full py-3.5 rounded-full border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition"
      >
        Sair da conta
      </button>
    </div>
  );
}

// ─── Navegação inferior ───────────────────────────────────────────────────────

const navItems: { id: NavId; label: string; path: string }[] = [
  { id: "inicio",    label: "Início",    path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id: "pedidos",   label: "Pedidos",   path: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
  { id: "chat",      label: "Chat",      path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "historico", label: "Histórico", path: "M12 8v4l3 3M3.05 11a9 9 0 1 0 .5-3M3 4v4h4" },
  { id: "perfil",    label: "Perfil",    path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardCliente() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);  // ← adiciona aqui
  const [navAtiva, setNavAtiva]               = useState<NavId>("inicio");
  const [pedidoEmAndamento, setPedidoEmAndamento] = useState<Pedido | null>(pedidoAtivo);
  const [categoriaModal, setCategoriaModal]   = useState<CategoriaServico | null>(null);
  const [mostrarConclusao, setMostrarConclusao] = useState(false);

  // ─── Proteção de rota ─────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setCarregando(false);  // ← usuário logado, libera a tela
      }
    });
    return () => unsub();
  }, [router]);

  // Segura a tela enquanto verifica o login
  if (carregando) return null;  // ← adiciona aqui, antes do titulos

const titulos: Record<NavId, string> = {
  inicio:    `Olá, ${auth.currentUser?.displayName?.split(" ")[0] ?? ""}! 👋`,
  pedidos:   "Meus pedidos",
  chat:      "Chat",
  historico: "Histórico",
  perfil:    "Perfil",
};

  function handleNovoServico(descricao: string, endereco: string) {
    // TODO: criar pedido no Firestore e notificar prestadores próximos
    console.log("Novo pedido:", descricao, endereco);
    alert("Pedido enviado! Aguardando prestadores.");
  }

  function handleConfirmarConclusao() {
    // TODO: atualizar status no Firestore e liberar pagamento
    setPedidoEmAndamento(null);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto">

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div className="bg-[#f0ede6] px-4 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">
              {navAtiva === "inicio" ? "Bem-vinda de volta," : ""}
            </p>
            <h1 className="text-xl font-bold text-zinc-700">{titulos[navAtiva]}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M15 17H5a2 2 0 0 1-1.7-3L4 13V11a8 8 0 0 1 16 0v2l.7 1a2 2 0 0 1-1.7 3h-4z" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {/* Badge de notificação */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#f0ede6]" />
            </button>
            <Avatar iniciais={
              auth.currentUser?.displayName
              ?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?"
            } />
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {navAtiva === "inicio" && (
          <SecaoInicio
            pedidoAtual={pedidoEmAndamento}
            onConfirmarConclusao={() => setMostrarConclusao(true)}
            onAbrirChat={() => setNavAtiva("chat")}
            onSolicitarServico={cat => setCategoriaModal(cat)}
          />
        )}
        {navAtiva === "pedidos"   && <SecaoPedidos />}
        {navAtiva === "chat"      && <SecaoChat />}
        {navAtiva === "historico" && <SecaoHistorico />}
        {navAtiva === "perfil"    && <SecaoPerfil />}
      </div>

      {/* ── BOTTOM NAV ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm flex border-t border-zinc-100 bg-white">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setNavAtiva(item.id)}
            className="flex-1 flex flex-col items-center py-3 gap-1 relative"
          >
            <svg
              className={`w-5 h-5 ${navAtiva === item.id ? "text-orange-500" : "text-zinc-400"}`}
              fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            >
              <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Badge no chat */}
            {item.id === "chat" && (
              <span className="absolute top-2 right-[calc(50%-10px)] w-2 h-2 bg-orange-500 rounded-full" />
            )}
            <span className={`text-[9px] ${navAtiva === item.id ? "text-orange-500 font-semibold" : "text-zinc-400"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* ── MODAIS ───────────────────────────────────────── */}
      {categoriaModal && (
        <ModalNovoServico
          categoria={categoriaModal}
          onFechar={() => setCategoriaModal(null)}
          onEnviar={handleNovoServico}
        />
      )}

      {mostrarConclusao && pedidoEmAndamento && (
        <ModalConfirmarConclusao
          pedido={pedidoEmAndamento}
          onFechar={() => setMostrarConclusao(false)}
          onConfirmar={handleConfirmarConclusao}
        />
      )}
    </div>
  );
}