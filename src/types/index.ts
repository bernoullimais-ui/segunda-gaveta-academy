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

// ─── Projeto de Conclusão ─────────────────────────────────────────────────────

export type CampoTipo =
  | 'texto_curto'
  | 'texto_longo'
  | 'numero'
  | 'checkbox'
  | 'tabela'
  | 'data'
  | 'selecao_unica'
  | 'upload'
  | 'calculado';

export interface CampoConfig {
  id: string;
  tipo: CampoTipo;
  label: string;
  placeholder?: string;
  obrigatorio?: boolean;
  unidade?: string;         // para tipo 'numero' e 'calculado', ex: 'R$', '%'
  opcoes?: string[];        // para 'checkbox' e 'selecao_unica'
  colunas?: string[];       // para tipo 'tabela'
  linhas?: number;          // para tipo 'tabela', qtd de linhas padrão
  linhas_rotulos?: string[]; // para tipo 'tabela', rótulos pré-definidos da primeira coluna
  formula?: string;         // para tipo 'calculado'
}

export interface ProjetoTemplate {
  id: string;
  curso_id: string;
  organizacao_id?: string;
  titulo: string;
  descricao?: string;
  bloqueio_estrito: boolean;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type GatilhoTipo = 'concluir_etapa' | 'assistir_70' | 'concluir_secao';

export interface ProjetoMissao {
  id: string;
  template_id: string;
  titulo: string;
  descricao?: string;
  campos_json: CampoConfig[];
  gatilho_etapa_id?: string;   // ID da etapa no curriculo_json
  gatilho_tipo: GatilhoTipo;
  ordem: number;
  created_at?: string;
}

export interface ProjetoDelegacao {
  id: string;
  template_id: string;
  usuario_id: string;
  created_at?: string;
  usuarios?: Pick<Usuario, 'id' | 'nome' | 'email'>;
}

export type ProjetoStatus = 'rascunho' | 'submetido' | 'com_feedback';

export interface ProjetoResposta {
  id?: string;
  missao_id: string;
  usuario_id: string;
  curso_id: string;
  respostas_json: Record<string, any>;
  feedback_geral?: string;
  feedbacks_campos_json?: Record<string, string>;
  feedback_publicado: boolean;
  status: ProjetoStatus;
  updated_at?: string;
  created_at?: string;
  // Joins opcionais
  usuarios?: Pick<Usuario, 'id' | 'nome' | 'email'>;
  projeto_conclusao_missoes?: Pick<ProjetoMissao, 'id' | 'titulo' | 'ordem'>;
}

// ─── Versões da Página de Vendas (LP) ───────────────────────────────────────

export type LpVersionStatus = 'publicada' | 'rascunho';

export interface TypographyStyle {
  font_family?: string;
  font_weight?: string;
  font_size?: string;
  line_height?: string;
  letter_spacing?: string;
}

export type TextTypeKey =
  | 'titulo_1'
  | 'titulo_2'
  | 'titulo_3'
  | 'texto_corrido_1'
  | 'texto_corrido_2'
  | 'texto_corrido_3'
  | 'texto_corrido_4'
  | 'texto_botao_1'
  | 'texto_botao_2';

export interface TypographyConfig {
  titulo_1?: TypographyStyle;
  titulo_2?: TypographyStyle;
  titulo_3?: TypographyStyle;
  texto_corrido_1?: TypographyStyle;
  texto_corrido_2?: TypographyStyle;
  texto_corrido_3?: TypographyStyle;
  texto_corrido_4?: TypographyStyle;
  texto_botao_1?: TypographyStyle;
  texto_botao_2?: TypographyStyle;
  [key: string]: TypographyStyle | undefined;
}

export interface LandingPageVersionConfig {
  id: string;                      // ex: 'v1', 'v2'
  nome: string;                    // ex: 'Versão Principal', 'Campanha Meta Ads'
  status: LpVersionStatus;          // 'publicada' | 'rascunho'
  is_default?: boolean;            // se é a versão carregada por padrão na URL raiz
  enabled?: boolean;
  hero_title?: string;
  hero_subtitle?: string;
  hero_video_url?: string;
  hero_image_url?: string;
  hero_title_image_height?: number;
  hero_align_v?: string;
  hero_align_h?: string;
  hero_title_offset_x?: number;
  hero_title_offset_y?: number;
  hero_subtitle_offset_x?: number;
  hero_subtitle_offset_y?: number;
  hero_cta_offset_x?: number;
  hero_cta_offset_y?: number;
  about_title?: string;
  about?: string;
  about_image_url?: string;
  copy_section_text?: string;
  copy_section_cta_text?: string;
  curriculum_title?: string;
  curriculum_image_url?: string;
  benefits?: Array<string | { title: string; description?: string }>;
  target_audience?: string;
  faq?: Array<{ question: string; answer: string }>;
  primary_color?: string;
  logo_url?: string;
  nav_logo_height?: number;
  nav_bg_color?: string;
  typography?: TypographyConfig;
  instructor?: {
    name?: string;
    role?: string;
    bio?: string;
    avatar_url?: string;
    students_count?: string;
    projects_count?: string;
    instagram_url?: string;
    youtube_url?: string;
    linkedin_url?: string;
    website_url?: string;
    whatsapp_url?: string;
  };
  testimonials?: Array<{ name: string; role: string; text: string; photo_url?: string }>;
  bonuses?: Array<{ title: string; description: string; value?: string }>;
  guarantee_days?: number;
  cta_text?: string;
  section_order?: string[];
  countdown_enabled?: boolean;
  countdown_title?: string;
  countdown_end_date?: string;
  layout_tipo?: 'escuro';           // Fixo em 'escuro'
  [key: string]: any;
}

export interface LpConfigStorage {
  active_version_id: string;        // ID da versão padrão (ex: 'v1')
  versions: Record<string, LandingPageVersionConfig>;
}

