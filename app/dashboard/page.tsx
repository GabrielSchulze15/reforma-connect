"use client";

import { useEffect, useState } from "react";

import { auth, db } from "../../src/lib/firebase";

import { onAuthStateChanged, signOut } from "firebase/auth";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { useRouter } from "next/navigation";


export default function DashboardPage() {
  const [userData, setUserData] = useState<any>(null);
  const [tipoServico, setTipoServico] = useState("");
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const servicos = [
  "Elétrica",
  "Hidráulica",
  "Pintura",
  "Construção",
  "Reparos",
  "Acabamentos",
];

  async function handleLogout() {
  await signOut(auth);

  window.location.href = "/login";
}
async function handleCreateService() {
  try {
    const user = auth.currentUser;

    if (!user) return;

    await addDoc(collection(db, "services"), {
      clienteId: user.uid,
      tipoServico,
      descricao,
      endereco,
      status: "pendente",
      criadoEm: new Date(),
    });

    alert("Serviço solicitado com sucesso!");

    setTipoServico("");
    setDescricao("");
    setEndereco("");

  } catch (error) {
    console.error(error);
    alert("Erro ao criar serviço");
  }
}

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {

      // se NÃO estiver logado
      if (!user) {
        router.push("/login");
        return;
      }

      // se estiver logado
      const docRef = doc(db, "users", user.uid);

      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserData(docSnap.data());
        const servicesQuery = query(
  collection(db, "services"),
  where("clienteId", "==", user.uid)
);

const servicesSnapshot = await getDocs(servicesQuery);

const servicesList: any[] = [];

servicesSnapshot.forEach((doc) => {
  servicesList.push({
    id: doc.id,
    ...doc.data(),
  });
});

setServices(servicesList);
      }
    });

    return () => unsubscribe();
  }, [router]);

 return (
  <div className="min-h-screen bg-black text-white p-10">
    <h1 className="text-4xl font-bold mb-8">
      Dashboard
    </h1>

    {userData ? (
      <>
        <div className="bg-zinc-900 p-6 rounded-2xl w-[400px]">
          <img
            src={userData.foto || "https://via.placeholder.com/150"}
            alt="Foto do usuário"
            className="w-24 h-24 rounded-full mb-4 object-cover"
          />

          <h2 className="text-2xl font-bold">
            {userData.nome}
          </h2>

          <p className="text-zinc-400">
            {userData.email}
          </p>

          <p className="mt-4">
            Tipo:{" "}
            <span className="font-bold text-green-400">
              {userData.tipo}
            </span>
          </p>

          <button
            onClick={handleLogout}
            className="mt-6 w-full bg-red-500 hover:bg-red-600 transition py-3 rounded-xl font-bold"
          >
            Sair da conta
          </button>
        </div>

        <div className="bg-zinc-900 p-6 rounded-2xl w-[400px] mt-8">
          <h2 className="text-2xl font-bold mb-4">
            Solicitar Serviço
          </h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
           {servicos.map((servico) => (
            <button
             key={servico}
             onClick={() => setTipoServico(servico)}
             className={`
              p-4 rounded-2xl transition font-bold
              ${
               tipoServico === servico
                 ? "bg-orange-500 text-white"
                 : "bg-zinc-800 hover:bg-zinc-700"
        }
      `}
    >
      {servico}
    </button>
  ))}
</div>

          <textarea
            placeholder="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full p-3 rounded-xl bg-zinc-800 mb-4 outline-none h-32"
          />

          <input
            type="text"
            placeholder="Endereço"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            className="w-full p-3 rounded-xl bg-zinc-800 mb-4 outline-none"
          />

          <button
            onClick={handleCreateService}
            className="w-full bg-green-500 hover:bg-green-600 transition py-3 rounded-xl font-bold"
          >
            Solicitar Serviço
          </button>
        </div>
        <div className="mt-10">
  <h2 className="text-3xl font-bold mb-6">
    Meus Serviços
  </h2>

  <div className="grid gap-4">
    {services.map((service) => (
      <div
        key={service.id}
        className="bg-zinc-900 p-6 rounded-2xl w-[400px]"
      >
        <h3 className="text-xl font-bold text-orange-400">
          {service.tipoServico}
        </h3>

        <p className="mt-2 text-zinc-300">
          {service.descricao}
        </p>

        <p className="mt-2 text-zinc-500">
          📍 {service.endereco}
        </p>

        <p className="mt-4">
          Status:{" "}
          <span className="text-yellow-400 font-bold">
            {service.status}
          </span>
        </p>
      </div>
    ))}
  </div>
</div>
      </>
    ) : (
      <p>Carregando...</p>
    )}
  </div>
);
}