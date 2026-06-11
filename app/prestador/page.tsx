"use client";

import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  doc, getDoc, updateDoc, addDoc, collection, getDocs,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../src/lib/firebase";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NavId = "inicio" | "pedidos" | "chat" | "ganhos" | "perfil";
type StatusDisponivel = "disponivel" | "ocupado" | "offline";

type Pedido = {
  id: string;
  tipo: string;
  emoji: string;
  clienteId: string;
  clienteNome: string;
  prestadorId?: string;
  prestadorNome?: string;
  valor?: number;
  descricao: string;
  endereco: string;
  status: string;
  recusadoPor?: Record<string, boolean>;
  inicioEm?: { seconds: number };
  criadoEm?: { seconds: number };
};

type Mensagem = {
  id: string;
  texto: string;
  remetente: string;
  nomeRemetente: string;
  tipo: "texto" | "sistema";
  criadoEm?: { seconds: number };
};

type Carteira = {
  saldoDisponivel: number;
  saldoRetido: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarData(ts?: { seconds: number }) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString("pt-BR");
}

function Avatar({ iniciais, cor = "bg-orange-500", size = "w-10 h-10" }: {
  iniciais: string; cor?: string; size?: string;
}) {
  return (
    <div className={`${size} rounded-full ${cor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
      {iniciais}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusDisponivel }) {
  const config = {
    disponivel: { dot: "bg-green-500", label: "Disponível" },
    ocupado:    { dot: "bg-orange-500", label: "Ocupado"   },
    offline:    { dot: "bg-zinc-400",  label: "Offline"    },
  }[status];
  return (
    <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="text-xs text-zinc-600">{config.label}</span>
    </div>
  );
}

// ─── Modal negociar valor ─────────────────────────────────────────────────────

function ModalNegociarValor({ pedido, onFechar, onEnviar }: {
  pedido: Pedido;
  onFechar: () => void;
  onEnviar: (valor: number) => Promise<void>;
}) {
  const [valor, setValor]     = useState("");
  const [enviando, setEnviando] = useState(false);

  async function handleEnviar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!v || v <= 0) return;
    setEnviando(true);
    await onEnviar(v);
    setEnviando(false);
    onFechar();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onFechar} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 bg-white rounded-t-3xl p-6 flex flex-col gap-4">
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-2" />
        <div>
          <p className="text-base font-bold text-zinc-800">Propor valor</p>
          <p className="text-xs text-zinc-400 mt-1">
            Informe o valor que deseja cobrar pelo serviço de {pedido.tipo}.
          </p>
        </div>
        <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-full px-4 py-3 gap-2">
          <span className="text-sm text-zinc-500 font-medium">R$</span>
          <input
            type="number"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0,00"
            className="flex-1 text-sm text-zinc-600 outline-none placeholder-zinc-400 bg-transparent"
          />
        </div>
        <p className="text-[11px] text-zinc-400 text-center">
          O cliente receberá sua proposta no chat e confirmará o pagamento.
        </p>
        <div className="flex gap-2">
          <button onClick={onFechar}
            className="flex-1 py-3 rounded-full border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition">
            Cancelar
          </button>
          <button onClick={handleEnviar} disabled={!valor || enviando}
            className="flex-1 py-3 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-40">
            {enviando ? "Enviando..." : "Propor valor"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Seção Início ─────────────────────────────────────────────────────────────

function SecaoInicio({
  pedidosDisponiveis,
  pedidoAtivo,
  status,
  onSetStatus,
  onAceitar,
  onRecusar,
  onIniciar,
  onFinalizar,
  onAbrirChat,
  onProporValor,
  onSaque,
  carteira,
}: {
  pedidosDisponiveis: Pedido[];
  pedidoAtivo: Pedido | null;
  status: StatusDisponivel;
  onSetStatus: (s: StatusDisponivel) => void;
  onAceitar: (pedido: Pedido) => Promise<void>;
  onRecusar: (pedido: Pedido) => Promise<void>;
  onIniciar: () => Promise<void>;
  onFinalizar: () => Promise<void>;
  onAbrirChat: () => void;
  onProporValor: () => void;
  onSaque: () => Promise<void>;
  carteira: Carteira;
}) {
  return (
    <div className="flex flex-col gap-5">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">Disponível</p>
          <p className="text-xl font-bold text-orange-500">
            R$ {carteira.saldoDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">Retido</p>
          <p className="text-xl font-bold text-zinc-700">
            R$ {carteira.saldoRetido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-zinc-400">Aguardando confirmação</p>
        </div>
      </div>

      {/* Pedido ativo */}
      {pedidoAtivo && (
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Serviço em andamento
          </p>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
                {pedidoAtivo.emoji}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-700">{pedidoAtivo.tipo}</p>
                <p className="text-xs text-zinc-400">
                  {pedidoAtivo.clienteNome}
                  {pedidoAtivo.valor ? ` · R$${pedidoAtivo.valor}` : ""}
                </p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
                pedidoAtivo.status === "em_andamento" ? "bg-green-100 text-green-600" :
                pedidoAtivo.status === "negociando"   ? "bg-yellow-100 text-yellow-700" :
                "bg-orange-100 text-orange-600"
              }`}>
                {pedidoAtivo.status === "em_andamento"         ? "Em andamento" :
                 pedidoAtivo.status === "negociando"           ? "Negociando" :
                 pedidoAtivo.status === "aguardando_pagamento" ? "Aguard. pagamento" :
                 "Aceito"}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={onAbrirChat}
                className="flex-1 py-2.5 rounded-full border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 transition">
                Ver chat
              </button>
              {pedidoAtivo.status === "em_andamento" && (
                <button onClick={onFinalizar}
                  className="flex-1 py-2.5 rounded-full bg-zinc-700 text-white text-xs font-semibold hover:bg-zinc-800 transition">
                  ■ Finalizar
                </button>
              )}
              {pedidoAtivo.status === "negociando" && (
                <button onClick={onProporValor}
                  className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">
                  💰 Propor valor
                </button>
              )}
              {pedidoAtivo.status === "aguardando_pagamento" && (
                <button disabled
                  className="flex-1 py-2.5 rounded-full bg-yellow-500 text-white text-xs font-semibold opacity-50">
                  ⏳ Aguardando pagamento
                </button>
              )}
              {(!pedidoAtivo.status || pedidoAtivo.status === "aceito") && (
                <button onClick={onIniciar}
                  className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">
                  ▶ Iniciar serviço
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pedidos disponíveis */}
      {status === "disponivel" && pedidosDisponiveis.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Pedidos disponíveis ({pedidosDisponiveis.length})
          </p>
          <div className="flex flex-col gap-3">
            {pedidosDisponiveis.map(p => (
              <div key={p.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#f0ede6] flex items-center justify-center text-xl shrink-0">
                    {p.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-700">{p.tipo}</p>
                    <p className="text-xs text-zinc-400">{p.clienteNome}</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mb-3 leading-relaxed">{p.descricao}</p>
                <p className="text-[10px] text-zinc-400 mb-3">📍 {p.endereco}</p>
                <div className="flex gap-2">
                  <button onClick={() => onRecusar(p)}
                    className="flex-1 py-2.5 rounded-full border border-zinc-300 text-zinc-600 text-sm font-medium hover:bg-zinc-100 transition">
                    Recusar
                  </button>
                  <button onClick={() => onAceitar(p)}
                    className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition">
                    Aceitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vazio */}
      {!pedidoAtivo && pedidosDisponiveis.length === 0 && status === "disponivel" && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-400">
          <span className="text-3xl">🔍</span>
          <p className="text-sm">Nenhum pedido disponível.</p>
          <p className="text-xs">Fique disponível para receber novos pedidos.</p>
        </div>
      )}

      {status !== "disponivel" && !pedidoAtivo && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-zinc-400">
          <span className="text-3xl">😴</span>
          <p className="text-sm">Você está {status === "ocupado" ? "ocupado" : "offline"}</p>
          <p className="text-xs">Altere seu status para "Disponível" para receber pedidos.</p>
        </div>
      )}

      {/* Carteira */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Carteira</p>
        <div className="bg-zinc-700 rounded-2xl p-4 text-white">
          <p className="text-xs opacity-70 mb-1">Saldo disponível</p>
          <p className="text-3xl font-bold mb-1">
            R$ {carteira.saldoDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] opacity-60 mb-4">
            Retido: R$ {carteira.saldoRetido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (aguardando cliente)
          </p>
          <button 
            onClick={onSaque}
            className="w-full py-2.5 rounded-full border border-white/30 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition">
            Sacar para conta bancária
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Seção Chat ───────────────────────────────────────────────────────────────

function SecaoChat({ pedidoAtivo, onProporValor, onFinalizar }: {
  pedidoAtivo: Pedido | null;
  onProporValor: () => void;
  onFinalizar: () => Promise<void>;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto]         = useState("");
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const user                      = auth.currentUser;

  useEffect(() => {
    if (!pedidoAtivo) return;
    const q = query(
      collection(db, "chats", pedidoAtivo.id, "mensagens"),
      orderBy("criadoEm", "asc"),
    );
    const unsub = onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() } as Mensagem)));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsub();
  }, [pedidoAtivo]);

  async function handleEnviar() {
    if (!texto.trim() || !pedidoAtivo || !user) return;
    const msg = texto.trim();
    setTexto("");
    await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
      texto: msg,
      remetente: user.uid,
      nomeRemetente: user.displayName ?? "Prestador",
      tipo: "texto",
      criadoEm: serverTimestamp(),
    });
  }

  if (!pedidoAtivo) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-400">
        <p className="text-sm">Nenhum serviço ativo.</p>
        <p className="text-xs">Aceite um pedido para iniciar o chat.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {pedidoAtivo.clienteNome?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-700">{pedidoAtivo.clienteNome}</p>
            <p className="text-[10px] text-zinc-400">{pedidoAtivo.tipo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {pedidoAtivo.status === "negociando" && (
            <button onClick={onProporValor}
              className="px-3 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">
              Propor valor
            </button>
          )}
          {pedidoAtivo.status === "em_andamento" && (
            <button onClick={onFinalizar}
              className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition">
              Finalizar
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto pb-4">
        {mensagens.map(m => {
          if (m.tipo === "sistema") {
            return (
              <p key={m.id} className="text-center text-[10px] text-zinc-400 bg-zinc-50 rounded-full px-3 py-1.5 mx-auto">
                {m.texto}
              </p>
            );
          }
          const ehMeu = m.remetente === user?.uid;
          return (
            <div key={m.id} className={`flex flex-col gap-1 ${ehMeu ? "items-end" : "items-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                ehMeu ? "bg-orange-500 text-white rounded-br-sm" : "bg-zinc-100 text-zinc-700 rounded-bl-sm"
              }`}>
                {m.texto}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
        <input value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleEnviar()}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-full px-4 py-2.5 text-sm text-zinc-600 placeholder-zinc-400 outline-none" />
        <button onClick={handleEnviar} disabled={!texto.trim()}
          className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition disabled:opacity-40">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Seção Pedidos ────────────────────────────────────────────────────────────

function SecaoPedidos({ pedidos }: { pedidos: Pedido[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Meus serviços</p>
      {pedidos.length === 0 && (
        <div className="text-center py-10 text-zinc-400 text-sm">Nenhum serviço ainda.</div>
      )}
      {pedidos.map(p => (
        <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
              {p.emoji}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-700">{p.tipo}</p>
              <p className="text-[10px] text-zinc-400">{formatarData(p.criadoEm)}</p>
            </div>
            <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${
              p.status === "concluido" ? "bg-zinc-100 text-zinc-500" :
              p.status === "em_andamento" ? "bg-green-100 text-green-600" :
              "bg-orange-100 text-orange-600"
            }`}>
              {p.status === "concluido" ? "Concluído" :
               p.status === "em_andamento" ? "Em andamento" : "Em aberto"}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">{p.clienteNome}</p>
            {p.valor && <p className="text-sm font-bold text-zinc-700">R$ {p.valor},00</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Seção Ganhos ─────────────────────────────────────────────────────────────

function SecaoGanhos({ pedidos, carteira }: { pedidos: Pedido[]; carteira: Carteira }) {
  const concluidos = pedidos.filter(p => p.status === "concluido" && p.valor);
  const totalGanho = concluidos.reduce((acc, p) => acc + (p.valor ?? 0) * 0.8, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-orange-500 rounded-2xl p-4 text-white">
        <p className="text-xs opacity-80 mb-1">Total ganho (líquido 80%)</p>
        <p className="text-3xl font-bold">
          R$ {totalGanho.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs opacity-70 mt-1">{concluidos.length} serviços concluídos</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
          <p className="text-[10px] text-zinc-400 mb-1">Disponível</p>
          <p className="text-lg font-bold text-zinc-700">
            R$ {carteira.saldoDisponivel.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
          <p className="text-[10px] text-zinc-400 mb-1">Retido</p>
          <p className="text-lg font-bold text-zinc-700">
            R$ {carteira.saldoRetido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Histórico</p>
      {concluidos.map(p => (
        <div key={p.id} className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700">{p.tipo}</p>
            <p className="text-[10px] text-zinc-400">{p.clienteNome} · {formatarData(p.criadoEm)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-green-600">
              +R$ {((p.valor ?? 0) * 0.8).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-zinc-400">80% de R${p.valor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const navItems: { id: NavId; label: string; path: string }[] = [
  { id: "inicio",  label: "Início",  path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id: "pedidos", label: "Serviços", path: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
  { id: "chat",    label: "Chat",    path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "ganhos",  label: "Ganhos",  path: "M18 20V10M12 20V4M6 20v-6" },
  { id: "perfil",  label: "Perfil",  path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPrestador() {
  const router = useRouter();
  const [carregando, setCarregando]         = useState(true);
  const [navAtiva, setNavAtiva]             = useState<NavId>("inicio");
  const [status, setStatus]                 = useState<StatusDisponivel>("disponivel");
  const [pedidos, setPedidos]               = useState<Pedido[]>([]);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState<Pedido[]>([]);
  const [carteira, setCarteira]             = useState<Carteira>({ saldoDisponivel: 0, saldoRetido: 0 });
  const [modalValor, setModalValor]         = useState(false);
  const [carregandoPedidos, setCarregandoPedidos] = useState(true);

  const pedidoAtivo = pedidos.find(p =>
    ["negociando", "aguardando_pagamento", "em_andamento"].includes(p.status)
  ) ?? null;

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { 
        router.push("/login"); 
        return; 
      }
      setCarregando(false);
      console.log("✅ Prestador autenticado:", user.uid);
    });
    return () => unsub();
  }, [router]);

  // Atualizar status de disponibilidade no Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const updateAvailability = async () => {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          statusDisponibilidade: status,
          ultimaAtualizacao: serverTimestamp()
        });
        console.log("✅ Status atualizado para:", status);
      } catch (error) {
        console.error("❌ Erro ao atualizar status:", error);
      }
    };

    updateAvailability();
  }, [status]);

  // Pedidos do prestador em tempo real (VERSÃO SEM ÍNDICE)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    console.log("🔍 Buscando pedidos do prestador:", user.uid);
    
    // Query SEM orderBy para evitar a necessidade de índice composto
    const q = query(
      collection(db, "pedidos"),
      where("prestadorId", "==", user.uid),
    );
    
    const unsub = onSnapshot(q, 
      snap => {
        const pedidosArray = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Pedido))
          // Ordenar por data localmente (ordem decrescente)
          .sort((a, b) => {
            const timeA = a.criadoEm?.seconds ?? 0;
            const timeB = b.criadoEm?.seconds ?? 0;
            return timeB - timeA;
          });
        
        console.log("📋 Pedidos do prestador:", pedidosArray.length, "pedidos");
        pedidosArray.forEach(p => {
          console.log(`  - ${p.id}: ${p.tipo} | ${p.clienteNome} | ${p.status}`);
        });
        setPedidos(pedidosArray);
      },
      error => {
        console.error("❌ Erro ao buscar pedidos do prestador:", error);
      }
    );
    
    return () => unsub();
  }, [carregando]);

  // Pedidos disponíveis (aguardando prestador) - só mostra se status for "disponivel"
  useEffect(() => {
    if (!auth.currentUser) return;
    
    if (status !== "disponivel") {
      console.log("⏸️ Status não é 'disponivel', ocultando pedidos disponíveis");
      setPedidosDisponiveis([]);
      setCarregandoPedidos(false);
      return;
    }
    
    console.log("🔍 Buscando pedidos disponíveis...");
    setCarregandoPedidos(true);
    
    const q = query(
      collection(db, "pedidos"),
      where("status", "==", "aguardando_prestador"),
    );
    
    const unsub = onSnapshot(q, 
      snap => {
        const user = auth.currentUser!;
        const pedidosArray = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Pedido))
          .filter(p => {
            // Filtrar pedidos que este prestador já recusou
            const recusado = p.recusadoPor && p.recusadoPor[user.uid];
            if (recusado) {
              console.log("⏭️ Pedido ignorado (recusado anteriormente):", p.id);
            }
            return !recusado;
          });
        
        console.log("📋 Pedidos disponíveis encontrados:", pedidosArray.length);
        pedidosArray.forEach(p => {
          console.log(`  - ${p.id}: ${p.tipo} | ${p.clienteNome} | ${p.status}`);
        });
        
        setPedidosDisponiveis(pedidosArray);
        setCarregandoPedidos(false);
      },
      error => {
        console.error("❌ Erro ao buscar pedidos disponíveis:", error);
        setCarregandoPedidos(false);
      }
    );
    
    return () => unsub();
  }, [carregando, status]);

  // Carteira em tempo real
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    console.log("💰 Monitorando carteira do prestador...");
    
    const unsub = onSnapshot(doc(db, "users", user.uid), 
      snap => {
        const data = snap.data();
        const novaCarteira = {
          saldoDisponivel: data?.saldoDisponivel ?? 0,
          saldoRetido:     data?.saldoRetido     ?? 0,
        };
        console.log("💰 Carteira atualizada:", novaCarteira);
        setCarteira(novaCarteira);
      },
      error => {
        console.error("❌ Erro ao monitorar carteira:", error);
      }
    );
    
    return () => unsub();
  }, [carregando]);

  if (carregando) return null;

  const user = auth.currentUser!;

  // ─── Função para resetar pedidos travados ─────────────────────────────────
  async function resetarPedidosTravados() {
    try {
      console.log("🔧 Verificando pedidos travados...");
      const q = query(
        collection(db, "pedidos"),
        where("status", "==", "recusado_prestador")
      );
      
      const snapshot = await getDocs(q);
      console.log(`📋 Encontrados ${snapshot.docs.length} pedidos travados`);
      
      for (const docSnapshot of snapshot.docs) {
        await updateDoc(doc(db, "pedidos", docSnapshot.id), {
          status: "aguardando_prestador",
          prestadorId: null,
          prestadorNome: null
        });
        console.log("✅ Pedido resetado:", docSnapshot.id);
      }
      
      if (snapshot.docs.length > 0) {
        alert(`${snapshot.docs.length} pedido(s) travado(s) foram resetados!`);
      } else {
        alert("Nenhum pedido travado encontrado!");
      }
    } catch (error) {
      console.error("❌ Erro ao resetar pedidos:", error);
      alert("Erro ao resetar pedidos. Verifique o console.");
    }
  }

  // ─── Aceitar pedido ────────────────────────────────────────────────────────
  async function handleAceitar(pedido: Pedido) {
    try {
      console.log("🤝 Aceitando pedido:", pedido.id);
      
      await updateDoc(doc(db, "pedidos", pedido.id), {
        prestadorId:   user.uid,
        prestadorNome: user.displayName ?? "Prestador",
        status:        "negociando",
      });
      
      await addDoc(collection(db, "chats", pedido.id, "mensagens"), {
        texto: `✅ ${user.displayName ?? "Prestador"} aceitou seu pedido! Aguarde a proposta de valor.`,
        remetente: "sistema", 
        nomeRemetente: "Sistema", 
        tipo: "sistema",
        criadoEm: serverTimestamp(),
      });
      
      console.log("✅ Pedido aceito com sucesso!");
      setNavAtiva("chat");
    } catch (error) {
      console.error("❌ Erro ao aceitar pedido:", error);
      alert("Erro ao aceitar pedido. Tente novamente.");
    }
  }

  // ─── Recusar pedido ────────────────────────────────────────────────────────
  async function handleRecusar(pedido: Pedido) {
    if (!confirm("Deseja recusar este pedido?")) return;
    
    try {
      console.log("👎 Recusando pedido:", pedido.id);
      
      // Marcar que este prestador recusou, mas manter o pedido disponível para outros
      await updateDoc(doc(db, "pedidos", pedido.id), {
        [`recusadoPor.${user.uid}`]: true,
      });
      
      console.log("✅ Pedido marcado como recusado para este prestador");
      
      // Remover da lista local imediatamente
      setPedidosDisponiveis(prev => prev.filter(p => p.id !== pedido.id));
    } catch (error) {
      console.error("❌ Erro ao recusar pedido:", error);
      alert("Erro ao recusar pedido. Tente novamente.");
    }
  }

  // ─── Propor valor ──────────────────────────────────────────────────────────
  async function handleProporValor(valor: number) {
    if (!pedidoAtivo) return;
    
    try {
      console.log("💰 Propondo valor:", valor, "para pedido:", pedidoAtivo.id);
      
      await updateDoc(doc(db, "pedidos", pedidoAtivo.id), {
        valor,
        status: "aguardando_pagamento",
      });
      
      await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
        texto: `💰 Valor proposto: R$${valor.toFixed(2).replace(".", ",")}. Aguardando confirmação do pagamento.`,
        remetente: "sistema", 
        nomeRemetente: "Sistema", 
        tipo: "sistema",
        criadoEm: serverTimestamp(),
      });
      
      console.log("✅ Valor proposto com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao propor valor:", error);
      alert("Erro ao propor valor. Tente novamente.");
    }
  }

  // ─── Iniciar serviço ───────────────────────────────────────────────────────
  async function handleIniciar() {
    if (!pedidoAtivo) return;
    
    try {
      console.log("🔧 Iniciando serviço:", pedidoAtivo.id);
      
      await updateDoc(doc(db, "pedidos", pedidoAtivo.id), {
        status:  "em_andamento",
        inicioEm: serverTimestamp(),
      });
      
      await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
        texto: "🔧 Prestador iniciou o serviço!",
        remetente: "sistema", 
        nomeRemetente: "Sistema", 
        tipo: "sistema",
        criadoEm: serverTimestamp(),
      });
      
      console.log("✅ Serviço iniciado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao iniciar serviço:", error);
      alert("Erro ao iniciar serviço. Tente novamente.");
    }
  }

  // ─── Finalizar serviço ─────────────────────────────────────────────────────
  async function handleFinalizar() {
    if (!pedidoAtivo) return;
    
    try {
      console.log("✅ Finalizando serviço:", pedidoAtivo.id);
      
      await updateDoc(doc(db, "pedidos", pedidoAtivo.id), { 
        status: "finalizado_prestador" 
      });
      
      await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
        texto: "✅ Prestador finalizou o serviço! Aguardando confirmação do cliente.",
        remetente: "sistema", 
        nomeRemetente: "Sistema", 
        tipo: "sistema",
        criadoEm: serverTimestamp(),
      });
      
      console.log("✅ Serviço finalizado com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao finalizar serviço:", error);
      alert("Erro ao finalizar serviço. Tente novamente.");
    }
  }

  // ─── Saque ─────────────────────────────────────────────────────────────────
  async function handleSaque() {
    if (carteira.saldoDisponivel < 10) {
      alert("Saldo mínimo para saque é R$10,00");
      return;
    }
    
    try {
      console.log("💸 Solicitando saque de:", carteira.saldoDisponivel);
      
      await addDoc(collection(db, "saques"), {
        prestadorId: user.uid,
        prestadorNome: user.displayName,
        valor: carteira.saldoDisponivel,
        status: "pendente",
        criadoEm: serverTimestamp()
      });
      
      console.log("✅ Saque solicitado com sucesso!");
      alert("Solicitação de saque enviada! Processamos em até 5 dias úteis.");
    } catch (error) {
      console.error("❌ Erro ao solicitar saque:", error);
      alert("Erro ao solicitar saque. Tente novamente.");
    }
  }

  const titulos: Record<NavId, string> = {
    inicio:  `Olá, ${user.displayName?.split(" ")[0] ?? ""}! 🔧`,
    pedidos: "Meus serviços",
    chat:    "Chat",
    ganhos:  "Ganhos",
    perfil:  "Perfil",
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto">

      {/* TOP BAR */}
      <div className="bg-[#f0ede6] px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-zinc-400">{navAtiva === "inicio" ? "Bem-vindo de volta," : ""}</p>
            <h1 className="text-xl font-bold text-zinc-700">{titulos[navAtiva]}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={resetarPedidosTravados}
              className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center"
              title="Resetar pedidos travados"
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M15 17H5a2 2 0 0 1-1.7-3L4 13V11a8 8 0 0 1 16 0v2l.7 1a2 2 0 0 1-1.7 3h-4z" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <Avatar
              iniciais={user.displayName?.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() ?? "?"}
              cor="bg-zinc-700"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setStatus(s =>
            s === "disponivel" ? "ocupado" : s === "ocupado" ? "offline" : "disponivel"
          )}>
            <StatusBadge status={status} />
          </button>
          
          {/* Indicador de depuração */}
          {status === "disponivel" && (
            <span className="text-[10px] text-zinc-400">
              {carregandoPedidos ? "Buscando pedidos..." : `${pedidosDisponiveis.length} disponíveis`}
            </span>
          )}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {navAtiva === "inicio" && (
          <SecaoInicio
            pedidosDisponiveis={pedidosDisponiveis}
            pedidoAtivo={pedidoAtivo}
            status={status}
            onSetStatus={setStatus}
            onAceitar={handleAceitar}
            onRecusar={handleRecusar}
            onIniciar={handleIniciar}
            onFinalizar={handleFinalizar}
            onAbrirChat={() => setNavAtiva("chat")}
            onProporValor={() => setModalValor(true)}
            onSaque={handleSaque}
            carteira={carteira}
          />
        )}
        {navAtiva === "pedidos" && <SecaoPedidos pedidos={pedidos} />}
        {navAtiva === "chat"    && (
          <SecaoChat
            pedidoAtivo={pedidoAtivo}
            onProporValor={() => setModalValor(true)}
            onFinalizar={handleFinalizar}
          />
        )}
        {navAtiva === "ganhos"  && <SecaoGanhos pedidos={pedidos} carteira={carteira} />}
      </div>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm flex border-t border-zinc-100 bg-white">
        {navItems.map(item => (
          <button key={item.id} onClick={() => setNavAtiva(item.id)}
            className="flex-1 flex flex-col items-center py-3 gap-1 relative">
            <svg className={`w-5 h-5 ${navAtiva === item.id ? "text-orange-500" : "text-zinc-400"}`}
              fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {item.id === "inicio" && pedidosDisponiveis.length > 0 && status === "disponivel" && (
              <span className="absolute top-2 right-[calc(50%-10px)] w-2 h-2 bg-orange-500 rounded-full" />
            )}
            <span className={`text-[9px] ${navAtiva === item.id ? "text-orange-500 font-semibold" : "text-zinc-400"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* MODAL VALOR */}
      {modalValor && pedidoAtivo && (
        <ModalNegociarValor
          pedido={pedidoAtivo}
          onFechar={() => setModalValor(false)}
          onEnviar={handleProporValor}
        />
      )}
    </div>
  );
}