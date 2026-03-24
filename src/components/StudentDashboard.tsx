import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, Mission } from "../types";
import { MODULES, CLASSES, RANKS, BADGES } from "../constants";
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
  Presentation,
  Database,
  LogOut
} from "lucide-react";
import { fireConfetti } from "../lib/confetti";
import { cn } from "../lib/utils";
import { auth } from "../firebase";

const iconMap: any = {
  Rocket,
  Globe,
  Briefcase,
  Presentation,
  Database
};

export default function StudentDashboard({ profile }: { profile: UserProfile }) {
  const [module, setModule] = useState(MODULES[0]);
  const [classNum, setClassNum] = useState(1);
  const [content, setContent] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

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
          module,
          classNum,
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
        console.error(err);
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-mult-orange/20 rounded-xl flex items-center justify-center neon-glow-orange border border-mult-orange/30">
            <Rocket className="text-mult-orange w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">MULT <span className="text-mult-orange">PROFISSÕES</span></h1>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Cockpit v2.0 • Piloto {profile.displayName.split(' ')[0]}</p>
          </div>
        </div>
        <button 
          onClick={() => auth.signOut()}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
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
                <span>XP: {profile.xp}</span>
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
            <div className="grid grid-cols-5 gap-4">
              {BADGES.map((badge) => {
                const Icon = iconMap[badge.icon];
                const isUnlocked = profile.unlockedBadges.includes(badge.id);
                return (
                  <div 
                    key={badge.id}
                    title={`${badge.name}: ${badge.description}`}
                    className={cn(
                      "aspect-square rounded-xl flex items-center justify-center transition-all border",
                      isUnlocked 
                        ? "bg-mult-orange/20 border-mult-orange text-mult-orange neon-glow-orange scale-110" 
                        : "bg-white/5 border-white/10 text-gray-600 grayscale opacity-50"
                    )}
                  >
                    <Icon className="w-6 h-6" />
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
            className="glass-card p-8 relative"
          >
            <div className="absolute top-0 right-0 p-4">
              <Zap className="text-mult-orange w-6 h-6 animate-pulse" />
            </div>
            
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Send className="text-neon-blue w-6 h-6" /> MISSION CONTROL
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Módulo</label>
                  <select 
                    value={module}
                    onChange={(e) => setModule(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white"
                  >
                    {MODULES.map(m => <option key={m} value={m} className="bg-cockpit-bg">{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aula</label>
                  <select 
                    value={classNum}
                    onChange={(e) => setClassNum(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white"
                  >
                    {CLASSES.map(c => <option key={c} value={c} className="bg-cockpit-bg">Aula {c}</option>)}
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
                  className="glass-card p-4 flex items-center justify-between group hover:border-neon-blue/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      mission.status === "pending" ? "bg-gray-500/20 text-gray-500" : "bg-neon-blue/20 text-neon-blue"
                    )}>
                      {mission.status === "pending" ? <Clock className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{mission.module} - Aula {mission.classNum}</h4>
                      <p className="text-xs text-gray-500">{new Date(mission.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {mission.status !== "pending" && (
                      <span className="text-xs font-bold text-neon-blue bg-neon-blue/10 px-2 py-1 rounded">
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
    </div>
  );
}
