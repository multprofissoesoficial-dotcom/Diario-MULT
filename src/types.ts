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

export interface JobPosting {
  id: string;
  title: string;
  companyId: string;
  companyName?: string; // Denormalized for easier display
  description: string;
  requiredSkills: SkillTag[];
  status: 'aberta' | 'fechada';
  franquiaId: string;
  createdAt: string;
  createdByUid: string;
}

export type ApplicationStatus = 'pendente' | 'encaminhado' | 'contratado' | 'rejeitado';

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
  status: "pending" | "approved" | "bonus";
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
