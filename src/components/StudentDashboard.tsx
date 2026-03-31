"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp, getDocs } from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { UserProfile, Mission, Badge, SkillTag, JobPosting, Application, Enrollment, Course } from "../types";
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
import { cn, handleFirestoreError, OperationType, sanitizeText } from "../lib/utils";
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

const SKILLS: SkillTag[] = [
  'Boa Comunicação', 'Trabalho em Equipe', 'Proatividade', 'Organização', 
  'Perfil Analítico', 'Adaptabilidade', 'Inteligência Emocional', 'Foco em Resultados', 
  'Informática Básica', 'Pacote Office', 'Atendimento ao Cliente', 'Vendas e Negociação', 
  'Inglês Básico', 'Rotinas Administrativas', 'Primeiro Emprego', 
  'Disponibilidade Tarde/Noite', 'Disponibilidade Manhã/Tarde'
];

export default function StudentDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<"missions" | "ats">("missions");
  const [module, setModule] = useState("Windows");
  const [classNum, setClassNum] = useState(1);
  const [content, setContent] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [activeEnrollment, setActiveEnrollment] = useState<Enrollment | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  // ATS State
  const [selectedSkills, setSelectedSkills] = useState<SkillTag[]>(profile.skills || []);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [userApplications, setUserApplications] = useState<Application[]>([]);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);

  useEffect(() => {
    if (profile.currentCourseId) {
      const unsub = onSnapshot(doc(db, "courses", profile.currentCourseId), (snap) => {
        if (snap.exists()) {
          setActiveCourse({ id: snap.id, ...snap.data() } as Course);
        }
      });
      return () => unsub();
    }
  }, [profile.currentCourseId]);

  useEffect(() => {
    // Fetch Jobs - Multitenancy: Filter by franquiaId
    const jobsQuery = query(
      collection(db, "job_postings"), 
      where("status", "==", "aberta"),
      where("franquiaId", "==", profile.franquiaId)
    );
    const unsubJobs = onSnapshot(jobsQuery, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as JobPosting)));
    });

    // Fetch User Applications
    const appsQuery = query(collection(db, "applications"), where("studentId", "==", profile.uid));
    const unsubApps = onSnapshot(appsQuery, (snap) => {
      setUserApplications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Application)));
    });

    return () => {
      unsubJobs();
      unsubApps();
    };
  }, [profile.uid, profile.franquiaId]);

  useEffect(() => {
    const enrollmentsRef = collection(db, "users", profile.id, "enrollments");
    const unsubEnrollments = onSnapshot(enrollmentsRef, (snap) => {
      const list = snap.docs.map(d => d.data() as Enrollment);
      setEnrollments(list);
      
      const active = list.find(e => e.courseId === profile.currentCourseId) || list[0] || null;
      setActiveEnrollment(active);
      
      if (active) {
        const { module: m, relativeLesson: l } = getRelativeLesson(active.currentLesson);
        setModule(m);
        setClassNum(l);
      }
    });

    return () => unsubEnrollments();
  }, [profile.uid, profile.currentCourseId]);

  useEffect(() => {
    const q = query(
      collection(db, "missions"),
      where("studentId", "==", profile.uid)
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

    const badgesToUse = activeCourse?.badges || BADGES;
    const newBadges = badgesToUse.filter(badge => 
      maxClass >= (badge.unlockClass || 0) && !profile.unlockedBadges.includes(badge.id)
    );

    if (newBadges.length > 0) {
      const userRef = doc(db, "users", profile.id);
      const courseId = activeEnrollment?.courseId || "INF";
      
      // Senior Audit: Prevent frontend writes to legacy profiles
      if (profile.uid === auth.currentUser?.uid) {
        console.warn("Legacy profile detected. Skipping badge update to avoid permission errors.");
        setNewBadge(newBadges[0]);
        return;
      }
      
      await updateDoc(userRef, {
        unlockedBadges: arrayUnion(...newBadges.map(b => b.id))
      });

      // Also update enrollment badges
      await updateDoc(doc(db, "users", profile.id, "enrollments", courseId), {
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

    const sanitizedContent = sanitizeText(content);

    // Simulate AI analysis
    setTimeout(async () => {
      let feedback = "Excelente registro! Vi que você dominou habilidades cruciais hoje. Continue assim!";
      const lowerContent = sanitizedContent.toLowerCase();
      if (lowerContent.includes("drive") || lowerContent.includes("email") || lowerContent.includes("planilha")) {
        feedback = "Excelente registro! Vi que você dominou habilidades cruciais hoje. Continue assim!";
      }

      if (profile.uid === auth.currentUser?.uid) {
      alert("Seu perfil está em modo de compatibilidade (Legado). Por favor, aguarde a migração automática ou procure o suporte para atualizar seus dados.");
      setUploadingProfile(false);
      return;
    }

    try {
          const courseId = activeEnrollment?.courseId || "INF";
          const courseName = activeEnrollment?.courseName || "Informática Profissional";
          const absLesson = getAbsoluteLessonId(module, classNum);

          await addDoc(collection(db, "missions"), {
            studentId: profile.uid,
            studentName: profile.displayName,
            franquiaId: profile.franquiaId,
            turma: profile.turma || "024inf",
            courseId,
            courseName,
            module,
            classNum: absLesson,
            content: sanitizedContent,
            status: "pending",
            aiFeedback: feedback,
            createdAt: new Date().toISOString(),
          });

          // Update currentLesson in enrollment - ONLY if not legacy
          if (activeEnrollment && absLesson > activeEnrollment.currentLesson && profile.uid !== auth.currentUser?.uid) {
            await updateDoc(doc(db, "users", profile.id, "enrollments", courseId), {
              currentLesson: absLesson
            });
          }

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

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile.uid === auth.currentUser?.uid) {
      alert("Seu perfil está em modo de compatibilidade (Legado). Por favor, aguarde a migração automática ou procure o suporte para atualizar seus dados.");
      setUploadingProfile(false);
      return;
    }
    setUploadingProfile(true);
    try {
      let resumeUrl = profile.resumeUrl || "";

      if (resumeFile) {
        if (resumeFile.size > 5 * 1024 * 1024) {
          alert("O currículo deve ter no máximo 5MB.");
          setUploadingProfile(false);
          return;
        }
        const resumeRef = ref(storage, `resumes/${profile.uid}/curriculo.pdf`);
        await uploadBytes(resumeRef, resumeFile);
        resumeUrl = await getDownloadURL(resumeRef);
      }

      const userRef = doc(db, "users", profile.id);
      await updateDoc(userRef, {
        skills: selectedSkills,
        resumeUrl: resumeUrl
      });

      alert("Perfil profissional atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      alert("Erro ao atualizar perfil profissional.");
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleApply = async (job: JobPosting) => {
    if (profile.availabilityStatus === 'Bloqueado') {
      alert("Seu perfil está bloqueado para novos encaminhamentos conforme as normas da agência. Procure a coordenação para mais informações.");
      return;
    }

    if (!profile.skills || profile.skills.length === 0) {
      alert("Por favor, preencha suas habilidades no perfil profissional antes de se candidatar.");
      return;
    }

    setApplyingJobId(job.id);
    try {
      // Motor de Match Matemático
      const studentSkills = selectedSkills;
      const requiredSkills = job.requiredSkills;
      
      const commonSkills = studentSkills.filter(skill => requiredSkills.includes(skill));
      const score = Math.round((commonSkills.length / requiredSkills.length) * 100);

      await addDoc(collection(db, "applications"), {
        jobId: job.id,
        studentId: profile.uid,
        matchScore: score,
        status: 'pendente',
        appliedAt: serverTimestamp()
      });

      alert(`Candidatura enviada! Seu Match Score é ${score}%.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "applications");
    } finally {
      setApplyingJobId(null);
    }
  };

  const hasApplied = (jobId: string) => userApplications.some(app => app.jobId === jobId);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loadingTerms, setLoadingTerms] = useState(false);

  const handleAcceptTerms = async () => {
    if (!acceptTerms) return;
    if (profile.uid === auth.currentUser?.uid) {
      alert("Seu perfil está em modo de compatibilidade (Legado). Por favor, aguarde a migração automática.");
      return;
    }
    setLoadingTerms(true);
    try {
      await updateDoc(doc(db, "users", profile.id), {
        atsTermsAccepted: true,
        atsTermsAcceptedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "users");
    } finally {
      setLoadingTerms(false);
    }
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
            <p className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">
              {activeEnrollment ? activeEnrollment.courseName : "Cockpit v2.0"} • Piloto {profile.displayName.split(' ')[0]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {enrollments.length > 1 && (
            <select 
              value={profile.currentCourseId}
              onChange={async (e) => {
                if (profile.uid === auth.currentUser?.uid) {
                  alert("Seu perfil está em modo de compatibilidade (Legado).");
                  return;
                }
                await updateDoc(doc(db, "users", profile.id), {
                  currentCourseId: e.target.value
                });
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-neon-blue transition-all mr-2"
            >
              {enrollments.map(e => (
                <option key={e.courseId} value={e.courseId} className="bg-cockpit-bg">
                  {e.courseName}
                </option>
              ))}
            </select>
          )}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
            <button 
              onClick={() => setActiveTab("missions")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === "missions" ? "bg-mult-orange text-white neon-glow-orange" : "text-gray-500 hover:text-gray-300"
              )}
            >
              Missões
            </button>
            <button 
              onClick={() => setActiveTab("ats")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                activeTab === "ats" ? "bg-neon-blue text-white neon-glow-blue" : "text-gray-500 hover:text-gray-300"
              )}
            >
              Agência
            </button>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {activeTab === "missions" ? (
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
              {(activeCourse?.badges || BADGES).map((badge) => {
                const Icon = iconMap[badge.icon] || Trophy;
                const isUnlocked = activeEnrollment?.unlockedBadges?.includes(badge.id);
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
                    {badge.icon.startsWith('http') ? (
                      <img src={badge.icon} alt={badge.name} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                    ) : (
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
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
      ) : (
        <AnimatePresence mode="wait">
          {!profile.atsTermsAccepted ? (
            <motion.div 
              key="terms"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto glass-card p-8 space-y-6 border-mult-orange/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-mult-orange/20 flex items-center justify-center text-mult-orange neon-glow-orange border border-mult-orange/30">
                  <FileText className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black tracking-tighter uppercase">Termos e Normas de Encaminhamento</h2>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl p-6 h-64 overflow-y-auto custom-scrollbar text-sm text-gray-400 leading-relaxed space-y-4">
                <p className="font-bold text-white">DECLARAÇÃO DE CONHECIMENTO DAS NORMAS DE ENCAMINHAMENTO.</p>
                <p>Declaro para devidos fins de direito ter plena ciência das leis referentes aos serviços de Encaminhamentos exercidos pela MULT Profissões:</p>
                <p>1º O(a) aluno(a) que for encaminhado e faltar sem justificativa prévia perderá o direito de ser encaminhado novamente.</p>
                <p>2º O(a) aluno(a) que participar de todo o processo seletivo, concordar com as exigências e no momento da contratação desistir da vaga, perderá o direito de ser encaminhado novamente.</p>
                <p>3º É direito do aluno ser encaminhado, mas a Agência não garante a contratação.</p>
                <p>4º O aluno pode se negar a concorrer à vaga ao ouvir as exigências.</p>
                <p>5º Não é de responsabilidade da MULT Profissões os vínculos empregatícios (assinatura de carteira, etc) entre alunos e empresas parceiras.</p>
                <p>6º Após contratação, o aluno deve informar à Agência para atualização de status.</p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-mult-orange focus:ring-mult-orange transition-all"
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-widest">Li e concordo com os termos</span>
                </label>

                <button 
                  onClick={handleAcceptTerms}
                  disabled={!acceptTerms || loadingTerms}
                  className="w-full bg-mult-orange text-white font-black py-4 rounded-xl transition-all neon-glow-orange uppercase tracking-widest text-xs disabled:opacity-30 disabled:grayscale"
                >
                  {loadingTerms ? "PROCESSANDO..." : "ACEITAR TERMOS E ACESSAR AGÊNCIA"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="ats-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* ATS Profile Section */}
              <div className="space-y-8">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-6"
                >
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-neon-blue" /> Meu Perfil Profissional
                  </h3>

                  {profile.availabilityStatus && (
                    <div className={cn(
                      "mb-6 p-4 rounded-xl border flex items-center justify-between",
                      profile.availabilityStatus === 'Disponível' ? "bg-green-500/10 border-green-500/30 text-green-400" :
                      profile.availabilityStatus === 'Bloqueado' ? "bg-red-500/10 border-red-500/30 text-red-400" :
                      "bg-neon-blue/10 border-neon-blue/30 text-neon-blue"
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          profile.availabilityStatus === 'Disponível' ? "bg-green-500/20" :
                          profile.availabilityStatus === 'Bloqueado' ? "bg-red-500/20" :
                          "bg-neon-blue/20"
                        )}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Status de Disponibilidade</p>
                          <p className="text-sm font-black uppercase tracking-tighter">{profile.availabilityStatus}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Minhas Habilidades</label>
                      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {SKILLS.map(skill => (
                          <label key={skill} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                            <input 
                              type="checkbox"
                              checked={selectedSkills.includes(skill)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSkills([...selectedSkills, skill]);
                                } else {
                                  setSelectedSkills(selectedSkills.filter(s => s !== skill));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-neon-blue focus:ring-neon-blue"
                            />
                            <span className="text-xs text-gray-300">{skill}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Currículo (PDF)</label>
                      <div className="relative">
                        <input 
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                          className="hidden"
                          id="resume-upload"
                        />
                        <label 
                          htmlFor="resume-upload"
                          className="flex items-center justify-center gap-2 w-full p-4 rounded-xl border-2 border-dashed border-white/10 hover:border-neon-blue/50 hover:bg-neon-blue/5 transition-all cursor-pointer group"
                        >
                          <FileText className="w-5 h-5 text-gray-500 group-hover:text-neon-blue" />
                          <span className="text-xs font-bold text-gray-400 group-hover:text-gray-200">
                            {resumeFile ? resumeFile.name : profile.resumeUrl ? "Alterar Currículo" : "Upload Currículo (PDF)"}
                          </span>
                        </label>
                      </div>
                      {profile.resumeUrl && (
                        <a 
                          href={profile.resumeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-neon-blue hover:underline block text-center mt-2"
                        >
                          Ver currículo atual
                        </a>
                      )}
                    </div>

                    <button 
                      type="submit"
                      disabled={uploadingProfile}
                      className="w-full bg-neon-blue text-white font-black py-3 rounded-xl transition-all neon-glow-blue uppercase tracking-widest text-xs disabled:opacity-50"
                    >
                      {uploadingProfile ? "SALVANDO..." : "ATUALIZAR PERFIL"}
                    </button>
                  </form>
                </motion.div>
              </div>

              {/* Job Board Section */}
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-mult-orange" /> Mural de Vagas
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {jobs.map(job => (
                    <motion.div 
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-6 relative group border-white/10 hover:border-mult-orange/30 transition-all"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-black tracking-tighter text-white uppercase">{job.title}</h4>
                          <p className="text-xs font-bold text-mult-orange uppercase tracking-widest">{job.companyName || "Empresa"}</p>
                        </div>
                        {hasApplied(job.id) && (
                          <span className="bg-green-500/10 text-green-500 text-[10px] font-black px-2 py-1 rounded-full border border-green-500/20 uppercase tracking-widest">
                            Candidatado
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-400 mb-6 line-clamp-3 italic">"{job.description}"</p>

                      <div className="flex flex-wrap gap-2 mb-6">
                        {job.requiredSkills.map(skill => (
                          <span 
                            key={skill}
                            className={cn(
                              "text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest border",
                              selectedSkills.includes(skill) 
                                ? "bg-neon-blue/10 text-neon-blue border-neon-blue/20" 
                                : "bg-white/5 text-gray-500 border-white/10"
                            )}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      <button 
                        onClick={() => handleApply(job)}
                        disabled={hasApplied(job.id) || applyingJobId === job.id}
                        className={cn(
                          "w-full py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all",
                          hasApplied(job.id)
                            ? "bg-white/5 text-gray-600 cursor-not-allowed"
                            : "bg-gradient-to-r from-mult-orange to-orange-600 text-white neon-glow-orange hover:scale-[1.02] active:scale-95"
                        )}
                      >
                        {applyingJobId === job.id ? "PROCESSANDO..." : hasApplied(job.id) ? "CANDIDATURA ENVIADA" : "CANDIDATAR-ME"}
                      </button>
                    </motion.div>
                  ))}
                  {jobs.length === 0 && (
                    <div className="glass-card p-12 text-center">
                      <p className="text-gray-500 italic">Nenhuma vaga disponível no momento. Volte em breve!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
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
