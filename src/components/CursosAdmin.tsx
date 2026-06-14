import React, { useState, useEffect } from 'react';
import { Settings, Users, BarChart2, BookOpen, Clock, Lock, PlayCircle, Plus, Eye, Share2, Download, Search, Filter, MoreHorizontal, MessageSquare, Award, CheckCircle, ChevronLeft, Calendar, FileText, Gift, DollarSign, Loader2, Image as ImageIcon, Minus, Code, Video as VideoIcon, ShoppingBag, User, CalendarCheck, List, Paperclip, Volume2, Pencil, Trash2, Check, X, Table, Bold, Italic, Underline, ListOrdered, GripVertical, AlertTriangle, Database, Upload, LayoutDashboard, Sparkles, AlertCircle, Info, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { MarketingLinksModal } from './MarketingLinksModal';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import { CursosCandidato } from './CursosCandidato';
import { generateCertificatePDF } from '../lib/certificateUtils';
import CertificateDesigner, { CertificateTemplate } from './CertificateDesigner';
import { TrilhaModal } from './TrilhaModal';
import { FinanceiroAdmin } from './FinanceiroAdmin';
import { ActionModal } from './ActionModal';
import { getFormattedVideoUrl } from '../lib/videoUtils';

// getFormattedVideoUrl migrado para src/lib/videoUtils.ts
// A função é re-exportada aqui para compatibilidade com código interno ainda não migrado
export { getFormattedVideoUrl };

interface CursosAdminProps {
  loggedUser?: any;
  orgId?: string;
}

export function CursosAdmin({ loggedUser, orgId }: CursosAdminProps) {
  // Toast system — substitui todos os alert() nativos do componente
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  const [view, setView] = useState<'list' | 'create_wizard' | 'course_dashboard'>('list');
  const [wizardStep, setWizardStep] = useState(1);
  const [createdCourseName, setCreatedCourseName] = useState('Novo Curso');
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [editingTrilha, setEditingTrilha] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [dndReady, setDndReady] = useState(false);
  useEffect(() => {
    setDndReady(true);
  }, []);
  const [viewConteudo, setViewConteudo] = useState<'list' | 'edit_section' | 'edit_step_video' | 'edit_step_artigo' | 'edit_step_quiz' | 'edit_step_ao_vivo' | 'edit_step_multi_video'>('list');
  const [editingSection, setEditingSection] = useState<{ id?: string, nome: string, progressiva: boolean, semana: string, dia: string }>({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
  const [editingStep, setEditingStep] = useState<{ id?: string, nome: string, secaoId: string, tipo: string, url_video?: string, descricao?: string, tempo_video?: string, questoes_ids?: string[], videos?: {title: string, url: string}[] }>({ nome: '', secaoId: '', tipo: 'video' });
  const [addingStepToSection, setAddingStepToSection] = useState<string | null>(null);

  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [isSelectQuestionsModalOpen, setIsSelectQuestionsModalOpen] = useState(false);
  const [isQuestionBankModalOpen, setIsQuestionBankModalOpen] = useState(false);
  const [isAddingQuestionModalOpen, setIsAddingQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [quizFilterTema, setQuizFilterTema] = useState('');
  const [quizFilterDificuldade, setQuizFilterDificuldade] = useState('');

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'confirm' | 'alert', title: string, message: string, onConfirm: () => void}>({ 
    isOpen: false, 
    type: 'confirm', 
    title: '', 
    message: '', 
    onConfirm: () => {} 
  });
  const [displayItems, setDisplayItems] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const fetchRequestRef = React.useRef(0);


  useEffect(() => {
    // Setup chat for live lesson when editing an existing step
    if (viewConteudo === 'edit_step_ao_vivo' && editingStep.id) {
      const channel = supabase.channel(`live_chat_${editingStep.id}`)
        .on('broadcast', { event: 'new_message' }, payload => {
          setChatMessages(prev => [...prev, payload.payload]);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      }
    } else {
      setChatMessages([]);
    }
  }, [viewConteudo, editingStep.id]);

  const sendLiveMessage = async () => {
    if (!chatInput.trim() || !editingStep.id) return;
    
    const { data: userData } = await supabase.auth.getUser();
    let userName = userData?.user?.user_metadata?.nome || userData?.user?.email?.split('@')[0] || 'Professor';

    if (userData?.user?.id) {
      try {
        const { data: userProfile } = await supabase
          .from('usuarios')
          .select('nome, role')
          .eq('id', userData.user.id)
          .maybeSingle();
        
        if (userProfile && userProfile.nome) {
          userName = userProfile.nome + ' (Professor)';
        } else {
          if (userData?.user?.user_metadata?.nome) {
            userName = userData.user.user_metadata.nome + ' (Professor)';
          }
        }
      } catch (err) {
        console.error("Error fetching user profile", err);
      }
    }
    
    const message = {
      id: Date.now().toString(),
      text: chatInput,
      user_id: userData?.user?.id || 'admin',
      user_name: userName,
      timestamp: new Date().toISOString()
    };
    
    // Add locally immediately
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
    
    // Broadcast
    await supabase.channel(`live_chat_${editingStep.id}`).send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    });
  };

  const [newCourseConfig, setNewCourseConfig] = useState({
    nome: '',
    descricao: '',
    ritmo: 'proprio', // proprio, programado
    tempo: 'sem_limite', // sem_limite, com_limite
    duracao: '',
    duracao_tipo: 'Dias',
    preco: 'gratuito', // gratuito, pago
    valor: '',
    professor_nome: '',
    professor_titulo: '',
    professor_foto_url: '',
    thumbnail_url: '',
    carga_horaria: '',
    em_breve: false
  });

  const [activeTab, setActiveTab] = useState<'visao_geral' | 'conteudo' | 'participantes' | 'configuracoes' | 'engajamento' | 'acessar_curso' | 'landing_page' | 'split' | 'financeiro' | 'planos'>('visao_geral');
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [courseSplits, setCourseSplits] = useState<{ usuario_id: string, porcentagem: number }[]>([]);
  const [pagarmeMarketplaceEnabled, setPagarmeMarketplaceEnabled] = useState(false);
  const [affiliateCommission, setAffiliateCommission] = useState<number>(0);
  const [planosAssinatura, setPlanosAssinatura] = useState<any[]>([]);

  // AI Copywriting States
  const [copyFramework, setCopyFramework] = useState<'AIDA' | 'PAS'>('AIDA');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [generatedCopyResult, setGeneratedCopyResult] = useState<any>(null);
  const [copyBenefits, setCopyBenefits] = useState('');

  const generateAICopy = async () => {
    setIsGeneratingCopy(true);
    setGeneratedCopyResult(null);
    try {
      const response = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: activeCurso?.nome || 'Novo Curso',
          description: activeCurso?.descricao || lpData.hero_subtitle || '',
          targetAudience: lpData.target_audience || '',
          benefits: copyBenefits || '',
          framework: copyFramework
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar copy de vendas');
      }
      setGeneratedCopyResult(data);
    } catch (err: any) {
      console.error(err);
      showToast('Erro ao gerar copy: ' + err.message, 'error');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  useEffect(() => {
    async function fetchOrgUsers() {
      if (!orgId) return;
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, role')
        .eq('organizacao_id', orgId);
      if (!error && data) {
        setOrgUsers(data);
      }
    }
    fetchOrgUsers();
  }, [orgId]);

  const [courseStats, setCourseStats] = useState({ total: 0, andamento: 0, concluido: 0, taxa: 0 });
  const [courseParticipants, setCourseParticipants] = useState<any[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [participantStatusFilter, setParticipantStatusFilter] = useState('todos');
  const [lpData, setLpData] = useState<any>({
    enabled: true,
    hero_title: '',
    hero_subtitle: '',
    hero_video_url: '',
    about: '',
    benefits: [''],
    target_audience: '',
    faq: [{ question: '', answer: '' }],
    primary_color: '#2563eb',
    instructor: {
      name: '',
      bio: '',
      avatar_url: '',
      role: ''
    },
    testimonials: [{ name: '', role: '', text: '', photo_url: '' }],
    bonuses: [{ title: '', description: '' }],
    guarantee_days: 7,
    cta_text: 'Matricule-se Agora'
  });

  const fetchCourseStats = async (cursoId: string) => {
    try {
      const { data, error } = await supabase.from('curso_participantes').select('*, usuarios(nome, email)').eq('curso_id', cursoId);
      if (error) {
        if (error.code === 'PGRST200') {
          // Log detalhes técnicos apenas no console (não exibir SQL para usuário final)
          console.error('[DB] Erro de relacionamento em curso_participantes:', error);
          showToast('Erro de configuração no banco de dados. Entre em contato com o suporte.', 'error');
        } else if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('Could not find the of') || error.message?.includes('quiz_scores')) {
          console.error('[DB] Tabela ou coluna ausente:', error);
          showToast('Tabela de participantes não encontrada. Execute as migrações do banco de dados.', 'error');
        } else {
          console.error("Erro ao carregar estatísticas", error);
        }
        return;
      }
      
      const total = data.length || 0;
      const concluido = data.filter((d: any) => d.status === 'concluido').length || 0;
      const andamento = data.filter((d: any) => d.status === 'andamento').length || 0;
      const taxa = total > 0 ? Math.round((concluido / total) * 100) : 0;
      
      setCourseStats({ total, andamento, concluido, taxa });
      setCourseParticipants(data);
    } catch (err) {
      console.error(err);
    }
  };

  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [editingCertTemplate, setEditingCertTemplate] = useState<CertificateTemplate | null>(null);
  
  const [isTrilhaModalOpen, setIsTrilhaModalOpen] = useState(false);
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState(false);

  const [isVideoSettingsModalOpen, setIsVideoSettingsModalOpen] = useState(false);
  const [videoSettings, setVideoSettings] = useState({
    assistirObrigatorio: false,
    porcentagem: 90,
    reproduzirAutomaticamente: false
  });

  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [tableCols, setTableCols] = useState(4);
  const [tableRows, setTableRows] = useState(4);
  const artigoTextareaRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (artigoTextareaRef.current && document.activeElement !== artigoTextareaRef.current) {
      if (artigoTextareaRef.current.innerHTML !== (editingStep.descricao || '')) {
        artigoTextareaRef.current.innerHTML = editingStep.descricao || '';
      }
    }
  }, [editingStep.descricao]);

  const applyCommand = (command: string, value: string = '') => {
    if (artigoTextareaRef.current) {
      artigoTextareaRef.current.focus();
      document.execCommand(command, false, value);
      setEditingStep(prev => ({...prev, descricao: artigoTextareaRef.current!.innerHTML}));
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Compression logic
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Max dimensions
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Export to base64 with 0.7 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        applyCommand('insertHTML', `<br/><img src="${dataUrl}" alt="${file.name}" style="max-width: 100%; border-radius: 0.5rem; margin-top: 1rem; margin-bottom: 1rem;" /><br/>`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      applyCommand('insertHTML', `<br/><a href="${dataUrl}" download="${file.name}" class="text-blue-600 underline font-medium" target="_blank">📄 Baixar arquivo: ${file.name}</a><br/>`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };


  const [isEditingSettingsModalOpen, setIsEditingSettingsModalOpen] = useState(false);
  const [isConvidarModalOpen, setIsConvidarModalOpen] = useState(false);
  const [convidarEmails, setConvidarEmails] = useState('');
  const [isEnviandoConvites, setIsEnviandoConvites] = useState(false);
  const [editingSettingsData, setEditingSettingsData] = useState({
    nome: '',
    descricao: '',
    thumbnail_url: '',
    tempo: 'sem_limite',
    duracao: '',
    duracao_tipo: 'Dias',
    ritmo: 'proprio',
    preco: 'gratuito',
    valor: '',
    professor_nome: '',
    professor_titulo: '',
    professor_foto_url: '',
    carga_horaria: '',
    em_breve: false,
    pagamento_modelo: 'fixo',
    pagamento_ciclo: '30',
    pagamento_parcelas_limite: '12'
  });

  useEffect(() => {
    fetchCursos();
    fetchQuestoes();
  }, [view, orgId]);

  const fetchQuestoes = async () => {
    try {
      let query = supabase.from('questoes_teoricas').select('*');
      if (orgId) {
        query = query.eq('organizacao_id', orgId);
      }
      let { data, error } = await query;
      
      // Fallback if organizacao_id column doesn't exist
      if (error && (error.code === '42703' || error.message?.includes('organizacao_id'))) {
        const result = await supabase.from('questoes_teoricas').select('*');
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.warn('Error fetching questoes:', error);
      } else {
        setAvailableQuestions(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (view === 'course_dashboard' && createdCourseId) {
      fetchCourseStats(createdCourseId);

      // Always fetch fresh data from DB to avoid stale React state
      (async () => {
        const { data: freshCurso, error: fetchErr } = await supabase
          .from('cursos')
          .select('*')
          .eq('id', createdCourseId)
          .single();

        if (fetchErr || !freshCurso) {
          console.error('Error fetching fresh course data:', fetchErr);
          return;
        }

        // M6: Fetch plan_assinatura
        const { data: plansData } = await supabase
          .from('planos_assinatura')
          .select('*')
          .eq('curso_id', createdCourseId)
          .order('criado_em', { ascending: false });
        setPlanosAssinatura(plansData || []);

        // Update the cursos array with fresh data
        setCursos(prev => prev.map(c => c.id === createdCourseId ? { ...c, ...freshCurso } : c));

        const rawSections = freshCurso.curriculo_json || [];
        const normalizedSections = rawSections.map((s: any, sIdx: number) => {
          const sectionId = s.id || `sec-${Date.now()}-${sIdx}`;
          return {
            ...s,
            id: sectionId,
            etapas: (s.etapas || []).map((e: any, eIdx: number) => ({
              ...e,
              id: e.id || `step-${Date.now()}-${sIdx}-${eIdx}`
            }))
          };
        });
        setSections(normalizedSections);

        if (freshCurso?.configuracao_json?.videoSettings) {
          setVideoSettings(freshCurso.configuracao_json.videoSettings);
        }

        if (freshCurso?.configuracao_json?.splits) {
          setCourseSplits(freshCurso.configuracao_json.splits);
        } else {
          setCourseSplits([]);
        }

        // Fixed: use nullish check instead of falsy (so 0 is also loaded correctly)
        const commValue = freshCurso?.configuracao_json?.comissao_afiliado;
        setAffiliateCommission(commValue != null ? Number(commValue) : 0);
        setPagarmeMarketplaceEnabled(!!freshCurso?.configuracao_json?.pagarme_marketplace_enabled);

        if (freshCurso?.configuracao_json?.lp) {
          setLpData(prev => ({
            ...prev,
            ...freshCurso.configuracao_json.lp
          }));
        } else {
          setLpData({
            enabled: true,
            hero_title: freshCurso?.nome || '',
            hero_subtitle: freshCurso?.descricao || '',
            hero_video_url: '',
            about: freshCurso?.descricao || '',
            benefits: [''],
            target_audience: '',
            faq: [{ question: '', answer: '' }],
            primary_color: '#2563eb',
            instructor: {
              name: freshCurso?.professor_nome || '',
              bio: '',
              avatar_url: freshCurso?.professor_foto_url || '',
              role: 'Instrutor(a)'
            },
            testimonials: [],
            bonuses: [],
            guarantee_days: 7,
            layout_tipo: 'claro',
            cta_text: 'Matricule-se Agora'
          });
        }
      })();
    }
  }, [view, createdCourseId]);

  const saveLandingPage = async () => {
    if (!createdCourseId) return;
    setIsSaving(true);
    try {
      const activeCurso = (cursos || []).find(c => c.id === createdCourseId);
      const newConfig = {
        ...(activeCurso?.configuracao_json || {}),
        lp: lpData
      };
      
      const { error } = await supabase
        .from('cursos')
        .update({ configuracao_json: newConfig })
        .eq('id', createdCourseId);
        
      if (error) throw error;
      
      // Update local state
      const nextCursos = cursos.map(c => c.id === createdCourseId ? { ...c, configuracao_json: newConfig } : c);
      setCursos(nextCursos);
      showToast('Página de venda salva com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving landing page:', err);
      showToast('Erro ao salvar página de venda: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveCourseSplits = async (newSplits: { usuario_id: string, porcentagem: number }[], affiliateComm: number, marketplaceEnabled: boolean = false) => {
    if (!createdCourseId) return;
    setIsSaving(true);
    try {
      const activeCurso = (cursos || []).find(c => c.id === createdCourseId);
      const newConfig = {
        ...(activeCurso?.configuracao_json || {}),
        splits: newSplits,
        comissao_afiliado: affiliateComm,
        pagarme_marketplace_enabled: marketplaceEnabled
      };
      
      const { error } = await supabase
        .from('cursos')
        .update({ configuracao_json: newConfig })
        .eq('id', createdCourseId);
        
      if (error) throw error;
      
      const nextCursos = cursos.map(c => c.id === createdCourseId ? { ...c, configuracao_json: newConfig } : c);
      setCursos(nextCursos);
      setCourseSplits(newSplits);
      setAffiliateCommission(affiliateComm);
      showToast('Configuração de split e comissão salva com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving splits:', err);
      showToast('Erro ao salvar split: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadParticipantCertificate = async (participant: any) => {
    const activeCurso = (cursos || []).find(c => c.id === createdCourseId);
    if (!activeCurso?.certificado_template) {
      showToast('Este curso não possui um template de certificado configurado.', 'error');
      return;
    }

    try {
      const participantData = {
        id: participant.id,
        nome: participant.usuarios?.nome || participant.usuarios?.email || 'Participante',
        dataConclusao: new Date(participant.updated_at).toLocaleDateString('pt-BR'),
        titulo: activeCurso.nome || 'Certificado de Conclusão',
        cargaHoraria: activeCurso.carga_horaria
      };

      await generateCertificatePDF(activeCurso.certificado_template, participantData);
    } catch (error) {
      console.error('Error downloading certificate:', error);
      showToast('Erro ao gerar o certificado. Tente novamente.', 'error');
    }
  };

  const saveCurriculo = async (newSections: any[]) => {
    if (!createdCourseId) return false;
    
    // Check payload size
    const payloadSize = JSON.stringify(newSections).length;
    const sizeInMB = payloadSize / 1024 / 1024;
    
    if (sizeInMB > 8) {
      showToast(`⚠️ ERRO CRÍTICO: O currículo está pesado demais (${sizeInMB.toFixed(2)} MB).\n\nO limite máximo recomendado é 2 MB. Remova imagens coladas diretamente no texto ou reduza o conteúdo antes de tentar salvar novamente.`, 'error');
      return false;
    }

    if (sizeInMB > 2) {
       console.warn(`Curriculum size is large: ${sizeInMB.toFixed(2)}MB`);
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('cursos')
        .update({ curriculo_json: newSections })
        .eq('id', createdCourseId);
      if (error) {
        console.error('Error saving curriculum:', error);
        
        if (error.code === '57014' || error.message.includes('timeout')) {
          showToast('Erro de tempo limite: O currículo está muito grande para salvar. Isso geralmente acontece quando há muitas imagens pesadas coladas no texto. Tente remover imagens grandes e salvar novamente.', 'error');
        } else {
          showToast('Erro ao salvar no banco de dados: ' + error.message, 'error');
        }
        return false;
      }

      // Update local cursos state to avoid stale data
      setCursos(prev => prev.map(c => c.id === createdCourseId ? { ...c, curriculo_json: newSections } : c));
      
      return true;
    } catch (err: any) {
      console.error('Failed to save curriculum:', err);
      showToast('Falha crítica ao salvar: ' + err.message, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateOutlineWithAI = async () => {
    if (!createdCourseId || !activeCurso) {
      showToast("Curso não encontrado ou não selecionado.", 'error');
      return;
    }
    
    const confirmGen = window.confirm(
      "Isso substituirá todo o currículo atual deste curso por uma nova estrutura gerada por Inteligência Artificial (Gemini). Deseja continuar?"
    );
    if (!confirmGen) return;

    try {
      setIsGeneratingOutline(true);
      const response = await fetch('/api/ai/generate-course-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeCurso.nome || 'Novo Curso',
          description: activeCurso.descricao || ''
        })
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorMsg = 'Erro ao gerar o currículo.';
        try { errorMsg = JSON.parse(rawText).error || errorMsg; } catch { errorMsg = rawText.substring(0, 200) || errorMsg; }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data || !data.modules) {
        throw new Error('Formato de resposta inválido do Gemini.');
      }

      // Convert generated outline modules to sections format compatible with curriculo_json
      const generatedSections = data.modules.map((m: any, mIdx: number) => {
        const secId = `sec-${Date.now()}-${mIdx}`;
        return {
          id: secId,
          nome: m.name || `Módulo ${mIdx + 1}`,
          semana: `Semana ${mIdx + 1}`,
          dia: 'Dia 1',
          progressiva: false,
          etapas: (m.steps || []).map((s: any, sIdx: number) => {
            const stepId = `step-${Date.now()}-${mIdx}-${sIdx}`;
            return {
              id: stepId,
              nome: s.nome || `Aula ${sIdx + 1}`,
              tipo: s.tipo || 'video',
              url_video: '',
              descricao: s.tipo === 'artigo' ? 'Escreva aqui o conteúdo em texto da sua aula...' : '',
              tempo_video: s.tipo === 'video' ? '10:00' : '',
              questoes_ids: []
            };
          })
        };
      });

      // Save generated curriculum to DB & state
      const success = await saveCurriculo(generatedSections);
      if (success) {
        setSections(generatedSections);
        showToast('Grade curricular gerada com sucesso pela Inteligência Artificial!', 'success');
      }
    } catch (err: any) {
      console.error('Error generating AI outline:', err);
      showToast('Falha ao gerar grade com IA: ' + err.message, 'error');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateQuizWithAI = async (topic: string, count: number) => {
    try {
      setIsGeneratingQuiz(true);
      const response = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          count
        })
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorMsg = 'Erro ao gerar questões.';
        try { errorMsg = JSON.parse(rawText).error || errorMsg; } catch { errorMsg = rawText.substring(0, 200) || errorMsg; }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (!data || !data.questions || !Array.isArray(data.questions)) {
        throw new Error('Formato de resposta inválido do Gemini.');
      }

      // Convert generated questions to public.questoes_teoricas format
      const newQuestionsPayload = data.questions.map((q: any) => {
        return {
          organizacao_id: orgId,
          enunciado: q.enunciado,
          opcoes: q.opcoes, // exactly 4 options
          correta: q.correta, // '0', '1', '2' or '3'
          tema: q.tema || topic || 'Geral',
          dificuldade: q.dificuldade || 'Médio',
          created_at: new Date().toISOString()
        };
      });

      // Insert into Supabase
      const { error } = await supabase.from('questoes_teoricas').insert(newQuestionsPayload);
      if (error) {
        // Fallback if organization_id column doesn't exist
        if (error.code === '42703' || error.message?.includes('organizacao_id')) {
          const sanitized = newQuestionsPayload.map(q => {
            const { organizacao_id, ...rest } = q;
            return rest;
          });
          const { error: error2 } = await supabase.from('questoes_teoricas').insert(sanitized);
          if (error2) throw error2;
        } else {
          throw error;
        }
      }

      // Refresh available questions list
      await fetchQuestoes();
      showToast(`${newQuestionsPayload.length} questões teóricas geradas com sucesso pela Inteligência Artificial e adicionadas ao banco!`, 'success');
    } catch (err: any) {
      console.error('Error generating AI quiz questions:', err);
      showToast('Falha ao gerar questões com IA: ' + err.message, 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };


  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'SECTION') {
      const newSections = Array.from(sections);
      const [reorderedSection] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, reorderedSection);
      
      setSections(newSections);
      saveCurriculo(newSections);
      return;
    }

    // Default behavior for STEPs
    const sourceSectionId = source.droppableId;
    const destSectionId = destination.droppableId;

    const sourceIdx = source.index;
    const destIdx = destination.index;

    // Need to clone the array and the sections being modified
    const newSections = (sections || []).map(s => ({ ...s, etapas: [...(s.etapas || [])] }));

    // Find sections by ID or index (for legacy support if needed, but we'll prioritize ID)
    let sourceSection = newSections.find(s => s.id === sourceSectionId);
    let destSection = newSections.find(s => s.id === destSectionId);

    // Fallback to index if not found by ID (if we are still using indices as strings)
    if (!sourceSection && !isNaN(parseInt(sourceSectionId))) {
      sourceSection = newSections[parseInt(sourceSectionId)];
    }
    if (!destSection && !isNaN(parseInt(destSectionId))) {
      destSection = newSections[parseInt(destSectionId)];
    }

    if (!sourceSection || !destSection) return;

    const [movedEtapa] = sourceSection.etapas.splice(sourceIdx, 1);
    destSection.etapas.splice(destIdx, 0, movedEtapa);

    setSections(newSections);
    saveCurriculo(newSections);
  };

  const fetchCursos = async () => {
    const requestId = ++fetchRequestRef.current;
    setIsLoading(true);
    setFetchError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (requestId !== fetchRequestRef.current) return;
      console.log('DEBUG [fetchCursos]:', {
        orgId,
        sessionUser: sessionData?.session?.user?.email,
        sessionUserId: sessionData?.session?.user?.id,
        sessionRole: sessionData?.session?.user?.role,
      });

      let queryCursos = supabase
        .from('cursos')
        .select('id, nome, preco, status, ordem, created_at, thumbnail_url, professor_nome, professor_titulo, professor_foto_url, descricao, carga_horaria, ritmo, tempo, duracao, duracao_tipo, valor, em_breve, configuracao_json, curriculo_json, tem_certificado');
        
      let queryTrilhas = supabase
        .from('trilhas')
        .select('*');

      if (orgId) {
        queryCursos = queryCursos.eq('organizacao_id', orgId);
        queryTrilhas = queryTrilhas.eq('organizacao_id', orgId);
      }

      const { data: cursosData, error: cursosError } = await queryCursos.order('ordem', { ascending: true, nullsFirst: false });
      if (requestId !== fetchRequestRef.current) return;
      const { data: trilhasData, error: trilhasError } = await queryTrilhas.order('ordem', { ascending: true, nullsFirst: false });
      if (requestId !== fetchRequestRef.current) return;

      console.log('DEBUG [fetchCursos] results:', {
        cursosCount: cursosData?.length,
        cursosData,
        cursosError,
        trilhasCount: trilhasData?.length,
        trilhasError
      });

      if (cursosError) {
        console.error('Error fetching courses:', cursosError);
        setFetchError(prev => prev ? `${prev} | Erro nos cursos: ${cursosError.message}` : `Erro nos cursos: ${cursosError.message}`);
      }
      if (trilhasError) {
        console.error('Error fetching trilhas:', trilhasError);
        setFetchError(prev => prev ? `${prev} | Erro nas trilhas: ${trilhasError.message}` : `Erro nas trilhas: ${trilhasError.message}`);
      }

      // Fetch participant counts and trilha associations for the relevant courses
      const courseIds = (cursosData || []).map(c => c.id);
      const trilhaIds = (trilhasData || []).map(t => t.id);

      const [countsRes, trilhaCursosRes] = await Promise.all([
        courseIds.length > 0 
          ? supabase.from('curso_participantes').select('curso_id, usuario_id').in('curso_id', courseIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        trilhaIds.length > 0
          ? supabase.from('trilha_cursos').select('trilha_id, curso_id').in('trilha_id', trilhaIds)
          : Promise.resolve({ data: [] as any[], error: null })
      ]);
      if (requestId !== fetchRequestRef.current) return;

      const countsMap: Record<string, number> = {};
      
      if (countsRes.data) {
        // Individual course counts
        countsRes.data.forEach((row: any) => {
          countsMap[row.curso_id] = (countsMap[row.curso_id] || 0) + 1;
        });

        // Trilha counts (unique participants across all its courses)
        if (trilhaCursosRes.data) {
          const trilhaToUsers: Record<string, Set<string>> = {};
          
          trilhaCursosRes.data.forEach((tc: any) => {
            if (!trilhaToUsers[tc.trilha_id]) {
              trilhaToUsers[tc.trilha_id] = new Set();
            }
            
            // Find participants for this course and add to the trilha's set
            const courseUserIds = countsRes.data!
              .filter((p: any) => p.curso_id === tc.curso_id)
              .map((p: any) => p.usuario_id);
              
            courseUserIds.forEach(uid => trilhaToUsers[tc.trilha_id].add(uid));
          });

          // Convert sets to sizes
          for (const tId in trilhaToUsers) {
            countsMap[tId] = trilhaToUsers[tId].size;
          }
        }
      }
      
      setParticipantCounts(countsMap);
      
      // Client-side filtering if needed, for now just show all to see if they appear
      const combined = [
        ...(cursosData || []).map(c => ({ ...c, type: 'curso' })),
        ...(trilhasData || []).map(t => ({ ...t, type: 'trilha' }))
      ];
      
      // Safe Sort: prioritize 'ordem' (ascending, nulls/undefined last), then 'created_at' (descending, invalid dates last)
      combined.sort((a, b) => {
        const ordemA = typeof a.ordem === 'number' ? a.ordem : 999999;
        const ordemB = typeof b.ordem === 'number' ? b.ordem : 999999;
        
        if (ordemA !== ordemB) {
          return ordemA - ordemB;
        }
        
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        const validA = isNaN(timeA) ? 0 : timeA;
        const validB = isNaN(timeB) ? 0 : timeB;
        
        return validB - validA; // Descending by creation date
      });
      
      setCursos(cursosData || []);
      setTrilhas(trilhasData || []);
      setDisplayItems(combined);


    } catch (err: any) {
      if (requestId !== fetchRequestRef.current) return;
      console.error('Failed to fetch data:', err);
      setFetchError(err.message || 'Erro desconhecido ao carregar dados');
      setCursos([]);
      setTrilhas([]);
      setDisplayItems([]);
    } finally {
      if (requestId === fetchRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleReorder = async (newItems: any[]) => {
    setDisplayItems(newItems);
    
    // Sync separate states
    setCursos(newItems.filter(i => i.type === 'curso'));
    setTrilhas(newItems.filter(i => i.type === 'trilha'));
    
    // Updates the DB with the new order
    // To minimize API calls, we could use a single RPC or batch update if supported.
    // Here we'll do promise.all updates.
    
    try {
      const updates = newItems.map((item, index) => {
        const table = item.type === 'curso' ? 'cursos' : 'trilhas';
        return supabase.from(table).update({ ordem: index }).eq('id', item.id);
      });
      
      await Promise.all(updates);
    } catch (err: any) {
      console.error('Error persisting order:', err);
      if (err.message && (err.message.includes("column \"ordem\" of relation") || err.message.includes("does not exist"))) {
        console.warn('Column "ordem" does not exist. Please run the SQL migration.');
      }
    }
  };
  const loadCertificateTemplate = async (cursoId: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('cursos')
        .select('certificado_template')
        .eq('id', cursoId)
        .single();
      if (error) throw error;
      return data?.certificado_template || null;
    } catch (err) {
      console.error('Error loading certificate template:', err);
      return null;
    }
  };

  const handleSaveCertificate = async (template: CertificateTemplate) => {
    console.log('handleSaveCertificate (Curso) called', { createdCourseId, template });
    if (!createdCourseId) {
      showToast('Erro: ID do curso não encontrado. Tente recarregar o curso.', 'error');
      return;
    }

    // Check template size to warn user before saving
    const templateStr = JSON.stringify(template);
    const sizeMB = templateStr.length / 1024 / 1024;
    if (sizeMB > 3) {
      showToast(`⚠️ AVISO: O template do certificado está muito grande (${sizeMB.toFixed(2)} MB).\n\nIsso pode causar lentidão. Por favor:\n1. Use uma imagem de fundo menor (máx. 300KB recomendado)\n2. Certifique-se de que o bucket "certificados" está criado no Supabase Storage para upload automático.`, 'error');
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('cursos')
        .update({ certificado_template: template, tem_certificado: true })
        .eq('id', createdCourseId);
      
      if (error) throw error;
      
      showToast('Template de certificado salvo com sucesso!', 'success');
      setIsCertificateModalOpen(false);
      // Update local state only (don't re-fetch all courses with heavy payload)
      setCursos(prev => prev.map(c => 
        c.id === createdCourseId ? { ...c, tem_certificado: true } : c
      ));
    } catch (err: any) {
      console.error('Error saving certificate template:', err);
      if (err.code === '57014') {
        showToast('Erro: Tempo limite excedido (DB Timeout). A imagem de fundo do certificado é muito grande.\n\nSolução:\n1. Crie o bucket "certificados" no Supabase Storage (Storage → New Bucket → "certificados" → Public)\n2. Tente fazer o upload novamente — o sistema fará upload automático para o Storage.', 'error');
      } else {
        showToast('Erro ao salvar template do certificado: ' + (err.message || 'Erro desconhecido', 'error'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const renderActionModal = () => (
    <ActionModal
      isOpen={modalConfig.isOpen}
      title={modalConfig.title}
      message={modalConfig.message}
      type={modalConfig.type}
      onConfirm={modalConfig.onConfirm}
      onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
    />
  );

  if (view === 'list') {
    return (
      <>
      <div className="bg-slate-50 min-h-screen p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Cursos online</h1>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsMarketingModalOpen(true)}
                className="px-4 py-2 border border-slate-300 rounded-full font-medium hover:bg-slate-100 flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Divulgação
              </button>
              <button 
                onClick={async () => {
                  try {
                    const { data, error } = await supabase
                      .from('cursos')
                      .insert([{ 
                        nome: 'Novo Programa (Rascunho)', 
                        organizacao_id: orgId,
                        status: 'Rascunho',
                        curriculo_json: [],
                        configuracao_json: {
                          ritmo: 'proprio',
                          tempo: 'sem_limite',
                          preco: 'gratuito',
                          pagamento_modelo: 'fixo'
                        }
                      }])
                      .select();
                    
                    if (error) throw error;
                    
                    if (data && data.length > 0) {
                      setCreatedCourseId(data[0].id);
                      setCreatedCourseName(data[0].nome);
                      setView('course_dashboard');
                      fetchCursos();
                    } else {
                      // Se não retornou data, mas não deu erro, pode ser RLS impedindo o SELECT.
                      // Mesmo assim, vamos atualizar a lista de cursos.
                      fetchCursos();
                      showToast('Curso criado, mas você não tem permissão para visualizá-lo imediatamente.', 'error');
                    }
                  } catch (err: any) {
                    console.error('Erro ao criar curso:', err);
                    showToast('Erro ao criar curso: ' + (err.message || 'Erro desconhecido'), 'error');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar Curso
              </button>
              <button 
                onClick={() => setIsTrilhaModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Criar Trilha
              </button>
            </div>
          </div>
          
          <TrilhaModal 
            isOpen={isTrilhaModalOpen}
            onClose={() => { setIsTrilhaModalOpen(false); setEditingTrilha(null); }}
            fetchTrilhas={fetchCursos}
            editingTrilha={editingTrilha}
            orgId={orgId}
          />                
          <MarketingLinksModal 
            isOpen={isMarketingModalOpen}
            onClose={() => setIsMarketingModalOpen(false)}
            publicBaseUrl={window.location.origin}
            cursos={cursos}
            trilhas={trilhas}
          />

          {fetchError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="text-sm font-medium">{fetchError}</div>
            </div>
          )}


          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-4"></th>
                  <th className="px-6 py-4 font-semibold">Nome</th>
                  <th className="px-6 py-4 font-semibold">Participantes</th>
                  <th className="px-6 py-4 font-semibold">Preço</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              {isLoading ? (
                <tbody className="divide-y divide-slate-100">
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                      <p>Carregando programas...</p>
                    </div>
                  </td>
                </tr>
                </tbody>
              ) : displayItems.length === 0 ? (
                <tbody className="divide-y divide-slate-100">
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-medium">Nenhum programa ou trilha encontrado. Crie um novo.</td>
                </tr>
                </tbody>
              ) : (
                <Reorder.Group axis="y" values={displayItems} onReorder={handleReorder} as="tbody" className="divide-y divide-slate-100">
                  {displayItems.map(item => (
                    <Reorder.Item 
                      key={item.id} 
                      value={item} 
                      as="tr" 
                      className="hover:bg-slate-50 cursor-pointer group"
                    >
                      <td className="px-4 py-4 text-slate-300 group-hover:text-slate-400">
                        <GripVertical className="w-4 h-4 cursor-grab" />
                      </td>
                      {item.type === 'curso' ? (
                        <>
                          <td className="px-6 py-4 font-medium text-slate-900" onClick={() => { 
                            setCreatedCourseId(item.id);
                            setCreatedCourseName(item.nome);
                            setView('course_dashboard');
                          }}>{item.nome}</td>
                          <td className="px-6 py-4 text-slate-600" onClick={() => { 
                            setCreatedCourseId(item.id);
                            setCreatedCourseName(item.nome);
                            setView('course_dashboard');
                          }}>{participantCounts[item.id] || 0}</td>
                          <td className="px-6 py-4 text-slate-600 capitalize" onClick={() => { 
                            setCreatedCourseId(item.id);
                            setCreatedCourseName(item.nome);
                            setView('course_dashboard');
                          }}>{item.preco || 'Gratuito'}</td>
                          <td className="px-6 py-4" onClick={() => { 
                            setCreatedCourseId(item.id);
                            setCreatedCourseName(item.nome);
                            setView('course_dashboard');
                          }}>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Publicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{item.status || 'Rascunho'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const newStatus = item.status === 'Publicado' ? 'Rascunho' : 'Publicado';
                                  try {
                                    const { error } = await supabase.from('cursos').update({ status: newStatus }).eq('id', item.id);
                                    if (error) throw error;
                                    fetchCursos();
                                  } catch (err: any) {
                                    console.error('Error updating course status:', err);
                                    showToast('Erro ao atualizar status: ' + (err.message || 'Erro desconhecido', 'error'));
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                                title={item.status === 'Publicado' ? 'Despublicar' : 'Publicar'}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCreatedCourseId(item.id);
                                  setCreatedCourseName(item.nome);
                                  setView('course_dashboard');
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalConfig({
                                    isOpen: true,
                                    type: 'confirm',
                                    title: 'Excluir curso',
                                    message: 'Tem certeza que deseja excluir este curso?',
                                    onConfirm: async () => {
                                      setModalConfig(prev => ({ ...prev, isOpen: false }));
                                      try {
                                        const { error } = await supabase.from('cursos').delete().eq('id', item.id);
                                        if (error) throw error;
                                        fetchCursos();
                                      } catch (err: any) {
                                        console.error('Error deleting course:', err);
                                        showToast('Erro ao excluir curso: ' + (err.message || 'Erro desconhecido', 'error'));
                                      }
                                    }
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-slate-900" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>{item.nome} <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">Trilha</span></td>
                          <td className="px-6 py-4 text-slate-600" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>{participantCounts[item.id] || 0}</td>
                          <td className="px-6 py-4 text-slate-600 capitalize" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>Pago</td>
                          <td className="px-6 py-4" onClick={() => { setEditingTrilha(item); setIsTrilhaModalOpen(true); }}>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Publicado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{item.status || 'Rascunho'}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={async (e) => {
                                   e.stopPropagation();
                                   const newStatus = item.status === 'Publicado' ? 'Rascunho' : 'Publicado';
                                   try {
                                     const { error, count } = await supabase
                                       .from('trilhas')
                                       .update({ status: newStatus }, { count: 'exact' })
                                       .eq('id', item.id);
                                     if (error) throw error;
                                     if (count === 0) {
                                       showToast(`Permissão negada (RLS). Verifique as políticas da tabela trilhas.`, 'error');
                                       return;
                                     }
                                     fetchCursos();
                                   } catch (err: any) {
                                     console.error('Error updating trilha status:', err);
                                     showToast('Erro ao atualizar status da trilha: ' + (err.message || 'Erro desconhecido', 'error'));
                                   }
                                 }}
                                 className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                                 title={item.status === 'Publicado' ? 'Despublicar' : 'Publicar'}
                               >
                                 <CheckCircle className="w-4 h-4" />
                               </button>
                               <button onClick={(e) => { e.stopPropagation(); setEditingTrilha(item); setIsTrilhaModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                                 <Pencil className="w-4 h-4" />
                               </button>
                              <button 
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setModalConfig({
                                     isOpen: true,
                                     type: 'confirm',
                                     title: 'Excluir trilha',
                                     message: 'Tem certeza que deseja excluir esta trilha?',
                                     onConfirm: async () => {
                                       setModalConfig(prev => ({ ...prev, isOpen: false }));
                                       try {
                                         const { error } = await supabase.from('trilhas').delete().eq('id', item.id);
                                         if (error) throw error;
                                         
                                         // Also remove from trilha_cursos
                                         const { error: tcError } = await supabase.from('trilha_cursos').delete().eq('trilha_id', item.id);
                                         if (tcError) throw tcError;

                                         fetchCursos();
                                       } catch (err: any) {
                                         console.error('Error deleting trilha:', err);
                                         showToast('Erro ao excluir trilha: ' + (err.message || 'Erro desconhecido', 'error'));
                                       }
                                     }
                                   });
                                 }}
                                 className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </table>
          </div>
        </div>
      </div>
      {renderActionModal()}
      </>
    );
  }


  const activeCurso = editingTrilha ? null : (cursos || []).find(c => c.id === createdCourseId);
  const activeTrilha = editingTrilha;
  
  const nomeExibido = editingTrilha ? activeTrilha.nome : createdCourseName;

  const tempoText = activeCurso?.tempo === 'sem_limite' ? 'Sem limite' : (activeCurso?.duracao ? `${activeCurso?.duracao} ${activeCurso?.duracao_tipo}` : 'Sem limite');
  const ritmoText = activeCurso?.ritmo === 'programado' ? 'Programado' : 'Próprio ritmo';
  const filteredParticipants = courseParticipants.filter(p => {
    const nome = (p.usuarios?.nome || '').toLowerCase();
    const email = (p.usuarios?.email || '').toLowerCase();
    const search = participantSearch.toLowerCase();
    
    const matchesSearch = nome.includes(search) || email.includes(search);
    
    if (participantStatusFilter === 'todos') return matchesSearch;
    
    const progress = Math.min(100, Math.max(0, p.progresso || 0));
    if (participantStatusFilter === 'concluido') return matchesSearch && progress >= 100;
    if (participantStatusFilter === 'andamento') return matchesSearch && progress > 0 && progress < 100;
    if (participantStatusFilter === 'nao_comecou') return matchesSearch && progress === 0;
    
    return matchesSearch;
  });

  const handleExportCSV = () => {
    if (filteredParticipants.length === 0) {
      setModalConfig({
        isOpen: true,
        type: 'alert',
        title: 'Sem dados',
        message: 'Não há participantes para exportar.',
        onConfirm: () => setModalConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    
    const headers = ['Nome', 'Email', 'Progresso', 'Status', 'Data de Entrada', 'Última Atividade'];
    const rows = filteredParticipants.map(p => {
      const nome = p.usuarios?.nome || 'Usuário Desconhecido';
      const email = p.usuarios?.email || '';
      const progresso = `${Math.min(100, Math.max(0, p.progresso || 0))}%`;
      const cappedProgress = Math.min(100, Math.max(0, p.progresso || 0));
      let statusText = 'Em Andamento';
      if (cappedProgress === 0) statusText = 'Não começou';
      else if (cappedProgress >= 100) statusText = 'Concluído';
      
      const entrada = new Date(p.created_at).toLocaleDateString('pt-BR');
      const atividade = new Date(p.updated_at).toLocaleDateString('pt-BR');
      
      const clean = (str: string) => str.replace(/,/g, ';');
      
      return [clean(nome), clean(email), progresso, statusText, entrada, atividade].join(',');
    });
    
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `participantes_${activeCurso?.nome || 'curso'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSVTemplate = () => {
    const headers = ['Pergunta', 'OpcaoA', 'OpcaoB', 'OpcaoC', 'OpcaoD', 'OpcaoE', 'RespostaCorreta', 'Tema', 'Dificuldade'];
    const example = ['Qual a capital do Brasil?', 'São Paulo', 'Rio de Janeiro', 'Brasília', 'Belo Horizonte', 'Salvador', 'C', 'Geografia', 'Fácil'];
    const example2 = ['Quem descobriu o Brasil?', 'Pedro Álvares Cabral', 'Vasco da Gama', 'Cristóvão Colombo', 'Américo Vespúcio', 'Bartolomeu Dias', 'A', 'História', 'Médio'];
    const example3 = ['Capital da França?', 'Marselha', 'Lyon', 'Paris', 'Nice', 'Bordeaux', '3', 'Geografia', 'Fácil'];
    
    const csvContent = "\uFEFF" + [
      headers.join(','), 
      example.join(','), 
      example2.join(','),
      example3.join(',')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_questoes_academia.csv');
    link.click();
  };

  const precoText = activeCurso?.preco === 'gratuito' ? 'Gratuito' : `Pago`;

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[1000] flex items-center justify-center p-0 md:p-8 overflow-hidden">
      <div className="relative bg-white w-full max-w-7xl h-full md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-[110] px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button onClick={() => { setView('list'); setEditingTrilha(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
               <ChevronLeft className="w-6 h-6" />
             </button>
             <div>
               <h2 className="text-xl font-bold text-slate-800">{nomeExibido}</h2>
               <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                 <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {tempoText}</span>
                 <span className="w-1 h-1 bg-slate-300 rounded-full" />
                 <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> {ritmoText}</span>
                 <span className={`px-2 py-0.5 ml-2 rounded-full font-bold bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider`}>
                    {activeCurso?.status || 'Rascunho'}
                 </span>
               </div>
             </div>
          </div>
          <button onClick={() => { setView('list'); setEditingTrilha(null); }} className="p-2.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-600">
             <X className="w-6 h-6" />
          </button>
        </div>

        <div className="bg-white border-b border-slate-100 px-8 flex gap-8 shrink-0 overflow-x-auto scrollbar-hide">
          {(['visao_geral', 'conteudo', 'participantes', 'engajamento', 'landing_page', 'planos', 'split', 'financeiro'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`py-4 font-bold text-sm tracking-tight transition-all relative whitespace-nowrap ${
                activeTab === tab 
                ? 'text-blue-600' 
                : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab === 'visao_geral' ? 'Visão Geral' : 
               tab === 'conteudo' ? (editingTrilha ? 'Cursos Inclusos' : 'Currículo') : 
               tab === 'participantes' ? (editingTrilha ? 'Alunos' : 'Participantes') : 
               tab === 'engajamento' ? 'Certificado' : 
               tab === 'landing_page' ? 'Página de Vendas' : 
               tab === 'planos' ? 'Assinaturas' :
               tab === 'split' ? 'Coprodução / Split' :
               tab === 'financeiro' ? 'Financeiro' : 'Configurações'}
              {activeTab === tab && (
                <motion.div 
                  layoutId="activeTabIndicatorCurso"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" 
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          <div className="max-w-5xl mx-auto">
        {activeTab === 'financeiro' && (
          <FinanceiroAdmin orgId={orgId} />
        )}
        {activeTab === 'planos' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-2xl text-slate-900 mb-2">Planos de Assinatura</h3>
                  <p className="text-slate-500 text-sm">Crie e gerencie os planos de pagamento recorrente (mensal/anual) para este conteúdo.</p>
                </div>
                <button
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
                  onClick={() => alert('Criação de planos pelo Painel Administrativo do Pagar.me (em breve API de criação)')}
                >
                  + Novo Plano
                </button>
              </div>

              {planosAssinatura.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-slate-500 text-sm">Nenhum plano de assinatura configurado para este conteúdo.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {planosAssinatura.map((plano) => (
                    <div key={plano.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg">{plano.nome}</h4>
                        <p className="text-slate-500 text-sm">{plano.descricao}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-xl text-blue-600">R$ {(plano.valor_cents / 100).toFixed(2)}</div>
                        <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                          /{plano.intervalo === 'month' ? 'mês' : 'ano'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'split' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-2xl text-slate-900 mb-2">Split de Coprodução</h3>
                  <p className="text-slate-500 text-sm">Configure a divisão automática de receitas deste curso com outros especialistas ou coordenadores da sua organização.</p>
                </div>
              </div>

              {loggedUser?.role !== 'super_admin' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3 text-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="font-semibold">Modo de Visualização: Apenas administradores globais (Segunda Gaveta Academy) podem configurar ou alterar as regras de split deste curso.</p>
                </div>
              )}

              {/* Form to add a split rule - Only for Super Admin */}
              {loggedUser?.role === 'super_admin' && (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Parceiro / Coprodutor</label>
                    <select 
                      id="select-coproducer"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-700"
                      defaultValue=""
                    >
                      <option value="" disabled>Selecione um especialista...</option>
                      {orgUsers
                        .filter(u => u.role === 'especialista' || u.role === 'coordenador')
                        .filter(u => !courseSplits.some(s => s.usuario_id === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.nome || u.email} ({u.role})</option>
                        ))}
                    </select>
                  </div>
                  <div className="w-full md:w-32 space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Porcentagem</label>
                    <div className="relative">
                      <input 
                        id="input-split-percentage"
                        type="number" 
                        min="1" 
                        max="100" 
                        className="w-full pl-4 pr-8 py-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-700"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const select = document.getElementById('select-coproducer') as HTMLSelectElement;
                      const input = document.getElementById('input-split-percentage') as HTMLInputElement;
                      const userId = select.value;
                      const pct = parseInt(input.value);
                      if (!userId || isNaN(pct) || pct <= 0 || pct > 100) {
                        showToast('Por favor, selecione um especialista e digite uma porcentagem válida.', 'error');
                        return;
                      }
                      const totalCurrent = courseSplits.reduce((acc, s) => acc + s.porcentagem, 0);
                      if (totalCurrent + pct > 100) {
                        showToast(`A soma das porcentagens não pode ultrapassar 100% (atual: ${totalCurrent}% + novo: ${pct}% = ${totalCurrent + pct}%).`, 'error');
                        return;
                      }
                      const nextSplits = [...courseSplits, { usuario_id: userId, porcentagem: pct }];
                      setCourseSplits(nextSplits);
                      select.value = "";
                      input.value = "";
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all text-sm h-12 flex items-center justify-center shrink-0"
                  >
                    Adicionar Regra
                  </button>
                </div>
              )}

              {/* List of current split rules */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Regras de Divisão Ativas</h4>
                
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                        <th className="p-4 pl-6">Beneficiário</th>
                        <th className="p-4">Cargo</th>
                        <th className="p-4">Porcentagem</th>
                        {loggedUser?.role === 'super_admin' && <th className="p-4 pr-6 text-right">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {/* Main Producer Row */}
                      <tr className="bg-blue-50/20 font-medium">
                        <td className="p-4 pl-6">Você (Produtor Principal)</td>
                        <td className="p-4 text-xs font-bold text-blue-600">PRODUTOR</td>
                        <td className="p-4 font-black">{100 - courseSplits.reduce((acc, s) => acc + s.porcentagem, 0)}%</td>
                        {loggedUser?.role === 'super_admin' && <td className="p-4 pr-6 text-right text-slate-400 italic text-xs">Padrão</td>}
                      </tr>

                      {courseSplits.map((split, sIdx) => {
                        const user = orgUsers.find(u => u.id === split.usuario_id);
                        return (
                          <tr key={split.usuario_id}>
                            <td className="p-4 pl-6">
                              <div className="font-bold text-slate-900">{user?.nome || 'Usuário Desconhecido'}</div>
                              <div className="text-xs text-slate-400">{user?.email}</div>
                            </td>
                            <td className="p-4 uppercase text-xs font-semibold text-slate-500">{user?.role}</td>
                            <td className="p-4 font-black text-slate-900">{split.porcentagem}%</td>
                            {loggedUser?.role === 'super_admin' && (
                              <td className="p-4 pr-6 text-right">
                                <button 
                                  onClick={() => {
                                    const nextSplits = courseSplits.filter((_, idx) => idx !== sIdx);
                                    setCourseSplits(nextSplits);
                                  }}
                                  className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* M14: Pagar.me Marketplace Toggle */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Pagar.me Marketplace</h4>
                <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="pagarmeMarketplaceEnabled"
                    disabled={loggedUser?.role !== 'super_admin'}
                    checked={pagarmeMarketplaceEnabled}
                    onChange={(e) => setPagarmeMarketplaceEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="pagarmeMarketplaceEnabled" className="text-sm font-medium text-slate-700 select-none">
                    Ativar Split Nativo Pagar.me (Requer aprovação como Marketplace no Pagar.me)
                  </label>
                </div>
              </div>

              {/* Affiliate Commission Configuration */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Configuração de Afiliados</h4>
                <div className="max-w-xs space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Comissão de Afiliados (%)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      min="0" 
                      max="100" 
                      disabled={loggedUser?.role !== 'super_admin'}
                      value={affiliateCommission}
                      onChange={(e) => setAffiliateCommission(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl outline-none text-slate-700 font-bold disabled:opacity-70 disabled:bg-slate-50"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Percentual direcionado para o afiliador que indicar a venda do curso.</p>
                </div>
              </div>

              {/* Save changes - Only for Super Admin */}
              {loggedUser?.role === 'super_admin' && (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    disabled={isSaving}
                    onClick={() => saveCourseSplits(courseSplits, affiliateCommission, pagarmeMarketplaceEnabled)}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Salvar Regras de Split
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'visao_geral' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start">
              <div className="flex gap-6 items-start">
                <div 
                  className="w-24 h-16 bg-slate-100 border border-slate-200 rounded flex items-center justify-center font-bold text-lg text-slate-800 bg-cover bg-center"
                  style={{ backgroundImage: (activeCurso?.thumbnail_url || activeTrilha?.capa_url) ? `url("${activeCurso?.thumbnail_url || activeTrilha?.capa_url}")` : undefined }}
                >
                  {!(activeCurso?.thumbnail_url || activeTrilha?.capa_url) && (
                    loggedUser?.organizacoes?.logo_url ? (
                      <img src={loggedUser.organizacoes.logo_url} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <span className="text-sm px-2 text-center truncate">{loggedUser?.organizacoes?.nome || 'Novo Curso'}</span>
                    )
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">{nomeExibido}</h2>
                  {!editingTrilha && (
                    <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 mb-2">
                       <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {tempoText}</span>
                       <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Público</span>
                       <span className="flex items-center gap-2"><Award className="w-4 h-4" /> {precoText}</span>
                       <span className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {ritmoText}</span>
                    </div>
                  )}
                  {editingTrilha && (
                      <div className="flex items-center gap-2 mt-3">
                        {activeTrilha.coordenador_foto_url ? (
                          <img src={activeTrilha.coordenador_foto_url} alt={activeTrilha.coordenador_nome || 'Coordenador'} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                            {(activeTrilha.coordenador_nome || 'C').charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          Coordenador: {activeTrilha.coordenador_nome || 'Sem nome'}
                          {activeTrilha.coordenador_titulo && <span className="text-slate-500 font-normal ml-1">({activeTrilha.coordenador_titulo})</span>}
                        </span>
                      </div>
                  )}
                  {(!editingTrilha && (activeCurso?.professor_nome || activeCurso?.professor_foto_url)) && (
                    <div className="flex items-center gap-2 mt-3">
                      {activeCurso.professor_foto_url ? (
                        <img src={activeCurso.professor_foto_url} alt={activeCurso.professor_nome || 'Professor'} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                          {(activeCurso.professor_nome || 'P').charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700">
                        {activeCurso.professor_nome || 'Professor sem nome'}
                        {activeCurso.professor_titulo && <span className="text-slate-500 font-normal ml-1">({activeCurso.professor_titulo})</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  if (editingTrilha) {
                      showToast('Abrir edição de trilha no modal', 'info');
                  } else {
                    setCreatedCourseId(activeCurso?.id || '');
                    const config = activeCurso?.configuracao_json || {};
                    setEditingSettingsData({
                      nome: activeCurso?.nome || '',
                      thumbnail_url: activeCurso?.thumbnail_url || '',
                      tempo: activeCurso?.tempo || 'sem_limite',
                      duracao: activeCurso?.duracao?.toString() || '',
                      duracao_tipo: activeCurso?.duracao_tipo || 'Dias',
                      ritmo: activeCurso?.ritmo || 'proprio',
                      preco: activeCurso?.preco || 'gratuito',
                      valor: activeCurso?.valor?.toString() || '',
                      professor_nome: activeCurso?.professor_nome || '',
                      professor_titulo: activeCurso?.professor_titulo || '',
                      professor_foto_url: activeCurso?.professor_foto_url || '',
                      descricao: activeCurso?.descricao || '',
                      carga_horaria: activeCurso?.carga_horaria || '',
                      em_breve: activeCurso?.em_breve || false,
                      pagamento_modelo: config.pagamento_modelo || 'fixo',
                      pagamento_ciclo: config.pagamento_ciclo?.toString() || '30',
                      pagamento_parcelas_limite: config.pagamento_parcelas_limite?.toString() || '12'
                    });
                    setIsEditingSettingsModalOpen(true);
                  }
                }}
                className="px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50"
              >
                Editar configurações
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-900">Participantes</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const url = `${window.location.origin}/?inscricao_curso=${createdCourseId}`;
                      navigator.clipboard.writeText(url);
                      showToast('Link de inscrição copiado para a área de transferência!', 'success');
                    }}
                    className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
                  >
                    <Share2 className="w-4 h-4"/> Compartilhar link de inscrição
                  </button>
                  <button 
                    onClick={() => {
                      setConvidarEmails('');
                      setIsConvidarModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4"/> Convidar participantes
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><Users className="w-4 h-4" /> <span className="text-sm">Total de participantes</span></div>
                  <span className="font-bold text-xl">{courseStats.total}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><BarChart2 className="w-4 h-4" /> <span className="text-sm">Em andamento</span></div>
                  <span className="font-bold text-xl">{courseStats.andamento}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><CheckCircle className="w-4 h-4" /> <span className="text-sm">Concluído</span></div>
                  <span className="font-bold text-xl">{courseStats.concluido}</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-2 text-slate-600"><Award className="w-4 h-4" /> <span className="text-sm">Taxa de conclusão</span></div>
                  <span className="font-bold text-xl">{courseStats.taxa}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conteudo' && viewConteudo === 'list' && (
          <>
            {(() => {
              const currentSize = JSON.stringify(sections).length;
              if (currentSize < 1 * 1024 * 1024) return null;
              
              const isCritical = currentSize > 5 * 1024 * 1024;
              return (
                <div className={`mb-6 p-4 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2 border ${
                  isCritical 
                    ? 'bg-red-50 text-red-800 border-red-200' 
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  <AlertTriangle className={`w-6 h-6 shrink-0 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">
                      {isCritical ? '⚠️ Conteúdo Muito Pesado' : 'Atenção com o tamanho do curso'}
                    </h4>
                    <p className="text-sm opacity-90 leading-relaxed">
                      O currículo atual tem **{(currentSize / 1024 / 1024).toFixed(2)} MB**. 
                      {isCritical 
                        ? ' Este tamanho impede o salvamento no banco de dados. Você provavelmente colou imagens pesadas no texto. Remova-as para conseguir salvar.' 
                        : ' Acima de 5 MB você terá problemas ao salvar. Evite embutir imagens pesadas diretamente nos campos de texto.'}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-10">
               <h3 className="font-bold text-xl text-slate-900">Conteúdo</h3>
               <div className="flex gap-2">
                  <button 
                    onClick={handleGenerateOutlineWithAI}
                    disabled={isGeneratingOutline}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isGeneratingOutline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGeneratingOutline ? "Gerando..." : "Gerar com IA"}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                      setViewConteudo('edit_section');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-blue-600 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>
            </div>
            
            {sections.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
                <h4 className="text-xl font-bold text-slate-900 mb-2">Comece a criar o conteúdo do seu programa</h4>
                <p className="text-slate-600 max-w-lg mb-6">
                  Você pode começar adicionando sua primeira seção manualmente ou deixar que nossa IA gere instantaneamente uma estrutura para você.
                </p>
                <div className="flex gap-4 items-center justify-center">
                  <button 
                    onClick={() => {
                      setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                      setViewConteudo('edit_section');
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Criar Seção Manuais
                  </button>
                  <button 
                    onClick={handleGenerateOutlineWithAI}
                    disabled={isGeneratingOutline}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
                  >
                    {isGeneratingOutline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGeneratingOutline ? "Gerando currículo..." : "Gerar Currículo com IA"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {dndReady && (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="ROOT" type="SECTION">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                          {sections.map((section, sIdx) => (
                            <Draggable key={section.id || `sec-${sIdx}`} draggableId={section.id || `sec-${sIdx}`} index={sIdx}>
                              {(provided, snapshot) => (
                                <div 
                                  ref={provided.innerRef} 
                                  {...provided.draggableProps} 
                                  className={`border rounded-lg bg-white transition-all duration-200 ${
                                    snapshot.isDragging 
                                      ? 'border-blue-400 shadow-lg ring-2 ring-blue-500/20 scale-[1.005]' 
                                      : 'border-slate-200 shadow-sm'
                                  }`}
                                >
                                  <div className="flex justify-between items-center p-4 bg-white border-b border-slate-200 group">
                                    <div className="flex items-center gap-3">
                                      <div 
                                        {...provided.dragHandleProps} 
                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-grab"
                                        title="Arraste para reordenar esta seção"
                                      >
                                        <GripVertical className="w-5 h-5" />
                                      </div>
                                      <h4 className="font-bold text-slate-900">{section.nome}</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSection(section);
                                          setViewConteudo('edit_section');
                                        }}
                                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                        title="Editar Seção"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const sectionId = section.id;
                                          setModalConfig({
                                            isOpen: true,
                                            type: 'confirm',
                                            title: 'Excluir Seção',
                                            message: `Tem certeza que deseja excluir "${section.nome || 'esta seção'}" e todo o seu conteúdo?`,
                                            onConfirm: () => {
                                              setModalConfig(prev => ({ ...prev, isOpen: false }));
                                              const next = sections.filter((s, idx) => {
                                                if (sectionId) return s.id !== sectionId;
                                                return idx !== sIdx;
                                              });
                                              setSections(next);
                                              saveCurriculo(next);
                                            }
                                          });
                                        }}
                                        className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                        title="Excluir Seção"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="bg-slate-50">
                                    <Droppable droppableId={section.id || sIdx.toString()} type="STEP">
                                      {(provided, droppableSnapshot) => (
                                        <div
                                          {...provided.droppableProps}
                                          ref={provided.innerRef}
                                          className={`min-h-[20px] transition-colors duration-200 ${
                                            droppableSnapshot.isDraggingOver 
                                              ? 'bg-blue-50/40 border-y border-dashed border-blue-300' 
                                              : ''
                                          }`}
                                        >
                              {section.etapas && section.etapas.length > 0 && (
                                <div className="p-4 space-y-2 border-b border-slate-200">
                                  {section.etapas.map((etapa: any, eIdx: number) => (
                                    <Draggable key={etapa.id || `${sIdx}-${eIdx}`} draggableId={etapa.id || `${sIdx}-${eIdx}`} index={eIdx}>
                                      {(provided, snapshot) => (
                                        <div 
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          className={`flex items-center gap-3 p-3 bg-white border rounded-md transition-all duration-200 ${
                                            snapshot.isDragging 
                                              ? 'border-blue-400 shadow-md ring-2 ring-blue-500/10 scale-[1.01] z-50' 
                                              : 'border-slate-200'
                                          }`}
                                        >
                                          <div 
                                            {...provided.dragHandleProps} 
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-grab"
                                            title="Arraste para reordenar esta etapa"
                                          >
                                            <GripVertical className="w-4 h-4" />
                                          </div>
                                          <span className="text-sm font-medium text-slate-700 flex-1">{etapa.nome}</span>
                                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs capitalize">
                                            {etapa.tipo === 'ao_vivo' ? 'Ao vivo' : etapa.tipo}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => {
                                                setEditingStep({ 
                                                  id: etapa.id, 
                                                  nome: etapa.nome, 
                                                  secaoId: section.id, 
                                                  tipo: etapa.tipo, 
                                                  url_video: etapa.url_video, 
                                                  descricao: etapa.descricao,
                                                  tempo_video: etapa.tempo_video,
                                                  questoes_ids: etapa.questoes_ids || [],
                                                  videos: etapa.videos || []
                                                });
                                                setViewConteudo(etapa.tipo === 'quiz' ? 'edit_step_quiz' : (etapa.tipo === 'artigo' ? 'edit_step_artigo' : (etapa.tipo === 'ao_vivo' ? 'edit_step_ao_vivo' : (etapa.tipo === 'multi_video' ? 'edit_step_multi_video' : 'edit_step_video'))));
                                              }}
                                              className="text-slate-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                              title="Editar"
                                            >
                                              <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const etapaId = etapa.id;
                                                setModalConfig({
                                                  isOpen: true,
                                                  type: 'confirm',
                                                  title: 'Excluir Etapa',
                                                  message: `Tem certeza que deseja excluir "${etapa.nome || 'esta etapa'}"?`,
                                                  onConfirm: () => {
                                                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                                                    const next = sections.map((sec, currSIdx) => {
                                                      if (currSIdx === sIdx) {
                                                        return {
                                                          ...sec,
                                                          etapas: (sec.etapas || []).filter((etap: any, idx: number) => {
                                                            if (etapaId) return etap.id !== etapaId;
                                                            return idx !== eIdx;
                                                          })
                                                        };
                                                      }
                                                      return sec;
                                                    });
                                                    setSections(next);
                                                    saveCurriculo(next);
                                                  }
                                                });
                                              }}
                                              className="text-slate-400 hover:text-red-600 p-1.5 rounded-full hover:bg-slate-50 transition-colors"
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                              {(!section.etapas || section.etapas.length === 0) && (
                                <div className="p-4 border-b border-slate-200" style={{minHeight: "20px"}}>
                                  {provided.placeholder}
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                        
                        <div className="p-4 bg-slate-100 flex gap-6 text-sm font-medium text-blue-600 relative rounded-b-lg">
                          <div>
                            <button 
                              onClick={() => {
                                const sid = section.id || `sec-${sIdx}`;
                                setAddingStepToSection(addingStepToSection === sid ? null : sid);
                              }}
                              className="flex items-center gap-1 hover:underline text-blue-500 font-semibold"
                            >
                              <Plus className="w-4 h-4"/> Adicionar etapa
                            </button>
                            {addingStepToSection === (section.id || `sec-${sIdx}`) && (
                              <div className="absolute top-full left-4 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-20">
                                 <button onClick={() => {
                                   const sid = section.id || `sec-${sIdx}`;
                                   setEditingStep({ nome: '', secaoId: sid, tipo: 'artigo', descricao: '' });
                                   setViewConteudo('edit_step_artigo');
                                   setAddingStepToSection(null);
                                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><FileText className="w-4 h-4 text-slate-400"/> Artigo</button>
                                 <button onClick={() => {
                                   const sid = section.id || `sec-${sIdx}`;
                                   setEditingStep({ nome: '', secaoId: sid, tipo: 'video', descricao: '', url_video: '', tempo_video: '' });
                                   setViewConteudo('edit_step_video');
                                   setAddingStepToSection(null);
                                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><PlayCircle className="w-4 h-4 text-slate-400"/> Vídeo</button>
                                 <button onClick={() => {
                                   const sid = section.id || `sec-${sIdx}`;
                                   setEditingStep({ nome: '', secaoId: sid, tipo: 'multi_video', videos: [{title: '', url: ''}] });
                                   setViewConteudo('edit_step_multi_video');
                                   setAddingStepToSection(null);
                                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><List className="w-4 h-4 text-slate-400"/> Multi-vídeo</button>
                                 <button onClick={() => {
                                   const sid = section.id || `sec-${sIdx}`;
                                   setEditingStep({ nome: '', secaoId: sid, tipo: 'ao_vivo', descricao: '', url_video: '', tempo_video: '' });
                                   setViewConteudo('edit_step_ao_vivo');
                                   setAddingStepToSection(null);
                                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><VideoIcon className="w-4 h-4 text-slate-400"/> Ao Vivo</button>
                                 <button onClick={() => {
                                   const sid = section.id || `sec-${sIdx}`;
                                   setEditingStep({ nome: '', secaoId: sid, tipo: 'quiz', questoes_ids: [] });
                                   setViewConteudo('edit_step_quiz');
                                   setAddingStepToSection(null);
                                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"><CheckCircle className="w-4 h-4 text-slate-400"/> Quiz</button>
                              </div>
                            )}
                          </div>
                          <button className="flex items-center gap-1 hover:underline text-blue-500 font-semibold"><Download className="w-4 h-4"/> Importar etapa</button>
                        </div>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    )}

                <button 
                  onClick={() => {
                    setEditingSection({ nome: '', progressiva: false, semana: 'Semana 1', dia: 'Dia 1' });
                    setViewConteudo('edit_section');
                  }}
                  className="flex items-center gap-2 text-blue-500 font-medium py-4 px-2 hover:underline"
                >
                  <Plus className="w-4 h-4" /> Seções
                </button>
              </div>
            )}
          </div>
        </>
      )}

        {viewConteudo === 'edit_section' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingSection.nome || 'Nome da seção'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingSection.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     let newSecs;
                     if (editingSection.id) {
                       newSecs = sections.map(s => s.id === editingSection.id ? { ...s, ...editingSection } : s);
                     } else {
                       newSecs = [...sections, { id: Date.now().toString(), ...editingSection, etapas: [] }];
                     }
                     
                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingSection.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Seção'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">Informações</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between text-sm text-slate-600 mb-1">
                      <label>Nome da seção</label>
                      <span>{editingSection.nome.length}/50</span>
                    </div>
                    <input 
                      type="text" 
                      value={editingSection.nome}
                      onChange={(e) => setEditingSection({...editingSection, nome: e.target.value.substring(0, 50)})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                      placeholder="Nome da seção"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                  <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Seção progressiva</h3>
                    <button 
                      onClick={() => setEditingSection({...editingSection, progressiva: !editingSection.progressiva})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingSection.progressiva ? 'bg-blue-500' : 'bg-slate-200'}`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${editingSection.progressiva ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {editingSection.progressiva ? (
                      <>
                        <div>
                          <label className="block text-sm text-slate-600 mb-2">Selecionar dia <span className="text-blue-500">*</span></label>
                          <div className="flex gap-2">
                             <select 
                               value={editingSection.semana}
                               onChange={(e) => setEditingSection({...editingSection, semana: e.target.value})}
                               className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 text-slate-700 text-sm"
                             >
                                <option>Semana 1</option>
                                <option>Semana 2</option>
                                <option>Semana 3</option>
                             </select>
                             <select 
                               value={editingSection.dia}
                               onChange={(e) => setEditingSection({...editingSection, dia: e.target.value})}
                               className="w-1/2 px-3 py-2 bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 text-slate-700 text-sm"
                             >
                                <option>Dia 1</option>
                                <option>Dia 2</option>
                                <option>Dia 3</option>
                                <option>Dia 4</option>
                                <option>Dia 5</option>
                                <option>Dia 6</option>
                                <option>Dia 7</option>
                             </select>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          Permita que os participantes concluam esta seção em um dia específico após entrarem no programa.
                        </p>
                      </>
                    ) : (
                      <p className="text-slate-600 text-sm leading-relaxed">
                        Permita que os participantes concluam esta seção em um dia específico após entrarem no programa.
                      </p>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

         {viewConteudo === 'edit_step_video' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     const stepId = editingStep.id || Date.now().toString();
                     
                     const newSecs = sections.map(sec => {
                       let etapas = [...(sec.etapas || [])];
                       
                       if (sec.id === editingStep.secaoId) {
                         const stepData = { 
                           id: stepId, 
                           nome: editingStep.nome, 
                           tipo: editingStep.tipo, 
                           url_video: editingStep.url_video, 
                           descricao: editingStep.descricao, 
                           tempo_video: editingStep.tempo_video 
                         };
                         
                         if (etapas.some(e => e.id === stepId)) {
                            etapas = etapas.map(e => e.id === stepId ? stepData : e);
                         } else {
                            etapas.push(stepData);
                         }
                       } else {
                         etapas = etapas.filter(e => e.id !== stepId);
                       }
                       
                       return { ...sec, etapas };
                     });
                     
                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingStep.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Etapa'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Video URL */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Vídeo</h3>
                    </div>
                    <div className="p-5">
                      <div className="border border-dashed border-blue-400 bg-blue-50/10 rounded-lg p-12 flex flex-col items-center justify-center">
                         <div className="text-center w-full max-w-md space-y-4">
                           <div className="mx-auto w-10 h-10 text-blue-500 flex items-center justify-center mb-2">
                             <Plus className="w-8 h-8 font-light" />
                           </div>
                           <input 
                             type="text" 
                             placeholder="Cole a URL do YouTube" 
                             value={editingStep.url_video || ''}
                             onChange={(e) => setEditingStep({...editingStep, url_video: e.target.value})}
                             className="w-full px-4 py-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                           />
                           {editingStep.url_video && (editingStep.url_video.includes('youtube.com') || editingStep.url_video.includes('youtu.be')) && (
                             <div className="aspect-video w-full mt-4 bg-slate-900 rounded overflow-hidden">
                               <iframe 
                                 src={getFormattedVideoUrl(editingStep.url_video)} 
                                 className="w-full h-full border-0"
                                 allowFullScreen
                               ></iframe>
                             </div>
                           )}
                           <div className="mt-4">
                             <label className="block text-sm font-medium text-slate-700 mb-1">Duração do Vídeo</label>
                             <input 
                               type="text" 
                               placeholder="Ex. 03:45" 
                               value={editingStep.tempo_video || ''}
                               onChange={(e) => setEditingStep({...editingStep, tempo_video: e.target.value})}
                               className="w-full px-4 py-2 border border-slate-300 rounded focus:border-blue-500 outline-none"
                             />
                           </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Descrição</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { 
                            e.preventDefault(); 
                            const url = window.prompt('Digite a URL do link (ex: https://...):');
                            if (url) applyCommand('createLink', url); 
                          }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Adicionar Link">
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Settings Sidebar */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 text-sm">Visão geral das configurações</h3>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Assistir vídeo (obrigatório)</span>
                        <span className="text-slate-400">{videoSettings.assistirObrigatorio ? 'Ativado' : 'Desativado'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">Reprodução automática</span>
                        <span className="text-slate-400">{videoSettings.reproduzirAutomaticamente ? 'Ativado' : 'Desativado'}</span>
                      </div>
                      <button 
                        onClick={() => setIsVideoSettingsModalOpen(true)}
                        className="text-blue-600 font-medium flex items-center gap-2 hover:underline text-sm pt-2"
                      >
                        <Settings className="w-3.5 h-3.5" /> Editar configurações
                      </button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
         )}

         {viewConteudo === 'edit_step_multi_video' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Novo Multi-vídeo'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     const stepId = editingStep.id || Date.now().toString();
                     
                     const newSecs = sections.map(sec => {
                       let etapas = [...(sec.etapas || [])];
                       
                       if (sec.id === editingStep.secaoId) {
                         const stepData = { 
                           id: stepId, 
                           nome: editingStep.nome, 
                           tipo: editingStep.tipo, 
                           descricao: editingStep.descricao,
                           videos: editingStep.videos 
                         };
                         
                         if (etapas.some(e => e.id === stepId)) {
                            etapas = etapas.map(e => e.id === stepId ? stepData : e);
                         } else {
                            etapas.push(stepData);
                         }
                       } else {
                         etapas = etapas.filter(e => e.id !== stepId);
                       }
                       
                       return { ...sec, etapas };
                     });
                     
                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingStep.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Etapa'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900">Informações básicas</h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-slate-600 mb-1">
                        <label>Nome da etapa <span className="text-blue-600">*</span></label>
                        <span>{editingStep.nome.length}/60</span>
                      </div>
                      <input 
                        type="text" 
                        value={editingStep.nome}
                        onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                        placeholder="Nomeie sua etapa (ex: Coletânea de Técnicas)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                      <select 
                        value={editingStep.secaoId}
                        onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                      >
                        {sections.map(s => (
                          <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Lista de Vídeos</h3>
                    <button 
                      onClick={() => setEditingStep({
                        ...editingStep, 
                        videos: [...(editingStep.videos || []), {title: '', url: ''}]
                      })}
                      className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-4 h-4"/> Adicionar vídeo
                    </button>
                  </div>
                  <div className="p-5 space-y-6">
                    {editingStep.videos?.map((video, idx) => (
                      <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative group">
                        <button 
                          onClick={() => {
                            const newVideos = [...(editingStep.videos || [])];
                            newVideos.splice(idx, 1);
                            setEditingStep({...editingStep, videos: newVideos});
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Título do Vídeo</label>
                            <input 
                              type="text"
                              value={video.title}
                              onChange={(e) => {
                                const newVideos = [...(editingStep.videos || [])];
                                newVideos[idx].title = e.target.value;
                                setEditingStep({...editingStep, videos: newVideos});
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 text-sm"
                              placeholder="Ex: Waza-ari Tutorial"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">URL do YouTube</label>
                            <input 
                              type="text"
                              value={video.url}
                              onChange={(e) => {
                                const newVideos = [...(editingStep.videos || [])];
                                newVideos[idx].url = e.target.value;
                                setEditingStep({...editingStep, videos: newVideos});
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 text-sm"
                              placeholder="https://www.youtube.com/watch?v=..."
                            />
                          </div>
                        </div>
                        {video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be')) && (
                          <div className="mt-4 aspect-video w-full max-w-sm mx-auto rounded overflow-hidden shadow-inner bg-black">
                            <iframe 
                               src={getFormattedVideoUrl(video.url)} 
                               className="w-full h-full border-0"
                               allowFullScreen
                             ></iframe>
                          </div>
                        )}
                      </div>
                    ))}

                    {(!editingStep.videos || editingStep.videos.length === 0) && (
                      <div className="text-center py-8 text-slate-500 italic border border-dashed border-slate-200 rounded-lg">
                        Nenhum vídeo adicionado. Clique em "Adicionar vídeo" para começar.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900">Descrição (Opcional)</h3>
                  </div>
                  <div className="p-5">
                    <textarea 
                      value={editingStep.descricao || ''}
                      onChange={(e) => setEditingStep({...editingStep, descricao: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 min-h-[150px] resize-y"
                      placeholder="Adicione instruções ou informações extras sobre esta coleção de vídeos..."
                    />
                  </div>
                </div>
             </div>
          </div>
         )}

         {viewConteudo === 'edit_step_ao_vivo' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     const stepId = editingStep.id || Date.now().toString();
                     
                     const newSecs = sections.map(sec => {
                       let etapas = [...(sec.etapas || [])];
                       
                       if (sec.id === editingStep.secaoId) {
                         const stepData = { 
                           id: stepId, 
                           nome: editingStep.nome, 
                           tipo: editingStep.tipo, 
                           url_video: editingStep.url_video, 
                           descricao: editingStep.descricao, 
                           tempo_video: editingStep.tempo_video 
                         };
                         
                         if (etapas.some(e => e.id === stepId)) {
                           etapas = etapas.map(e => e.id === stepId ? stepData : e);
                         } else {
                           etapas.push(stepData);
                         }
                       } else {
                         etapas = etapas.filter(e => e.id !== stepId);
                       }
                       
                       return { ...sec, etapas };
                     });
                     
                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingStep.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Etapa'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-6xl mx-auto w-full p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa (Ex: Aula Inaugural Ao Vivo)"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Live URL */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Transmissão (YouTube Live)</h3>
                    </div>
                    <div className="p-5">
                      <div className="border border-dashed border-red-400 bg-red-50/10 rounded-lg p-12 flex flex-col items-center justify-center">
                         <div className="text-center w-full max-w-md space-y-4">
                           <div className="mx-auto w-10 h-10 text-red-500 flex items-center justify-center mb-2">
                             <VideoIcon className="w-8 h-8 font-light" />
                           </div>
                           <input 
                             type="text" 
                             placeholder="Cole a URL do YouTube Live" 
                             value={editingStep.url_video || ''}
                             onChange={(e) => setEditingStep({...editingStep, url_video: e.target.value})}
                             className="w-full px-4 py-2 border border-slate-300 rounded focus:border-red-500 outline-none"
                           />
                           {editingStep.url_video && (editingStep.url_video.includes('youtube.com') || editingStep.url_video.includes('youtu.be')) && (
                             <div className="aspect-video w-full mt-4 bg-slate-900 rounded overflow-hidden">
                               <iframe 
                                 src={getFormattedVideoUrl(editingStep.url_video)} 
                                 className="w-full h-full border-0"
                                 allowFullScreen
                               ></iframe>
                             </div>
                           )}
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Descrição e Instruções</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { 
                            e.preventDefault(); 
                            const url = window.prompt('Digite a URL do link (ex: https://...):');
                            if (url) applyCommand('createLink', url); 
                          }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Adicionar Link">
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Settings Sidebar */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900 text-sm">Configurações da Live</h3>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <p className="text-slate-500">Ao usar o modo Ao Vivo, os participantes terão acesso a um chat em tempo real e um botão para confirmar participação na própria tela de transmissão.</p>
                    </div>
                  </div>

                  {/* Admin Live Chat */}
                  {editingStep.id && (
                    <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden shadow-sm" style={{ minHeight: '400px' }}>
                      <div className="bg-white border-b border-slate-200 p-4">
                         <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600"/> Chat ao vivo</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px]">
                         <div className="text-center text-xs text-slate-400 my-4">Chat vinculado à etapa salva.</div>
                         {chatMessages.map(msg => (
                           <div key={msg.id} className="text-sm">
                             <span className="font-bold text-slate-700 mr-2">{msg.user_name}:</span>
                             <span className="text-slate-600">{msg.text}</span>
                           </div>
                         ))}
                      </div>
                      <div className="bg-slate-50 border-t border-slate-200 p-3">
                         <div className="flex gap-2 relative">
                            <input 
                              type="text" 
                              placeholder="Falar como Professor..." 
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && sendLiveMessage()}
                              className="w-full px-4 py-2 bg-white border-slate-300 rounded-full text-sm outline-none focus:border-blue-500 border transition-colors pr-16" 
                            />
                            <button 
                              onClick={sendLiveMessage}
                              disabled={!chatInput.trim()}
                              className="absolute right-1.5 top-1.5 w-auto px-3 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
                         </div>
                      </div>
                    </div>
                  )}
                  {!editingStep.id && (
                     <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                       <span className="font-bold">Chat indisponível:</span> Salve a etapa primeiro para habilitar o chat ao vivo interativo.
                     </div>
                  )}
                </div>
             </div>
          </div>
         )}

          {viewConteudo === 'edit_step_quiz' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     const stepId = editingStep.id || Date.now().toString();
                     
                     const newSecs = sections.map(sec => {
                       let etapas = [...(sec.etapas || [])];
                       
                       if (sec.id === editingStep.secaoId) {
                         const stepData = { 
                           id: stepId, 
                           nome: editingStep.nome, 
                           tipo: editingStep.tipo, 
                           questoes_ids: editingStep.questoes_ids || [] 
                         };
                         
                         if (etapas.some(e => e.id === stepId)) {
                            etapas = etapas.map(e => e.id === stepId ? stepData : e);
                         } else {
                            etapas.push(stepData);
                         }
                       } else {
                         etapas = etapas.filter(e => e.id !== stepId);
                       }
                       
                       return { ...sec, etapas };
                     });

                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingStep.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Etapa'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Configuração do Quiz</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome do quiz <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Ex: Avaliação Módulo 1"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Questões */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">Questões do Quiz ({(editingStep.questoes_ids || []).length})</h3>
                      <button 
                        onClick={() => setIsSelectQuestionsModalOpen(true)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors flex items-center gap-2 text-sm"
                      >
                        <Plus className="w-4 h-4"/> Selecionar Questões
                      </button>
                    </div>
                    <div className="p-5">
                      {(editingStep.questoes_ids || []).length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                          <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p>Nenhuma questão foi adicionada a este quiz ainda.</p>
                          <p className="text-sm mt-1">Clique no botão acima para selecionar questões do banco.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(editingStep.questoes_ids || []).map((qId, idx) => {
                            const qInfo = (availableQuestions || []).find(q => q.id === qId);
                            return (
                              <div key={qId} className="flex justify-between items-center p-3 border border-slate-200 rounded-lg bg-slate-50">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-400 min-w-[24px]">{idx + 1}.</span>
                                  <div>
                                    <p className="text-slate-800 font-medium line-clamp-1">{qInfo?.enunciado || qInfo?.texto || 'Questão não encontrada'}</p>
                                    <div className="flex gap-2 mt-1">
                                      <p className="text-[10px] text-slate-500 font-medium">Dificuldade: {qInfo?.dificuldade || 'N/A'}</p>
                                      {qInfo?.tema && <p className="text-[10px] text-slate-500 font-medium border-l border-slate-300 pl-2">Tema: {qInfo.tema}</p>}
                                    </div>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    setEditingStep({
                                      ...editingStep,
                                      questoes_ids: (editingStep.questoes_ids || []).filter(id => id !== qId)
                                    })
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
             </div>
          </div>
         )}

        {viewConteudo === 'edit_step_artigo' && (
          <div className="absolute inset-0 bg-slate-100 z-[1020] flex flex-col overflow-y-auto">
             <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
               <div className="flex items-center gap-4">
                 <button onClick={() => setViewConteudo('list')} className="text-blue-600 hover:bg-slate-50 p-2 rounded-full transition-colors">
                   <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-bold text-slate-900">{editingStep.nome || 'Nome da Etapa'}</h2>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setViewConteudo('list')} className="px-6 py-2 border border-slate-200 rounded-full font-medium hover:bg-slate-50 text-blue-600 transition-colors">
                   Cancelar
                 </button>
                 <button 
                   disabled={editingStep.nome.trim() === '' || isSaving}
                   onClick={async () => {
                     const stepId = editingStep.id || Date.now().toString();
                     
                     const newSecs = sections.map(sec => {
                       let etapas = [...(sec.etapas || [])];
                       
                       if (sec.id === editingStep.secaoId) {
                         const stepData = { 
                           id: stepId, 
                           nome: editingStep.nome, 
                           tipo: editingStep.tipo, 
                           descricao: editingStep.descricao 
                         };
                         
                         if (etapas.some(e => e.id === stepId)) {
                            etapas = etapas.map(e => e.id === stepId ? stepData : e);
                         } else {
                            etapas.push(stepData);
                         }
                       } else {
                         etapas = etapas.filter(e => e.id !== stepId);
                       }
                       
                       return { ...sec, etapas };
                     });

                     setSections(newSecs);
                     const success = await saveCurriculo(newSecs);
                     if (success) {
                       setViewConteudo('list');
                     }
                   }}
                   className={`px-8 py-2 rounded-full font-medium text-white transition-all flex items-center gap-2 ${editingStep.nome.trim() === '' || isSaving ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95'}`}
                 >
                   {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {isSaving ? 'Salvando...' : 'Salvar Etapa'}
                 </button>
               </div>
             </div>

             <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Informações básicas</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      <div>
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <label>Nome da etapa <span className="text-blue-600">*</span></label>
                          <span>{editingStep.nome.length}/60</span>
                        </div>
                        <input 
                          type="text" 
                          value={editingStep.nome}
                          onChange={(e) => setEditingStep({...editingStep, nome: e.target.value.substring(0, 60)})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                          placeholder="Nomeie sua etapa"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Seção <span className="text-blue-600">*</span></label>
                        <select 
                          value={editingStep.secaoId}
                          onChange={(e) => setEditingStep({...editingStep, secaoId: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                        >
                          {sections.map(s => (
                            <option key={s.id} value={s.id}>{s.nome || 'Seção sem nome'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                      <h3 className="font-bold text-slate-900">Conteúdo</h3>
                    </div>
                    <div className="p-5 flex flex-col min-h-[400px]">
                      <div className="flex gap-2 text-slate-400 mb-4 cursor-text flex-1">
                        <div className="w-5 h-5 bg-blue-50 rounded text-blue-500 flex items-center justify-center mt-1"><Plus className="w-3 h-3"/></div>
                        <div 
                          ref={artigoTextareaRef}
                          contentEditable
                          onInput={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          onBlur={(e) => setEditingStep({...editingStep, descricao: e.currentTarget.innerHTML})}
                          className="w-full text-slate-700 outline-none min-h-[300px] prose prose-slate max-w-none focus:outline-none"
                        />
                      </div>
                      <div className="border-t border-slate-100 pt-4 mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('bold'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Negrito">
                            <Bold className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('italic'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Itálico">
                            <Italic className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('underline'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Sublinhado">
                            <Underline className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { 
                            e.preventDefault(); 
                            const url = window.prompt('Digite a URL do link (ex: https://...):');
                            if (url) applyCommand('createLink', url); 
                          }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Adicionar Link">
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <div className="w-px h-5 bg-slate-300 mx-1"></div>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertUnorderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Marcadores (Lista)">
                            <List className="w-4 h-4" />
                          </button>
                          <button onPointerDown={(e) => { e.preventDefault(); applyCommand('insertOrderedList'); }} className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors" title="Numeração (Lista Numérica)">
                            <ListOrdered className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                          <button onClick={() => imageInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <ImageIcon className="w-4 h-4" /> Adicionar Imagem
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors">
                            <Paperclip className="w-4 h-4" /> Adicionar arquivo para download
                          </button>
                          <button 
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                          >
                            <Table className="w-4 h-4" /> Adicionar tabela
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
             </div>
          </div>
         )}
        
        {activeTab === 'participantes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl text-slate-900">{filteredParticipants.length} participantes ativos</h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  <Download className="w-4 h-4"/> Exportar CSV
                </button>
                
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                  <select 
                    value={participantStatusFilter}
                    onChange={(e) => setParticipantStatusFilter(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50 focus:outline-none appearance-none cursor-pointer bg-white"
                  >
                    <option value="todos">Todos os Status</option>
                    <option value="concluido">Concluídos</option>
                    <option value="andamento">Em Andamento</option>
                    <option value="nao_comecou">Não Começaram</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar participante..." 
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" 
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f2f6fe] text-slate-700 border-b border-blue-100">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nome</th>
                    <th className="px-6 py-4 font-semibold">Desempenho <span className="text-blue-600">↓</span></th>
                    <th className="px-6 py-4 font-semibold">Última atividade</th>
                    <th className="px-6 py-4 font-semibold">Data de entrada</th>
                    <th className="px-6 py-4 font-semibold">Preço</th>
                    <th className="px-6 py-4 font-semibold">Certificado</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(filteredParticipants.length > 0 ? filteredParticipants.map(participant => {
                      const getInitials = (name?: string) => name ? name.substring(0, 2).toUpperCase() : '??';
                      const cappedProgress = Math.min(100, Math.max(0, participant.progresso || 0));
                      const isNew = cappedProgress === 0;
                      const isFinished = cappedProgress >= 100;
                      let totalQuizPercentage = 0;
                      let numQuizzes = 0;
                      if (participant.quiz_scores) {
                        Object.values(participant.quiz_scores).forEach((score: any) => {
                          if (score.total && score.total > 0) {
                            totalQuizPercentage += ((score.correct || 0) / score.total) * 100;
                            numQuizzes++;
                          }
                        });
                      }
                      const hasQuiz = numQuizzes > 0;
                      const quizGrade = hasQuiz ? Math.round(totalQuizPercentage / numQuizzes) : null;

                      let bgColor = 'bg-slate-200';
                      let txColor = 'text-slate-700';
                      let statusText = 'Baixo';
                      if (cappedProgress >= 90) { bgColor = 'bg-emerald-100'; txColor = 'text-emerald-700'; statusText = 'Excepcional'; }
                      else if (cappedProgress >= 50) { bgColor = 'bg-yellow-100'; txColor = 'text-yellow-700'; statusText = 'Alto'; }
                      else if (cappedProgress > 0) { bgColor = 'bg-amber-100'; txColor = 'text-amber-700'; statusText = 'Baixo'; }
                      else { bgColor = 'bg-slate-400'; txColor = 'text-white'; statusText = 'Baixo'; }

                      return {
                          nome: participant.usuarios?.nome || participant.usuarios?.email || 'Usuário Desconhecido',
                          initials: getInitials(participant.usuarios?.nome || participant.usuarios?.email),
                          rate: `${cappedProgress}%`,
                          status: statusText,
                          quizGrade,
                          date1: new Date(participant.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                          date2: new Date(participant.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                          bgColor,
                          txColor,
                          isNew,
                          isFinished
                      };
                  }) : [
                    { nome: 'Nenhum resultado encontrado', initials: '?', rate: '-', status: '-', date1: '-', date2: '-', bgColor: 'bg-slate-100', txColor: 'text-slate-400', quizGrade: null, isEmpty: true },
                  ]).map((p, i) => (
                    <tr key={i} className={`hover:bg-slate-50 ${(p as any).isEmpty ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${p.bgColor} ${p.txColor}`}>{p.initials}</div>
                           <div>
                             <div className="font-medium text-slate-900">{p.nome}</div>
                             {!(p as any).isEmpty && (
                               <div className={`text-[10px] uppercase font-semibold mt-0.5 px-2 py-0.5 inline-block rounded ${p.isNew ? 'bg-rose-100 text-rose-700' : p.isFinished ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800'}`}>
                                 {p.isNew ? 'Não começou' : p.isFinished ? 'Concluído' : 'Em Andamento'}
                               </div>
                             )}
                           </div>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{p.rate}</div>
                        <div className="text-xs text-slate-500">{p.status}</div>
                        {p.quizGrade !== null && (
                          <div className="text-xs font-semibold text-blue-600 mt-0.5">Nota: {p.quizGrade}%</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{p.date1}</td>
                      <td className="px-6 py-4 text-slate-600">{p.date2}</td>
                      <td className="px-6 py-4 text-slate-600">Gratuito</td>
                      <td className="px-6 py-4 text-slate-400 font-medium">
                        {p.isFinished ? (
                          <span className="text-emerald-600">Concluído</span>
                        ) : (
                          <>Não<br/>emitido</>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            {p.isFinished && (
                               <button 
                                 onClick={() => {
                                   const participant = courseParticipants[i];
                                   if (participant) handleDownloadParticipantCertificate(participant);
                                 }}
                                 className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                 title="Baixar Certificado"
                               >
                                 <Download className="w-5 h-5" />
                               </button>
                            )}
                            <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full">
                              <MoreHorizontal className="w-5 h-5"/>
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'landing_page' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="font-bold text-2xl text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-blue-600" /> Página de Venda Pública
                </h3>
                <p className="text-slate-500 mt-1 italic">Personalize como o mundo vê seu programa e transforme visitantes em alunos.</p>
              </div>
              <div className="flex gap-3">
                <a 
                  href={`${window.location.origin}/public/curso/${createdCourseId}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-6 py-2 border border-slate-200 text-slate-700 rounded-full font-medium hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" /> Visualizar
                </a>
                <button 
                  onClick={saveLandingPage}
                  className="px-8 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                {/* Layout Type selection */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-blue-600" />
                    <h4 className="font-bold text-slate-800">Modelo de Layout</h4>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setLpData({...lpData, layout_tipo: 'claro'})}
                      className={`relative p-1 rounded-xl transition-all border-2 overflow-hidden group ${lpData.layout_tipo === 'claro' || !lpData.layout_tipo ? 'border-blue-600 shadow-md' : 'border-transparent hover:border-slate-200'}`}
                    >
                      <div className="bg-slate-50 aspect-video rounded-lg flex flex-col p-3 gap-2">
                        <div className="w-2/3 h-2 bg-slate-300 rounded"></div>
                        <div className="w-full h-1 bg-slate-200 rounded"></div>
                        <div className="w-full h-1 bg-slate-200 rounded"></div>
                        <div className="mt-auto flex justify-between items-center">
                           <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                           <div className="w-16 h-4 bg-blue-600 rounded"></div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2 pb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${lpData.layout_tipo === 'claro' || !lpData.layout_tipo ? 'border-blue-600' : 'border-slate-300'}`}>
                          {(lpData.layout_tipo === 'claro' || !lpData.layout_tipo) && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                        </div>
                        <span className={`text-sm font-bold ${lpData.layout_tipo === 'claro' || !lpData.layout_tipo ? 'text-blue-600' : 'text-slate-500'}`}>Layout Claro (Padrão)</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => setLpData({...lpData, layout_tipo: 'escuro'})}
                      className={`relative p-1 rounded-xl transition-all border-2 overflow-hidden group ${lpData.layout_tipo === 'escuro' ? 'border-blue-600 shadow-md' : 'border-transparent hover:border-slate-200'}`}
                    >
                      <div className="bg-slate-900 aspect-video rounded-lg flex flex-col p-3 gap-2">
                        <div className="w-2/3 h-2 bg-slate-700 rounded"></div>
                        <div className="w-full h-1 bg-slate-800 rounded"></div>
                        <div className="w-full h-1 bg-slate-800 rounded"></div>
                        <div className="mt-auto flex justify-between items-center">
                           <div className="w-20 h-2 bg-blue-600 rounded"></div>
                           <div className="w-10 h-6 bg-slate-800 rounded"></div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-2 pb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${lpData.layout_tipo === 'escuro' ? 'border-blue-600' : 'border-slate-300'}`}>
                          {lpData.layout_tipo === 'escuro' && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                        </div>
                        <span className={`text-sm font-bold ${lpData.layout_tipo === 'escuro' ? 'text-blue-600' : 'text-slate-500'}`}>Layout Escuro (Moderno)</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Hero section */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <h4 className="font-bold text-slate-800">Seção de Destaque (Hero)</h4>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Título de Impacto</label>
                      <input 
                        type="text" 
                        value={lpData.hero_title}
                        onChange={(e) => setLpData({...lpData, hero_title: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-lg"
                        placeholder="Ex: Domine a arte do design em 30 dias"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Subtítulo ou Chamada (CTA)</label>
                      <textarea 
                        value={lpData.hero_subtitle}
                        onChange={(e) => setLpData({...lpData, hero_subtitle: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
                        placeholder="Uma breve frase que resume o valor do seu curso e convida o aluno a se inscrever."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Texto do Botão (CTA)</label>
                        <input 
                          type="text" 
                          value={lpData.cta_text || 'Matricule-se Agora'}
                          onChange={(e) => setLpData({...lpData, cta_text: e.target.value})}
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Ex: Começar minha jornada"
                        />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Cor da Página</label>
                         <div className="flex gap-2">
                           <input 
                             type="color" 
                             value={lpData.primary_color || '#2563eb'}
                             onChange={(e) => setLpData({...lpData, primary_color: e.target.value})}
                             className="w-10 h-10 border-0 p-0 overflow-hidden cursor-pointer rounded-lg bg-transparent"
                           />
                           <input 
                              type="text" 
                              value={lpData.primary_color || '#2563eb'}
                              onChange={(e) => setLpData({...lpData, primary_color: e.target.value})}
                              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                           />
                         </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Vídeo de Apresentação (YouTube)</label>
                        <div className="relative">
                          <PlayCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text" 
                            value={lpData.hero_video_url}
                            onChange={(e) => setLpData({...lpData, hero_video_url: e.target.value})}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="URL do vídeo promocional"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Ativar Página?</label>
                        <button 
                          onClick={() => setLpData({...lpData, enabled: !lpData.enabled})}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all border ${lpData.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                        >
                          {lpData.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          {lpData.enabled ? 'Página Publicada' : 'Página Oculta'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed description */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-800">Sobre o Programa</h4>
                  </div>
                  <div className="p-6 space-y-4">
                    {/* #7 about_title field */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Título da Seção "Sobre"</label>
                      <input
                        type="text"
                        value={lpData.about_title || ''}
                        onChange={(e) => setLpData({...lpData, about_title: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        placeholder="Ex: Tudo o que você precisa em um só lugar"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider text-xs">Descrição Detalhada</label>
                      <textarea
                        value={lpData.about}
                        onChange={(e) => setLpData({...lpData, about: e.target.value})}
                        className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[200px]"
                        placeholder="Fale mais sobre a metodologia, o que o aluno vai encontrar lá dentro..."
                      />
                    </div>
                  </div>
                </div>


                {/* Benefits */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">O que você vai aprender (Vantagens)</h4>
                    <button 
                      onClick={() => setLpData({...lpData, benefits: [...lpData.benefits, '']})}
                      className="text-blue-600 text-xs font-bold uppercase hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar item
                    </button>
                  </div>
                  <div className="p-6 space-y-3">
                    {lpData.benefits.map((benefit: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <div className="w-6 h-6 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold mt-2">
                          {idx + 1}
                        </div>
                        <input 
                          type="text" 
                          value={benefit}
                          onChange={(e) => {
                            const newBenefits = [...lpData.benefits];
                            newBenefits[idx] = e.target.value;
                            setLpData({...lpData, benefits: newBenefits});
                          }}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                          placeholder="Ex: Técnicas avançadas de iluminação"
                        />
                        <button 
                          onClick={() => {
                            const newBenefits = lpData.benefits.filter((_: any, i: number) => i !== idx);
                            setLpData({...lpData, benefits: newBenefits});
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                         >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Testimonials */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Depoimentos de Alunos</h4>
                    <button 
                      onClick={() => setLpData({...lpData, testimonials: [...(lpData.testimonials || []), { name: '', role: '', text: '', photo_url: '' }]})}
                      className="text-blue-600 text-xs font-bold uppercase hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Depoimento
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    {(lpData.testimonials || []).map((t: any, idx: number) => (
                      <div key={idx} className="p-4 border border-slate-100 rounded-xl space-y-4 relative group">
                        <button 
                          onClick={() => {
                            const newT = lpData.testimonials.filter((_: any, i: number) => i !== idx);
                            setLpData({...lpData, testimonials: newT});
                          }}
                          className="absolute right-4 top-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                          <input 
                            type="text" 
                            value={t.name}
                            onChange={(e) => {
                              const newT = [...lpData.testimonials];
                              newT[idx].name = e.target.value;
                              setLpData({...lpData, testimonials: newT});
                            }}
                            className="px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                            placeholder="Nome do aluno"
                          />
                          <input 
                            type="text" 
                            value={t.role}
                            onChange={(e) => {
                              const newT = [...lpData.testimonials];
                              newT[idx].role = e.target.value;
                              setLpData({...lpData, testimonials: newT});
                            }}
                            className="px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                            placeholder="Cargo/Empresa"
                          />
                        </div>
                        <textarea 
                          value={t.text}
                          onChange={(e) => {
                            const newT = [...lpData.testimonials];
                            newT[idx].text = e.target.value;
                            setLpData({...lpData, testimonials: newT});
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500 min-h-[80px]"
                          placeholder="O que o aluno disse..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bonuses */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Materiais Bônus</h4>
                    <button 
                      onClick={() => setLpData({...lpData, bonuses: [...(lpData.bonuses || []), { title: '', description: '', value: '' }]})}
                      className="text-blue-600 text-xs font-bold uppercase hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar Bônus
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {(lpData.bonuses || []).map((b: any, idx: number) => (
                      <div key={idx} className="flex gap-4 items-start p-4 bg-emerald-50/30 rounded-xl border border-emerald-100 group">
                        <div className="flex-1 space-y-2">
                           <input 
                              type="text" 
                              value={b.title}
                              onChange={(e) => {
                                const newB = [...lpData.bonuses];
                                newB[idx].title = e.target.value;
                                setLpData({...lpData, bonuses: newB});
                              }}
                              className="w-full font-bold text-emerald-900 bg-transparent outline-none border-b border-transparent focus:border-emerald-200 focus:bg-white px-2 py-1 rounded"
                              placeholder="Título do Bônus"
                           />
                           <input
                              type="text"
                              value={b.value || ''}
                              onChange={(e) => {
                                const newB = [...lpData.bonuses];
                                newB[idx].value = e.target.value;
                                setLpData({...lpData, bonuses: newB});
                              }}
                              className="w-full text-xs text-emerald-600 bg-transparent outline-none border-b border-transparent focus:border-emerald-200 focus:bg-white px-2 py-1 rounded font-bold"
                              placeholder="Valor de mercado (ex: 297,00) — opcional"
                           />
                           <textarea 
                              value={b.description}
                              onChange={(e) => {
                                const newB = [...lpData.bonuses];
                                newB[idx].description = e.target.value;
                                setLpData({...lpData, bonuses: newB});
                              }}
                              className="w-full text-sm text-emerald-700 bg-transparent outline-none border-b border-transparent focus:border-emerald-200 focus:bg-white px-2 py-1 rounded min-h-[60px]"
                              placeholder="O que o aluno recebe?"
                           />
                        </div>
                        <button 
                          onClick={() => {
                            const newB = lpData.bonuses.filter((_: any, i: number) => i !== idx);
                            setLpData({...lpData, bonuses: newB});
                          }}
                          className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Instrutor */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-800">Instrutor(a)</h4>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        {lpData.instructor?.avatar_url ? (
                          <img src={lpData.instructor.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-full h-full p-2 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                         <input 
                            type="text" 
                            value={lpData.instructor?.name}
                            onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, name: e.target.value}})}
                            className="w-full text-sm font-bold outline-none focus:text-blue-600"
                            placeholder="Nome Completo"
                         />
                         <input 
                            type="text" 
                            value={lpData.instructor?.role}
                            onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, role: e.target.value}})}
                            className="w-full text-xs text-slate-500 outline-none"
                            placeholder="Ex: Especialista em Design"
                         />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">URL da Foto do Avatar</label>
                      <input
                        type="text"
                        value={lpData.instructor?.avatar_url}
                        onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, avatar_url: e.target.value}})}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm mb-3 outline-none focus:border-blue-500 transition-colors"
                        placeholder="Link da imagem (https://...)"
                      />
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Membro desde / Bio Curta</label>
                      <textarea
                        value={lpData.instructor?.bio || ''}
                        onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, bio: e.target.value}})}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm min-h-[100px] mb-3"
                        placeholder="Fale um pouco sobre sua trajetória profissional..."
                      />
                      {/* #5 Configurable instructor stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Nº Alunos (ex: 10k+)</label>
                          <input
                            type="text"
                            value={lpData.instructor?.students_count || ''}
                            onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, students_count: e.target.value}})}
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                            placeholder="Ex: 2.000+"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Nº Projetos (ex: 15+)</label>
                          <input
                            type="text"
                            value={lpData.instructor?.projects_count || ''}
                            onChange={(e) => setLpData({...lpData, instructor: {...lpData.instructor, projects_count: e.target.value}})}
                            className="w-full px-3 py-2 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                            placeholder="Ex: 30+"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Garantia */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Garantia</h4>
                    <div className="flex items-center gap-2">
                       <input 
                         type="number" 
                         value={lpData.guarantee_days || 7}
                         onChange={(e) => setLpData({...lpData, guarantee_days: parseInt(e.target.value)})}
                         className="w-12 text-center font-bold text-blue-600 bg-blue-50 rounded"
                       />
                       <span className="text-xs font-bold text-slate-400">DIAS</span>
                    </div>
                  </div>
                  <div className="p-4 text-center">
                    <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 italic">Selo de segurança exibido no final da página.</p>
                  </div>
                </div>

                {/* Cronômetro Regressivo */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Cronômetro Regressivo</h4>
                    <button
                      type="button"
                      onClick={() => setLpData({...lpData, countdown_enabled: !lpData.countdown_enabled})}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        lpData.countdown_enabled 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      {lpData.countdown_enabled ? 'Ativo' : 'Inativo'}
                    </button>
                  </div>
                  {lpData.countdown_enabled && (
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Título do Alerta</label>
                        <input 
                          type="text" 
                          value={lpData.countdown_title || ''}
                          onChange={(e) => setLpData({...lpData, countdown_title: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          placeholder="Ex: Lote promocional termina em:"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Data/Hora Limite</label>
                        <input 
                          type="datetime-local" 
                          value={lpData.countdown_end_date || ''}
                          onChange={(e) => setLpData({...lpData, countdown_end_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Publico alvo */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h4 className="font-bold text-slate-800">Público-alvo</h4>
                  </div>
                  <div className="p-6">
                    <textarea 
                      value={lpData.target_audience}
                      onChange={(e) => setLpData({...lpData, target_audience: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[120px] text-sm"
                      placeholder="Para quem este curso foi desenhado?"
                    />
                  </div>
                </div>

                {/* FAQ */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h4 className="font-bold text-slate-800">Dúvidas Frequentes (FAQ)</h4>
                    <button 
                      onClick={() => setLpData({...lpData, faq: [...lpData.faq, { question: '', answer: '' }]})}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      +
                    </button>
                  </div>
                  <div className="p-6 space-y-6">
                    {lpData.faq.map((item: any, idx: number) => (
                      <div key={idx} className="space-y-2 border-l-2 border-slate-100 pl-4 py-1 relative group">
                        <button 
                          onClick={() => {
                            const newFaq = lpData.faq.filter((_: any, i: number) => i !== idx);
                            setLpData({...lpData, faq: newFaq});
                          }}
                          className="absolute -right-2 top-0 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <input 
                          type="text" 
                          value={item.question}
                          onChange={(e) => {
                            const newFaq = [...lpData.faq];
                            newFaq[idx].question = e.target.value;
                            setLpData({...lpData, faq: newFaq});
                          }}
                          className="w-full font-bold text-slate-800 outline-none border-b border-transparent focus:border-blue-200 pb-1"
                          placeholder="Sua pergunta..."
                        />
                        <textarea 
                          value={item.answer}
                          onChange={(e) => {
                            const newFaq = [...lpData.faq];
                            newFaq[idx].answer = e.target.value;
                            setLpData({...lpData, faq: newFaq});
                          }}
                          className="w-full text-slate-600 outline-none resize-none bg-transparent"
                          rows={2}
                          placeholder="A resposta para sua dúvida..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copiloto de Copywriting IA */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                      Copiloto de Copywriting IA
                    </h4>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Framework de Venda</label>
                      <select 
                        value={copyFramework}
                        onChange={(e) => setCopyFramework(e.target.value as 'AIDA' | 'PAS')}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                      >
                        <option value="AIDA">AIDA (Atenção, Interesse, Desejo, Ação)</option>
                        <option value="PAS">PAS (Problema, Agitação, Solução)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Principais Benefícios</label>
                      <input 
                        type="text" 
                        value={copyBenefits}
                        onChange={(e) => setCopyBenefits(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Ex: Certificado, Aulas práticas, Acesso vitalício"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={generateAICopy}
                      disabled={isGeneratingCopy}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isGeneratingCopy ? 'Gerando Copy...' : '✨ Gerar Copy com IA'}
                    </button>

                    {generatedCopyResult && (
                      <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 max-h-[300px] overflow-y-auto">
                        <div className="border-b border-slate-200 pb-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Headline Recomendada</span>
                          <p className="font-bold text-slate-800 text-sm mt-1">{generatedCopyResult.headline}</p>
                          <button
                            type="button"
                            onClick={() => setLpData({...lpData, hero_title: generatedCopyResult.headline, hero_subtitle: generatedCopyResult.subheadline})}
                            className="mt-2 text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            Aplicar no Topo da Página
                          </button>
                        </div>
                        <div className="border-b border-slate-200 pb-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Subheadline</span>
                          <p className="text-xs text-slate-600 mt-1">{generatedCopyResult.subheadline}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Estrutura de Vendas</span>
                          <div className="space-y-3 mt-2">
                            {generatedCopyResult.frameworkSections?.map((section: any, idx: number) => (
                              <div key={idx} className="bg-white p-3 rounded-lg border border-slate-100">
                                <h5 className="font-bold text-xs text-slate-700 uppercase">{section.title}</h5>
                                <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{section.content}</p>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              let fullText = `${generatedCopyResult.intro}\n\n`;
                              generatedCopyResult.frameworkSections?.forEach((sec: any) => {
                                fullText += `### ${sec.title}\n${sec.content}\n\n`;
                              });
                              fullText += `### Chamada para Ação\n${generatedCopyResult.callToAction}`;
                              setLpData({...lpData, about: fullText});
                              showToast("Estrutura de vendas aplicada na seção 'Sobre o Programa' com sucesso!", 'success');
                            }}
                            className="mt-3 w-full py-2 border border-blue-200 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all cursor-pointer text-center block"
                          >
                            Aplicar na Seção "Sobre o Programa"
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Marketing Hint */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg overflow-hidden relative">
                   <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                     <ShoppingBag className="w-32 h-32" />
                   </div>
                   <h4 className="font-bold text-lg mb-2 relative z-10">Dica de Conversão</h4>
                   <p className="text-blue-50 opacity-90 text-sm leading-relaxed relative z-10">
                     Páginas de venda com vídeos têm uma taxa de conversão até 80% maior. Destaque os benefícios reais e o que o aluno terá acesso imediato após o pagamento.
                   </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'configuracoes' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Informações básicas</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Nome e descrição</div>
                <div className="flex items-center gap-4 text-slate-600">
                  <span>{createdCourseName}</span>
                  <span className="w-px h-4 bg-slate-300"></span>
                  <span className="truncate">{activeCurso?.descricao || 'Nenhuma descrição informada'}</span>
                </div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Categorias</div>
                <div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Curso</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Programação</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Ritmo</div>
                <div className="text-slate-600">No seu próprio ritmo</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Limite de tempo</div>
                <div className="text-slate-600">Sem limite</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Inscrição e pagamento</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Opções de preço</div>
                <div className="text-slate-600">Gratuito</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Visibilidade</div>
                <div className="text-slate-600">Público</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Limite de participação</div>
                <div className="text-slate-600">Ilimitado</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-900">Configurações de conteúdo</h3>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Editar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm">
                <div className="font-semibold text-slate-700">Acesso à etapa</div>
                <div className="text-slate-600">Qualquer ordem</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Necessário assistir a vídeos</div>
                <div className="text-slate-400">Desativado</div>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm mt-4">
                <div className="font-semibold text-slate-700">Reprodução automática da próxima etapa de vídeo</div>
                <div className="text-slate-400">Desativado</div>
              </div>
            </div>

             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Instrutores</h3>
                  <p className="text-sm text-slate-500">Atribua instrutores a este programa e edite seus perfis.</p>
                </div>
                <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full text-sm font-medium hover:bg-blue-50">Gerenciar</button>
              </div>
              <div className="grid grid-cols-[200px_1fr] gap-4 text-sm font-medium border-t border-slate-50 pt-6">
                <div className="font-semibold text-slate-700 uppercase tracking-wider text-xs">Instrutores atribuídos</div>
                <div className="flex flex-col gap-4">
                  {editingTrilha ? (
                    (() => {
                      const extra = activeTrilha?.professores_extra_json || [];
                      const guestRows = Array.isArray(extra) && extra.length > 0 
                        ? extra.map((p: any, idx: number) => (
                          <div key={`guest-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                             <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                               {p.nome.charAt(0)}
                             </div>
                             <div>
                               <div className="font-bold text-slate-900">{p.nome}</div>
                               <div className="text-xs text-slate-500">{p.titulo}</div>
                             </div>
                          </div>
                        ))
                        : activeTrilha?.professores_convidados 
                          ? [<div key="old-guest" className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                {activeTrilha.professores_convidados.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{activeTrilha.professores_convidados}</div>
                                <div className="text-xs text-slate-500">{activeTrilha.professores_titulos}</div>
                              </div>
                             </div>]
                          : [];
                      
                      return guestRows.length > 0 ? guestRows : <div className="text-slate-400 italic">Sem professores convidados.</div>;
                    })()
                  ) : activeCurso?.professor_nome || activeCurso?.professor_foto_url ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                       {activeCurso.professor_foto_url ? (
                         <img src={activeCurso.professor_foto_url} alt={activeCurso.professor_nome || 'Instrutor'} className="w-12 h-12 rounded-full object-cover border border-white shadow-sm" />
                       ) : (
                         <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                           {(activeCurso.professor_nome || 'I').charAt(0)}
                         </div>
                       )}
                       <div>
                         <div className="font-bold text-slate-900">{activeCurso.professor_nome || 'Instrutor principal'}</div>
                         <div className="text-xs text-slate-500">{activeCurso.professor_titulo || 'Especialista'}</div>
                       </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic">Sem instrutores configurados. Vá em configurações para adicionar.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'acessar_curso' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)' }}>
            <CursosCandidato previewCourseId={createdCourseId || undefined} isGestor={true} />
          </div>
        )}

        {activeTab === 'engajamento' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex gap-6 items-start pb-6 border-b border-slate-100">
                <div className="w-24 h-24 bg-rose-900 rounded-lg flex items-center justify-center text-white">
                  <MessageSquare className="w-10 h-10" />
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">Comunidade e comunicação</h3>
                  <p className="text-sm text-slate-600">Crie conexões por colaboração e engajamento em tempo real.</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                 <span className="font-semibold text-slate-700">Grupo</span>
                 <div className="flex items-center gap-6">
                   <span className="text-slate-400">Não conectado</span>
                   <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50">Conectar grupo</button>
                 </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="flex gap-6 items-start pb-6 border-b border-slate-100">
                <div className="w-24 h-24 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Award className="w-10 h-10" />
                </div>
                <div className="pt-2">
                  <h3 className="font-bold text-lg text-slate-900 mb-1">Recompensas</h3>
                  <p className="text-sm text-slate-600">Comemore o sucesso com certificados e selos de desempenho.</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm py-4 border-b border-slate-100">
                 <span className="font-semibold text-slate-700">Certificado</span>
                 <div className="flex items-center justify-between flex-1 ml-16">
                   <div className="flex flex-col">
                     <span className="text-slate-400">Não conectado</span>
                     <span className="text-slate-600">Crie e emita um certificado de conclusão para os participantes que concluírem este programa.</span>
                   </div>
                   <button 
                     onClick={async () => {
                        const template = await loadCertificateTemplate(createdCourseId!);
                        setEditingCertTemplate(template);
                        setIsCertificateModalOpen(true);
                     }}
                     className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50 whitespace-nowrap"
                   >
                     {activeCurso?.tem_certificado ? 'Editar certificado' : 'Criar certificado'}
                   </button>
                 </div>
              </div>
               <div className="flex items-center justify-between text-sm pt-4">
                 <span className="font-semibold text-slate-700">Selos</span>
                 <div className="flex items-center justify-between flex-1 ml-16">
                   <div className="flex flex-col">
                     <span className="text-slate-400">Não adicionado</span>
                     <span className="text-slate-600">Dê aos participantes um selo quando concluírem todas as etapas.</span>
                   </div>
                   <button className="px-4 py-1.5 border border-blue-200 text-blue-600 rounded-full font-medium hover:bg-blue-50 whitespace-nowrap">Adicionar selos</button>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditingSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Editar Configurações</h2>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Curso <span className="text-blue-600">*</span></label>
                <input 
                  type="text" 
                  value={editingSettingsData.nome}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, nome: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                />
              </div>

              {/* Descricao */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Curso</label>
                <textarea 
                  value={editingSettingsData.descricao}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, descricao: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-blue-500 resize-none h-24"
                />
              </div>

              {/* Carga Horaria */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Carga Horária</label>
                <input 
                  type="text" 
                  value={editingSettingsData.carga_horaria}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, carga_horaria: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                />
              </div>

              {/* URL da Capa */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL da Imagem de Capa</label>
                <input 
                  type="text" 
                  value={editingSettingsData.thumbnail_url}
                  onChange={(e) => setEditingSettingsData({...editingSettingsData, thumbnail_url: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                  placeholder="https://..."
                />
              </div>

              {/* Professor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_nome}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_nome: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="Nome"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_titulo}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_titulo: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="Ex. Faixa Preta"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL da Foto do Professor</label>
                  <input 
                    type="text" 
                    value={editingSettingsData.professor_foto_url}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, professor_foto_url: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Ritmo */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ritmo</label>
                  <select 
                    value={editingSettingsData.ritmo}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, ritmo: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="proprio">No seu próprio ritmo</option>
                    <option value="programado">Programado</option>
                  </select>
                </div>

                {/* Preço */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custo</label>
                  <select 
                    value={editingSettingsData.preco}
                    onChange={(e) => setEditingSettingsData({...editingSettingsData, preco: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              {/* Configurações de Pagamento */}
              {editingSettingsData.preco === 'pago' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Pagamento</label>
                      <select 
                        value={editingSettingsData.pagamento_modelo}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, pagamento_modelo: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="fixo">Pagamento Único (Fixo)</option>
                        <option value="recorrente">Assinatura Recorrente</option>
                        <option value="parcelado">Parcelamento Inteligente (Carnê)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Valor {editingSettingsData.pagamento_modelo === 'fixo' ? 'Total' : 'da Parcela'} (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingSettingsData.valor}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, valor: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {editingSettingsData.pagamento_modelo === 'recorrente' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ciclo da Assinatura (em dias)</label>
                      <select
                        value={editingSettingsData.pagamento_ciclo}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, pagamento_ciclo: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="30">Mensal (30 dias)</option>
                        <option value="90">Trimestral (90 dias)</option>
                        <option value="180">Semestral (180 dias)</option>
                        <option value="365">Anual (365 dias)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Acesso é renovado a cada pagamento aprovado.</p>
                    </div>
                  )}

                  {editingSettingsData.pagamento_modelo === 'parcelado' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ciclo da Parcela</label>
                        <select
                          value={editingSettingsData.pagamento_ciclo}
                          onChange={(e) => setEditingSettingsData({...editingSettingsData, pagamento_ciclo: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="30">Mensal (30 dias)</option>
                          <option value="15">Quinzenal (15 dias)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Qtd. de Parcelas</label>
                        <input 
                          type="number" 
                          min="2"
                          max="36"
                          value={editingSettingsData.pagamento_parcelas_limite}
                          onChange={(e) => setEditingSettingsData({...editingSettingsData, pagamento_parcelas_limite: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Em Breve */}
              <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <input 
                  type="checkbox" 
                  id="editEmBreve" 
                  checked={editingSettingsData.em_breve} 
                  onChange={e => setEditingSettingsData({...editingSettingsData, em_breve: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="editEmBreve" className="font-bold text-slate-800">Marcar como "Em Breve"</label>
                <span className="text-xs text-slate-500 ml-auto">(Exibe selo verde no lugar do preço)</span>
              </div>

              {/* Tempo / Formato */}
              <div className="border border-slate-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-slate-700 mb-3">Duração do Programa</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tempo_edit"
                      checked={editingSettingsData.tempo === 'sem_limite'}
                      onChange={() => setEditingSettingsData({...editingSettingsData, tempo: 'sem_limite'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">Sem limite de tempo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="tempo_edit"
                      checked={editingSettingsData.tempo === 'com_limite'}
                      onChange={() => setEditingSettingsData({...editingSettingsData, tempo: 'com_limite'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">Com limite de tempo</span>
                  </label>
                </div>
                
                {editingSettingsData.tempo === 'com_limite' && (
                  <div className="mt-4 flex gap-4">
                    <div className="flex-1">
                      <input 
                        type="number" 
                        value={editingSettingsData.duracao}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, duracao: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500"
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div className="flex-1">
                      <select 
                        value={editingSettingsData.duracao_tipo}
                        onChange={(e) => setEditingSettingsData({...editingSettingsData, duracao_tipo: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white"
                      >
                        <option value="Dias">Dias</option>
                        <option value="Semanas">Semanas</option>
                        <option value="Meses">Meses</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsEditingSettingsModalOpen(false)}
                className="px-6 py-2 border border-slate-300 rounded-full font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                disabled={isSaving || !editingSettingsData.nome.trim()}
                onClick={async () => {
                  if (!createdCourseId) return;
                  setIsSaving(true);
                  try {
                    const formatGoogleDriveUrl = (url: string | undefined | null) => {
                      if (!url) return url;
                      const match1 = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/i);
                      if (match1 && match1[1]) return `https://drive.google.com/uc?export=view&id=${match1[1]}`;
                      const match2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/i);
                      if (match2 && match2[1]) return `https://drive.google.com/uc?export=view&id=${match2[1]}`;
                      return url;
                    };

                    const updateData: any = {
                      nome: editingSettingsData.nome,
                      descricao: editingSettingsData.descricao,
                      tempo: editingSettingsData.tempo,
                      duracao: editingSettingsData.duracao ? parseInt(editingSettingsData.duracao, 10) : null,
                      duracao_tipo: editingSettingsData.duracao_tipo,
                      ritmo: editingSettingsData.ritmo,
                      preco: editingSettingsData.preco,
                      valor: editingSettingsData.preco === 'pago' && editingSettingsData.valor ? parseFloat(editingSettingsData.valor) : null,
                      professor_nome: editingSettingsData.professor_nome,
                      professor_titulo: editingSettingsData.professor_titulo,
                      professor_foto_url: formatGoogleDriveUrl(editingSettingsData.professor_foto_url),
                      carga_horaria: editingSettingsData.carga_horaria,
                      em_breve: editingSettingsData.em_breve
                    };

                    const currentCurso = cursos.find(c => c.id === createdCourseId);
                    const baseConfig = currentCurso?.configuracao_json || {};

                    const completeData = { 
                      ...updateData, 
                      thumbnail_url: formatGoogleDriveUrl(editingSettingsData.thumbnail_url),
                      configuracao_json: {
                        ...baseConfig,
                        pagamento_modelo: editingSettingsData.pagamento_modelo,
                        pagamento_ciclo: editingSettingsData.pagamento_ciclo,
                        pagamento_parcelas_limite: editingSettingsData.pagamento_parcelas_limite
                      }
                    };
                    console.log('Salvando configurações do curso:', completeData);

                    // Try updating everything including thumbnail_url
                    try {
                      const { error } = await supabase.from('cursos').update(completeData).eq('id', createdCourseId);
                      if (error) throw error;
                      
                      setCreatedCourseName(editingSettingsData.nome);
                      setIsEditingSettingsModalOpen(false);
                      fetchCursos();
                    } catch (err: any) {
                      console.error('Error updating course settings:', err);
                      if (err.code === '57014' || (err.message && err.message.includes('timeout'))) {
                         showToast('Erro de tempo limite: As configurações do curso estão muito grandes para salvar. Tente reduzir o texto da descrição ou remover imagens embutidas.', 'error');
                      } else if (err.message && (err.message.includes("does not exist") || err.code === 'PGRST204' || err.message.includes("Could not find the"))) {
                        showToast(`Erro no banco de dados: ${err.message}\n\nExecute no SQL Editor para adicionar a coluna faltante:\n\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS thumbnail_url text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_nome text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_titulo text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS professor_foto_url text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS descricao text;\nALTER TABLE cursos ADD COLUMN IF NOT EXISTS carga_horaria text;\nNOTIFY pgrst, 'reload schema';`, 'error');
                      } else {
                        showToast('Erro ao atualizar. Tente novamente.', 'error');
                        throw err;
                      }
                    }
                  } catch (err) {
                    console.error('Error updating course settings:', err);
                    showToast('Erro ao atualizar. Tente novamente.', 'error');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className={`px-8 py-2 rounded-full font-medium text-white transition-colors flex items-center gap-2 ${
                  isSaving || !editingSettingsData.nome.trim() ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando...</> : 'Salvar Configurações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isVideoSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 pb-2 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-1">Configurações de vídeo</h2>
                <p className="text-slate-500 text-sm">Essas configurações serão aplicadas a todas as etapas de vídeo do seu programa.</p>
              </div>
              <button onClick={() => setIsVideoSettingsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              <div className="flex gap-4">
                <div className="pt-1">
                  <button 
                    onClick={() => setVideoSettings(prev => ({ ...prev, assistirObrigatorio: !prev.assistirObrigatorio }))}
                    className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${videoSettings.assistirObrigatorio ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform flex items-center justify-center ${videoSettings.assistirObrigatorio ? 'translate-x-5' : 'translate-x-0'}`}>
                      {videoSettings.assistirObrigatorio && <Check className="w-3 h-3 text-blue-600" />}
                    </div>
                  </button>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Assistir vídeos é obrigatório</h3>
                  <p className="text-slate-500 text-sm mb-4">Defina a porcentagem que os participantes devem assistir para concluir a etapa.</p>
                  
                  {videoSettings.assistirObrigatorio && (
                    <div className="flex items-center gap-2 max-w-[120px]">
                      <div className="relative flex-1">
                        <input 
                          type="number"
                          min="1"
                          max="100"
                          value={videoSettings.porcentagem}
                          onChange={(e) => setVideoSettings(prev => ({ ...prev, porcentagem: parseInt(e.target.value) || 0 }))}
                          className="w-full pl-4 pr-8 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="absolute right-3 top-2.5 text-slate-400 font-medium select-none">%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-slate-200 w-full"></div>

              <div className="flex gap-4">
                <div className="pt-1">
                  <button 
                    onClick={() => setVideoSettings(prev => ({ ...prev, reproduzirAutomaticamente: !prev.reproduzirAutomaticamente }))}
                    className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${videoSettings.reproduzirAutomaticamente ? 'bg-blue-600' : 'bg-slate-200'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${videoSettings.reproduzirAutomaticamente ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </button>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">Reproduzir próxima etapa de vídeo automaticamente</h3>
                  <p className="text-slate-500 text-sm">Quando uma etapa de vídeo termina, a próxima começa automaticamente.</p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 flex justify-end gap-3">
              <button 
                onClick={() => setIsVideoSettingsModalOpen(false)}
                className="px-6 py-2 border border-blue-200 text-blue-600 bg-white hover:bg-slate-50 rounded-full font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (createdCourseId) {
                     try {
                        const activeCurso = (cursos || []).find(c => c.id === createdCourseId);
                        const currentConfig = activeCurso?.configuracao_json || {};
                        const { error } = await supabase.from('cursos').update({
                           configuracao_json: { ...currentConfig, videoSettings }
                        }).eq('id', createdCourseId);
                        if(error) console.error(error);
                        fetchCursos();
                     } catch(e) {}
                  }
                  setIsVideoSettingsModalOpen(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Adicionar tabela</h2>
              <button 
                onClick={() => setIsAddTableModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 rounded-full border border-blue-200 p-2 hover:bg-blue-50"
              >
                <X className="w-5 h-5 text-blue-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-700">
              <p>Defina o número de colunas e linhas.</p>
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="flex items-center gap-2 font-medium mb-2">
                    Colunas 
                    <div className="w-4 h-4 border border-slate-400 rounded-sm flex">
                      <div className="w-1/2 h-full border-r border-slate-400"></div>
                    </div>
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={tableCols}
                    onChange={(e) => setTableCols(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 font-medium mb-2">
                    Linhas 
                    <div className="w-4 h-4 border border-slate-400 rounded-sm flex flex-col">
                      <div className="w-full h-1/2 border-b border-slate-400"></div>
                    </div>
                  </label>
                  <input 
                    type="number"
                    min="1"
                    value={tableRows}
                    onChange={(e) => setTableRows(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsAddTableModalOpen(false)}
                className="px-6 py-2 border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 rounded-full font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  let tableText = '<br/><table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;"><thead><tr>';
                  for (let i = 0; i < tableCols; i++) {
                    tableText += '<th style="border: 1px solid #e2e8f0; padding: 0.5rem; background-color: #f8fafc;">Cabeçalho</th>';
                  }
                  tableText += '</tr></thead><tbody>';
                  for (let i = 0; i < tableRows; i++) {
                    tableText += '<tr>';
                    for (let j = 0; j < tableCols; j++) {
                      tableText += '<td style="border: 1px solid #e2e8f0; padding: 0.5rem;">Célula</td>';
                    }
                    tableText += '</tr>';
                  }
                  tableText += '</tbody></table><br/>';
                  
                  applyCommand('insertHTML', tableText);
                  setIsAddTableModalOpen(false);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
      {isSelectQuestionsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[1050] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Selecionar Questões</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Escolha as questões que farão parte deste quiz no banco da organização</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsQuestionBankModalOpen(true)}
                  className="px-4 py-2 border border-blue-200 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-50 transition-all flex items-center gap-2 uppercase tracking-wider"
                >
                  <Database className="w-4 h-4" /> Gerenciar Banco
                </button>
                <button 
                  onClick={() => setIsSelectQuestionsModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 rounded-full border border-slate-200 p-2 hover:bg-slate-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Buscar Questão</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por texto..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Tema</label>
                <input 
                  type="text" 
                  value={quizFilterTema}
                  onChange={e => setQuizFilterTema(e.target.value)}
                  placeholder="Ex: História, Arbitragem..."
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Filtrar por Nível</label>
                <select 
                  value={quizFilterDificuldade}
                  onChange={e => setQuizFilterDificuldade(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Todos os Níveis</option>
                  <option value="Fácil">Fácil</option>
                  <option value="Médio">Médio</option>
                  <option value="Difícil">Difícil</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              {availableQuestions.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Nenhuma questão encontrada no banco.</p>
                  <button 
                    onClick={() => setIsQuestionBankModalOpen(true)}
                    className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                  >
                    Ir para o Gerenciador do Banco
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {availableQuestions
                    .filter(q => {
                      const temaMatch = !quizFilterTema || (q.tema && q.tema.toLowerCase().includes(quizFilterTema.toLowerCase()));
                      const dificuldadeMatch = !quizFilterDificuldade || (q.dificuldade || 'Médio') === quizFilterDificuldade;
                      return temaMatch && dificuldadeMatch;
                    })
                    .map(q => {
                    const isSelected = (editingStep.questoes_ids || []).includes(q.id);
                    return (
                      <div 
                        key={q.id} 
                        onClick={() => {
                          const newIds = isSelected 
                            ? (editingStep.questoes_ids || []).filter(id => id !== q.id)
                            : [...(editingStep.questoes_ids || []), q.id];
                          setEditingStep({...editingStep, questoes_ids: newIds});
                        }}
                        className={`flex items-start gap-4 p-5 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'}`}
                      >
                        <div className={`mt-0.5 min-w-[24px] h-6 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                          {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold leading-relaxed ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>{q.enunciado || q.texto}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <span className={`text-[10px] px-2.5 py-1 font-extrabold uppercase rounded-full border ${
                              q.dificuldade === 'Difícil' ? 'bg-red-50 text-red-700 border-red-100' : 
                              q.dificuldade === 'Fácil' ? 'bg-green-50 text-green-700 border-green-100' : 
                              'bg-orange-50 text-orange-700 border-orange-100'
                            }`}>Nível: {q.dificuldade || 'Médio'}</span>
                            {q.tema && (
                              <span className="text-[10px] px-2.5 py-1 bg-blue-50 text-blue-700 font-extrabold uppercase rounded-full border border-blue-100">Tema: {q.tema}</span>
                            )}
                            <span className="text-[10px] px-2.5 py-1 bg-slate-100 text-slate-600 font-extrabold uppercase rounded-full border border-slate-200">
                              {q.opcoes?.length || 0} Opções
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
              <span className="text-sm font-medium text-slate-500">
                {editingStep.questoes_ids?.length || 0} questões selecionadas
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSelectQuestionsModalOpen(false)}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  Concluir Seleção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banco de Questões Gerenciamento */}
      {isQuestionBankModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                    <Database className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Banco de Questões</h2>
                </div>
                <p className="text-slate-500 font-medium text-sm mt-1">Gerencie o acervo de questões da sua organização</p>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  id="csv-import" 
                  className="hidden" 
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const text = event.target?.result as string;
                      const lines = text.split('\n').filter(l => l.trim());
                      // Header: Pergunta,Opcao1,Opcao2,Opcao3,Opcao4,Opcao5,RespostaCorretaIndex,Tema,Dificuldade
                      const headers = lines[0].split(',').map(h => h.trim());
                      const newQuestions = [];
                      
                      for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                        if (cols.length < 7) continue;

                        let answerRaw = cols[6].toUpperCase();
                        let answerIndex = '0';

                        // Map A-E or 1-5 to 0-4
                        const map: Record<string, string> = {
                          'A': '0', 'B': '1', 'C': '2', 'D': '3', 'E': '4',
                          '1': '0', '2': '1', '3': '2', '4': '3', '5': '4'
                        };

                        if (map[answerRaw]) {
                          answerIndex = map[answerRaw];
                        } else if (/^[0-4]$/.test(answerRaw)) {
                          answerIndex = answerRaw;
                        }
                        
                        newQuestions.push({
                          organizacao_id: orgId,
                          enunciado: cols[0],
                          opcoes: [cols[1], cols[2], cols[3], cols[4], cols[5]],
                          correta: answerIndex,
                          tema: cols[7] || 'Geral',
                          dificuldade: cols[8] || 'Médio',
                          created_at: new Date().toISOString()
                        });
                      }
                      
                      if (newQuestions.length > 0) {
                        try {
                          const { error } = await supabase.from('questoes_teoricas').insert(newQuestions);
                          if (error) {
                            // If column doesn't exist, try without it
                            if (error.code === '42703' || error.message?.includes('organizacao_id')) {
                              const sanitized = newQuestions.map(q => {
                                const { organizacao_id, ...rest } = q;
                                return rest;
                              });
                              const { error: error2 } = await supabase.from('questoes_teoricas').insert(sanitized);
                              if (!error2) {
                                showToast(`${newQuestions.length} questões importadas com sucesso!`, 'success');
                                fetchQuestoes();
                              } else {
                                showToast('Erro ao importar questões: ' + error2.message, 'error');
                              }
                            } else {
                              showToast('Erro ao importar questões: ' + error.message, 'error');
                            }
                          } else {
                            showToast(`${newQuestions.length} questões importadas com sucesso!`, 'success');
                            fetchQuestoes();
                          }
                        } catch (err: any) {
                          showToast('Erro ao importar questões: ' + err.message, 'error');
                        }
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
                <button 
                  onClick={handleDownloadCSVTemplate}
                  className="px-5 py-2.5 text-slate-500 hover:text-slate-700 font-bold text-sm flex items-center gap-2 transition-all mr-2"
                  title="Baixar modelo de CSV"
                >
                  <Download className="w-4 h-4" /> Modelo
                </button>
                <button 
                  onClick={() => document.getElementById('csv-import')?.click()}
                  className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-full font-bold text-sm hover:bg-emerald-100 flex items-center gap-2 transition-all"
                >
                  <Upload className="w-4 h-4" /> Importar CSV
                </button>
                <button 
                  onClick={async () => {
                    const topic = window.prompt("Digite o tema ou assunto sobre o qual deseja gerar as questões (ex: 'Princípios fundamentais do Judô', 'História do Dojo'):");
                    if (!topic) return;
                    
                    const countStr = window.prompt("Quantas questões deseja gerar? (máximo 5):", "3");
                    const count = parseInt(countStr || "3", 10) || 3;
                    
                    await handleGenerateQuizWithAI(topic, count);
                  }}
                  disabled={isGeneratingQuiz}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full font-bold text-sm hover:opacity-90 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-50 mr-2"
                >
                  {isGeneratingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGeneratingQuiz ? "Gerando..." : "Gerar com IA"}
                </button>
                <button 
                  onClick={() => {
                    setEditingQuestion({
                      enunciado: '',
                      opcoes: ['', '', '', '', ''],
                      correta: '0',
                      tema: '',
                      dificuldade: 'Médio'
                    });
                    setIsAddingQuestionModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" /> Nova Questão
                </button>
                <button 
                  onClick={() => setIsQuestionBankModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              <div className="max-w-5xl mx-auto space-y-4 pb-8">
                {availableQuestions.length === 0 ? (
                  <div className="bg-white p-16 text-center rounded-3xl border border-slate-200 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Database className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Seu banco está vazio</h3>
                    <p className="text-slate-500 mt-2 mb-8 max-w-sm mx-auto">Comece adicionando questões manualmente ou importe um arquivo CSV com sua base de conhecimento.</p>
                    <div className="flex justify-center gap-4">
                       <button 
                         onClick={handleDownloadCSVTemplate}
                         className="px-6 py-3 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-white transition-all shadow-sm flex items-center gap-2"
                       >
                         <Download className="w-4 h-4" /> Baixar Modelo
                       </button>
                       <button 
                         onClick={() => document.getElementById('csv-import')?.click()}
                         className="px-6 py-3 border border-slate-200 rounded-2xl font-bold text-emerald-600 hover:bg-white transition-all shadow-sm flex items-center gap-2"
                       >
                         <Upload className="w-4 h-4" /> Importar CSV
                       </button>
                       <button 
                         onClick={() => {
                            setEditingQuestion({
                              enunciado: '',
                              opcoes: ['', '', '', '', ''],
                              correta: '0',
                              tema: '',
                              dificuldade: 'Médio'
                            });
                            setIsAddingQuestionModalOpen(true);
                          }}
                         className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                       >
                         Adicionar Questão
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {availableQuestions.map(q => (
                      <div key={q.id} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-all" />
                        <div className="flex justify-between gap-6">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <span className={`text-[10px] px-2.5 py-1 font-black uppercase rounded-full border ${
                                q.dificuldade === 'Difícil' ? 'bg-red-50 text-red-700 border-red-100' : 
                                q.dificuldade === 'Fácil' ? 'bg-green-50 text-green-700 border-green-100' : 
                                'bg-orange-50 text-orange-700 border-orange-100'
                              }`}>{q.dificuldade || 'Médio'}</span>
                              <span className="text-[10px] px-2.5 py-1 bg-blue-50 text-blue-700 font-black uppercase rounded-full border border-blue-100">{q.tema || 'Geral'}</span>
                            </div>
                            <h4 className="text-lg font-bold text-slate-800 leading-tight mb-4">{q.enunciado || q.texto}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                              {(q.opcoes || []).map((opt: string, i: number) => (
                                <div key={i} className={`flex items-center gap-2 text-sm ${String(i) === String(q.correta || q.resposta_correta) ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 border ${String(i) === String(q.correta || q.resposta_correta) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'}`}>
                                    {String.fromCharCode(65 + i)}
                                  </div>
                                  <span className="truncate">{opt}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                             <button 
                               onClick={() => {
                                 setEditingQuestion(q);
                                 setIsAddingQuestionModalOpen(true);
                               }}
                               className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                             >
                               <Pencil className="w-5 h-5" />
                             </button>
                             <button 
                               onClick={async () => {
                                 if (confirm('Deseja realmente excluir esta questão do banco?')) {
                                   try {
                                     const { error } = await supabase.from('questoes_teoricas').delete().eq('id', q.id);
                                     if (error) {
                                       showToast('Erro ao excluir: ' + error.message, 'error');
                                     } else {
                                       showToast('Questão excluída do banco com sucesso!', 'success');
                                       await fetchQuestoes();
                                     }
                                   } catch (err: any) {
                                     showToast('Erro inesperado ao excluir: ' + err.message, 'error');
                                   }
                                 }
                               }}
                               className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                             >
                               <Trash2 className="w-5 h-5" />
                             </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar/Editar Questão */}
      {isAddingQuestionModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">{editingQuestion?.id ? 'Editar Questão' : 'Nova Questão'}</h2>
              <button onClick={() => setIsAddingQuestionModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2"><X /></button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-tight">Texto da Pergunta</label>
                <textarea 
                  value={editingQuestion?.enunciado || editingQuestion?.texto || ''}
                  onChange={e => setEditingQuestion({...editingQuestion, enunciado: e.target.value})}
                  className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all font-medium text-slate-800"
                  rows={3}
                  placeholder="Qual a pergunta?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">TEMA</label>
                  <input 
                    type="text"
                    value={editingQuestion?.tema || ''}
                    onChange={e => setEditingQuestion({...editingQuestion, tema: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-bold text-slate-700"
                    placeholder="Ex: História"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">DIFICULDADE</label>
                  <select 
                    value={editingQuestion?.dificuldade || 'Médio'}
                    onChange={e => setEditingQuestion({...editingQuestion, dificuldade: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-bold text-slate-700"
                  >
                    <option value="Fácil">Fácil</option>
                    <option value="Médio">Médio</option>
                    <option value="Difícil">Difícil</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-tight">Opções de Resposta</label>
                {[0, 1, 2, 3, 4].map(idx => (
                  <div key={idx} className="flex gap-3 items-center group">
                    <button 
                      onClick={() => setEditingQuestion({...editingQuestion, correta: String(idx)})}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all shadow-sm ${
                        String(editingQuestion?.correta || editingQuestion?.resposta_correta) === String(idx)
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200' 
                        : 'bg-white text-slate-400 border border-slate-200 group-hover:border-emerald-300'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </button>
                    <input 
                      type="text"
                      value={editingQuestion?.opcoes[idx] || ''}
                      onChange={e => {
                        const newOpts = [...(editingQuestion?.opcoes || [])];
                        newOpts[idx] = e.target.value;
                        setEditingQuestion({...editingQuestion, opcoes: newOpts});
                      }}
                      className={`flex-1 px-4 py-3 border rounded-2xl outline-none transition-all font-medium ${
                        String(editingQuestion?.correta || editingQuestion?.resposta_correta) === String(idx)
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900' 
                        : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 text-slate-700'
                      }`}
                      placeholder={`Texto da opção ${idx + 1}`}
                    />
                  </div>
                ))}
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider text-center mt-2">Clique na letra à esquerda para marcar a resposta correta</p>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsAddingQuestionModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-2xl transition-all">Cancelar</button>
               <button 
                 onClick={async () => {
                   const currentEnunciado = editingQuestion.enunciado || editingQuestion.texto;
                   if (!currentEnunciado || !editingQuestion.opcoes[0]) {
                     showToast('Preencha a pergunta e ao menos a primeira opção.', 'error');
                     return;
                   }
                   
                   const questionData = {
                     enunciado: currentEnunciado,
                     opcoes: editingQuestion.opcoes,
                     correta: String(editingQuestion.correta || editingQuestion.resposta_correta || '0'),
                     tema: editingQuestion.tema,
                     dificuldade: editingQuestion.dificuldade,
                     organizacao_id: orgId
                   };
                   
                   if (editingQuestion.id) {
                     const { error } = await supabase.from('questoes_teoricas').update(questionData).eq('id', editingQuestion.id);
                     if (error) showToast(error.message, 'error');
                   } else {
                     const { error } = await supabase.from('questoes_teoricas').insert([questionData]);
                     if (error) showToast(error.message, 'error');
                   }
                   
                   fetchQuestoes();
                   setIsAddingQuestionModalOpen(false);
                 }}
                 className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95"
               >
                 Salvar Questão
               </button>
            </div>
          </div>
        </div>
      )}

      {isConvidarModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Users className="w-5 h-5 text-blue-600" />
                Convidar Participantes
              </h2>
              <button 
                onClick={() => setIsConvidarModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                E-mails dos participantes (separados por vírgula)
              </label>
              <textarea 
                value={convidarEmails}
                onChange={(e) => setConvidarEmails(e.target.value)}
                className="w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                placeholder="exemplo@email.com, outro@email.com"
                rows={4}
              />
              <p className="text-sm text-slate-500 mt-2">
                Os participantes receberão um e-mail com o link de inscrição para este programa.
              </p>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsConvidarModalOpen(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (!convidarEmails.trim()) {
                    showToast('Por favor, informe ao menos um e-mail.', 'error');
                    return;
                  }
                  setIsEnviandoConvites(true);
                  // Simulate sending emails
                  setTimeout(() => {
                    setIsEnviandoConvites(false);
                    setIsConvidarModalOpen(false);
                    setConvidarEmails('');
                    showToast('Os convites foram enviados com sucesso!', 'success');
                  }, 1500);
                }}
                disabled={isEnviandoConvites || !convidarEmails.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isEnviandoConvites ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  'Enviar Convites'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCertificateModalOpen && (
        <CertificateDesigner
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          onSave={handleSaveCertificate}
          initialTemplate={editingCertTemplate}
          targetName={createdCourseName}
          orgId={orgId}
        />
      )}

      {renderActionModal()}

      {/* Toast de notificação — substitui todos os alert() nativos */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold max-w-sm ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' :
              toast.type === 'error'   ? 'bg-red-600 text-white' :
                                         'bg-slate-800 text-white'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error'   && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info'    && <Info className="w-5 h-5 flex-shrink-0" />}
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
          </div>
        </div>
      </div>
    );
}
