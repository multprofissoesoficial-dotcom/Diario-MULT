import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { motion } from "motion/react";
import { Rocket, Mail, Lock, ShieldCheck } from "lucide-react";

export default function Auth({ onSeedClick }: { onSeedClick: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError("Credenciais inválidas. Verifique seu e-mail e senha.");
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
        
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 bg-mult-orange/20 rounded-full flex items-center justify-center mb-6 neon-glow-orange border-2 border-mult-orange/30">
            <Rocket className="text-mult-orange w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white text-center leading-none">
            MULT <span className="text-mult-orange">PROFISSÕES</span>
          </h1>
          <div className="h-px w-32 bg-white/10 my-4" />
          <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.4em]">Diário de Bordo 2.0</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">E-mail de Acesso</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-neon-blue focus:bg-white/10 transition-all text-sm"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Senha Secreta</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-neon-blue transition-colors" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:border-neon-blue focus:bg-white/10 transition-all text-sm"
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
            className="w-full bg-mult-orange hover:bg-mult-orange/90 text-white font-black py-4 rounded-xl transition-all neon-glow-orange disabled:opacity-50 mt-4 text-sm tracking-widest uppercase"
          >
            {loading ? "AUTENTICANDO..." : "INICIAR SISTEMAS"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <button
            onClick={onSeedClick}
            className="text-gray-600 text-[10px] uppercase tracking-widest hover:text-neon-blue transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ShieldCheck className="w-3 h-3" /> Primeiro Acesso Mestre
          </button>
        </div>
      </motion.div>
    </div>
  );
}
