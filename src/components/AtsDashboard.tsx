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
import { UserProfile, JobPosting, Application, SkillTag, Company, ApplicationStatus, Franquia, JobStatus, SelectionProcessType, Enrollment } from "../types";
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
  Download,
  Edit3,
  Calendar,
  Target,
  BookOpen
} from "lucide-react";
import { cn, handleFirestoreError, OperationType, sanitizeText } from "../lib/utils";

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
  const [candidateEnrollments, setCandidateEnrollments] = useState<Enrollment[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<"apresentacao" | "confirmacao" | null>(null);
  const [showDocDropdown, setShowDocDropdown] = useState(false);

  // CRM Temp States
  const [tempPerceptionNotes, setTempPerceptionNotes] = useState("");
  const [tempWithdrawalReason, setTempWithdrawalReason] = useState("");
  const [isSavingCRM, setIsSavingCRM] = useState(false);

  useEffect(() => {
    if (selectedCandidate) {
      const franquiaId = profile.franquiaId || "global";
      setTempPerceptionNotes(selectedCandidate.student?.perceptions?.[franquiaId]?.notes || "");
      setTempWithdrawalReason(selectedCandidate.student?.withdrawalReason || "");

      // Fetch enrollments
      const fetchEnrollments = async () => {
        try {
          const snap = await getDocs(collection(db, "users", selectedCandidate.studentId, "enrollments"));
          setCandidateEnrollments(snap.docs.map(d => d.data() as Enrollment));
        } catch (error) {
          console.error("Error fetching candidate enrollments:", error);
        }
      };
      fetchEnrollments();
    } else {
      setCandidateEnrollments([]);
    }
  }, [selectedCandidate, profile.franquiaId]);

  // New Job Form State
  const [newJob, setNewJob] = useState({
    title: "",
    companyId: "",
    description: "",
    requiredSkills: [] as SkillTag[],
    status: "aberta" as JobStatus,
    openingDate: "",
    closingForecast: "",
    selectionProcessType: "Entrevista Presencial" as SelectionProcessType
  });

  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);

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
      setNewJob({ 
        title: "", 
        companyId: "", 
        description: "", 
        requiredSkills: [], 
        status: "aberta",
        openingDate: "",
        closingForecast: "",
        selectionProcessType: "Entrevista Presencial"
      });
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

  const updateApplicationStatus = async (appId: string, newStatus: ApplicationStatus, withdrawalReason?: string) => {
    try {
      const app = applications.find(a => a.id === appId);
      if (!app || !app.student) return;

      const historyEntry = {
        status: newStatus,
        date: new Date().toISOString(),
        updatedByRole: profile.role
      };

      // Update Application
      await updateDoc(doc(db, "applications", appId), { 
        status: newStatus,
        statusHistory: arrayUnion(historyEntry)
      });

      // Update Student Profile (Availability & History)
      let availabilityStatus: UserProfile['availabilityStatus'] = 'Disponível';
      if (newStatus === 'encaminhado') availabilityStatus = 'Em Processo Selecionado';
      if (newStatus === 'contratado') availabilityStatus = 'Empregado';
      if (newStatus === 'faltou' || newStatus === 'desistiu') availabilityStatus = 'Bloqueado';

      const employmentEntry: any = {
        date: new Date().toISOString(),
        companyName: selectedJob?.companyName || "Desconhecida",
        jobTitle: selectedJob?.title || "Vaga",
        event: newStatus,
        notes: withdrawalReason || ""
      };

      await updateDoc(doc(db, "users", app.studentId), {
        availabilityStatus,
        withdrawalReason: withdrawalReason || app.student.withdrawalReason || "",
        employmentHistory: arrayUnion(employmentEntry)
      });
      
      // Update local state for immediate feedback
      setApplications(prev => prev.map(a => a.id === appId ? { 
        ...a, 
        status: newStatus,
        statusHistory: a.statusHistory ? [...a.statusHistory, historyEntry] : [historyEntry],
        student: a.student ? { ...a.student, availabilityStatus, withdrawalReason: withdrawalReason || a.student.withdrawalReason } : undefined
      } : a));

      if (selectedCandidate?.id === appId) {
        setSelectedCandidate(prev => prev ? {
          ...prev,
          status: newStatus,
          statusHistory: prev.statusHistory ? [...prev.statusHistory, historyEntry] : [historyEntry],
          student: prev.student ? { ...prev.student, availabilityStatus, withdrawalReason: withdrawalReason || prev.student.withdrawalReason } : undefined
        } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applications/${appId}`);
    }
  };

  const updateStudentPerceptions = async (studentId: string, rating: number, notes: string) => {
    setIsSavingCRM(true);
    try {
      const sanitizedNotes = sanitizeText(notes);
      const franquiaId = profile.franquiaId || "global";
      await updateDoc(doc(db, "users", studentId), {
        [`perceptions.${franquiaId}`]: { rating, notes: sanitizedNotes }
      });

      // Update local state
      setApplications(prev => prev.map(app => app.studentId === studentId ? {
        ...app,
        student: app.student ? {
          ...app.student,
          perceptions: {
            ...app.student.perceptions,
            [franquiaId]: { rating, notes: sanitizedNotes }
          }
        } : undefined
      } : app));

      if (selectedCandidate?.student?.uid === studentId) {
        setSelectedCandidate(prev => prev ? {
          ...prev,
          student: prev.student ? {
            ...prev.student,
            perceptions: {
              ...prev.student.perceptions,
              [franquiaId]: { rating, notes: sanitizedNotes }
            }
          } : undefined
        } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${studentId}`);
    } finally {
      setIsSavingCRM(false);
    }
  };

  const updateWithdrawalReason = async (studentId: string, reason: string) => {
    setIsSavingCRM(true);
    try {
      const sanitizedReason = sanitizeText(reason);
      await updateDoc(doc(db, "users", studentId), {
        withdrawalReason: sanitizedReason
      });
      
      // Update local state
      setApplications(prev => prev.map(a => a.studentId === studentId ? {
        ...a,
        student: a.student ? { ...a.student, withdrawalReason: sanitizedReason } : undefined
      } : a));

      if (selectedCandidate?.studentId === studentId) {
        setSelectedCandidate(prev => prev ? {
          ...prev,
          student: prev.student ? { ...prev.student, withdrawalReason: sanitizedReason } : undefined
        } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${studentId}`);
    } finally {
      setIsSavingCRM(false);
    }
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    setLoading(true);
    try {
      const company = companies.find(c => c.id === editingJob.companyId);
      const { id, ...jobData } = editingJob;
      await updateDoc(doc(db, "job_postings", id), {
        ...jobData,
        companyName: company?.name || editingJob.companyName
      });
      setEditingJob(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `job_postings/${editingJob.id}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleJobStatus = async (job: JobPosting) => {
    // This is now handled by the Kanban or Edit Job modal
    setEditingJob(job);
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
            
            <div className="overflow-x-auto hidden md:block">
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
                          <div className="flex flex-col gap-1">
                            <select 
                              value={app.status || "pendente"}
                              onChange={(e) => updateApplicationStatus(app.id, e.target.value as ApplicationStatus)}
                              className={cn(
                                "bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all",
                                app.status === "contratado" ? "text-yellow-500 border-yellow-500/30" :
                                app.status === "encaminhado" ? "text-green-500 border-green-500/30" :
                                app.status === "rejeitado" ? "text-red-500 border-red-500/30" : 
                                (app.status === "faltou" || app.status === "desistiu") ? "text-orange-500 border-orange-500/30" : "text-gray-400"
                              )}
                            >
                              <option value="pendente">Pendente</option>
                              <option value="encaminhado">Encaminhado</option>
                              <option value="contratado">Contratado</option>
                              <option value="rejeitado">Rejeitado</option>
                              <option value="faltou">Faltou (Regra 1ª)</option>
                              <option value="desistiu">Desistiu (Regra 2ª)</option>
                            </select>
                            {app.student?.availabilityStatus && (
                              <span className={cn(
                                "text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded w-fit",
                                app.student.availabilityStatus === 'Bloqueado' ? "bg-red-500/20 text-red-500" :
                                app.student.availabilityStatus === 'Empregado' ? "bg-yellow-500/20 text-yellow-500" :
                                app.student.availabilityStatus === 'Em Processo Selecionado' ? "bg-neon-blue/20 text-neon-blue" : "bg-green-500/20 text-green-500"
                              )}>
                                {app.student.availabilityStatus}
                              </span>
                            )}
                          </div>
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

            {/* Mobile Candidate List */}
            <div className="md:hidden divide-y divide-white/5">
              {loadingCandidates ? (
                <div className="p-12 text-center text-gray-500 italic">Carregando candidatos...</div>
              ) : applications.length > 0 ? (
                applications.map((app, index) => (
                  <div key={app.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs",
                          index === 0 ? "bg-yellow-500/20 text-yellow-500 neon-glow-yellow" : 
                          index === 1 ? "bg-gray-400/20 text-gray-400" :
                          index === 2 ? "bg-orange-800/20 text-orange-800" : "bg-white/5 text-gray-500"
                        )}>
                          {index + 1}º
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{app.student?.displayName || "N/A"}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{app.student?.turma || "Sem Turma"}</p>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-blue/10 border border-neon-blue/20">
                        <Trophy className="w-3 h-3 text-neon-blue" />
                        <span className="text-xs font-black text-neon-blue">{app.matchScore}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <select 
                          value={app.status || "pendente"}
                          onChange={(e) => updateApplicationStatus(app.id, e.target.value as ApplicationStatus)}
                          className={cn(
                            "w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all",
                            app.status === "contratado" ? "text-yellow-500 border-yellow-500/30" :
                            app.status === "encaminhado" ? "text-green-500 border-green-500/30" :
                            app.status === "rejeitado" ? "text-red-500 border-red-500/30" : 
                            (app.status === "faltou" || app.status === "desistiu") ? "text-orange-500 border-orange-500/30" : "text-gray-400"
                          )}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="encaminhado">Encaminhado</option>
                          <option value="contratado">Contratado</option>
                          <option value="rejeitado">Rejeitado</option>
                          <option value="faltou">Faltou (Regra 1ª)</option>
                          <option value="desistiu">Desistiu (Regra 2ª)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedCandidate(app)}
                          className="p-3 rounded-lg bg-white/5 hover:bg-mult-orange text-white transition-all border border-white/10"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        {app.student?.resumeUrl && (
                          <a 
                            href={app.student.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-lg bg-white/5 hover:bg-neon-blue text-white hover:text-black transition-all border border-white/10"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    {app.student?.availabilityStatus && (
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded w-fit block",
                        app.student.availabilityStatus === 'Bloqueado' ? "bg-red-500/20 text-red-500" :
                        app.student.availabilityStatus === 'Empregado' ? "bg-yellow-500/20 text-yellow-500" :
                        app.student.availabilityStatus === 'Em Processo Selecionado' ? "bg-neon-blue/20 text-neon-blue" : "bg-green-500/20 text-green-500"
                      )}>
                        {app.student.availabilityStatus}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-500 italic">Nenhum candidato inscrito nesta vaga.</div>
              )}
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
            <div className="space-y-6 overflow-x-auto pb-4 custom-scrollbar">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-xl font-black tracking-tighter uppercase flex items-center gap-2">
                  <Briefcase className="text-mult-orange w-6 h-6" /> Pipeline de Vagas
                </h2>
                <button 
                  onClick={() => setShowAddJob(true)}
                  className="bg-mult-orange hover:bg-mult-orange/90 text-white font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-widest flex items-center gap-2 neon-glow-orange"
                >
                  <Plus className="w-4 h-4" /> Nova Vaga
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                {[
                  { id: 'captacao', title: 'Vagas em Captação', color: 'text-neon-blue', bg: 'bg-neon-blue/5' },
                  { id: 'aberta', title: 'Vagas Abertas', color: 'text-green-500', bg: 'bg-green-500/5' },
                  { id: 'encaminhado', title: 'Alunos Encaminhados', color: 'text-mult-orange', bg: 'bg-mult-orange/5' },
                  { id: 'encerrada', title: 'Vagas Preenchidas/Encerradas', color: 'text-gray-500', bg: 'bg-white/5' }
                ].map(column => (
                  <div key={column.id} className={cn("flex-1 rounded-2xl p-4 border border-white/5", column.bg)}>
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className={cn("text-[10px] font-black uppercase tracking-widest", column.color)}>
                        {column.title}
                      </h3>
                      <span className="text-[10px] font-black text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                        {jobs.filter(j => j.status === column.id).length}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {jobs.filter(j => j.status === column.id).map(job => (
                        <motion.div 
                          key={job.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass-card p-4 border-white/10 hover:border-mult-orange/30 transition-all group relative"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-black tracking-tight text-white uppercase group-hover:text-mult-orange transition-colors">{job.title}</h4>
                            <button 
                              onClick={() => setEditingJob(job)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white transition-all"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <p className="text-[10px] font-bold text-mult-orange uppercase tracking-widest mb-3">{job.companyName}</p>
                          
                          <div className="flex flex-col gap-2 mb-4">
                            <div className="flex items-center gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                              <Calendar className="w-3 h-3" />
                              Previsão: {job.closingForecast ? new Date(job.closingForecast).toLocaleDateString('pt-BR') : 'N/A'}
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                              <Target className="w-3 h-3" />
                              {job.selectionProcessType || 'Presencial'}
                            </div>
                          </div>

                          <button 
                            onClick={() => viewCandidates(job)}
                            className="w-full py-2 rounded-lg bg-white/5 hover:bg-neon-blue text-white hover:text-black font-black uppercase tracking-widest text-[9px] transition-all border border-white/10 flex items-center justify-center gap-2"
                          >
                            <Users className="w-3 h-3" /> Candidatos
                          </button>
                        </motion.div>
                      ))}
                      {jobs.filter(j => j.status === column.id).length === 0 && (
                        <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Vazio</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.map(company => (
                  <div key={company.id} className="glass-card p-6 border-white/10 hover:border-neon-blue/30 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-neon-blue/10 flex items-center justify-center text-neon-blue border border-neon-blue/20">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Vagas Ativas</p>
                        <p className="text-2xl font-black text-white tracking-tighter">
                          {jobs.filter(j => j.companyId === company.id && j.status === 'aberta').length}
                        </p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1">{company.name}</h3>
                    <p className="text-xs text-gray-400 mb-4">{company.contactPerson}</p>
                    
                    <div className="space-y-2 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <Phone className="w-3 h-3" /> {company.phone}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        <Calendar className="w-3 h-3" /> Desde {new Date(company.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>
                ))}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data de Abertura</label>
                    <input 
                      type="date"
                      value={newJob.openingDate}
                      onChange={(e) => setNewJob({...newJob, openingDate: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Previsão de Fechamento</label>
                    <input 
                      type="date"
                      value={newJob.closingForecast}
                      onChange={(e) => setNewJob({...newJob, closingForecast: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo de Processo</label>
                    <select 
                      value={newJob.selectionProcessType}
                      onChange={(e) => setNewJob({...newJob, selectionProcessType: e.target.value as SelectionProcessType})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    >
                      <option value="Entrevista Presencial">Entrevista Presencial</option>
                      <option value="Entrega de Currículo">Entrega de Currículo</option>
                      <option value="Atendimento Online">Atendimento Online</option>
                      <option value="Teste Técnico">Teste Técnico</option>
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

      {/* Edit Job Modal */}
      <AnimatePresence>
        {editingJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-widest text-white">Editar Vaga</h3>
                <button onClick={() => setEditingJob(null)} className="text-gray-500 hover:text-white">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdateJob} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Título da Vaga</label>
                    <input 
                      required
                      type="text"
                      value={editingJob.title}
                      onChange={(e) => setEditingJob({...editingJob, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Status da Vaga</label>
                    <select 
                      required
                      value={editingJob.status}
                      onChange={(e) => setEditingJob({...editingJob, status: e.target.value as JobStatus})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    >
                      <option value="captacao">Em Captação</option>
                      <option value="aberta">Aberta</option>
                      <option value="encaminhado">Alunos Encaminhados</option>
                      <option value="encerrada">Preenchida/Encerrada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Data de Abertura</label>
                    <input 
                      type="date"
                      value={editingJob.openingDate}
                      onChange={(e) => setEditingJob({...editingJob, openingDate: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Previsão de Fechamento</label>
                    <input 
                      type="date"
                      value={editingJob.closingForecast}
                      onChange={(e) => setEditingJob({...editingJob, closingForecast: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo de Processo</label>
                    <select 
                      value={editingJob.selectionProcessType}
                      onChange={(e) => setEditingJob({...editingJob, selectionProcessType: e.target.value as SelectionProcessType})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-3 focus:outline-none focus:border-mult-orange text-white text-sm"
                    >
                      <option value="Entrevista Presencial">Entrevista Presencial</option>
                      <option value="Entrega de Currículo">Entrega de Currículo</option>
                      <option value="Atendimento Online">Atendimento Online</option>
                      <option value="Teste Técnico">Teste Técnico</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Descrição da Vaga</label>
                  <textarea 
                    required
                    value={editingJob.description}
                    onChange={(e) => setEditingJob({...editingJob, description: e.target.value})}
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
                          checked={editingJob.requiredSkills.includes(skill)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingJob({...editingJob, requiredSkills: [...editingJob.requiredSkills, skill]});
                            } else {
                              setEditingJob({...editingJob, requiredSkills: editingJob.requiredSkills.filter(s => s !== skill)});
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
                    onClick={() => setEditingJob(null)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 rounded-xl bg-mult-orange text-white font-black uppercase tracking-widest text-[10px] transition-all neon-glow-orange disabled:opacity-50"
                  >
                    {loading ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
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
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-mult-orange flex items-center gap-2">
                          <Star className="w-4 h-4" /> Inteligência de CRM
                        </h3>
                        {selectedCandidate.student?.availabilityStatus && (
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                            selectedCandidate.student.availabilityStatus === 'Bloqueado' ? "bg-red-500/20 text-red-500 border-red-500/30" :
                            selectedCandidate.student.availabilityStatus === 'Empregado' ? "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" :
                            selectedCandidate.student.availabilityStatus === 'Em Processo Selecionado' ? "bg-neon-blue/20 text-neon-blue border-neon-blue/30" : "bg-green-500/20 text-green-500 border-green-500/30"
                          )}>
                            {selectedCandidate.student.availabilityStatus}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Avaliação Geral (Rating)</label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => updateStudentPerceptions(
                                  selectedCandidate.studentId, 
                                  star, 
                                  selectedCandidate.student?.perceptions?.[profile.franquiaId || "global"]?.notes || ""
                                )}
                                className="transition-transform hover:scale-110 active:scale-95"
                              >
                                <Star 
                                  className={cn(
                                    "w-6 h-6",
                                    (selectedCandidate.student?.perceptions?.[profile.franquiaId || "global"]?.rating || 0) >= star 
                                      ? "text-yellow-500 fill-yellow-500 neon-glow-yellow" 
                                      : "text-gray-600"
                                  )} 
                                  />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Percepções Pessoais (Franquia)</label>
                          <textarea 
                            value={tempPerceptionNotes}
                            onChange={(e) => setTempPerceptionNotes(e.target.value)}
                            placeholder="Descreva o perfil comportamental, pontos fortes e observações da unidade..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-gray-300 focus:outline-none focus:border-mult-orange min-h-[120px] transition-all"
                          />
                          <button 
                            onClick={() => updateStudentPerceptions(
                              selectedCandidate.studentId,
                              selectedCandidate.student?.perceptions?.[profile.franquiaId || "global"]?.rating || 0,
                              tempPerceptionNotes
                            )}
                            disabled={isSavingCRM}
                            className="mt-2 w-full py-2 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                          >
                            {isSavingCRM ? "SALVANDO..." : "SALVAR PERCEPÇÕES"}
                          </button>
                        </div>

                        {(selectedCandidate.status === 'faltou' || selectedCandidate.status === 'desistiu' || selectedCandidate.student?.availabilityStatus === 'Bloqueado') && (
                          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                            <label className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Motivo da Desistência / Penalidade</label>
                            <textarea 
                              value={tempWithdrawalReason}
                              onChange={(e) => setTempWithdrawalReason(e.target.value)}
                              placeholder="Conforme regulamento: Faltou sem justificativa ou desistiu na contratação..."
                              className="w-full bg-black/40 border border-red-500/30 rounded-lg p-3 text-xs text-red-200 focus:outline-none focus:border-red-500 min-h-[80px]"
                            />
                            <button 
                              onClick={() => updateWithdrawalReason(selectedCandidate.studentId, tempWithdrawalReason)}
                              disabled={isSavingCRM}
                              className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all text-red-400"
                            >
                              {isSavingCRM ? "SALVANDO..." : "SALVAR MOTIVO DA PENALIDADE"}
                            </button>
                            <p className="text-[9px] text-red-500/70 italic">Regra 1ª: Falta sem justificativa | Regra 2ª: Desistência na contratação.</p>
                          </div>
                        )}
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

                    <div className="glass-card p-6 border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-mult-orange mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Cursos Matriculados
                      </h3>
                      <div className="space-y-3">
                        {candidateEnrollments.length > 0 ? (
                          candidateEnrollments.map((enrollment) => (
                            <div key={enrollment.courseId} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-white uppercase tracking-tight">{enrollment.courseName}</p>
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-1">
                                  Status: <span className={enrollment.status === 'concluido' ? "text-green-500" : "text-neon-blue"}>{enrollment.status}</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Aula Atual</p>
                                <p className="text-xs font-black text-mult-orange">{enrollment.currentLesson}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-gray-500 italic uppercase tracking-widest text-center py-4">Nenhuma matrícula encontrada</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Timeline */}
                  <div className="space-y-6">
                    <div className="glass-card p-6 border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-green-500 mb-6 flex items-center gap-2">
                        <History className="w-4 h-4" /> Histórico de Jornada Global
                      </h3>
                      
                      <div className="relative space-y-8 before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-green-500 before:via-neon-blue before:to-transparent">
                        {/* Employment History from User Document */}
                        {selectedCandidate.student?.employmentHistory?.slice().reverse().map((entry, idx) => (
                          <div key={`hist-${idx}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={cn(
                              "flex items-center justify-center w-8 h-8 rounded-full border shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2",
                              entry.event === 'contratado' ? "bg-yellow-500/20 border-yellow-500 text-yellow-500" :
                              entry.event === 'encaminhado' ? "bg-green-500/20 border-green-500 text-green-500" :
                              (entry.event === 'faltou' || entry.event === 'desistiu') ? "bg-red-500/20 border-red-500 text-red-500" : "bg-white/5 border-white/10 text-gray-500"
                            )}>
                              {entry.event === 'contratado' ? <Trophy className="w-4 h-4" /> : 
                               entry.event === 'encaminhado' ? <UserCheck className="w-4 h-4" /> : 
                               (entry.event === 'faltou' || entry.event === 'desistiu') ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-xl bg-white/5 border border-white/10 ml-4">
                              <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-black text-[10px] text-white uppercase tracking-widest">{entry.companyName}</div>
                                <time className="font-mono text-[9px] text-gray-500">
                                  {new Date(entry.date).toLocaleDateString()}
                                </time>
                              </div>
                              <div className="text-[10px] text-neon-blue font-bold uppercase tracking-widest">{entry.jobTitle}</div>
                              <div className="text-[9px] text-gray-400 mt-1 uppercase font-black">Evento: {entry.event}</div>
                              {entry.notes && <div className="text-[9px] text-red-400 mt-1 italic">Obs: {entry.notes}</div>}
                            </div>
                          </div>
                        ))}

                        {/* Current Application Initial Step if no history matches */}
                        {(!selectedCandidate.student?.employmentHistory || selectedCandidate.student.employmentHistory.length === 0) && (
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
                        )}
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
