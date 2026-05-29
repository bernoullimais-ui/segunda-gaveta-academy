/**
 * Tipos centralizados — Academia Digital
 * Referência única para todos os modelos de dados do Supabase
 */

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'gestor'
  | 'especialista'
  | 'membro'
  | 'super_admin'
  | 'curador'
  | 'design'
  | 'professor_convidado';

export const ADMIN_ROLES: UserRole[] = ['gestor', 'super_admin', 'curador', 'design', 'especialista'];

export function isAdmin(role: UserRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

// ─── Organização ──────────────────────────────────────────────────────────────

export interface Organizacao {
  id: string;
  nome: string;
  slug?: string;
  logo_url?: string;
  cor_primaria?: string;
  created_at?: string;
}

// ─── Usuário ──────────────────────────────────────────────────────────────────

export interface Usuario {
  id: string;
  auth_id?: string;
  nome: string;
  email: string;
  role: UserRole;
  organizacao_id?: string;
  organizacoes?: Organizacao;
  telefone?: string;
  codigo_convite?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Curso / Currículo ────────────────────────────────────────────────────────

export type TipoEtapa = 'video' | 'artigo' | 'quiz' | 'ao_vivo' | 'multi_video';
export type PrecoTipo = 'gratuito' | 'pago';

export interface VideoMulti {
  url: string;
  titulo?: string;
}

export interface Etapa {
  id?: string;
  nome: string;
  tipo: TipoEtapa;
  url_video?: string;
  descricao?: string;
  videos?: VideoMulti[];
  questions?: QuizQuestion[];
  data_hora?: string;
  duracao_minutos?: number;
  _calculatedId?: string;
}

export interface Secao {
  nome: string;
  etapas: Etapa[];
}

export interface Curso {
  id: string;
  nome: string;
  descricao?: string;
  preco: PrecoTipo;
  valor?: number;
  organizacao_id: string;
  curriculo_json?: Secao[];
  thumbnail_url?: string;
  professor_nome?: string;
  professor_titulo?: string;
  professor_foto_url?: string;
  carga_horaria?: string;
  tem_certificado?: boolean;
  ativo?: boolean;
  em_breve?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Trilha {
  id: string;
  nome: string;
  descricao?: string;
  preco?: number;
  organizacao_id: string;
  ativo?: boolean;
  created_at?: string;
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id?: string;
  titulo?: string;
  tema?: string;
  dificuldade?: 'fácil' | 'médio' | 'difícil';
  enunciado: string;
  opcoes: string[];
  correta: string; // índice '0'-'3'
}

// ─── Participação ─────────────────────────────────────────────────────────────

export type ParticipacaoStatus = 'andamento' | 'inscrito' | 'concluido' | 'pendente' | 'cancelado';

export interface CursoParticipante {
  id: string;
  curso_id: string;
  usuario_id: string;
  status: ParticipacaoStatus;
  progresso?: number;
  completed_steps?: string[];
  quiz_scores?: Record<string, number>;
  valor_pago?: number;
  cupom_codigo?: string;
  created_at?: string;
  updated_at?: string;
  usuarios?: Pick<Usuario, 'id' | 'nome' | 'email'>;
}

// ─── Pagamento ────────────────────────────────────────────────────────────────

export interface CheckoutAbandonado {
  id: string;
  name: string;
  email: string;
  phone?: string;
  item_type: 'curso' | 'trilha';
  item_id?: string;
  item_name?: string;
  amount?: number;
  checkout_url?: string;
  recovered: boolean;
  created_at: string;
}

// ─── Notificações ─────────────────────────────────────────────────────────────

export interface NotificationPayload {
  email: string;
  name: string;
  phone?: string;
  orgName?: string;
}

// ─── Toast (UI) ───────────────────────────────────────────────────────────────

export interface ToastMessage {
  text: string;
  type: 'success' | 'error' | 'info';
}
