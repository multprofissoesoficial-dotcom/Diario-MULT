"use client";

import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "../firebase";
import { motion } from "motion/react";
import { Rocket, Mail, Lock as LockIcon, ShieldCheck, HelpCircle, MapPin, ChevronRight } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

interface Franquia {
  id: string;
  nome: string;
}

export default function Auth({ onSeedClick }: { onSeedClick: () => void }) {
  const [activeTab, setActiveTab] = useState<"aluno" | "admin">("aluno");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [selectedFranquia, setSelectedFranquia] = useState("");
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [loadingFranquias, setLoadingFranquias] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    const fetchFranquias = async () => {
      setLoadingFranquias(true);
      try {
        console.log("Buscando franquias...");
        const q = query(collection(db, "franquias"), orderBy("nome", "asc"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        console.log("Franquias encontradas:", list);
        setFranquias(list);
      } catch (err) {
        console.error("Erro ao buscar franquias:", err);
      } finally {
        setLoadingFranquias(false);
      }
    };
    fetchFranquias();
  }, []);

  const getFinalEmail = (id: string) => {
    let email = id.trim().toLowerCase();
    if (activeTab === "aluno") {
      if (!email.includes("@")) {
        // If it's just a code, we MUST have a selected unit
        if (!selectedFranquia) {
          throw new Error("Por favor, selecione sua unidade.");
        }
        // NEW STANDARD: unit_code@mult.com.br
        email = `${selectedFranquia}_${email}@mult.com.br`;
      }
    }
    return email;
  };

  const handleForgotPassword = async () => {
    if (!identifier) {
      setError("Digite seu e-mail ou matrícula primeiro.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const email = getFinalEmail(identifier);
      await sendPasswordResetEmail(auth, email);
      setSuccess("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error("Erro ao enviar reset:", err);
      setError(err.message || "Erro ao enviar e-mail. Verifique se os dados estão corretos.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const finalEmail = getFinalEmail(identifier);
      console.log("Tentando login com:", finalEmail);
      await signInWithEmailAndPassword(auth, finalEmail, password);
    } catch (err: any) {
      console.error("Erro de login:", err.code, err.message);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Dados de acesso incorretos. Verifique sua unidade, matrícula e senha.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Muitas tentativas. Tente novamente em alguns minutos.");
      } else {
        setError(err.message || "Erro ao autenticar. Verifique sua conexão ou tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] from-neon-blue/10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-10 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-mult-orange to-neon-blue" />
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-mult-orange/20 rounded-full flex items-center justify-center mb-4 neon-glow-orange border-2 border-mult-orange/30">
            <Rocket className="text-mult-orange w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white text-center leading-none">
            MULT <span className="text-mult-orange">PROFISSÕES</span>
          </h1>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.4em] mt-2">Diário de Bordo 2.0</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl mb-8 border border-white/10">
          <button
            onClick={() => { setActiveTab("aluno"); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "aluno" 
                ? "bg-mult-orange text-white shadow-lg" 
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Acesso Aluno
          </button>
          <button
            onClick={() => { setActiveTab("admin"); setError(""); }}
            className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "admin" 
                ? "bg-neon-blue text-black shadow-lg" 
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Administrativo
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === "aluno" && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
                Selecione sua Unidade
              </label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-mult-orange transition-colors" />
                <select
                  required
                  disabled={loadingFranquias}
                  value={selectedFranquia}
                  onChange={(e) => setSelectedFranquia(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-10 focus:outline-none transition-all text-sm focus:border-mult-orange focus:bg-mult-orange/5 appearance-none text-white cursor-pointer disabled:opacity-50"
                >
                  <option value="" disabled className="bg-cockpit-bg">
                    {loadingFranquias ? "Carregando unidades..." : "Escolha sua unidade..."}
                  </option>
                  {franquias.map(f => (
                    <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="w-4 h-4 text-gray-500 rotate-90" />
                </div>
              </div>
              <p className="text-[9px] text-gray-600 italic ml-1">A unidade é obrigatória para identificar seu perfil único.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
              {activeTab === "aluno" ? "Sua Matrícula" : "E-mail Administrativo"}
            </label>
            <div className="relative group">
              {activeTab === "aluno" ? (
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-mult-orange transition-colors" />
              ) : (
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
              )}
              <input
                type={activeTab === "aluno" ? "text" : "email"}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none transition-all text-sm ${
                  activeTab === "aluno" ? "focus:border-mult-orange focus:bg-mult-orange/5" : "focus:border-neon-blue focus:bg-neon-blue/5"
                }`}
                placeholder={activeTab === "aluno" ? "Ex: 14100" : "seu@email.com"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Senha Secreta</label>
            <div className="relative group">
              <LockIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors ${activeTab === "aluno" ? "group-focus-within:text-mult-orange" : "group-focus-within:text-neon-blue"}`} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none transition-all text-sm ${
                  activeTab === "aluno" ? "focus:border-mult-orange focus:bg-mult-orange/5" : "focus:border-neon-blue focus:bg-neon-blue/5"
                }`}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-[10px] font-bold text-gray-500 hover:text-mult-orange transition-colors uppercase tracking-widest flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3" /> Esqueci minha senha
            </button>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-[11px] text-center font-bold bg-red-400/10 py-2 rounded-lg border border-red-400/20"
            >
              {error}
            </motion.p>
          )}

          {success && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-green-400 text-[11px] text-center font-bold bg-green-400/10 py-2 rounded-lg border border-green-400/20"
            >
              {success}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-black py-4 rounded-xl transition-all disabled:opacity-50 mt-4 text-sm tracking-widest uppercase shadow-lg ${
              activeTab === "aluno" 
                ? "bg-mult-orange hover:bg-mult-orange/90 text-white shadow-mult-orange/20" 
                : "bg-neon-blue hover:bg-neon-blue/90 text-black shadow-neon-blue/20"
            }`}
          >
            {loading ? "AUTENTICANDO..." : "INICIAR SISTEMAS"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-gray-600 text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
            <ShieldCheck className="w-3 h-3" /> Acesso Restrito MULT Profissões
          </p>
        </div>
      </motion.div>
    </div>
  );
}
