import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { motion } from "motion/react";
import { Rocket, Mail, Lock, ShieldCheck } from "lucide-react";

export default function Auth({ onSeedClick }: { onSeedClick: () => void }) {
  const [activeTab, setActiveTab] = useState<"aluno" | "admin">("aluno");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let finalEmail = identifier;
      
      if (activeTab === "aluno") {
        // If it's a student and identifier is numeric, assume it's a student code
        if (/^\d+$/.test(identifier)) {
          finalEmail = `${identifier}@mult.com.br`;
        } else if (!identifier.includes("@")) {
          // If not numeric but no @, maybe it's a code with letters?
          finalEmail = `${identifier}@mult.com.br`;
        }
      }

      await signInWithEmailAndPassword(auth, finalEmail, password);
    } catch (err: any) {
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Credenciais inválidas. Verifique seus dados e senha.");
      } else {
        setError("Erro ao autenticar. Tente novamente mais tarde.");
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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">
              {activeTab === "aluno" ? "Matrícula ou E-mail" : "E-mail Administrativo"}
            </label>
            <div className="relative group">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors ${activeTab === "aluno" ? "group-focus-within:text-mult-orange" : "group-focus-within:text-neon-blue"}`} />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none transition-all text-sm ${
                  activeTab === "aluno" ? "focus:border-mult-orange focus:bg-mult-orange/5" : "focus:border-neon-blue focus:bg-neon-blue/5"
                }`}
                placeholder={activeTab === "aluno" ? "Digite sua matrícula" : "seu@email.com"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Senha Secreta</label>
            <div className="relative group">
              <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-colors ${activeTab === "aluno" ? "group-focus-within:text-mult-orange" : "group-focus-within:text-neon-blue"}`} />
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

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-[11px] text-center font-bold bg-red-400/10 py-2 rounded-lg border border-red-400/20"
            >
              {error}
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
