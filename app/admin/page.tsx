"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import { useEffect } from "react";
import { auth } from "../../src/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

async function promoverParaPrestador(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    tipo:     "prestador",
    aprovado: true,
  });
}

async function revogarPrestador(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    tipo:     "cliente",
    aprovado: false,
  });
}

async function banirUsuario(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    status:  "banido",
    aprovado: false,
  });
}

async function desbanirUsuario(uid: string) {
  await updateDoc(doc(db, "users", uid), {
    status: "ativo",
  });
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type NavId = "visao_geral" | "usuarios" | "servicos" | "financeiro" | "suporte";

type TipoUsuario = "cliente" | "prestador";
type StatusUsuario = "ativo" | "alerta" | "banido";

type Usuario = {
  id: string;
  nome: string;
  iniciais: string;
  tipo: TipoUsuario;
  status: StatusUsuario;
  avaliacao?: number;
  totalServicos: number;
  cadastro: string;
};

type Servico = {
  id: string;
  tipo: string;
  emoji: string;
  cliente: string;
  prestador: string;
  valor: number;
  comissao: number;
  status: "aguardando" | "em_andamento" | "concluido" | "cancelado";
  data: string;
};

type Chamado = {
  id: string;
  usuario: string;
  assunto: string;
  status: "aberto" | "em_atendimento" | "resolvido";
  data: string;
};

type Atividade = {
  id: string;
  descricao: string;
  tempo: string;
  tipo: "sucesso" | "info" | "alerta" | "erro";
};

// ─── Dados mockados (substituir por Firestore) ────────────────────────────────

const usuariosMock: Usuario[] = [
  { id: "u1", nome: "Ana Souza",    iniciais: "AS", tipo: "cliente",   status: "ativo",   totalServicos: 7,  cadastro: "12/03/2025" },
  { id: "u2", nome: "João Carlos",  iniciais: "JC", tipo: "prestador", status: "ativo",   avaliacao: 4.9, totalServicos: 84, cadastro: "05/01/2025" },
  { id: "u3", nome: "Pedro R.",     iniciais: "PR", tipo: "prestador", status: "alerta",  avaliacao: 3.1, totalServicos: 12, cadastro: "20/04/2025" },
  { id: "u4", nome: "Márcia Lima",  iniciais: "ML", tipo: "cliente",   status: "ativo",   totalServicos: 3,  cadastro: "01/05/2025" },
  { id: "u5", nome: "Carlos M.",    iniciais: "CM", tipo: "prestador", status: "banido",  avaliacao: 1.2, totalServicos: 5,  cadastro: "10/02/2025" },
];

const servicosMock: Servico[] = [
  { id: "s1", tipo: "Piso vinílico",      emoji: "🪵", cliente: "Ana S.",    prestador: "João C.", valor: 400, comissao: 80,  status: "em_andamento", data: "Hoje, 09:15" },
  { id: "s2", tipo: "Pintura sala",       emoji: "🎨", cliente: "Márcia L.", prestador: "Carlos M.", valor: 320, comissao: 64,  status: "concluido",    data: "Hoje, 07:30" },
  { id: "s3", tipo: "Chuveiro elétrico",  emoji: "🚿", cliente: "Ana S.",    prestador: "João C.", valor: 180, comissao: 36,  status: "aguardando",   data: "Hoje, 11:00" },
  { id: "s4", tipo: "Montagem armário",   emoji: "🗄️", cliente: "Márcia L.", prestador: "Pedro R.", valor: 250, comissao: 50,  status: "cancelado",    data: "Ontem, 15:00" },
];

const chamadosMock: Chamado[] = [
  { id: "c1", usuario: "Ana Souza",   assunto: "Prestador não compareceu",    status: "aberto",         data: "há 28 min" },
  { id: "c2", usuario: "Pedro R.",    assunto: "Dúvida sobre saque",          status: "em_atendimento", data: "há 1h" },
  { id: "c3", usuario: "Márcia Lima", assunto: "Reembolso de serviço",        status: "resolvido",      data: "Ontem" },
];

const atividadesMock: Atividade[] = [
  { id: "a1", descricao: "Serviço concluído · Ana S. × João C.",  tempo: "há 5 min",  tipo: "sucesso" },
  { id: "a2", descricao: "Novo pedido · Chuveiro · R$180",         tempo: "há 12 min", tipo: "info"    },
  { id: "a3", descricao: "Alerta de avaliação baixa · Pedro R.",   tempo: "há 34 min", tipo: "alerta"  },
  { id: "a4", descricao: "Chamado de suporte aberto · Ana S.",     tempo: "há 1h",     tipo: "erro"    },
  { id: "a5", descricao: "Novo cadastro · Márcia Lima",            tempo: "há 2h",     tipo: "info"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function corAtividade(tipo: Atividade["tipo"]) {
  return { sucesso: "bg-green-500", info: "bg-orange-400", alerta: "bg-yellow-400", erro: "bg-red-400" }[tipo];
}

function badgeServico(status: Servico["status"]) {
  const map = {
    aguardando:   { bg: "bg-orange-100", text: "text-orange-600", label: "Aguardando"    },
    em_andamento: { bg: "bg-green-100",  text: "text-green-600",  label: "Em andamento"  },
    concluido:    { bg: "bg-zinc-100",   text: "text-zinc-500",   label: "Concluído"     },
    cancelado:    { bg: "bg-red-100",    text: "text-red-500",    label: "Cancelado"     },
  };
  return map[status];
}

function badgeChamado(status: Chamado["status"]) {
  const map = {
    aberto:         { bg: "bg-red-100",    text: "text-red-600",    label: "Aberto"          },
    em_atendimento: { bg: "bg-orange-100", text: "text-orange-600", label: "Em atendimento"  },
    resolvido:      { bg: "bg-zinc-100",   text: "text-zinc-500",   label: "Resolvido"       },
  };
  return map[status];
}

function badgeUsuario(status: StatusUsuario) {
  const map = {
    ativo:  { bg: "bg-green-100",  text: "text-green-600",  label: "Ativo"   },
    alerta: { bg: "bg-yellow-100", text: "text-yellow-700", label: "⚠ Alerta" },
    banido: { bg: "bg-red-100",    text: "text-red-600",    label: "Banido"  },
  };
  return map[status];
}

function corAvatar(tipo: TipoUsuario, status: StatusUsuario) {
  if (status === "banido") return "bg-red-100 text-red-500";
  if (status === "alerta") return "bg-yellow-100 text-yellow-700";
  return tipo === "prestador" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600";
}

// ─── Componentes de seção ─────────────────────────────────────────────────────

function SecaoVisaoGeral() {
  return (
    <div className="flex flex-col gap-5">
      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { emoji: "👥", valor: "1.284", label: "Usuários ativos",     destaque: false },
          { emoji: "🔧", valor: "47",    label: "Serviços hoje",        destaque: false },
          { emoji: "💰", valor: "R$12,8k",label: "Volume (semana)",     destaque: true  },
          { emoji: "📋", valor: "R$2,5k", label: "Comissões 20%",       destaque: false },
        ].map((m, i) => (
          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <span className="text-xl">{m.emoji}</span>
            <p className={`text-xl font-bold mt-1 ${m.destaque ? "text-orange-500" : "text-zinc-700"}`}>{m.valor}</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Atividade recente */}
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Atividade recente</p>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-4">
          {atividadesMock.map((a, i) => (
            <div key={a.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${corAtividade(a.tipo)}`} />
                {i < atividadesMock.length - 1 && <div className="w-px flex-1 bg-zinc-100 mt-1 mb-[-8px] min-h-[16px]" />}
              </div>
              <div className="flex-1">
                <p className="text-xs text-zinc-700">{a.descricao}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">{a.tempo}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de confirmação ─────────────────────────────────────────────────────

type ModalConfirm = {
  titulo: string;
  descricao: string;
  textoBotao: string;
  corBotao: string;
  onConfirmar: () => Promise<void>;
};

function ModalConfirmacao({
  modal,
  onFechar,
}: {
  modal: ModalConfirm;
  onFechar: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirmar() {
    setLoading(true);
    try {
      await modal.onConfirmar();
    } finally {
      setLoading(false);
      onFechar();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 bg-black/40">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 flex flex-col gap-4">
        <div>
          <p className="text-base font-bold text-zinc-800">{modal.titulo}</p>
          <p className="text-sm text-zinc-500 mt-1">{modal.descricao}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-3 rounded-full border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className={`flex-1 py-3 rounded-full text-white text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 ${modal.corBotao}`}
          >
            {loading ? "Aguarde..." : modal.textoBotao}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer de detalhes do usuário ───────────────────────────────────────────

function DrawerUsuario({
  usuario,
  onFechar,
  onAtualizar,
}: {
  usuario: Usuario;
  onFechar: () => void;
  onAtualizar: (id: string, changes: Partial<Usuario>) => void;
}) {
  const [modal, setModal] = useState<ModalConfirm | null>(null);

  function abrirPromover() {
    setModal({
      titulo: `Promover ${usuario.nome}?`,
      descricao: "O usuário receberá acesso à dashboard de prestador e poderá aceitar serviços.",
      textoBotao: "Promover",
      corBotao: "bg-orange-500 hover:bg-orange-600",
      onConfirmar: async () => {
        await promoverParaPrestador(usuario.id);
        onAtualizar(usuario.id, { tipo: "prestador", status: "ativo" });
      },
    });
  }

  function abrirRevogar() {
    setModal({
      titulo: `Revogar acesso de ${usuario.nome}?`,
      descricao: "O usuário voltará a ser cliente e não poderá aceitar novos serviços.",
      textoBotao: "Revogar",
      corBotao: "bg-zinc-700 hover:bg-zinc-800",
      onConfirmar: async () => {
        await revogarPrestador(usuario.id);
        onAtualizar(usuario.id, { tipo: "cliente" });
      },
    });
  }

  function abrirBanir() {
    setModal({
      titulo: `Banir ${usuario.nome}?`,
      descricao: "O usuário será removido do app e não poderá mais acessar a plataforma.",
      textoBotao: "Banir",
      corBotao: "bg-red-500 hover:bg-red-600",
      onConfirmar: async () => {
        await banirUsuario(usuario.id);
        onAtualizar(usuario.id, { status: "banido" });
      },
    });
  }

  function abrirDesbanir() {
    setModal({
      titulo: `Desbanir ${usuario.nome}?`,
      descricao: "O usuário voltará a ter acesso normal à plataforma.",
      textoBotao: "Desbanir",
      corBotao: "bg-green-600 hover:bg-green-700",
      onConfirmar: async () => {
        await desbanirUsuario(usuario.id);
        onAtualizar(usuario.id, { status: "ativo" });
      },
    });
  }

  const badge = badgeUsuario(usuario.status);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onFechar} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm z-40 bg-white rounded-t-3xl p-6 flex flex-col gap-5">

        {/* Handle */}
        <div className="w-10 h-1 bg-zinc-200 rounded-full mx-auto -mt-2" />

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${corAvatar(usuario.tipo, usuario.status)}`}>
            {usuario.iniciais}
          </div>
          <div className="flex-1">
            <p className="text-base font-bold text-zinc-800">{usuario.nome}</p>
            <p className="text-xs text-zinc-400">Cadastro: {usuario.cadastro}</p>
          </div>
          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>

        {/* Info */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
          <div className="flex justify-between px-4 py-3">
            <p className="text-xs text-zinc-400">Tipo atual</p>
            <p className="text-xs font-semibold text-zinc-700 capitalize">{usuario.tipo}</p>
          </div>
          <div className="flex justify-between px-4 py-3">
            <p className="text-xs text-zinc-400">Total de serviços</p>
            <p className="text-xs font-semibold text-zinc-700">{usuario.totalServicos}</p>
          </div>
          {usuario.avaliacao && (
            <div className="flex justify-between px-4 py-3">
              <p className="text-xs text-zinc-400">Avaliação média</p>
              <p className="text-xs font-semibold text-zinc-700">⭐ {usuario.avaliacao}</p>
            </div>
          )}
        </div>

        {/* Ações de permissão */}
        <div className="flex flex-col gap-2">
          {usuario.status !== "banido" && usuario.tipo === "cliente" && (
            <button
              onClick={abrirPromover}
              className="w-full py-3 rounded-full bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition"
            >
              ↑ Promover para prestador
            </button>
          )}
          {usuario.status !== "banido" && usuario.tipo === "prestador" && (
            <button
              onClick={abrirRevogar}
              className="w-full py-3 rounded-full bg-zinc-100 text-zinc-700 text-sm font-medium hover:bg-zinc-200 active:scale-[0.98] transition"
            >
              ↓ Revogar acesso de prestador
            </button>
          )}
          {usuario.status !== "banido" ? (
            <button
              onClick={abrirBanir}
              className="w-full py-3 rounded-full bg-red-50 text-red-500 text-sm font-medium hover:bg-red-100 active:scale-[0.98] transition"
            >
              Banir usuário
            </button>
          ) : (
            <button
              onClick={abrirDesbanir}
              className="w-full py-3 rounded-full bg-green-50 text-green-600 text-sm font-medium hover:bg-green-100 active:scale-[0.98] transition"
            >
              Desbanir usuário
            </button>
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      {modal && (
        <ModalConfirmacao modal={modal} onFechar={() => setModal(null)} />
      )}
    </>
  );
}

// ─── Seção de usuários ────────────────────────────────────────────────────────

function SecaoUsuarios() {
  const [busca, setBusca]           = useState("");
  const [filtro, setFiltro]         = useState<"todos" | TipoUsuario | "solicitacoes">("todos");
  const [usuarios, setUsuarios]     = useState<Usuario[]>(usuariosMock);
  const [selecionado, setSelecionado] = useState<Usuario | null>(null);

  // Atualiza localmente após ação (Firestore já foi atualizado nas funções)
  function handleAtualizar(id: string, changes: Partial<Usuario>) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...changes } : u));
    setSelecionado(prev => prev?.id === id ? { ...prev, ...changes } as Usuario : prev);
  }

  const filtrados = usuarios.filter(u => {
    const matchBusca  = u.nome.toLowerCase().includes(busca.toLowerCase());
    const matchFiltro =
      filtro === "todos"        ? true :
      filtro === "solicitacoes" ? (u.tipo === "cliente" && u.status === "ativo") :
      u.tipo === filtro;
    return matchBusca && matchFiltro;
  });

  const totalSolicitacoes = usuarios.filter(u => u.tipo === "cliente" && u.status === "ativo").length;

  return (
    <>
      <div className="flex flex-col gap-4">

        {/* Busca */}
        <div className="flex items-center bg-white border border-zinc-200 rounded-full px-4 py-2.5 gap-2">
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar usuário..."
            className="flex-1 text-sm text-zinc-600 outline-none placeholder-zinc-400 bg-transparent"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {([
            { id: "todos",        label: "Todos" },
            { id: "cliente",      label: "Clientes" },
            { id: "prestador",    label: "Prestadores" },
            { id: "solicitacoes", label: `Promover (${totalSolicitacoes})` },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                filtro === f.id
                  ? "bg-orange-500 text-white"
                  : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
          {filtrados.map(u => {
            const badge = badgeUsuario(u.status);
            return (
              <button
                key={u.id}
                onClick={() => setSelecionado(u)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${corAvatar(u.tipo, u.status)}`}>
                  {u.iniciais}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-700 truncate">{u.nome}</p>
                  <p className="text-[10px] text-zinc-400">
                    {u.tipo === "prestador" ? `Prestador · ⭐ ${u.avaliacao}` : "Cliente"} · {u.totalServicos} serviços
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <svg className="w-4 h-4 text-zinc-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" strokeLinecap="round" />
                  </svg>
                </div>
              </button>
            );
          })}
          {filtrados.length === 0 && (
            <p className="text-center text-zinc-400 text-sm py-6">Nenhum usuário encontrado</p>
          )}
        </div>
      </div>

      {/* Drawer de detalhes */}
      {selecionado && (
        <DrawerUsuario
          usuario={selecionado}
          onFechar={() => setSelecionado(null)}
          onAtualizar={handleAtualizar}
        />
      )}
    </>
  );
}

function SecaoServicos() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Todos os serviços</p>
      {servicosMock.map(s => {
        const badge = badgeServico(s.status);
        return (
          <div key={s.id} className="bg-white border border-zinc-200 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{s.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-zinc-700">{s.tipo}</p>
                <p className="text-[10px] text-zinc-400">{s.data}</p>
              </div>
              <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100">
              <div>
                <p className="text-[10px] text-zinc-400">Cliente</p>
                <p className="text-xs font-medium text-zinc-600">{s.cliente}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-400">Prestador</p>
                <p className="text-xs font-medium text-zinc-600">{s.prestador}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-400">Valor / Comissão</p>
                <p className="text-xs font-medium text-zinc-600">
                  R${s.valor} / <span className="text-orange-500">R${s.comissao}</span>
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SecaoFinanceiro() {
  return (
    <div className="flex flex-col gap-5">
      <div className="bg-orange-500 rounded-2xl p-4 text-white">
        <p className="text-xs opacity-80 mb-1">Total de comissões (mês)</p>
        <p className="text-3xl font-bold mb-1">R$ 9.840,00</p>
        <p className="text-xs opacity-70">20% sobre R$ 49.200 em serviços</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "A liberar",    valor: "R$2.100", sub: "12 serviços pendentes" },
          { label: "Liberado hoje",valor: "R$640",   sub: "4 confirmações" },
          { label: "Saques hoje",  valor: "R$1.800", sub: "3 prestadores" },
          { label: "Contestações", valor: "2",       sub: "Em análise" },
        ].map((c, i) => (
          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-xl font-bold text-zinc-700">{c.valor}</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Últimas transações</p>
        <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
          {[
            { desc: "Comissão · Piso vinílico",    valor: "+R$80",  data: "Hoje, 09:30",  cor: "text-green-600"  },
            { desc: "Saque · João Carlos",         valor: "-R$960", data: "Hoje, 08:15",  cor: "text-red-500"    },
            { desc: "Comissão · Pintura sala",     valor: "+R$64",  data: "Hoje, 07:45",  cor: "text-green-600"  },
            { desc: "Comissão · Chuveiro elétrico",valor: "+R$36",  data: "Ontem, 18:00", cor: "text-green-600"  },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-xs text-zinc-700">{t.desc}</p>
                <p className="text-[10px] text-zinc-400">{t.data}</p>
              </div>
              <p className={`text-sm font-semibold ${t.cor}`}>{t.valor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecaoSuporte() {
  const [chamadoAberto, setChamadoAberto] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Abertos",   valor: "3", cor: "text-red-500"    },
          { label: "Atendendo", valor: "1", cor: "text-orange-500" },
          { label: "Resolvidos",valor: "18",cor: "text-green-600"  },
        ].map((s, i) => (
          <div key={i} className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3 text-center">
            <p className={`text-xl font-bold ${s.cor}`}>{s.valor}</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Chamados</p>
      <div className="flex flex-col gap-3">
        {chamadosMock.map(c => {
          const badge = badgeChamado(c.status);
          const aberto = chamadoAberto === c.id;
          return (
            <div key={c.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setChamadoAberto(aberto ? null : c.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-700">{c.assunto}</p>
                  <p className="text-[10px] text-zinc-400">{c.usuario} · {c.data}</p>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0 ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
                <svg
                  className={`w-4 h-4 text-zinc-300 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" />
                </svg>
              </button>

              {aberto && (
                <div className="border-t border-zinc-100 px-4 py-3 flex gap-2">
                  <button className="flex-1 py-2 rounded-full border border-zinc-200 text-xs text-zinc-600 hover:bg-zinc-50 transition">
                    Responder
                  </button>
                  {c.status !== "resolvido" && (
                    <button className="flex-1 py-2 rounded-full bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition">
                      Marcar resolvido
                    </button>
                  )}
                  <button className="flex-1 py-2 rounded-full bg-red-50 text-red-500 text-xs font-medium hover:bg-red-100 transition">
                    Banir usuário
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Navegação inferior ───────────────────────────────────────────────────────

const navItems: { id: NavId; label: string; path: string }[] = [
  { id: "visao_geral", label: "Visão geral", path: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { id: "usuarios",    label: "Usuários",    path: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { id: "servicos",    label: "Serviços",    path: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" },
  { id: "financeiro",  label: "Financeiro",  path: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { id: "suporte",     label: "Suporte",     path: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" },
];


export default function DashboardAdmin() {
  const router = useRouter();
  const [navAtiva, setNavAtiva]     = useState<NavId>("visao_geral");
  const [carregando, setCarregando] = useState(true);

  // ─── Proteção de rota ─────────────────────────────────
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
  const titulos: Record<NavId, string> = {
    visao_geral: "Visão geral",
    usuarios:    "Usuários",
    servicos:    "Serviços",
    financeiro:  "Financeiro",
    suporte:     "Suporte",
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-sm mx-auto">

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div className="bg-[#f0ede6] px-4 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400">Painel administrativo</p>
            <h1 className="text-xl font-bold text-zinc-700">{titulos[navAtiva]}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-10 h-10 rounded-full bg-white border border-zinc-200 flex items-center justify-center">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M15 17H5a2 2 0 0 1-1.7-3L4 13V11a8 8 0 0 1 16 0v2l.7 1a2 2 0 0 1-1.7 3h-4z" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-2xl bg-zinc-700 flex items-center justify-center text-white text-xs font-bold">
              ADM
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-24">
        {navAtiva === "visao_geral" && <SecaoVisaoGeral />}
        {navAtiva === "usuarios"    && <SecaoUsuarios />}
        {navAtiva === "servicos"    && <SecaoServicos />}
        {navAtiva === "financeiro"  && <SecaoFinanceiro />}
        {navAtiva === "suporte"     && <SecaoSuporte />}
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
              <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
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