"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../src/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../src/lib/firebase";

export default function SplashScreen() {
  const router = useRouter();
  const [fase, setFase] = useState<"entrando" | "saindo">("entrando");

  useEffect(() => {
    // Aguarda 2.5s e começa a animação de saída
    const timerSaida = setTimeout(() => setFase("saindo"), 2500);

    // Após 3s verifica se o usuário já está logado
    const timerRedirect = setTimeout(() => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.push("/login");
          return;
        }

        // Usuário logado — redireciona para a dashboard correta
        const snap = await getDoc(doc(db, "users", user.uid));
        const tipo = snap.data()?.tipo;

        if (tipo === "admin")          router.push("/admin");
        else if (tipo === "prestador") router.push("/prestador");
        else                           router.push("/cliente");
      });
    }, 3000);

    return () => {
      clearTimeout(timerSaida);
      clearTimeout(timerRedirect);
    };
  }, [router]);

  return (
    <div
      className={`min-h-screen bg-[#f0ede6] flex flex-col items-center justify-center gap-6 transition-opacity duration-500 ${
        fase === "saindo" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Logo com animação de entrada */}
      <div
        className={`transition-all duration-700 ${
          fase === "entrando"
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-4"
        }`}
      >
        <img
          src="/logo.png"
          alt="Logo"
          className="w-48"
        />
      </div>

      {/* Nome do app */}
      <div
        className={`flex flex-col items-center gap-1 transition-all duration-700 delay-200 ${
          fase === "entrando"
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4"
        }`}
      >
        <h1 className="text-2xl font-bold text-zinc-700">Reforma Connect</h1>
        <p className="text-sm text-zinc-400">Serviços domésticos na palma da mão</p>
      </div>

      {/* Loading dots */}
      <div
        className={`flex gap-2 mt-4 transition-all duration-500 delay-500 ${
          fase === "entrando" ? "opacity-100" : "opacity-0"
        }`}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-orange-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}