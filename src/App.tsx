import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { motion, AnimatePresence } from "motion/react";
import { Rocket, LogOut } from "lucide-react";
import { auth } from "./firebase";
import { useState } from "react";

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-cockpit-bg flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-mult-orange/20 rounded-full flex items-center justify-center neon-glow-orange"
        >
          <Rocket className="text-mult-orange w-8 h-8" />
        </motion.div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
          Iniciando Sistemas...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cockpit-bg selection:bg-neon-blue selection:text-black">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Auth onSeedClick={() => {}} />
          </motion.div>
        ) : profile ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {profile.role === "aluno" ? (
              <StudentDashboard profile={profile} />
            ) : profile.role === "professor" ? (
              <TeacherDashboard profile={profile} />
            ) : (
              <AdminDashboard profile={profile} />
            )}
          </motion.div>
        ) : (
          <div className="min-h-screen flex flex-col items-center justify-center bg-cockpit-bg p-6 text-center">
            <div className="glass-card p-8 max-w-md space-y-6 border-red-500/30">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                <Rocket className="text-red-500 w-8 h-8 rotate-180" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter">Erro de Sincronização</h2>
                <p className="text-gray-400 text-sm">
                  Sua conta de acesso existe, mas seu perfil de aluno/colaborador não foi encontrado no banco de dados.
                </p>
                <p className="text-gray-500 text-xs italic">
                  Isso geralmente ocorre quando uma importação é interrompida. Entre em contato com o suporte.
                </p>
              </div>
              <button 
                onClick={() => auth.signOut()}
                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> VOLTAR AO LOGIN
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
