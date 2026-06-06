"use client";

import { db, auth} from "../../src/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

type StatusDisponivel = "disponivel" | "ocupado" | "offline";

type Pedido = {
  id: string;
  tipo: string;
  emoji: string;
  cliente: string;
  distancia: string;
  valor: number;
  descricao: string;
};

type ServicoAndamento = {
  id: string;
  tipo: string;
  emoji: string;
  cliente: string;
  valor: number;
  status: "aguardando" | "em_andamento" | "finalizado";
  inicio?: string;
};
const pedidoMock: Pedido = {
  id: "p1",
  tipo: "Instalação de piso vinílico",
  emoji: "🪵",
  cliente: "Ana Souza",
  distancia: "2,3 km",
  valor: 400,
  descricao: "Piso vinílico, aprox. 20m². Precisa de serviço hoje à tarde.",
};

const servicoMock: ServicoAndamento = {
  id: "s1",
  tipo: "Pintura quarto",
  emoji: "🎨",
  cliente: "Pedro R.",
  valor: 280,
  status: "aguardando",
};


function Avatar({ iniciais, cor = "bg-orange-500" }: { iniciais: string; cor?: string }) {
  return (
    <div className={`w-10 h-10 rounded-full ${cor} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
      {iniciais}
    </div>
  );
}

function StatusBadge({ status }: { status: StatusDisponivel }) {
  const config = {
    disponivel: { dot: "bg-green-500", label: "Disponível" },
    ocupado:    { dot: "bg-orange-500", label: "Ocupado" },
    offline:    { dot: "bg-zinc-400",  label: "Offline" },
  }[status];

  return (
    <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-full px-3 py-1.5">
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <span className="text-xs text-zinc-600">{config.label}</span>
    </div>
  );
}

function StatCard({ label, valor, sub, destaque = false }: {
  label: string; valor: string; sub?: string; destaque?: boolean;
}) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
      <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${destaque ? "text-orange-500" : "text-zinc-700"}`}>{valor}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}


function CardNovoPedido({
  pedido,
  onAceitar,
  onRecusar,
}: {
  pedido: Pedido;
  onAceitar: () => void;
  onRecusar: () => void;
}) {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#f0ede6] flex items-center justify-center text-xl shrink-0">
          {pedido.emoji}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-700">{pedido.tipo}</p>
          <p className="text-xs text-zinc-400">{pedido.cliente} · {pedido.distancia}</p>
        </div>
        <p className="text-base font-bold text-orange-500">R${pedido.valor}</p>
      </div>

      {/* Descrição */}
      <p className="text-xs text-zinc-500 leading-relaxed mb-4">{pedido.descricao}</p>

      {/* Ações */}
      <div className="flex gap-2">
        <button
          onClick={onRecusar}
          className="flex-1 py-2.5 rounded-full border border-zinc-300 text-zinc-600 text-sm font-medium hover:bg-zinc-100 active:scale-[0.98] transition"
        >
          Recusar
        </button>
        <button
          onClick={onAceitar}
          className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}

// ─── Card de serviço em andamento ─────────────────────────────────────────────

function CardServicoAndamento({ servico, onIniciar, onFinalizar }: {
  servico: ServicoAndamento;
  onIniciar: () => void;
  onFinalizar: () => void;
}) {
  const badgeConfig = {
    aguardando:   { bg: "bg-orange-100", text: "text-orange-600", label: "Aguardando" },
    em_andamento: { bg: "bg-green-100",  text: "text-green-600",  label: "Em andamento" },
    finalizado:   { bg: "bg-zinc-100",   text: "text-zinc-500",   label: "Finalizado" },
  }[servico.status];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-xl shrink-0">
          {servico.emoji}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-700">{servico.tipo}</p>
          <p className="text-xs text-zinc-400">{servico.cliente} · R$ {servico.valor},00</p>
        </div>
        <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${badgeConfig.bg} ${badgeConfig.text}`}>
          {badgeConfig.label}
        </span>
      </div>

      {/* Botões de controle */}
      <div className="flex gap-2">
        <button
          onClick={onIniciar}
          disabled={servico.status !== "aguardando"}
          className="flex-1 py-2.5 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ▶ Iniciar serviço
        </button>
        <button
          onClick={onFinalizar}
          disabled={servico.status !== "em_andamento"}
          className="flex-1 py-2.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold hover:bg-zinc-200 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ■ Finalizar
        </button>
      </div>

      {/* Timer visível quando em andamento */}
      {servico.status === "em_andamento" && servico.inicio && (
        <p className="text-center text-xs text-green-600 font-medium">
          ⏱ Iniciado às {servico.inicio}
        </p>
      )}
    </div>
  );
}

// ─── Card da carteira ─────────────────────────────────────────────────────────

function CardCarteira({ saldo, retido }: { saldo: number; retido: number }) {
  return (
    <div className="bg-zinc-700 rounded-2xl p-4 text-white">
      <p className="text-xs opacity-70 mb-1">Saldo disponível</p>
      <p className="text-3xl font-bold mb-1">
        R$ {saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </p>
      <p className="text-[10px] opacity-60 mb-4">
        Retido: R$ {retido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (aguardando confirmação do cliente)
      </p>
      <button className="w-full py-2.5 rounded-full border border-white/30 bg-white/10 text-white text-sm font-medium hover:bg-white/20 active:scale-[0.98] transition">
        Sacar para conta bancária
      </button>
    </div>
  );
}

// ─── Navegação inferior ───────────────────────────────────────────────────────

const navItems = [
  { icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", label: "Início",   id: "inicio"   },
  { icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2", label: "Pedidos",  id: "pedidos"  },
  { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", label: "Chat",     id: "chat"     },
  { icon: "M18 20V10M12 20V4M6 20v-6",                                           label: "Ganhos",   id: "ganhos"   },
  { icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", label: "Perfil",   id: "perfil"   },
];

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardPrestador() {
  const router = useRouter();
  const [navAtiva, setNavAtiva]           = useState("inicio");
  const [status, setStatus]               = useState<StatusDisponivel>("disponivel");
  const [pedido, setPedido]               = useState<Pedido | null>(pedidoMock);
  const [servico, setServico]             = useState<ServicoAndamento>(servicoMock);
  const [saldo]                           = useState(960);
  const [retido]                          = useState(280);

  // ─── Proteção de rota ─────────────────────────────────
  const [carregando, setCarregando] = useState(true);
useEffect(() => {
  const unsub = onAuthStateChanged(auth, (user) => {
    if (!user) {
      router.push("/login");
    } else {
      setCarregando(false);
    }
  });
  return () => unsub();
}, [router]);

  if (carregando) return null;
  // Ações do serviço
  function handleAceitarPedido() {
    // TODO: salvar no Firestore, disparar chat com cliente
    setPedido(null);
    alert("Pedido aceito! Combine o valor com o cliente no chat.");
  }

  function handleRecusarPedido() {
    setPedido(null);
  }

  function handleIniciarServico() {
    const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setServico(s => ({ ...s, status: "em_andamento", inicio: agora }));
    // TODO: registrar timestamp no Firestore
  }

  function handleFinalizarServico() {
    setServico(s => ({ ...s, status: "finalizado" }));
    // TODO: notificar cliente para confirmar conclusão
  }

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto">

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div className="bg-[#f0ede6] px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-zinc-400">Olá, prestador</p>
            <h1 className="text-xl font-bold text-zinc-700">João Carlos</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Sino */}
            <button className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M15 17H5a2 2 0 0 1-1.7-3L4 13V11a8 8 0 0 1 16 0v2l.7 1a2 2 0 0 1-1.7 3h-4z" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <Avatar iniciais="JC" cor="bg-zinc-700" />
          </div>
        </div>

        {/* Status + timer */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setStatus(s =>
                s === "disponivel" ? "ocupado" : s === "ocupado" ? "offline" : "disponivel"
              )
            }
          >
            <StatusBadge status={status} />
          </button>
          <div className="flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-xs text-zinc-500">4h 20min hoje</span>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5 pb-24">

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Ganhos hoje"   valor="R$320"    sub="2 serviços"  destaque />
          <StatCard label="Ganhos semana" valor="R$1.240"  sub="8 serviços"            />
        </div>

        {/* Novo pedido */}
        {pedido && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
              Novo pedido
            </p>
            <CardNovoPedido
              pedido={pedido}
              onAceitar={handleAceitarPedido}
              onRecusar={handleRecusarPedido}
            />
          </div>
        )}

        {/* Serviço em andamento */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Serviço em andamento
          </p>
          <CardServicoAndamento
            servico={servico}
            onIniciar={handleIniciarServico}
            onFinalizar={handleFinalizarServico}
          />
        </div>

        {/* Carteira */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
            Carteira
          </p>
          <CardCarteira saldo={saldo} retido={retido} />
        </div>

      </div>

      {/* ── BOTTOM NAV ───────────────────────────────────── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm flex border-t border-zinc-100 bg-white">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setNavAtiva(item.id)}
            className="flex-1 flex flex-col items-center py-3 gap-1"
          >
            <svg
              className={`w-5 h-5 ${navAtiva === item.id ? "text-orange-500" : "text-zinc-400"}`}
              fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            >
              <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={`text-[9px] ${navAtiva === item.id ? "text-orange-500 font-semibold" : "text-zinc-400"}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  );
}