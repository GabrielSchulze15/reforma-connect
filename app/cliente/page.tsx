"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../src/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, query, where, onSnapshot, 
  orderBy, updateDoc, doc, serverTimestamp 
} from "firebase/firestore";

// --- Tipos ---
type NavId = "inicio" | "pedidos" | "chat" | "historico" | "perfil";
type StatusPedido = "aguardando_prestador" | "negociando" | "em_andamento" | "concluido" | "cancelado";

interface Pedido {
  id: string;
  tipo: string;
  descricao: string;
  endereco: string;
  status: StatusPedido;
  prestadorNome?: string;
  valor?: number;
  criadoEm: any;
}

interface Mensagem {
  id: string;
  texto: string;
  de: "cliente" | "prestador" | "sistema";
  nomeRemetente: string;
  hora: any;
}

// --- Mocks para categorias (pode mover para um arquivo separado) ---
const CATEGORIAS = [
  { id: "eletrica", nome: "Elétrica", icone: "⚡" },
  { id: "hidraulica", nome: "Hidráulica", icone: "💧" },
  { id: "reforma", nome: "Reforma", icone: "🔨" },
  { id: "pintura", nome: "Pintura", icone: "🎨" },
  { id: "limpeza", nome: "Limpeza", icone: "✨" },
  { id: "outros", nome: "Outros", icone: "🛠️" },
];

export default function DashboardCliente() {
  const router = useRouter();
  
  // Estados de Autenticação e Carregamento
  const [carregando, setCarregando] = useState(true);
  const [usuarioLogado, setUsuarioLogado] = useState<any>(null);

  // Estados de Navegação
  const [navAtiva, setNavAtiva] = useState<NavId>("inicio");
  
  // Estados de Dados (Firestore)
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidoAtivo, setPedidoAtivo] = useState<Pedido | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  
  // Estados de UI (Modais e Formulários)
  const [mostrarModalCategoria, setMostrarModalCategoria] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  
  // Chat
  const [textoMsg, setTextoMsg] = useState("");
  const [enviandoMsg, setEnviandoMsg] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Proteção de Rota ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login");
      } else {
        setUsuarioLogado(user);
        setCarregando(false);
      }
    });
    return () => unsub();
  }, [router]);

  // --- Listener de Pedidos em Tempo Real ---
  useEffect(() => {
    if (!usuarioLogado || navAtiva === "perfil") return;

    const q = query(
      collection(db, "pedidos"),
      where("clienteId", "==", usuarioLogado.uid),
      orderBy("criadoEm", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lista: Pedido[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as Pedido);
      });
      
      setPedidos(lista);
      // Define o primeiro pedido "ativo" (não concluído/cancelado) como foco
      const ativo = lista.find(p => !["concluido", "cancelado"].includes(p.status));
      setPedidoAtivo(ativo || null);
    });

    return () => unsub();
  }, [usuarioLogado, navAtiva]);

  // --- Listener do Chat em Tempo Real ---
  useEffect(() => {
    if (!pedidoAtivo) {
      setMensagens([]);
      return;
    }

    const q = query(
      collection(db, "chats", pedidoAtivo.id, "mensagens"),
      orderBy("hora", "asc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: Mensagem[] = [];
      snapshot.forEach((doc) => {
        msgs.push(doc.data() as Mensagem);
      });
      setMensagens(msgs);
      // Scroll para o final quando chegar mensagem nova
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [pedidoAtivo]);

  // --- Ações ---

  async function handleCriarPedido() {
    if (!categoriaSelecionada || !descricao.trim() || !endereco.trim()) {
      alert("Preencha todos os campos!");
      return;
    }
    if (!usuarioLogado) return;

    setEnviandoPedido(true);
    try {
      await addDoc(collection(db, "pedidos"), {
        clienteId: usuarioLogado.uid,
        clienteNome: usuarioLogado.displayName || "Cliente",
        categoriaId: categoriaSelecionada,
        tipo: CATEGORIAS.find(c => c.id === categoriaSelecionada)?.nome || "Serviço",
        descricao,
        endereco,
        status: "aguardando_prestador",
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      
      // Limpa e volta para início
      setCategoriaSelecionada("");
      setDescricao("");
      setEndereco("");
      setMostrarModalCategoria(false);
      setNavAtiva("inicio");
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      alert("Erro ao solicitar serviço. Tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  }

  async function handleEnviarMensagem() {
    if (!textoMsg.trim() || !pedidoAtivo || !usuarioLogado) return;

    setEnviandoMsg(true);
    try {
      await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
        texto: textoMsg,
        de: "cliente",
        deId: usuarioLogado.uid,
        nomeRemetente: usuarioLogado.displayName || "Eu",
        hora: serverTimestamp(),
        tipo: "texto"
      });
      setTextoMsg("");
    } catch (error) {
      console.error("Erro ao enviar msg:", error);
    } finally {
      setEnviandoMsg(false);
    }
  }

  async function handleConfirmarConclusao() {
    if (!pedidoAtivo) return;
    if (!confirm("Confirmar que o serviço foi realizado? O valor será liberado ao prestador.")) return;

    try {
      await updateDoc(doc(db, "pedidos", pedidoAtivo.id), {
        status: "concluido",
        atualizadoEm: serverTimestamp()
      });
      // Adiciona mensagem de sistema no chat
      await addDoc(collection(db, "chats", pedidoAtivo.id, "mensagens"), {
        texto: "O cliente confirmou a conclusão do serviço.",
        de: "sistema",
        nomeRemetente: "Sistema",
        hora: serverTimestamp(),
        tipo: "sistema"
      });
    } catch (error) {
      alert("Erro ao confirmar conclusão.");
    }
  }

  async function handleSair() {
    await auth.signOut();
    document.cookie = "firebaseToken=; path=/; max-age=0";
    router.push("/login");
  }

  // --- Renderização Condicional ---
  if (carregando) return null;

  const titulos: Record<NavId, string> = {
    inicio: `Olá, ${usuarioLogado?.displayName?.split(" ")[0] ?? "Cliente"}! 👋`,
    pedidos: "Meus Pedidos",
    chat: pedidoAtivo ? `Chat: ${pedidoAtivo.prestadorNome || "Aguardando..."}` : "Chat",
    historico: "Histórico",
    perfil: "Perfil",
  };

  // --- Componentes Internos ---

  function renderizarInicio() {
    return (
      <div className="flex flex-col gap-6 pb-24">
        {/* Card de Ação Principal */}
        {!pedidoAtivo ? (
          <div className="bg-orange-500 rounded-3xl p-6 text-white shadow-lg shadow-orange-200">
            <h2 className="text-xl font-bold mb-2">Precisa de um reparo?</h2>
            <p className="text-orange-100 text-sm mb-6">Encontre um profissional qualificado em minutos.</p>
            <button
              onClick={() => setMostrarModalCategoria(true)}
              className="w-full bg-white text-orange-600 font-bold py-4 rounded-full hover:bg-orange-50 transition shadow-md"
            >
              Solicitar Novo Serviço
            </button>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-2">
                  {pedidoAtivo.status.replace("_", " ").toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-zinc-800">{pedidoAtivo.tipo}</h3>
                <p className="text-sm text-zinc-500">{pedidoAtivo.endereco}</p>
              </div>
              {pedidoAtivo.prestadorNome && (
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Profissional</p>
                  <p className="text-sm font-semibold text-zinc-700">{pedidoAtivo.prestadorNome}</p>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setNavAtiva("chat")}
              className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-3 rounded-full font-medium hover:bg-zinc-800 transition"
            >
              <span>💬</span> Ir para o Chat
            </button>
          </div>
        )}

        {/* Lista de Pedidos Recentes (Resumo) */}
        <div>
          <h3 className="text-lg font-bold text-zinc-800 mb-4">Atividade Recente</h3>
          {pedidos.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">Nenhum pedido ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pedidos.slice(0, 3).map((p) => (
                <div key={p.id} className="bg-white p-4 rounded-2xl border border-zinc-100 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-zinc-800">{p.tipo}</p>
                    <p className="text-xs text-zinc-400">{new Date(p.criadoEm?.seconds * 1000).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    p.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.status === 'concluido' ? 'Feito' : 'Em andamento'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderizarChat() {
    if (!pedidoAtivo) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-zinc-400">
          <span className="text-4xl mb-4">💭</span>
          <p>Não há nenhum pedido ativo para conversar.</p>
          <button onClick={() => setNavAtiva("inicio")} className="mt-4 text-orange-500 font-bold">Ir para Início</button>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 rounded-2xl mb-4">
          {mensagens.map((msg) => {
            const ehMinha = msg.de === "cliente";
            const ehSistema = msg.de === "sistema";
            
            if (ehSistema) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-xs bg-zinc-200 text-zinc-600 px-3 py-1 rounded-full">{msg.texto}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${ehMinha ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                  ehMinha 
                    ? "bg-orange-500 text-white rounded-br-none" 
                    : "bg-white text-zinc-800 border border-zinc-200 rounded-bl-none"
                }`}>
                  <p>{msg.texto}</p>
                  <span className={`text-[10px] block mt-1 text-right ${ehMinha ? "text-orange-200" : "text-zinc-400"}`}>
                    {msg.hora?.seconds ? new Date(msg.hora.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-full border border-zinc-200 shadow-sm">
          <input
            type="text"
            value={textoMsg}
            onChange={(e) => setTextoMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnviarMensagem()}
            placeholder="Digite sua mensagem..."
            className="flex-1 px-4 py-2 outline-none text-sm text-zinc-700"
          />
          <button
            onClick={handleEnviarMensagem}
            disabled={enviandoMsg || !textoMsg.trim()}
            className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white disabled:opacity-50 hover:bg-orange-600 transition"
          >
            ➤
          </button>
        </div>

        {pedidoAtivo.status === "em_andamento" && (
          <button
            onClick={handleConfirmarConclusao}
            className="mt-4 w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition"
          >
            Confirmar Conclusão do Serviço
          </button>
        )}
      </div>
    );
  }

  function renderizarHistorico() {
    const historico = pedidos.filter(p => ["concluido", "cancelado"].includes(p.status));
    return (
      <div className="flex flex-col gap-4 pb-24">
        {historico.length === 0 ? (
          <p className="text-zinc-400 text-center mt-10">Nenhum histórico disponível.</p>
        ) : (
          historico.map((p) => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-zinc-100">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-zinc-800">{p.tipo}</span>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  p.status === 'concluido' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {p.status === 'concluido' ? 'Concluído' : 'Cancelado'}
                </span>
              </div>
              <p className="text-sm text-zinc-500 mb-2">{p.descricao}</p>
              <p className="text-xs text-zinc-400">{new Date(p.criadoEm?.seconds * 1000).toLocaleDateString()}</p>
            </div>
          ))
        )}
      </div>
    );
  }

  function SecaoPerfil() {
    // Implementação simplificada para focar no fluxo de pedidos
    // Você pode manter a sua versão anterior de edição de perfil aqui
    return (
      <div className="flex flex-col gap-5">
         <div className="flex flex-col items-center py-6 bg-[#f0ede6] rounded-2xl gap-3">
            <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">
              {usuarioLogado?.displayName?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-zinc-800">{usuarioLogado?.displayName || "Usuário"}</p>
              <p className="text-xs text-zinc-500">{usuarioLogado?.email}</p>
            </div>
         </div>
         <button onClick={handleSair} className="w-full py-3.5 rounded-full border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition">
           Sair da conta
         </button>
      </div>
    );
  }

  // --- Layout Principal ---
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-black tracking-tight text-orange-600">Reforma<span className="text-zinc-900">Connect</span></h1>
        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600">
          {usuarioLogado?.displayName?.[0]?.toUpperCase() || "?"}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-6">{titulos[navAtiva]}</h2>
        
        {navAtiva === "inicio" && renderizarInicio()}
        {navAtiva === "pedidos" && (
           <div className="text-sm text-zinc-500">
             <p>Gerencie seus pedidos na tela inicial ou no histórico.</p>
             <button onClick={() => setNavAtiva("inicio")} className="text-orange-500 font-bold mt-2">Voltar</button>
           </div>
        )}
        {navAtiva === "chat" && renderizarChat()}
        {navAtiva === "historico" && renderizarHistorico()}
        {navAtiva === "perfil" && <SecaoPerfil />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex justify-between items-center z-40 safe-area-pb">
        {[
          { id: "inicio", label: "Início", icon: "🏠" },
          { id: "pedidos", label: "Pedidos", icon: "📋" },
          { id: "chat", label: "Chat", icon: "💬" },
          { id: "historico", label: "Histórico", icon: "🕒" },
          { id: "perfil", label: "Perfil", icon: "👤" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setNavAtiva(item.id as NavId)}
            className={`flex flex-col items-center gap-1 transition ${
              navAtiva === item.id ? "text-orange-600 scale-110" : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Modal de Nova Solicitação */}
      {mostrarModalCategoria && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setMostrarModalCategoria(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-bold mb-4">O que você precisa?</h3>
            
            <div className="grid grid-cols-3 gap-3 mb-6">
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaSelecionada(cat.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition ${
                    categoriaSelecionada === cat.id
                      ? "border-orange-500 bg-orange-50 text-orange-600"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <span className="text-2xl mb-1">{cat.icone}</span>
                  <span className="text-xs font-medium">{cat.nome}</span>
                </button>
              ))}
            </div>

            {categoriaSelecionada && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <textarea
                  placeholder="Descreva o problema (ex: Vazamento na pia da cozinha)"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:border-orange-500 resize-none h-24"
                />
                <input
                  type="text"
                  placeholder="Seu endereço completo"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm outline-none focus:border-orange-500"
                />
                
                <button
                  onClick={handleCriarPedido}
                  disabled={enviandoPedido}
                  className="w-full bg-orange-500 text-white font-bold py-4 rounded-full hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {enviandoPedido ? "Solicitando..." : "Confirmar Solicitação"}
                </button>
              </div>
            )}
            
            <div className="h-6" />
          </div>
        </>
      )}
    </div>
  );
}