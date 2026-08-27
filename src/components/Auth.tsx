"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import AdminDashboard from "./AdminDashboard";
import StudentDashboard from "./StudentDashboard";
import AtsDashboard from "./AtsDashboard";
import { auth as firebaseAuth } from "../firebase";
import { 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from "firebase/auth";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { Rocket, Mail, Lock, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function Auth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Monitorar Sessão do Firebase Auth e Buscar Perfil no Supabase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Busca o perfil na tabela 'usuarios' do Supabase usando o UID ou E-mail
          let { data, error } = await supabase
            .from("usuarios")
            .select("*")
            .or(`uid.eq.${firebaseUser.uid},id.eq.${firebaseUser.uid},email.eq.${firebaseUser.email}`)
            .single();

          if (error || !data) {
            // Fallback caso não ache pelo UID exato, busca pelo e-mail exato normalizado
            const { data: dataEmail } = await supabase
              .from("usuarios")
              .select("*")
              .ilike("email", firebaseUser.email || "")
              .single();
            
            data = dataEmail;
          }

          if (data) {
            const mappedProfile: UserProfile = {
              id: data.id,
              uid: data.uid || data.id,
              email: data.email,
              displayName: data.display_name,
              codigo: data.codigo,
              role: data.role,
              franquiaId: data.franquia_id,
              turma: data.turma,
              xp: data.xp || 0,
              skills: data.skills || [],
              resumeUrl: data.resume_url,
              availabilityStatus: data.availability_status,
              withdrawalReason: data.withdrawal_reason,
              unlockedBadges: data.unlocked_badges || [],
              currentCourseId: data.current_course_id || "INF",
              atsTermsAccepted: Boolean(data.ats_terms_accepted),
              atsTermsAcceptedAt: data.ats_terms_accepted_at,
              perceptions: data.perceptions || {},
              employmentHistory: data.employment_history || [],
              createdAt: data.created_at,
              lastLogin: data.last_login
            };
            setProfile(mappedProfile);
          } else {
            setAuthError("Perfil não encontrado no banco de dados do Supabase.");
          }
        } catch (err: any) {
          console.error("Erro ao buscar perfil no Supabase:", err);
          setAuthError("Erro ao carregar dados do perfil.");
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setSubmitting(true);

    try {
      let loginEmail = email.trim().toLowerCase();
      
      // Se o usuário digitou apenas números, assume o padrão de login por código de matrícula
      if (/^\d+$/.test(loginEmail)) {
        loginEmail = `${loginEmail}@mult.com.br`;
      }

      await signInWithEmailAndPassword(firebaseAuth, loginEmail, password);
    } catch (err: any) {
      console.error("Erro no login:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setAuthError("E-mail, matrícula ou senha incorretos.");
      } else {
        setAuthError("Erro ao autenticar. Verifique seus dados.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cockpit-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-mult-orange animate-spin" />
          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Conectando ao Cockpit...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-cockpit-bg flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-mult-orange/10 via-cockpit-bg to-cockpit-bg pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card max-w-md w-full p-8 relative z-10 space-y-8 border-white/10"
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/30">
              <Rocket className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter">MULT <span className="text-mult-orange">PROFISSÕES</span></h1>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Portal Diário de Bordo 2.0</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail ou Matrícula</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  required
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail ou código de matrícula"
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-mult-orange transition-all text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha de acesso"
                  className="w-full pl-11 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-mult-orange transition-all text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={submitting}
              className="w-full bg-mult-orange hover:bg-mult-orange/90 text-white font-black py-4 rounded-xl transition-all neon-glow-orange uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {submitting ? "AUTENTICANDO..." : "ACESSAR COCKPIT"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Roteamento baseado no cargo (Role) do Supabase
  if (["master", "coordenador", "professor", "rh"].includes(profile.role)) {
    if (profile.role === "rh") {
      return <AtsDashboard profile={profile} />;
    }
    return <AdminDashboard profile={profile} />;
  }

  return <StudentDashboard profile={profile} />;
}
