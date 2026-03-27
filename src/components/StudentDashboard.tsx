"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, Mission, Badge } from "../types";
import { RANKS, BADGES } from "../constants";
import { getAbsoluteLessonId, getRelativeLesson, getLessonsForModule } from "../utils/lessonMapper";
import { motion, AnimatePresence } from "motion/react";
import { 
  User as UserIcon, 
  Trophy, 
  Send, 
  CheckCircle, 
  Clock, 
  Zap, 
  ChevronRight,
  Rocket,
  Globe,
  Briefcase,
  Presentation as PresentationIcon,
  Database,
  LogOut,
  FileText
} from "lucide-react";
import { fireConfetti } from "../lib/confetti";
import { cn, handleFirestoreError, OperationType } from "../lib/utils";
import { auth } from "../firebase";

const iconMap: Record<string, React.ElementType> = {
  Rocket,
  Globe,
  Briefcase,
  Presentation: PresentationIcon,
  Database
};

function XPCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (displayValue < value) {
        setDisplayValue(prev => Math.min(prev + 5, value));
      } else if (displayValue > value) {
        setDisplayValue(value);
      }
    }, 20);
    return () => clearTimeout(timeout);
  }, [value, displayValue]);

  return <span>{displayValue}</span>;
}

export default function StudentDashboard({ profile }: { profile: UserProfile }) {
  const [module, setModule] = useState("Windows");
  const [classNum, setClassNum] = useState(1);
  const [content, setContent] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "missions"),
      where("studentId", "==", profile.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const missionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      setMissions(missionData);
      
      // Check for new badges based on class completion
      checkBadges(missionData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "missions");
    });

    return () => unsubscribe();
  }, [profile.uid]);

  const checkBadges = async (missionData: Mission[]) => {
    const approvedMissions = missionData.filter(m => m.status !== "pending");
    const completedClasses = new Set(approvedMissions.map(m => m.classNum));
    const maxClass = Math.max(0, ...Array.from(completedClasses));

    const newBadges = BADGES.filter(badge => 
      maxClass >= badge.unlockClass && !profile.unlockedBadges.includes(badge.id)
    );

    if (newBadges.length > 0) {
      const userRef = doc(db, "users", profile.uid);
      await updateDoc(userRef, {
        unlockedBadges: arrayUnion(...newBadges.map(b => b.id))
      });
      
      // Show the first new badge in a special modal
      setNewBadge(newBadges[0]);
      fireConfetti(); // Special confetti for medals
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (content.length < 50) return;

    setLoading(true);
    setAiFeedback("IA analisando seu relatório...");

    // Simulate AI analysis
    setTimeout(async () => {
      let feedback = "Excelente registro! Vi que você dominou habilidades cruciais hoje. Continue assim!";
      const lowerContent = content.toLowerCase();
      if (lowerContent.includes("drive") || lowerContent.includes("email") || lowerContent.includes("planilha")) {
        feedback = "Excelente registro! Vi que você dominou habilidades cruciais hoje. Continue assim!";
      }

      try {
          await addDoc(collection(db, "missions"), {
            studentId: profile.uid,
            studentName: profile.displayName,
            franquiaId: profile.franquiaId,
            turma: profile.turma || "024inf",
            module,
            classNum: getAbsoluteLessonId(module, classNum),
            content,
            status: "pending",
            aiFeedback: feedback,
            createdAt: new Date().toISOString(),
          });

        fireConfetti();
        setContent("");
        setAiFeedback(feedback);
        setTimeout(() => setAiFeedback(null), 5000);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, "missions");
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  const currentRank = RANKS.reduce((prev, curr) => (profile.xp >= curr.minXP ? curr : prev), RANKS[0]);
  const nextRank = RANKS.find(r => r.minXP > profile.xp) || null;
  const progress = nextRank 
    ? ((profile.xp - currentRank.minXP) / (nextRank.minXP - currentRank.minXP)) * 100 
    : 100;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <AnimatePresence>
        {newBadge && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="glass-card p-12 text-center space-y-8 max-w-sm relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-mult-orange/20 to-transparent pointer-events-none" />
              
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="w-32 h-32 bg-mult-orange/20 rounded-full flex items-center justify-center mx-auto neon-glow-orange border-2 border-mult-orange/50"
              >
                {iconMap[newBadge.icon] ? (
                  React.createElement(iconMap[newBadge.icon], { className: "w-16 h-16 text-mult-orange" })
                ) : (
                  <Trophy className="w-16 h-16 text-mult-orange" />
                )}
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tighter text-white">NOVA <span className="text-mult-orange">MEDALHA!</span></h2>
                <p className="text-xl font-bold text-neon-blue uppercase tracking-widest">{newBadge.name}</p>
                <p className="text-gray-400 text-sm italic">"{newBadge.description}"</p>
              </div>

              <button 
                onClick={() => setNewBadge(null)}
                className="w-full bg-mult-orange text-white font-black py-4 rounded-xl transition-all neon-glow-orange uppercase tracking-widest text-xs"
              >
                RECEBER RECOMPENSA
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
            <Rocket className="text-mult-orange w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter leading-none">MULT <span className="text-mult-orange">PROFISSÕES</span></h1>
            <p className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Cockpit v2.0 • Piloto {profile.displayName.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="absolute top-4 right-4 sm:relative sm:top-0 sm:right-0 p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Player Card & Badges */}
        <div className="space-y-8">
          {/* Player Card */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-neon-blue/20 flex items-center justify-center neon-glow-blue border border-neon-blue/30">
                <UserIcon className="text-neon-blue w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{profile.displayName}</h2>
                <p className={cn("text-sm font-bold uppercase tracking-widest", currentRank.color)}>
                  {currentRank.name}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-gray-400">
                <span>XP: <XPCounter value={profile.xp} /></span>
                {nextRank && <span>Próximo: {nextRank.minXP} XP</span>}
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-neon-blue to-mult-orange neon-glow-blue"
                />
              </div>
            </div>
          </motion.div>

          {/* Badges Showcase */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-mult-orange" /> Medalhas Conquistadas
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 sm:gap-4">
              {BADGES.map((badge) => {
                const Icon = iconMap[badge.icon] || Trophy;
                const isUnlocked = profile.unlockedBadges.includes(badge.id);
                return (
                  <div 
                    key={badge.id}
                    title={`${badge.name}: ${badge.description}`}
                    className={cn(
                      "aspect-square rounded-xl flex items-center justify-center transition-all border",
                      isUnlocked 
                        ? "bg-mult-orange/20 border-mult-orange text-mult-orange neon-glow-orange scale-105 sm:scale-110" 
                        : "bg-white/5 border-white/10 text-gray-600 grayscale opacity-50"
                    )}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Middle Column: Mission Control (Form) */}
        <div className="lg:col-span-2 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 sm:p-8 relative"
          >
            <div className="absolute top-0 right-0 p-4">
              <Zap className="text-mult-orange w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
              <Send className="text-neon-blue w-5 h-5 sm:w-6 sm:h-6" /> MISSION CONTROL
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Módulo</label>
                  <select 
                    value={module}
                    onChange={(e) => {
                      setModule(e.target.value);
                      setClassNum(1); // Reset class when module changes
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white"
                  >
                    {["Windows", "Internet", "Word", "PowerPoint", "Excel"].map(m => <option key={m} value={m} className="bg-cockpit-bg">{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aula</label>
                  <select 
                    value={classNum}
                    onChange={(e) => setClassNum(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white"
                  >
                    {getLessonsForModule(module).map(c => <option key={c} value={c} className="bg-cockpit-bg">Aula {c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex justify-between">
                  <span>Diário de Bordo (O que aprendi hoje e minha meta)</span>
                  <span className={cn(content.length < 50 ? "text-red-400" : "text-green-400")}>
                    {content.length}/50
                  </span>
                </label>
                <textarea 
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Descreva seu aprendizado..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-4 h-40 focus:outline-none focus:border-neon-blue resize-none"
                />
              </div>

              <AnimatePresence>
                {aiFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-neon-blue/10 border border-neon-blue/30 rounded-lg text-sm text-neon-blue italic"
                  >
                    {aiFeedback}
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit"
                disabled={loading || content.length < 50}
                className="w-full bg-gradient-to-r from-mult-orange to-orange-600 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 neon-glow-orange flex items-center justify-center gap-2"
              >
                {loading ? "PROCESSANDO DADOS..." : "ENVIAR MISSÃO"}
              </button>
            </form>
          </motion.div>

          {/* Recent Missions List */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Histórico de Missões
            </h3>
            <div className="space-y-3">
              {missions.map((mission) => (
                <motion.div 
                  key={mission.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedMission(mission)}
                  className="glass-card p-4 flex items-center justify-between group hover:border-neon-blue/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0",
                      mission.status === "pending" ? "bg-gray-500/20 text-gray-500" : "bg-neon-blue/20 text-neon-blue"
                    )}>
                      {mission.status === "pending" ? <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> : <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm truncate">{getRelativeLesson(mission.classNum).label}</h4>
                      <p className="text-[10px] sm:text-xs text-gray-500">{new Date(mission.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {mission.status !== "pending" && (
                      <span className="text-[10px] sm:text-xs font-bold text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">
                        +{mission.xpAwarded} XP
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-neon-blue transition-colors" />
                  </div>
                </motion.div>
              ))}
              {missions.length === 0 && (
                <p className="text-center text-gray-600 py-8 italic">Nenhuma missão enviada ainda. Inicie sua jornada!</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mission Detail Modal */}
      <AnimatePresence>
        {selectedMission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-2xl overflow-hidden relative"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                  <h2 className="text-xl font-black tracking-tighter uppercase">DIÁRIO DE <span className="text-mult-orange">BORDO</span></h2>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
                    {getRelativeLesson(selectedMission.classNum).label}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedMission(null)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
                >
                  <LogOut className="w-5 h-5 rotate-180" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data da Missão</p>
                      <p className="text-sm font-bold">{new Date(selectedMission.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</p>
                    <div className={cn(
                      "text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border mt-1",
                      selectedMission.status === 'approved' || selectedMission.status === 'bonus' 
                        ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20" 
                        : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    )}>
                      {selectedMission.status === 'approved' ? 'Aprovada' : selectedMission.status === 'bonus' ? 'Bônus' : 'Pendente'}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    <FileText className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Relato da Missão</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10 min-h-[200px]">
                    <p className="text-gray-300 leading-relaxed whitespace-pre-wrap italic">
                      "{selectedMission.content}"
                    </p>
                  </div>
                </div>

                {selectedMission.xpAwarded && (
                  <div className="flex items-center gap-4 p-4 bg-neon-blue/10 rounded-xl border border-neon-blue/20">
                    <div className="w-10 h-10 rounded-lg bg-neon-blue/20 flex items-center justify-center text-neon-blue neon-glow-blue">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">XP Conquistado</p>
                      <p className="text-lg font-black text-neon-blue">+{selectedMission.xpAwarded} XP</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end">
                <button 
                  onClick={() => setSelectedMission(null)}
                  className="px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
