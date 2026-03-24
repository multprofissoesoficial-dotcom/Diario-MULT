import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import StudentDashboard from "./components/StudentDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import AdminDashboard from "./components/AdminDashboard";
import SeedMaster from "./components/SeedMaster";
import { motion, AnimatePresence } from "motion/react";
import { Rocket } from "lucide-react";
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
          <div className="min-h-screen flex items-center justify-center text-red-400">
            Erro ao carregar perfil. Tente novamente.
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
