"use client";

import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  orderBy,
  getDoc,
  getDocs
} from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, JobPosting, Application, SkillTag } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Briefcase, 
  Plus, 
  Users, 
  FileText, 
  XCircle,
  ArrowLeft,
  Trophy,
  Mail,
  Phone
} from "lucide-react";
import { cn, handleFirestoreError, OperationType } from "../lib/utils";

const SKILLS: SkillTag[] = [
  'Boa Comunicação', 'Trabalho em Equipe', 'Proatividade', 'Organização', 
  'Perfil Analítico', 'Adaptabilidade', 'Inteligência Emocional', 'Foco em Resultados', 
  'Informática Básica', 'Pacote Office', 'Atendimento ao Cliente', 'Vendas e Negociação', 
  'Inglês Básico', 'Rotinas Administrativas', 'Primeiro Emprego', 
  'Disponibilidade Tarde/Noite', 'Disponibilidade Manhã/Tarde'
];

export default function AtsDashboard({ profile }: { profile: UserProfile }) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<(Application & { student?: UserProfile })[]>([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // New Job Form State
  const [newJob, setNewJob] = useState({
    title: "",
    company: "",
    description: "",
    requiredSkills: [] as SkillTag[],
    status: "aberta" as "aberta" | "fechada"
  });

  useEffect(() => {
    const q = query(collection(db, "job_postings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as JobPosting)));
    }, (err) => handleFirestoreError(err, OperationType.GET, "job_postings"));

    return () => unsubscribe();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title || !newJob.company || newJob.requiredSkills.length === 0) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "job_postings"), {
        ...newJob,
        createdAt: new Date().toISOString(),
        createdByUid: profile.uid
      });
      setShowAddJob(false);
      setNewJob({ title: "", company: "", description: "", requiredSkills: [], status: "aberta" });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "job_postings");
    } finally {
      setLoading(false);
    }
  };

  const toggleJobStatus = async (job: JobPosting) => {
    const newStatus = job.status === "aberta" ? "fechada" : "aberta";
    try {
      await updateDoc(doc(db, "job_postings", job.id), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `job_postings/${job.id}`);
    }
  };

  const viewCandidates = async (job: JobPosting) => {
    setSelectedJob(job);
    setLoadingCandidates(true);
    try {
      const q = query(
        collection(db, "applications"), 
        where("jobId", "==", job.id),
        orderBy("matchScore", "desc")
      );
      const snap = await getDocs(q);
      const apps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
      
      // Fetch student data for each application
      const appsWithStudents = await Promise.all(apps.map(async (app) => {
        const studentDoc = await getDoc(doc(db, "users", app.studentId));
        return { ...app, student: studentDoc.exists() ? (studentDoc.data() as UserProfile) : undefined };
      }));

      setApplications(appsWithStudents);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, "applications");
    } finally {
      setLoadingCandidates(false);
    }
  };

  return (
    <div className="space-y-8">
      {selectedJob ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setSelectedJob(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para Vagas
            </button>
            <div className="text-right">
              <h2 className="text-xl font-black tracking-tighter uppercase">{selectedJob.title}</h2>
              <p className="text-xs font-bold text-mult-orange uppercase tracking-widest">{selectedJob.company}</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-neon-blue" /> Ranking de Candidatos ({applications.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Posição</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Aluno</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Contato</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-center">Match Score</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-gray-500 italic">Carregando candidatos...</td>
                    </tr>
                  ) : applications.length > 0 ? (
                    applications.map((app, index) => (
                      <tr key={app.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                            index === 0 ? "bg-yellow-500/20 text-yellow-500 neon-glow-yellow" : 
                            index === 1 ? "bg-gray-400/20 text-gray-400" :
                            index === 2 ? "bg-orange-800/20 text-orange-800" : "bg-white/5 text-gray-500"
                          )}>
                            {index + 1}º
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neon-blue/10 flex items-center justify-center text-neon-blue border border-neon-blue/20">
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{app.student?.displayName || "N/A"}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{app.student?.turma || "Sem Turma"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <Mail className="w-3 h-3" /> {app.student?.email}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <Phone className="w-3 h-3" /> {app.student?.phone || "Não informado"}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                            <Trophy className="w-3 h-3 text-neon-blue" />
                            <span className="text-xs font-black text-neon-blue">{app.matchScore}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {app.student?.resumeUrl ? (
                            <a 
                              href={app.student.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-neon-blue text-white hover:text-black transition-all text-[10px] font-black uppercase tracking-widest border border-white/10"
                            >
                              <FileText className="w-3 h-3" /> Ver Currículo
                            </a>
                          ) : (
                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sem Currículo</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-gray-500 italic">Nenhum candidato para esta vaga ainda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-black tracking-tighter uppercase flex items-center gap-2">
              <Briefcase className="text-mult-orange w-6 h-6" /> Gestão de Vagas
            </h2>
            <button 
              onClick={() => setShowAddJob(true)}
              className="bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center gap-2 neon-glow-orange"
            >
              <Plus className="w-4 h-4" /> Nova Vaga
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map(job => (
              <motion.div 
                key={job.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card p-6 flex flex-col justify-between border-white/10 hover:border-mult-orange/30 transition-all group"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border",
                      job.status === "aberta" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {job.status}
                    </div>
                    <button 
                      onClick={() => toggleJobStatus(job)}
                      className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
                    >
                      {job.status === "aberta" ? "Fechar" : "Abrir"}
                    </button>
                  </div>
                  <h4 className="text-lg font-black tracking-tighter text-white uppercase mb-1">{job.title}</h4>
                  <p className="text-xs font-bold text-mult-orange uppercase tracking-widest mb-4">{job.company}</p>
                  <p className="text-xs text-gray-400 mb-6 line-clamp-2 italic">"{job.description}"</p>
                  
                  <div className="flex flex-wrap gap-1 mb-6">
                    {job.requiredSkills.slice(0, 3).map(skill => (
                      <span key={skill} className="text-[8px] font-black px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10 uppercase tracking-widest">
                        {skill}
                      </span>
                    ))}
                    {job.requiredSkills.length > 3 && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10 uppercase tracking-widest">
                        +{job.requiredSkills.length - 3}
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => viewCandidates(job)}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-neon-blue text-white hover:text-black font-black uppercase tracking-widest text-[10px] transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" /> Ver Candidatos
                </button>
              </motion.div>
            ))}
            {jobs.length === 0 && (
              <div className="lg:col-span-3 glass-card p-12 text-center">
                <p className="text-gray-500 italic">Nenhuma vaga cadastrada. Clique em "Nova Vaga" para começar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      <AnimatePresence>
        {showAddJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Cadastrar Nova Vaga</h3>
                <button onClick={() => setShowAddJob(false)} className="text-gray-500 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateJob} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Título da Vaga</label>
                    <input 
                      required
                      type="text"
                      value={newJob.title}
                      onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                      placeholder="Ex: Auxiliar Administrativo"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Empresa</label>
                    <input 
                      required
                      type="text"
                      value={newJob.company}
                      onChange={(e) => setNewJob({...newJob, company: e.target.value})}
                      placeholder="Nome da Empresa"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Descrição da Vaga</label>
                  <textarea 
                    required
                    value={newJob.description}
                    onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                    placeholder="Descreva as responsabilidades e detalhes da vaga..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 h-32 focus:outline-none focus:border-mult-orange text-white text-sm resize-none"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Habilidades Exigidas</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {SKILLS.map(skill => (
                      <label key={skill} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                        <input 
                          type="checkbox"
                          checked={newJob.requiredSkills.includes(skill)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewJob({...newJob, requiredSkills: [...newJob.requiredSkills, skill]});
                            } else {
                              setNewJob({...newJob, requiredSkills: newJob.requiredSkills.filter(s => s !== skill)});
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-mult-orange focus:ring-mult-orange"
                        />
                        <span className="text-[10px] text-gray-300 uppercase tracking-widest">{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddJob(false)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-[10px] transition-all neon-glow-orange disabled:opacity-50"
                  >
                    {loading ? "CRIANDO..." : "CRIAR VAGA"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
