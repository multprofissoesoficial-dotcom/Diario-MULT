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
  getDocs,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile, JobPosting, Application, SkillTag, Company, ApplicationStatus, Franquia } from "../types";
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
  Phone,
  Building2,
  CheckCircle2,
  Clock,
  UserCheck,
  TrendingUp,
  Star,
  MessageSquare,
  History,
  Printer,
  ChevronDown,
  Download
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
  const [activeSubTab, setActiveSubTab] = useState<"vagas" | "empresas">("vagas");
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [applications, setApplications] = useState<(Application & { student?: UserProfile })[]>([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<(Application & { student?: UserProfile }) | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<"apresentacao" | "confirmacao" | null>(null);
  const [showDocDropdown, setShowDocDropdown] = useState(false);

  // New Job Form State
  const [newJob, setNewJob] = useState({
    title: "",
    companyId: "",
    description: "",
    requiredSkills: [] as SkillTag[],
    status: "aberta" as "aberta" | "fechada"
  });

  // New Company Form State
  const [newCompany, setNewCompany] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    franquiaId: profile.franquiaId || ""
  });

  useEffect(() => {
    // Multitenancy: Filter by franquiaId unless master
    const baseQuery = (coll: string) => {
      if (profile.role === "master") {
        return query(collection(db, coll), orderBy("createdAt", "desc"));
      }
      return query(
        collection(db, coll), 
        where("franquiaId", "==", profile.franquiaId),
        orderBy("createdAt", "desc")
      );
    };

    const qJobs = baseQuery("job_postings");
    const unsubJobs = onSnapshot(qJobs, (snap) => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as JobPosting)));
    }, (err) => handleFirestoreError(err, OperationType.GET, "job_postings"));

    const qCompanies = baseQuery("companies");
    const unsubCompanies = onSnapshot(qCompanies, (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    }, (err) => handleFirestoreError(err, OperationType.GET, "companies"));

    // Fetch Franquias
    let unsubFranquias = () => {};
    const qFranquias = profile.role === "master" 
      ? query(collection(db, "franquias"), orderBy("nome", "asc"))
      : query(collection(db, "franquias"), where("id", "==", profile.franquiaId));
    
    unsubFranquias = onSnapshot(qFranquias, (snap) => {
      setFranquias(snap.docs.map(d => d.data() as Franquia));
    });

    const qApps = profile.role === "master" 
      ? query(collection(db, "applications"))
      : query(collection(db, "applications")); // Applications don't have franquiaId directly, but we filter by jobId later if needed. 
      // Actually, for metrics, we might need a better way if master sees all.
      // For now, let's assume applications are linked to jobs which have franquiaId.
    
    const unsubApps = onSnapshot(qApps, (snap) => {
      setAllApplications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Application)));
    }, (err) => handleFirestoreError(err, OperationType.GET, "applications"));

    return () => {
      unsubJobs();
      unsubCompanies();
      unsubApps();
      unsubFranquias();
    };
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    const company = companies.find(c => c.id === newJob.companyId);
    if (!newJob.title || !newJob.companyId || newJob.requiredSkills.length === 0) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "job_postings"), {
        ...newJob,
        companyName: company?.name || "Empresa Desconhecida",
        franquiaId: company?.franquiaId || profile.franquiaId,
        createdAt: new Date().toISOString(),
        createdByUid: profile.uid
      });
      setShowAddJob(false);
      setNewJob({ title: "", companyId: "", description: "", requiredSkills: [], status: "aberta" });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "job_postings");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany.name || !newCompany.contactPerson || !newCompany.phone) {
      alert("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "companies"), {
        ...newCompany,
        franquiaId: profile.role === "master" ? newCompany.franquiaId : profile.franquiaId,
        createdAt: new Date().toISOString()
      });
      setShowAddCompany(false);
      setNewCompany({ name: "", contactPerson: "", phone: "", franquiaId: profile.franquiaId || "" });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "companies");
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, newStatus: ApplicationStatus) => {
    try {
      const historyEntry = {
        status: newStatus,
        date: new Date().toISOString(),
        updatedByRole: profile.role
      };

      await updateDoc(doc(db, "applications", appId), { 
        status: newStatus,
        statusHistory: arrayUnion(historyEntry)
      });
      
      // Update local state for immediate feedback
      setApplications(prev => prev.map(app => app.id === appId ? { 
        ...app, 
        status: newStatus,
        statusHistory: app.statusHistory ? [...app.statusHistory, historyEntry] : [historyEntry]
      } : app));

      if (selectedCandidate?.id === appId) {
        setSelectedCandidate(prev => prev ? {
          ...prev,
          status: newStatus,
          statusHistory: prev.statusHistory ? [...prev.statusHistory, historyEntry] : [historyEntry]
        } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applications/${appId}`);
    }
  };

  const updateApplicationCRM = async (appId: string, data: { hrNotes?: string, hrRating?: number }) => {
    try {
      await updateDoc(doc(db, "applications", appId), data);
      setApplications(prev => prev.map(app => app.id === appId ? { ...app, ...data } : app));
      if (selectedCandidate?.id === appId) {
        setSelectedCandidate(prev => prev ? { ...prev, ...data } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applications/${appId}`);
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
    <>
      <div className="space-y-8 print:hidden">
        {/* Metrics Dashboard */}
      {!selectedJob && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Briefcase className="w-12 h-12 text-neon-blue" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Vagas Abertas</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {jobs.filter(j => j.status === "aberta").length}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-neon-blue font-bold uppercase">
              <TrendingUp className="w-3 h-3" /> Em captação
            </div>
          </div>

          <div className="glass-card p-6 border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-12 h-12 text-mult-orange" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Candidaturas</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {allApplications.length}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-mult-orange font-bold uppercase">
              <Users className="w-3 h-3" /> Inscritos
            </div>
          </div>

          <div className="glass-card p-6 border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Encaminhados</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {allApplications.filter(a => a.status === "encaminhado").length}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase">
              <UserCheck className="w-3 h-3" /> Em entrevista
            </div>
          </div>

          <div className="glass-card p-6 border-white/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Trophy className="w-12 h-12 text-yellow-500" />
            </div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Contratados</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {allApplications.filter(a => a.status === "contratado").length}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-yellow-500 font-bold uppercase">
              <CheckCircle2 className="w-3 h-3" /> Sucesso
            </div>
          </div>
        </div>
      )}

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
              <p className="text-xs font-bold text-mult-orange uppercase tracking-widest">{selectedJob.companyName}</p>
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
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Match Score</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
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
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                            <Trophy className="w-3 h-3 text-neon-blue" />
                            <span className="text-xs font-black text-neon-blue">{app.matchScore}%</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <select 
                            value={app.status || "pendente"}
                            onChange={(e) => updateApplicationStatus(app.id, e.target.value as ApplicationStatus)}
                            className={cn(
                              "bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all",
                              app.status === "contratado" ? "text-yellow-500 border-yellow-500/30" :
                              app.status === "encaminhado" ? "text-green-500 border-green-500/30" :
                              app.status === "rejeitado" ? "text-red-500 border-red-500/30" : "text-gray-400"
                            )}
                          >
                            <option value="pendente">Pendente</option>
                            <option value="encaminhado">Encaminhado</option>
                            <option value="contratado">Contratado</option>
                            <option value="rejeitado">Rejeitado</option>
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setSelectedCandidate(app)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-mult-orange text-white transition-all border border-white/10"
                              title="Ver Detalhes e CRM"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            {app.student?.resumeUrl && (
                              <a 
                                href={app.student.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-white/5 hover:bg-neon-blue text-white hover:text-black transition-all border border-white/10"
                                title="Ver Currículo"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                            )}
                            <div className="flex flex-col text-right">
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{app.student?.email}</span>
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{app.student?.phone || "S/ Tel"}</span>
                            </div>
                          </div>
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
          {/* Sub-Tabs */}
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
            <button
              onClick={() => setActiveSubTab("vagas")}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeSubTab === "vagas" ? "bg-mult-orange text-white neon-glow-orange" : "text-gray-500 hover:text-white"
              )}
            >
              <Briefcase className="w-3 h-3" /> Vagas
            </button>
            <button
              onClick={() => setActiveSubTab("empresas")}
              className={cn(
                "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeSubTab === "empresas" ? "bg-neon-blue text-black neon-glow-blue" : "text-gray-500 hover:text-white"
              )}
            >
              <Building2 className="w-3 h-3" /> Empresas Parceiras
            </button>
          </div>

          {activeSubTab === "vagas" ? (
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
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-mult-orange uppercase tracking-widest">{job.companyName}</p>
                        {profile.role === "master" && (
                          <span className="text-[8px] font-black text-neon-blue uppercase tracking-widest bg-neon-blue/10 px-1.5 py-0.5 rounded border border-neon-blue/20">
                            {franquias.find(f => f.id === job.franquiaId)?.nome || "Global"}
                          </span>
                        )}
                      </div>
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
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl font-black tracking-tighter uppercase flex items-center gap-2">
                  <Building2 className="text-neon-blue w-6 h-6" /> Empresas Parceiras
                </h2>
                <button 
                  onClick={() => setShowAddCompany(true)}
                  className="bg-neon-blue hover:bg-neon-blue/90 text-black font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center gap-2 neon-glow-blue"
                >
                  <Plus className="w-4 h-4" /> Nova Empresa
                </button>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5">
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Empresa</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Contato</th>
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Telefone</th>
                        {profile.role === "master" && <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Unidade</th>}
                        <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Cadastrada em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {companies.length > 0 ? (
                        companies.map(company => (
                          <tr key={company.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <p className="text-sm font-bold text-white uppercase tracking-tight">{company.name}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-xs text-gray-400">{company.contactPerson}</p>
                            </td>
                            <td className="p-4">
                              <p className="text-xs text-gray-400">{company.phone}</p>
                            </td>
                            {profile.role === "master" && (
                              <td className="p-4">
                                <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest bg-neon-blue/10 px-2 py-1 rounded border border-neon-blue/20">
                                  {franquias.find(f => f.id === company.franquiaId)?.nome || "Global"}
                                </span>
                              </td>
                            )}
                            <td className="p-4 text-right">
                              <p className="text-[10px] text-gray-500 uppercase font-bold">
                                {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-gray-500 italic">Nenhuma empresa cadastrada.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Empresa Parceira</label>
                    <select 
                      required
                      value={newJob.companyId}
                      onChange={(e) => setNewJob({...newJob, companyId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    >
                      <option value="" className="bg-cockpit-bg">Selecione uma empresa</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id} className="bg-cockpit-bg">{c.name}</option>
                      ))}
                    </select>
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

      {/* Add Company Modal */}
      <AnimatePresence>
        {showAddCompany && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Cadastrar Empresa Parceira</h3>
                <button onClick={() => setShowAddCompany(false)} className="text-gray-500 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateCompany} className="p-8 space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome da Empresa</label>
                  <input 
                    required
                    type="text"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                    placeholder="Ex: MULT Profissões"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pessoa de Contato</label>
                    <input 
                      required
                      type="text"
                      value={newCompany.contactPerson}
                      onChange={(e) => setNewCompany({...newCompany, contactPerson: e.target.value})}
                      placeholder="Nome do RH/Gestor"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Telefone</label>
                    <input 
                      required
                      type="text"
                      value={newCompany.phone}
                      onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
                      placeholder="(00) 00000-0000"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white text-sm"
                    />
                  </div>
                </div>

                {profile.role === "master" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Franquia / Unidade</label>
                    <select 
                      required
                      value={newCompany.franquiaId}
                      onChange={(e) => setNewCompany({...newCompany, franquiaId: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-neon-blue text-white text-sm"
                    >
                      <option value="" className="bg-cockpit-bg">Selecione uma unidade</option>
                      {franquias.map(f => (
                        <option key={f.id} value={f.id} className="bg-cockpit-bg">{f.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddCompany(false)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-neon-blue text-black font-black uppercase tracking-widest text-[10px] transition-all neon-glow-blue disabled:opacity-50"
                  >
                    {loading ? "CADASTRANDO..." : "CADASTRAR EMPRESA"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>

    {/* Candidate CRM Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCandidate(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-cockpit-bg border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-neon-blue/20 flex items-center justify-center text-neon-blue border border-neon-blue/30">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase">{selectedCandidate.student?.displayName}</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Candidato para: {selectedJob?.title}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button 
                      onClick={() => setShowDocDropdown(!showDocDropdown)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      <Printer className="w-4 h-4 text-mult-orange" /> Gerar Documentos <ChevronDown className="w-3 h-3" />
                    </button>
                    
                    <AnimatePresence>
                      {showDocDropdown && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-56 bg-cockpit-bg border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden"
                        >
                          <button 
                            onClick={() => {
                              setSelectedDocType("apresentacao");
                              setShowDocModal(true);
                              setShowDocDropdown(false);
                            }}
                            className="w-full text-left p-4 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest border-b border-white/5 transition-colors"
                          >
                            Carta de Apresentação
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedDocType("confirmacao");
                              setShowDocModal(true);
                              setShowDocDropdown(false);
                            }}
                            className="w-full text-left p-4 hover:bg-white/5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                          >
                            Carta de Confirmação
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={() => setSelectedCandidate(null)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: CRM & Notes */}
                  <div className="space-y-6">
                    <div className="glass-card p-6 border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-mult-orange mb-4 flex items-center gap-2">
                        <Star className="w-4 h-4" /> Inteligência de CRM
                      </h3>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Avaliação do RH</label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => updateApplicationCRM(selectedCandidate.id, { hrRating: star })}
                                className="transition-transform hover:scale-110 active:scale-95"
                              >
                                <Star 
                                  className={cn(
                                    "w-6 h-6",
                                    (selectedCandidate.hrRating || 0) >= star 
                                      ? "text-yellow-500 fill-yellow-500 neon-glow-yellow" 
                                      : "text-gray-600"
                                  )} 
                                />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Anotações Internas Privadas</label>
                          <textarea 
                            value={selectedCandidate.hrNotes || ""}
                            onChange={(e) => updateApplicationCRM(selectedCandidate.id, { hrNotes: e.target.value })}
                            placeholder="Descreva o perfil comportamental, pontos fortes e observações da entrevista..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-mult-orange min-h-[150px] transition-all"
                          />
                          <p className="text-[9px] text-gray-500 mt-2 italic">* Visível apenas para Master, Coordenador e RH.</p>
                        </div>
                      </div>
                    </div>

                    <div className="glass-card p-6 border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-neon-blue mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Informações de Contato
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">E-mail</p>
                          <p className="text-xs font-bold text-white truncate">{selectedCandidate.student?.email}</p>
                        </div>
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Telefone</p>
                          <p className="text-xs font-bold text-white">{selectedCandidate.student?.phone || "Não informado"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Timeline */}
                  <div className="space-y-6">
                    <div className="glass-card p-6 border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-green-500 mb-6 flex items-center gap-2">
                        <History className="w-4 h-4" /> Histórico de Jornada
                      </h3>
                      
                      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-green-500 before:via-neon-blue before:to-transparent">
                        {/* Initial Application */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-cockpit-bg text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-xl bg-white/5 border border-white/10 ml-4">
                            <div className="flex items-center justify-between space-x-2 mb-1">
                              <div className="font-black text-xs text-white uppercase tracking-widest">Candidatura Realizada</div>
                              <time className="font-mono text-[9px] text-gray-500">
                                {new Date(selectedCandidate.appliedAt).toLocaleDateString()}
                              </time>
                            </div>
                            <div className="text-[10px] text-gray-400">O aluno iniciou o processo para esta vaga.</div>
                          </div>
                        </div>

                        {/* Status History */}
                        {selectedCandidate.statusHistory?.map((entry, idx) => (
                          <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full border shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2",
                              entry.status === 'contratado' ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" :
                              entry.status === 'encaminhado' ? "bg-green-500/20 border-green-500 text-green-500" :
                              entry.status === 'rejeitado' ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/5 border-white/10 text-gray-500"
                            )}>
                              {entry.status === 'contratado' ? <Trophy className="w-4 h-4" /> : 
                               entry.status === 'encaminhado' ? <UserCheck className="w-4 h-4" /> : 
                               entry.status === 'rejeitado' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-xl bg-white/5 border border-white/10 ml-4">
                              <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-black text-xs text-white uppercase tracking-widest">Status: {entry.status}</div>
                                <time className="font-mono text-[9px] text-gray-500">
                                  {new Date(entry.date).toLocaleDateString()}
                                </time>
                              </div>
                              <div className="text-[10px] text-gray-400">Atualizado por: <span className="uppercase">{entry.updatedByRole}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Document Generator Modal */}
      <AnimatePresence>
        {showDocModal && selectedCandidate && selectedJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDocModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md print:hidden"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] print:max-h-none print:rounded-none print:shadow-none print:border-none print:w-full print:h-full"
            >
              {/* Modal Header - Hidden on Print */}
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-mult-orange/10 rounded-lg text-mult-orange">
                    <Printer className="w-5 h-5" />
                  </div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                    {selectedDocType === "apresentacao" ? "Carta de Apresentação" : "Carta de Confirmação"}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-mult-orange text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-mult-orange/90 transition-all shadow-lg shadow-mult-orange/20"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Documento
                  </button>
                  <button 
                    onClick={() => setShowDocModal(false)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Document Content */}
              <div className="flex-1 overflow-y-auto p-12 bg-white print:overflow-visible print:p-0">
                <div className="max-w-[210mm] mx-auto bg-white text-black font-serif leading-relaxed print:w-full">
                  {/* Header */}
                  <div className="text-center mb-12 border-b-2 border-black pb-6">
                    <h1 className="text-2xl font-black tracking-tighter uppercase mb-1">MULT Profissões</h1>
                    <p className="text-sm font-bold tracking-widest uppercase">Cursos Profissionalizantes</p>
                  </div>

                  {selectedDocType === "apresentacao" ? (
                    <div className="space-y-8">
                      <div className="text-center mb-12">
                        <h2 className="text-xl font-black underline decoration-2 underline-offset-8 uppercase">CARTA DE APRESENTAÇÃO</h2>
                      </div>

                      <div className="space-y-2">
                        <p className="font-bold">AO SR(A) RH DA EMPRESA: <span className="uppercase">{selectedJob.companyName}</span></p>
                        <p className="font-bold">Ref: PROFISSIONAL PARA O CARGO DE: <span className="uppercase">{selectedJob.title}</span></p>
                      </div>

                      <div className="text-right mb-8">
                        <p>{franquias.find(f => f.id === selectedJob.franquiaId)?.nome || "Global"}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      </div>

                      <div className="text-justify space-y-6">
                        <p>PREZADO(A) SR(A).</p>
                        <p>
                          Apresentamos nosso(a) aluno(a) <span className="font-bold uppercase">{selectedCandidate.student?.displayName}</span> conforme vossa solicitação, 
                          para ocupar o cargo descrito acima nesta conceituada empresa.
                        </p>
                        <p>
                          Informamos que o aluno(a) passou por um processo de seleção e identificamos que possui o perfil adequado. 
                          Em caso de aprovação, solicitamos que entre em contato conosco para efetivarmos a baixa em nosso banco de dados.
                        </p>
                        <p>
                          Atenciosamente,
                        </p>
                      </div>

                      <div className="pt-12">
                        <p className="font-bold">MULT Profissões - Unidade {franquias.find(f => f.id === selectedJob.franquiaId)?.nome || "Global"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="text-center mb-12">
                        <h2 className="text-xl font-black underline decoration-2 underline-offset-8 uppercase leading-tight">
                          CARTA DE CONFIRMAÇÃO DE ENCAMINHAMENTO AO MERCADO DE TRABALHO
                        </h2>
                      </div>

                      <div className="text-justify space-y-6">
                        <p>
                          Eu, <span className="font-bold uppercase">{selectedCandidate.student?.displayName}</span>, aluno(a) da MULT Profissões, 
                          declaro para devidos fins de direito que fui devidamente encaminhado(a) ao processo Seletivo da Empresa 
                          <span className="font-bold uppercase"> {selectedJob.companyName}</span> na cidade de 
                          <span className="font-bold uppercase"> {franquias.find(f => f.id === selectedJob.franquiaId)?.nome || "Global"}</span> para a vaga de 
                          <span className="font-bold uppercase"> {selectedJob.title}</span>.
                        </p>
                        <p>
                          Fico ciente que toda a responsabilidade sobre a forma de contratação será da empresa contratante, 
                          não havendo vínculo empregatício com a MULT Profissões.
                        </p>
                      </div>

                      <div className="text-right pt-12">
                        <p>{franquias.find(f => f.id === selectedJob.franquiaId)?.nome || "Global"}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                      </div>

                      <div className="pt-24 flex flex-col items-center">
                        <div className="w-64 border-t border-black mb-2"></div>
                        <p className="text-sm font-bold uppercase">Assinatura do Aluno</p>
                      </div>
                    </div>
                  )}

                  {/* Footer - Only visible on print if needed, but usually letters don't have it */}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
