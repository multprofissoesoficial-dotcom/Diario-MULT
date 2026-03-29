export type UserRole = "master" | "coordenador" | "professor" | "aluno" | "rh";

export type SkillTag = 
  | 'Boa Comunicação' 
  | 'Trabalho em Equipe' 
  | 'Proatividade' 
  | 'Organização' 
  | 'Perfil Analítico' 
  | 'Adaptabilidade' 
  | 'Inteligência Emocional' 
  | 'Foco em Resultados' 
  | 'Informática Básica' 
  | 'Pacote Office' 
  | 'Atendimento ao Cliente' 
  | 'Vendas e Negociação' 
  | 'Inglês Básico' 
  | 'Rotinas Administrativas' 
  | 'Primeiro Emprego' 
  | 'Disponibilidade Tarde/Noite' 
  | 'Disponibilidade Manhã/Tarde';

export interface Franquia {
  id: string;
  nome: string;
  cidade: string;
  createdAt: string;
}

export type AvailabilityStatus = 
  | 'Disponível' 
  | 'Em Processo Selecionado' 
  | 'Empregado' 
  | 'Pendente de Orientação' 
  | 'Bloqueado';

export interface EmploymentHistoryEntry {
  date: any;
  companyName: string;
  jobTitle: string;
  event: 'encaminhado' | 'entrevista' | 'contratado' | 'rejeitado' | 'faltou' | 'desistiu';
  notes?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  codigo?: string; // Registration code for students
  role: UserRole;
  franquiaId?: string; // Master doesn't necessarily have one
  turma?: string; // Class group
  xp: number;
  unlockedBadges: string[];
  resumeUrl?: string;
  skills?: SkillTag[];
  phone?: string;
  atsTermsAccepted?: boolean;
  atsTermsAcceptedAt?: any;
  availabilityStatus?: AvailabilityStatus;
  withdrawalReason?: string;
  perceptions?: Record<string, { rating: number; notes: string }>; // Keyed by franquiaId
  employmentHistory?: EmploymentHistoryEntry[];
  lastLogin?: any;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  franquiaId: string;
  createdAt: string;
}

export type JobStatus = 'captacao' | 'aberta' | 'encaminhado' | 'fechada';
export type SelectionProcessType = 'Entrevista Presencial' | 'Entrega de Currículo' | 'Atendimento Online' | 'Teste Técnico';

export interface JobPosting {
  id: string;
  title: string;
  companyId: string;
  companyName?: string; // Denormalized for easier display
  description: string;
  requiredSkills: SkillTag[];
  status: JobStatus;
  franquiaId: string;
  createdAt: string;
  createdByUid: string;
  openingDate?: string;
  closingForecast?: string;
  selectionProcessType?: SelectionProcessType;
}

export type ApplicationStatus = 'pendente' | 'encaminhado' | 'contratado' | 'rejeitado' | 'faltou' | 'desistiu';

export interface StatusHistoryEntry {
  status: ApplicationStatus;
  date: any;
  updatedByRole: string;
}

export interface Application {
  id: string;
  jobId: string;
  studentId: string;
  matchScore: number;
  status: ApplicationStatus;
  hrNotes?: string;
  hrRating?: number;
  statusHistory?: StatusHistoryEntry[];
  appliedAt: string;
}

export interface Mission {
  id: string;
  studentId: string;
  studentName: string;
  franquiaId: string;
  turma?: string; // Class group
  module: string;
  classNum: number;
  content: string;
  status: "pending" | "approved" | "bonus" | "rejected";
  aiFeedback?: string;
  xpAwarded?: number;
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  unlockClass: number;
  icon: string;
}

export interface Rank {
  name: string;
  minXP: number;
  color: string;
}
