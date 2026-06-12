import React, { useState, useEffect, useRef } from 'react';
import { PlayCircle, Clock, Award, ChevronRight, FileText, CheckCircle, ChevronLeft, Calendar, Maximize2, RefreshCcw, Info, ChevronDown, ChevronUp, Video, Check, X, MessageSquare, Download, List, Users, Sparkles, Bot, Loader2, BookOpen, Trophy, Star, PartyPopper } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { supabase } from '../lib/supabase';
import { generateCertificatePDF } from '../lib/certificateUtils';
import { getFormattedVideoUrl } from '../lib/videoUtils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReactPlayer from 'react-player/youtube';
import { motion, AnimatePresence } from 'motion/react';


export function CursosCandidato({ 
  previewCourseId, 
  isGestor, 
  userRole: initialUserRole,
  initialCourseId,
  onClearInitialCourse,
  globalOrgId
}: { 
  previewCourseId?: string; 
  isGestor?: boolean; 
  userRole?: string;
  initialCourseId?: string | null;
  onClearInitialCourse?: () => void;
  globalOrgId?: string | null;
} = {}) {
  const [cursos, setCursos] = useState<any[]>([]);
  const [trilhas, setTrilhas] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(initialUserRole || null);
  const [activeTab, setActiveTab] = useState<'cursos' | 'trilhas'>('cursos');
  const [cursosProgress, setCursosProgress] = useState<{[key: string]: {progresso: number, nome: string}}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'course' | 'lesson'>('list');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [courseToBuy, setCourseToBuy] = useState<any>(null);
  const [purchaseParticipantId, setPurchaseParticipantId] = useState<string | null>(null);
  const [buyerData, setBuyerData] = useState<{nome: string, email: string, cpf: string} | null>(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState<string | null>(null);
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [filterTrailId, setFilterTrailId] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<{[key: number]: boolean}>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const calculateProgress = (curso: any, steps: string[]) => {
    if (!curso || !curso.curriculo_json) return 0;
    const curriculo = curso.curriculo_json || [];
    let totalEtapas = 0;
    let validStepIds = new Set<string>();
    curriculo.forEach((s: any, sIdx: number) => {
      if (s.etapas) {
        totalEtapas += s.etapas.length;
        s.etapas.forEach((e: any, eIdx: number) => {
          validStepIds.add(e.id || `step-${sIdx}-${eIdx}`);
        });
      }
    });
    const validCompleted = (steps || []).filter(id => validStepIds.has(id));
    const progresso = totalEtapas === 0 ? 0 : Math.round((validCompleted.length / totalEtapas) * 100);
    return Math.min(100, Math.max(0, progresso));
  };

  // Video states
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoWatched, setVideoWatched] = useState(false);
  const [videoSettings, setVideoSettings] = useState<any>(null);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<{[key: string]: string}>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScores, setQuizScores] = useState<{[key: string]: { correct: number, total: number }}>({});
  const [aiExplanations, setAiExplanations] = useState<{[key: string]: { explicacao: string, aulaRecomendada?: string }}>({});
  const [loadingExplanations, setLoadingExplanations] = useState<{[key: string]: boolean}>({});
  
  // Chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [participantCount, setParticipantCount] = useState<number>(0);
  
  // Attendance states
  const [attendanceWindow, setAttendanceWindow] = useState<{ active: boolean, expiresAt: number | null }>({ active: false, expiresAt: null });
  const [attendanceTimeLeft, setAttendanceTimeLeft] = useState<number>(0);

  // Multi-video state
  const [currentMultiVideoUrl, setCurrentMultiVideoUrl] = useState<string>('');

  // AI Tutor states
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  const [tutorMessages, setTutorMessages] = useState<Array<{ role: 'user' | 'model', content: string }>>([
    { role: 'model', content: 'Olá! Sou seu Tutor de IA. Como posso te ajudar com o conteúdo desta aula?' }
  ]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  // Certificate modal state
  const [showCertModal, setShowCertModal] = useState(false);
  const [certModalCurso, setCertModalCurso] = useState<any>(null);
  const [certCandidateName, setCertCandidateName] = useState<string>('');
  const [certParticipationId, setCertParticipationId] = useState<string>('');
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);
  const certModalShownRef = useRef<Set<string>>(new Set());

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<{[key: string]: {participantes: number, concluintes: number}}>({});

  useEffect(() => {
    const init = async () => {
      let uId = null;
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          uId = data.user.id;
          setCurrentUserId(uId);
        }
        
        // Find role if not provided
        if (!initialUserRole) {
          const savedSession = localStorage.getItem('segunda_gaveta_session');
          if (savedSession) {
            try {
              const { role } = JSON.parse(savedSession);
              if (role) setUserRole(role);
            } catch (e) { console.error('Error parsing session in CursosCandidato', e); }
          }
        }
      } catch (err) { console.error(err); }
      fetchCursos(uId);
    };
    init();
  }, []);

  useEffect(() => {
    if (initialCourseId && cursos.length > 0) {
      const targetCourse = cursos.find(c => c.id === initialCourseId);
      if (targetCourse) {
        setSelectedCurso(targetCourse);
        setView('course');
      }
    }
  }, [initialCourseId, cursos]);

  const getStepId = (etapa: any, sIdx: number, eIdx: number) => {
    return etapa.id || `step-${sIdx}-${eIdx}`;
  };

  useEffect(() => {
    if (selectedCurso) {
      if (selectedCurso.configuracao_json?.videoSettings) {
        setVideoSettings(selectedCurso.configuracao_json.videoSettings);
      } else {
        setVideoSettings(null); // default or null
      }
      const loadProgress = async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          
          let parsedSteps: string[] = [];
          let currentScores: any = {};
          if (userId) {
            // Fetch from database
            const { data, error } = await supabase
              .from('curso_participantes')
              .select('completed_steps, quiz_scores, progresso, status')
              .eq('curso_id', selectedCurso.id)
              .eq('usuario_id', userId)
              .maybeSingle();
              
            if (data && data.completed_steps) {
              parsedSteps = data.completed_steps;
              
              // Consistency check: recalculate progress and compare with DB
              const curriculo = selectedCurso.curriculo_json || [];
              let totalEtapas = 0;
              let validStepIds = new Set<string>();
              curriculo.forEach((s: any, sIdx: number) => {
                if (s.etapas) {
                  totalEtapas += s.etapas.length;
                  s.etapas.forEach((e: any, eIdx: number) => {
                    validStepIds.add(e.id || `step-${sIdx}-${eIdx}`);
                  });
                }
              });
              const validCompleted = parsedSteps.filter(id => validStepIds.has(id));
              const calculatedProgresso = totalEtapas === 0 ? 0 : Math.round((validCompleted.length / totalEtapas) * 100);
              const expectedStatus = calculatedProgresso >= 100 ? 'concluido' : 'andamento';
              
              // If discrepancy found, trigger sync to repair the database
              if (data.progresso !== calculatedProgresso || data.status !== expectedStatus) {
                console.log(`Discrepancy detected in course ${selectedCurso.id}: DB=${data.progresso}%, Calculated=${calculatedProgresso}%. Repairing...`);
                syncProgressToDb(selectedCurso, parsedSteps, data.quiz_scores || {}, userId);
              }
            } else {
              // Read local storage as fallback
              const stored = localStorage.getItem(`progresso_curso_${selectedCurso.id}_${userId}`);
              if (stored) {
                try { parsedSteps = JSON.parse(stored); } catch { parsedSteps = []; }
              }
              // Sync initial
              syncProgressToDb(selectedCurso, parsedSteps, data?.quiz_scores || {}, userId);
            }
            if (data && data.quiz_scores) {
              currentScores = data.quiz_scores;
              setQuizScores(data.quiz_scores);
            }
            setCompletedSteps(parsedSteps);
          } else {
            // No user, fallback
            const stored = localStorage.getItem(`progresso_curso_${selectedCurso.id}`);
            if (stored) {
              try { parsedSteps = JSON.parse(stored); } catch { parsedSteps = []; }
            }
            setCompletedSteps(parsedSteps);
          }

          // AUTO SELECT FIRST INCOMPLETE STEP OR FIRST STEP
          const curriculo = selectedCurso.curriculo_json || [];
          let targetStep = null;
          let targetSecaoIdx = 0;
          let targetEtapaIdx = 0;
          let targetSecaoName = '';

          for (let sIdx = 0; sIdx < curriculo.length; sIdx++) {
            const secao = curriculo[sIdx];
            if (secao.etapas) {
              for (let eIdx = 0; eIdx < secao.etapas.length; eIdx++) {
                const etapa = secao.etapas[eIdx];
                const stepId = getStepId(etapa, sIdx, eIdx);
                if (!targetStep) {
                  targetStep = etapa;
                  targetSecaoIdx = sIdx;
                  targetEtapaIdx = eIdx;
                  targetSecaoName = secao.nome;
                }
                if (!parsedSteps.includes(stepId)) {
                  targetStep = etapa;
                  targetSecaoIdx = sIdx;
                  targetEtapaIdx = eIdx;
                  targetSecaoName = secao.nome;
                  break;
                }
              }
            }
            if (targetStep && !parsedSteps.includes(getStepId(targetStep, targetSecaoIdx, targetEtapaIdx))) {
              break;
            }
          }

          if (targetStep) {
            const stepId = getStepId(targetStep, targetSecaoIdx, targetEtapaIdx);
            setSelectedLesson({
              ...targetStep,
              _calculatedId: stepId,
              cursoNome: selectedCurso.nome,
              secaoNome: targetSecaoName,
              secaoIdx: targetSecaoIdx,
              etapaIdx: targetEtapaIdx
            });
            setExpandedSections(prev => ({ ...prev, [targetSecaoIdx]: true }));
          }
        } catch (err) {
          console.error("Error loading progress", err);
        }
      };

      loadProgress();
      
      setExpandedSections({ 0: true });
    }
  }, [selectedCurso]);

  useEffect(() => {
    // currentChannel declarado fora do if para que o cleanup sempre possa removê-lo,
    // independente do tipo da aula selecionada. Isso previne vazamentos de memória.
    let currentChannel: any = null;

    if (selectedLesson) {
      setAiExplanations({});
      setLoadingExplanations({});
      const isCompleted = completedSteps.includes(selectedLesson._calculatedId);
      setVideoProgress(isCompleted ? 1 : 0);
      setVideoWatched(isCompleted);

      if (selectedLesson.tipo === 'multi_video' && selectedLesson.videos?.length > 0) {
        setCurrentMultiVideoUrl(selectedLesson.videos[0].url);
      }

      if (selectedLesson.tipo === 'quiz') {
        loadQuizQuestions();
      }
      
      // Setup chat and presence for live lesson
      if (selectedLesson.tipo === 'ao_vivo') {
        currentChannel = supabase.channel(`live_chat_${selectedLesson._calculatedId}`)
          .on('broadcast', { event: 'new_message' }, payload => {
            setChatMessages(prev => [...prev, payload.payload]);
          })
          .on('broadcast', { event: 'release_attendance' }, payload => {
            setAttendanceWindow({ active: true, expiresAt: payload.payload.expiresAt });
          })
          .on('presence', { event: 'sync' }, () => {
            const newState = currentChannel.presenceState();
            // Count unique users across all connections
            const count = Object.keys(newState).length;
            setParticipantCount(count);
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              await currentChannel.track({
                user_id: currentUserId || 'anonymous',
                online_at: new Date().toISOString(),
              });
            }
          });
      }
    }

    // Cleanup sempre executado — remove o canal se existir
    return () => {
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
      }
    };
  }, [selectedLesson]);

  // Rastreador de tempo de estudo ativo (a cada 1 minuto de aula aberta)
  useEffect(() => {
    if (!selectedCurso || !selectedLesson || !currentUserId) return;

    const registrarMinutoEstudo = async () => {
      try {
        const hoje = new Date().toISOString().split('T')[0];
        
        // Buscar se já existe registro de hoje para acumular os minutos
        const { data: registroExistente, error: fetchErr } = await supabase
          .from('registro_estudos')
          .select('minutos_estudados')
          .eq('usuario_id', currentUserId)
          .eq('curso_id', selectedCurso.id)
          .eq('data', hoje)
          .maybeSingle();

        if (fetchErr) {
          console.warn('Erro ao verificar registro de estudo existente:', fetchErr.message);
        }

        const minutosAtuais = registroExistente ? registroExistente.minutos_estudados : 0;
        
        const { error: upsertErr } = await supabase
          .from('registro_estudos')
          .upsert({
            usuario_id: currentUserId,
            curso_id: selectedCurso.id,
            data: hoje,
            minutos_estudados: minutosAtuais + 1,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'usuario_id,curso_id,data' 
          });

        if (upsertErr) {
          console.error('Erro ao salvar minutos estudados:', upsertErr.message);
        }
      } catch (err) {
        console.error('Falha ao registrar tempo de estudo:', err);
      }
    };

    // Registra o primeiro minuto após 60 segundos ativo na aula
    const intervalId = setInterval(() => {
      registrarMinutoEstudo();
    }, 60000); // 1 minuto (60000ms)

    return () => {
      clearInterval(intervalId);
    };
  }, [selectedCurso, selectedLesson, currentUserId]);

  useEffect(() => {
    if (attendanceWindow.active && attendanceWindow.expiresAt) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((attendanceWindow.expiresAt! - Date.now()) / 1000));
        setAttendanceTimeLeft(remaining);
        if (remaining === 0) {
          setAttendanceWindow({ active: false, expiresAt: null });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [attendanceWindow]);

  const handleReleaseAttendance = async () => {
    if (!selectedLesson) return;
    const expiresAt = Date.now() + 3 * 60 * 1000;
    setAttendanceWindow({ active: true, expiresAt });
    await supabase.channel(`live_chat_${selectedLesson._calculatedId}`).send({
      type: 'broadcast',
      event: 'release_attendance',
      payload: { expiresAt }
    });
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !selectedLesson) return;
    
    const { data: userData } = await supabase.auth.getUser();
    let userName = userData?.user?.user_metadata?.nome || userData?.user?.email?.split('@')[0] || 'Usuário';

    if (userData?.user?.id) {
      try {
        const { data: userProfile } = await supabase
          .from('usuarios')
          .select('nome, role')
          .eq('id', userData.user.id)
          .maybeSingle();
        
        if (userProfile && userProfile.nome) {
          const role = userProfile.role || userRole;
          const isStaff = role === 'avaliador' || role === 'avaliador_convidado' || role === 'admin' || role === 'gestor' || role === 'coordenador';
          
          if (isStaff) {
            userName = userProfile.nome;
          } else {
            userName = userProfile.nome.split(' ')[0];
          }
        } else {
          // Extrair o primeiro nome do metadata se existir como fallback para não-staff
          if (userData?.user?.user_metadata?.nome) {
            const role = userRole;
            const isStaff = role === 'avaliador' || role === 'avaliador_convidado' || role === 'admin' || role === 'gestor' || role === 'coordenador';
            
            if (isStaff) {
               userName = userData.user.user_metadata.nome;
            } else {
               userName = userData.user.user_metadata.nome.split(' ')[0];
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user profile", err);
      }
    }
    
    const message = {
      id: Date.now().toString(),
      text: chatInput,
      user_id: userData?.user?.id || 'anonymous',
      user_name: userName,
      timestamp: new Date().toISOString()
    };
    
    // Add locally immediately for perceived performance
    setChatMessages(prev => [...prev, message]);
    setChatInput('');
    
    // Broadcast to other users
    await supabase.channel(`live_chat_${selectedLesson._calculatedId}`).send({
      type: 'broadcast',
      event: 'new_message',
      payload: message
    });
  };

  const loadQuizQuestions = async () => {
    if (!selectedLesson.questoes_ids || selectedLesson.questoes_ids.length === 0) {
      setQuizQuestions([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('questoes_teoricas')
        .select('*')
        .in('id', selectedLesson.questoes_ids);
      
      if (!error && data) {
        // Order according to the array order
        const ordered = selectedLesson.questoes_ids.map((id: string) => data.find((q: any) => q.id === id)).filter(Boolean);
        setQuizQuestions(ordered);
      }
    } catch (err) {
      console.error(err);
    }
    setQuizAnswers({});
    setQuizSubmitted(false);
    setAiExplanations({});
    setLoadingExplanations({});
  };

  const handleRequestAiExplanation = async (question: any) => {
    setLoadingExplanations(prev => ({ ...prev, [question.id]: true }));
    try {
      const curriculumOutline = selectedCurso.curriculo_json?.flatMap((s: any) => 
        s.etapas?.map((e: any) => e.nome) || []
      ) || [];

      const correctLetter = question.gabarito 
        ? question.gabarito.toUpperCase() 
        : (question.correta ? String.fromCharCode(65 + parseInt(question.correta, 10)) : '');
      const selectedLetter = quizAnswers[question.id];

      const optionsObj: {[key: string]: string} = {};
      const optionsList = [question.opcao_a, question.opcao_b, question.opcao_c, question.opcao_d, question.opcao_e].filter(Boolean);
      optionsList.forEach((optText, optIdx) => {
        const letter = String.fromCharCode(65 + optIdx);
        optionsObj[letter] = optText;
      });

      const response = await fetch('/api/ai/explain-quiz-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: selectedCurso.nome,
          curriculumOutline,
          questionText: question.enunciado || question.texto,
          options: optionsObj,
          correctAnswer: `${correctLetter}) ${optionsObj[correctLetter] || ''}`,
          selectedAnswer: `${selectedLetter}) ${optionsObj[selectedLetter] || ''}`
        })
      });

      if (!response.ok) throw new Error("Erro ao consultar explicação.");
      const data = await response.json();
      setAiExplanations(prev => ({ ...prev, [question.id]: data }));
    } catch (err) {
      console.error(err);
      alert("Não foi possível gerar a explicação da IA no momento.");
    } finally {
      setLoadingExplanations(prev => ({ ...prev, [question.id]: false }));
    }
  };

  const handleGoToRecommendedLesson = (lessonName: string) => {
    if (!selectedCurso || !selectedCurso.curriculo_json) return;
    const curriculo = selectedCurso.curriculo_json;
    
    for (let sIdx = 0; sIdx < curriculo.length; sIdx++) {
      const secao = curriculo[sIdx];
      if (secao.etapas) {
        for (let eIdx = 0; eIdx < secao.etapas.length; eIdx++) {
          const etapa = secao.etapas[eIdx];
          if (etapa.nome === lessonName) {
            const stepId = getStepId(etapa, sIdx, eIdx);
            setSelectedLesson({
              ...etapa,
              _calculatedId: stepId,
              cursoNome: selectedCurso.nome,
              secaoNome: secao.nome,
              secaoIdx: sIdx,
              etapaIdx: eIdx
            });
            setExpandedSections(prev => ({ ...prev, [sIdx]: true }));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }
      }
    }
  };

  const toggleStepComplete = (stepId: string, newScores?: any) => {
    if (!stepId) return;
    setCompletedSteps(prev => {
      const newSteps = prev.includes(stepId) && !newScores ? prev.filter(id => id !== stepId) : (prev.includes(stepId) ? prev : [...prev, stepId]);
      if (selectedCurso) {
        try {
          if (currentUserId) {
            localStorage.setItem(`progresso_curso_${selectedCurso.id}_${currentUserId}`, JSON.stringify(newSteps));
          } else {
            localStorage.setItem(`progresso_curso_${selectedCurso.id}`, JSON.stringify(newSteps));
          }
        } catch (e) {
          console.warn("Erro ao salvar progresso do curso em localStorage:", e);
        }
        syncProgressToDb(selectedCurso, newSteps, newScores ? { ...quizScores, ...newScores } : quizScores);
      }
      return newSteps;
    });
  };

  const syncProgressToDb = async (curso: any, steps: string[], currentScores: any = quizScores, explicitUserId?: string) => {
    try {
      const targetUserId = explicitUserId || currentUserId;
      if (!targetUserId) return;
      
      const progresso = calculateProgress(curso, steps);
      const status = progresso >= 100 ? 'concluido' : 'andamento';
      const justConcluded = progresso >= 100;

      // Update local state for listing page to prevent visual discrepancy
      setCursosProgress(prev => ({
        ...prev,
        [curso.id]: {
          progresso,
          nome: curso.nome
        }
      }));

      const upsertPayload: any = {
        curso_id: curso.id,
        usuario_id: targetUserId,
        progresso,
        status,
        completed_steps: steps,
        quiz_scores: currentScores,
        updated_at: new Date().toISOString()
      };

      // Set data_conclusao only upon first completion
      if (justConcluded) {
        upsertPayload.data_conclusao = new Date().toISOString();
      }

      await supabase.from('curso_participantes').upsert(upsertPayload, { onConflict: 'curso_id,usuario_id' });

      // Show certificate modal only once per session, and only if course has a template
      if (justConcluded && curso.tem_certificado && !certModalShownRef.current.has(curso.id)) {
        certModalShownRef.current.add(curso.id);
        // Fetch candidate name and template lazily
        try {
          const { data: partData } = await (supabase
            .from('curso_participantes')
            .select('id, usuarios(nome)')
            .eq('curso_id', curso.id)
            .eq('usuario_id', targetUserId)
            .single() as any);
          if (partData) {
            const userObj = Array.isArray(partData.usuarios) ? partData.usuarios[0] : partData.usuarios;
            setCertCandidateName(userObj?.nome || 'Participante');
            setCertParticipationId(partData.id);
          }
          // Load template lazily
          if (!curso.certificado_template) {
            const { data: tmplData } = await supabase
              .from('cursos')
              .select('certificado_template')
              .eq('id', curso.id)
              .single();
            if (tmplData?.certificado_template) {
              curso = { ...curso, certificado_template: tmplData.certificado_template };
            }
          }
        } catch (e) {
          setCertCandidateName('Participante');
          setCertParticipationId(targetUserId);
        }
        setCertModalCurso(curso);
        setShowCertModal(true);
      }
    } catch (err) {
      console.error("Error syncing progress", err);
    }
  };

  const goToNextStep = () => {
    if (!selectedCurso || !selectedLesson) return;
    const curriculo = selectedCurso.curriculo_json || [];
    
    const currentStepId = selectedLesson._calculatedId;

    const { secaoIdx, etapaIdx } = selectedLesson;
    const currentSection = curriculo[secaoIdx];

    if (currentSection && etapaIdx + 1 < currentSection.etapas?.length) {
      // Next step in same section
      const nextStep = currentSection.etapas[etapaIdx + 1];
      setSelectedLesson({ ...nextStep, _calculatedId: getStepId(nextStep, secaoIdx, etapaIdx + 1), cursoNome: selectedCurso.nome, secaoNome: currentSection.nome, secaoIdx, etapaIdx: etapaIdx + 1 });
    } else if (secaoIdx + 1 < curriculo.length) {
      // First step in next section
      const nextSection = curriculo[secaoIdx + 1];
      if (nextSection && nextSection.etapas && nextSection.etapas.length > 0) {
        const nextStep = nextSection.etapas[0];
        setExpandedSections(prev => ({ ...prev, [secaoIdx + 1]: true }));
        setSelectedLesson({ ...nextStep, _calculatedId: getStepId(nextStep, secaoIdx + 1, 0), cursoNome: selectedCurso.nome, secaoNome: nextSection.nome, secaoIdx: secaoIdx + 1, etapaIdx: 0 });
      }
    }
  };

  const fetchTrilhas = async (allowedOrgs: Set<string> | null = null) => {
    try {
      const { data: trilhasData, error: trilhasError } = await supabase
        .from('trilhas')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (trilhasError) throw trilhasError;

      const { data: trilhaCursosData, error: trilhaCursosError } = await supabase
        .from('trilha_cursos')
        .select('trilha_id, curso_id');

      if (trilhaCursosError) throw trilhaCursosError;

      let validTrilhasData = trilhasData || [];
      if (allowedOrgs) {
         validTrilhasData = validTrilhasData.filter(t => allowedOrgs.has(t.organizacao_id));
      }

      const trilhasWithCursos = validTrilhasData.map(trilha => ({
        ...trilha,
        trilha_cursos: (trilhaCursosData || []).filter(tc => tc.trilha_id === trilha.id)
      }));
      setTrilhas(trilhasWithCursos);
      return { trilhas: trilhasWithCursos, trilhaCursos: trilhaCursosData || [] };
    } catch (err) {
      console.error('Error fetching trilhas:', err);
      return { trilhas: [], trilhaCursos: [] };
    }
  };

  const fetchCursos = async (uId?: string | null) => {
    setIsLoading(true);
    try {
      const targetUserId = uId || currentUserId;
      let allowedOrgIds: Set<string> | null = null;

      if (targetUserId && !isGestor && !previewCourseId) {
        allowedOrgIds = new Set<string>();
        
        if (globalOrgId) {
          allowedOrgIds.add(globalOrgId);
        }

        // 1. Organização direta do usuário
        const { data: userProfile } = await supabase.from('usuarios').select('organizacao_id').eq('id', targetUserId).maybeSingle();
        if (userProfile?.organizacao_id) {
           allowedOrgIds.add(userProfile.organizacao_id);
        }

        // 2. Organizações de cursos adquiridos
        const { data: participacoes } = await supabase
          .from('curso_participantes')
          .select('cursos(organizacao_id)')
          .eq('usuario_id', targetUserId);
          
        if (participacoes) {
           participacoes.forEach((p: any) => {
             const orgId = Array.isArray(p.cursos) ? p.cursos[0]?.organizacao_id : p.cursos?.organizacao_id;
             if (orgId) allowedOrgIds.add(orgId);
           });
        }
      }

      const { trilhas: fetchedTrilhas, trilhaCursos } = await fetchTrilhas(allowedOrgIds);
      let fetchedCursos: any[] = [];

      if (previewCourseId) {
        const { data, error } = await supabase
          .from('cursos')
          .select('id, nome, descricao, thumbnail_url, curriculo_json, configuracao_json, certificado_template, carga_horaria, ritmo, tempo, duracao, duracao_tipo, preco, valor, em_breve, professor_nome, professor_titulo, professor_foto_url, tem_certificado, ordem, created_at')
          .eq('id', previewCourseId)
          .single();
        if (error) throw error;
        fetchedCursos = [data];
        setCursos(fetchedCursos);
        setSelectedCurso(data);
        setView('course');
      } else {
        const { data, error } = await supabase
          .from('cursos')
          .select('id, nome, descricao, thumbnail_url, curriculo_json, configuracao_json, carga_horaria, ritmo, tempo, duracao, duracao_tipo, preco, valor, em_breve, professor_nome, professor_titulo, professor_foto_url, tem_certificado, ordem, created_at, organizacao_id')
          .order('ordem', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });

        if (error) throw error;
        fetchedCursos = data || [];
        if (allowedOrgIds) {
           fetchedCursos = fetchedCursos.filter(c => allowedOrgIds!.has(c.organizacao_id));
        }
        setCursos(fetchedCursos);
      }
      
      if (targetUserId) {
        const { data: participacoes, error: pErr } = await supabase
          .from('curso_participantes')
          .select('curso_id, progresso, status, completed_steps, cursos(nome, curriculo_json)')
          .eq('usuario_id', targetUserId);
          
        if (!pErr && participacoes) {
          const m: {[key: string]: {progresso: number, nome: string}} = {};
          participacoes.forEach(p => {
             // Use calculated progress if possible, fallback to DB
             const cursoData = (fetchedCursos || []).find(c => c.id === p.curso_id) || p.cursos;
             const calcProg = calculateProgress(cursoData, p.completed_steps);
             
            m[p.curso_id] = { 
              progresso: calcProg, 
              nome: (Array.isArray(p.cursos) ? (p.cursos as any[])[0]?.nome : (p.cursos as any)?.nome) || 'Curso'
            };
          });
          setCursosProgress(m as any);
        }
      }

      // Fetch all participants stats for courses
      const { data: statsData, error: statsError } = await supabase
        .from('curso_participantes')
        .select('curso_id, status, usuario_id');

      if (!statsError && statsData) {
        const statsMap: {[key: string]: {participantes: number, concluintes: number}} = {};
        
        // Initialize all items with 0
        fetchedCursos.forEach(c => {
          statsMap[c.id] = { participantes: 0, concluintes: 0 };
        });
        fetchedTrilhas.forEach(t => {
          statsMap[t.id] = { participantes: 0, concluintes: 0 };
        });

        // Map for Course stats from DB
        statsData.forEach(row => {
          if (!statsMap[row.curso_id]) {
            statsMap[row.curso_id] = { participantes: 0, concluintes: 0 };
          }
          statsMap[row.curso_id].participantes++;
          if (row.status === 'concluido') {
            statsMap[row.curso_id].concluintes++;
          }
        });

        // Map for Trilha stats
        fetchedTrilhas.forEach(t => {
          const trailCourses = trilhaCursos.filter(tc => tc.trilha_id === t.id).map(tc => tc.curso_id);
          if (trailCourses.length > 0) {
            const trailParticipants = new Set();
            const trailCompleters = new Set();
            const userToCompletedCount: {[key: string]: number} = {};
            
            statsData.forEach(row => {
              if (trailCourses.includes(row.curso_id)) {
                trailParticipants.add(row.usuario_id);
                if (row.status === 'concluido') {
                  userToCompletedCount[row.usuario_id] = (userToCompletedCount[row.usuario_id] || 0) + 1;
                  if (userToCompletedCount[row.usuario_id] === trailCourses.length) {
                    trailCompleters.add(row.usuario_id);
                  }
                }
              }
            });
            
            statsMap[t.id] = { 
              participantes: trailParticipants.size, 
              concluintes: trailCompleters.size 
            };
          }
        });

        setStats(statsMap);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center p-8 text-slate-500">Carregando cursos...</div>;
  }

  const handleAccessCourse = async (curso: any) => {
    if (cursosProgress[curso.id] !== undefined || isGestor || userRole === 'avaliador') {
      setSelectedCurso(curso);
      setView('course');
      return;
    }

    setIsProcessingPurchase(curso.id);
    try {
      const targetUserId = currentUserId;
      if (!targetUserId) throw new Error("Usuário não identificado.");
      
      // Tenta buscar pelo auth_id primeiro, que é o correto, ou pelo email da sessão
      let userData = null;
      const { data: authSessionData } = await supabase.auth.getUser();
      const sessionEmail = authSessionData?.user?.email || '';
      
      if (sessionEmail) {
        const { data: userByEmail } = await supabase
          .from('usuarios')
          .select('id, nome, email, auth_id')
          .eq('email', sessionEmail)
          .maybeSingle();
        userData = userByEmail;
      }
      
      if (!userData) {
        const { data: userById } = await supabase
          .from('usuarios')
          .select('id, nome, email, auth_id')
          .eq('auth_id', targetUserId)
          .maybeSingle();
        userData = userById;
      }

      // O target id real da tabela de participantes e usuarios será o id interno retornado
      const realUsuarioId = userData?.id || targetUserId;

      let finalUserData = userData;
      if (!finalUserData) {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        const nome = authUser?.user_metadata?.nome || 'Aluno';
        const email = authUser?.email || '';
        
        const { data: newUser, error: upsertErr } = await supabase.from('usuarios').upsert({
          id: targetUserId,
          auth_id: targetUserId,
          nome: nome,
          email: email,
          role: 'membro',
          organizacao_id: curso.organizacao_id
        }).select('nome, email').single();

        if (upsertErr) {
          console.error("Falha ao criar registro em usuarios:", upsertErr);
        } else {
          finalUserData = newUser;
        }
      }

      const isFree = parseFloat(curso.preco) === 0;

      let participantId;
      const { data: existingParticipation } = await supabase
        .from('curso_participantes')
        .select('id, status')
        .eq('curso_id', curso.id)
        .eq('usuario_id', realUsuarioId)
        .maybeSingle();

      if (existingParticipation) {
        participantId = existingParticipation.id;
        if (existingParticipation.status === 'inscrito') {
           setSelectedCurso(curso);
           setView('course');
           setIsProcessingPurchase(null);
           return;
        }
      } else {
        const { data: participant, error: partErr } = await supabase
          .from('curso_participantes')
          .insert({
            curso_id: curso.id,
            usuario_id: realUsuarioId,
            status: isFree ? 'inscrito' : 'pendente',
            progresso: 0
          })
          .select()
          .single();

        if (partErr) throw partErr;
        participantId = participant.id;
      }

      if (isFree) {
        await fetchCursos();
        setSelectedCurso(curso);
        setView('course');
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const buyer = {
          nome: finalUserData?.nome || authData.user?.user_metadata?.nome || 'Aluno',
          email: finalUserData?.email || authData.user?.email || '',
          cpf: ''
        };
        setBuyerData(buyer);
        setPurchaseParticipantId(participantId);
        setCourseToBuy(curso);
        setShowPaymentModal(true);
      }
    } catch (err: any) {
      console.error("Erro ao iniciar acesso ao curso:", err);
      alert("Não foi possível acessar o curso no momento. Erro: " + (err.message || JSON.stringify(err)));
    } finally {
      setIsProcessingPurchase(null);
    }
  };

  const handleDownloadCertificate = async (curso: any, overrideName?: string, overridePartId?: string) => {
    setIsGeneratingCert(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      
      let participationId = overridePartId || userId || 'participante';
      let candidateName = overrideName || 'Participante';

      // Lazy-load template if not already in state
      let template = curso.certificado_template;
      if (!template) {
        const { data: tmplData } = await supabase
          .from('cursos')
          .select('certificado_template')
          .eq('id', curso.id)
          .single();
        template = tmplData?.certificado_template;
      }

      if (!template) {
        alert('Nenhum template de certificado configurado para este curso.');
        return;
      }

      if (!overrideName && userId) {
        // Busca o ID do registro de participação para o QR Code de validação
        const { data: partData } = await (supabase
          .from('curso_participantes')
          .select('id, usuarios(nome)')
          .eq('curso_id', curso.id)
          .eq('usuario_id', userId)
          .single() as any);
          
        if (partData) {
          participationId = partData.id;
          const userObj = Array.isArray(partData.usuarios) ? partData.usuarios[0] : partData.usuarios;
          if (userObj?.nome) candidateName = userObj.nome;
        }
      }

      await generateCertificatePDF(template, {
        id: participationId,
        nome: candidateName,
        dataConclusao: new Date().toLocaleDateString('pt-BR'),
        titulo: curso.nome,
        cargaHoraria: curso.carga_horaria
      });
    } catch (err) {
      console.error('Error generating certificate:', err);
    } finally {
      setIsGeneratingCert(false);
    }
  };

  if (view === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 border-b border-slate-200 mb-6">
          <button onClick={() => setActiveTab('cursos')} className={`pb-4 px-2 font-bold ${activeTab === 'cursos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Cursos</button>
          <button onClick={() => setActiveTab('trilhas')} className={`pb-4 px-2 font-bold ${activeTab === 'trilhas' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Trilhas</button>
        </div>

        {courseToBuy && buyerData && purchaseParticipantId && (
          <PaymentModal 
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              fetchCursos();
            }}
            item={{
              id: courseToBuy.id,
              description: courseToBuy.nome,
              amount: courseToBuy.valor ? Number(courseToBuy.valor) : 0,
              type: 'curso',
              paymentModel: courseToBuy.configuracao_json?.pagamento_modelo,
              paymentCycle: courseToBuy.configuracao_json?.pagamento_ciclo,
              paymentInstallmentsLimit: courseToBuy.configuracao_json?.pagamento_parcelas_limite
            }}
            customer={{ name: buyerData.nome, email: buyerData.email, cpf: buyerData.cpf || '' }}
            participantId={purchaseParticipantId}
            organizacaoId={courseToBuy.organizacao_id}
          />
        )}

        {filterTrailId && activeTab === 'cursos' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <PlayCircle className="w-5 h-5"/>
              </div>
              <div>
                <div className="text-sm text-blue-600 font-semibold">Exibindo cursos da trilha:</div>
                <div className="text-lg font-bold text-slate-800">
                  {(trilhas || []).find(t => t.id === filterTrailId)?.nome}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setFilterTrailId(null)}
              className="px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4"/> Limpar Filtro
            </button>
          </div>
        )}

        {activeTab === 'cursos' ? (
          (() => {
            const coursesToDisplay = filterTrailId 
              ? cursos.filter(c => {
                  const trail = (trilhas || []).find(t => t.id === filterTrailId);
                  return trail?.trilha_cursos?.some((tc: any) => tc.curso_id === c.id);
                })
              : cursos;

            return coursesToDisplay.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum curso disponível</h3>
              <p className="text-slate-500">No momento, não há cursos publicados.</p>
            </div>
          ) : (
            coursesToDisplay.map((curso: any) => (
              <div key={curso.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
                  <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-800 border border-slate-200 bg-cover bg-center" style={{ backgroundImage: curso.thumbnail_url ? `url("${curso.thumbnail_url}")` : undefined }}>
                    {!curso.thumbnail_url && curso.nome}
                  </div>
                <div className="flex flex-col gap-2 w-full items-center">
                  <div className="flex gap-2 w-full justify-center">
                    {curso.em_breve ? (
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full border border-emerald-200 uppercase tracking-widest animate-pulse">Em Breve</span>
                    ) : userRole === 'avaliador' ? (
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                        <Award className="w-3 h-3" /> Cortesia
                      </span>
                    ) : curso.preco === 'pago' && curso.valor ? (
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">R$ {curso.valor.toFixed(2)}</span>
                    ) : (
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">Gratuito</span>
                    )}
                  </div>
                  
                  {stats[curso.id] && (
                    <div className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      <div className="flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        <span>{stats[curso.id].participantes} Participantes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle size={12} className="text-emerald-500" />
                        <span>{stats[curso.id].concluintes} Concluintes</span>
                      </div>
                    </div>
                  )}
                </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">{curso.nome}</h2>
                  <p className="text-slate-600 mb-4 flex-1">{curso.descricao || 'Nenhuma descrição fornecida.'}</p>
                  
                  {(curso.professor_nome || curso.professor_foto_url) && (
                    <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      {curso.professor_foto_url ? (
                        <img src={curso.professor_foto_url} alt={curso.professor_nome || 'Professor'} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                          {(curso.professor_nome || 'P').charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{curso.professor_nome || 'Instrutor'}</div>
                        {curso.professor_titulo && <div className="text-xs text-slate-500">{curso.professor_titulo}</div>}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 font-medium mb-4">
                    {curso.carga_horaria && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {curso.carga_horaria}</span>}
                    <span className="flex items-center gap-1.5 capitalize"><PlayCircle className="w-4 h-4" /> {curso.ritmo === 'programado' ? 'Programado' : 'Ritmo próprio'}</span>
                    {curso.tempo && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {curso.tempo === 'com_limite' ? `${curso.duracao} ${curso.duracao_tipo}` : 'Sem limite'}</span>}
                    {curso.tem_certificado && <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Certificado incluso</span>}
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    {cursosProgress[curso.id] !== undefined && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-600">Progresso</span>
                          <span className="text-xs font-semibold text-slate-600">{cursosProgress[curso.id].progresso}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${cursosProgress[curso.id].progresso}%` }}></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                         {(cursosProgress[curso.id] !== undefined || userRole === 'avaliador') && (
                            <span className="text-sm font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-green-200">
                              <CheckCircle className="w-4 h-4"/> 
                              {userRole === 'avaliador' ? 'Acesso Cortesia' : 'Curso Adquirido'}
                            </span>
                         )}
                         {cursosProgress[curso.id]?.progresso === 100 && curso.tem_certificado && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadCertificate(curso);
                              }}
                              className="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-blue-200 hover:bg-blue-100"
                            >
                              <Download className="w-4 h-4"/> Certificado
                            </button>
                         )}
                      </div>
                      <button 
                        disabled={!!curso.em_breve || isProcessingPurchase === curso.id}
                        onClick={() => {
                          handleAccessCourse(curso);
                        }}
                        className={`px-6 py-2 ${curso.em_breve ? 'bg-slate-300 cursor-not-allowed text-slate-500' : (cursosProgress[curso.id] !== undefined || userRole === 'avaliador' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700')} text-white rounded-full font-medium flex items-center gap-2 transition-colors`}
                      >
                        {isProcessingPurchase === curso.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {curso.em_breve ? 'Indisponível' : (cursosProgress[curso.id] !== undefined || userRole === 'avaliador' ? 'Continuar Curso' : 'Acessar Curso')} {isProcessingPurchase !== curso.id ? <ChevronRight className="w-4 h-4"/> : null}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          );
        })()
      ) : (
          trilhas.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma trilha disponível</h3>
              <p className="text-slate-500">No momento, não há trilhas publicadas.</p>
            </div>
          ) : (
             <div className="space-y-4">
                {trilhas.map((trilha) => (
                    <div key={trilha.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-64 flex flex-col gap-3 shrink-0">
                          <div className="w-full h-40 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xl text-slate-800 border border-slate-200 bg-cover bg-center" style={{ backgroundImage: trilha.capa_url ? `url("${trilha.capa_url}")` : undefined }}>
                            {!trilha.capa_url && trilha.nome}
                          </div>
                        <div className="flex flex-col gap-2 w-full items-center">
                          <div className="flex gap-2 w-full justify-center">
                            {trilha.em_breve ? (
                              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-1 rounded-full border border-emerald-200 uppercase tracking-widest animate-pulse">Em Breve</span>
                            ) : userRole === 'avaliador' ? (
                              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 flex items-center gap-1">
                                <Award className="w-3 h-3" /> Cortesia
                              </span>
                            ) : parseFloat(trilha.preco) === 0 ? (
                              <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 uppercase tracking-wider">Gratuito</span>
                            ) : (
                              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">R$ {parseFloat(trilha.preco).toFixed(2)}</span>
                            )}
                          </div>

                          {stats[trilha.id] && (
                            <div className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                              <div className="flex items-center gap-1">
                                <Users size={12} className="text-slate-400" />
                                <span>{stats[trilha.id].participantes} Participantes</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CheckCircle size={12} className="text-emerald-500" />
                                <span>{stats[trilha.id].concluintes} Concluintes</span>
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                         <div className="flex-1 flex flex-col">
                          <h2 className="text-2xl font-bold text-slate-900 mb-2">{trilha.nome}</h2>
                          <p className="text-slate-600 mb-4 flex-1">{trilha.descricao || 'Nenhuma descrição fornecida.'}</p>
                          
                          <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm space-y-2">
                             <div className="flex items-center gap-3 mb-2">
                               {trilha.coordenador_foto_url ? (
                                 <img src={trilha.coordenador_foto_url} alt={trilha.coordenador_nome} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                               ) : (
                                 <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                   {(trilha.coordenador_nome || 'C').charAt(0)}
                                 </div>
                               )}
                               <div>
                                 <div className="font-bold text-slate-800">Coordenador: {trilha.coordenador_nome}</div>
                                 {trilha.coordenador_titulo && <div className="text-xs text-slate-500">{trilha.coordenador_titulo}</div>}
                               </div>
                             </div>
                             <div className="space-y-1">
                                <span className="font-bold">Professores:</span>
                                {(() => {
                                  // 1. Extrair Professores Convidados
                                  let guests: Array<{nome: string, titulo: string}> = [];
                                  const extra = trilha.professores_extra_json || [];
                                  if (Array.isArray(extra) && extra.length > 0) {
                                    guests = extra.map((p: any) => ({ nome: p.nome, titulo: p.titulo }));
                                  } else if (trilha.professores_convidados) {
                                    guests = [{ 
                                      nome: trilha.professores_convidados, 
                                      titulo: trilha.professores_titulos || '' 
                                    }];
                                  }
                                  
                                  // Filtrar convidados vazios e ordenar alfabeticamente
                                  const sortedGuests = guests
                                    .filter(p => p.nome && p.nome.trim() !== '')
                                    .sort((a, b) => a.nome.localeCompare(b.nome));

                                  // 2. Extrair Professores dos Cursos
                                  const trailCoursesProfessors = (trilha.trilha_cursos || [])
                                    .map((tc: any) => (cursos || []).find(c => c.id === tc.curso_id))
                                    .filter((c: any) => c && c.professor_nome && c.professor_nome.trim() !== '')
                                    .map((c: any) => ({
                                      nome: c.professor_nome,
                                      titulo: c.professor_titulo || ''
                                    }));

                                  // Deduplicar professores de cursos por nome
                                  const uniqueCourseProfsMap = new Map();
                                  trailCoursesProfessors.forEach(p => {
                                    if (!uniqueCourseProfsMap.has(p.nome)) {
                                      uniqueCourseProfsMap.set(p.nome, p);
                                    }
                                  });

                                  // 3. Remover professores de curso que já estão nos convidados (Prioridade Convidado)
                                  const guestNames = new Set(sortedGuests.map(g => g.nome));
                                  const filteredCourseProfs = Array.from(uniqueCourseProfsMap.values())
                                    .filter(p => !guestNames.has(p.nome)) as Array<{nome: string, titulo: string}>;

                                  // Ordenar professores de curso alfabeticamente
                                  const sortedCourseProfs = filteredCourseProfs.sort((a, b) => a.nome.localeCompare(b.nome));

                                  return (
                                    <div className="pl-0 space-y-1">
                                      {/* Exibir Convidados em Ordem Alfabética */}
                                      {sortedGuests.map((p, idx) => (
                                        <div key={`guest-${idx}`} className="flex flex-col">
                                          <span className="text-slate-800">{p.nome} {p.titulo && <span className="text-slate-500 text-xs italic">({p.titulo})</span>}</span>
                                        </div>
                                      ))}
                                      
                                      {/* Exibir Professores de Curso em Ordem Alfabética (sem duplicatas dos convidados) */}
                                      {sortedCourseProfs.map((p, idx) => (
                                        <div key={`course-${idx}`} className="flex flex-col">
                                          <span className="text-slate-800">{p.nome} {p.titulo && <span className="text-slate-500 text-xs italic">({p.titulo})</span>}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                             </div>
                             <div className="font-bold">Cursos:</div>
                             <ul className="list-disc list-inside">
                                {(() => {
                                  const trailCourses = (trilha.trilha_cursos || [])
                                    .map((tc: any) => (cursos || []).find(c => c.id === tc.curso_id))
                                    .filter((c: any) => c)
                                    .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

                                  return trailCourses.map((curso: any) => (
                                    <li key={curso.id} 
                                       className="cursor-pointer hover:text-blue-600 hover:underline transition-colors py-0.5"
                                       onClick={() => {
                                         handleAccessCourse(curso);
                                       }}
                                     >
                                       {curso.nome}
                                     </li>
                                  ));
                                })()}
                             </ul>
                          </div>

                          <div className="flex justify-end mt-auto">
                             <button 
                               disabled={!!trilha.em_breve}
                               onClick={() => {
                                  setFilterTrailId(trilha.id);
                                  setActiveTab('cursos');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className={`px-6 py-2 ${trilha.em_breve ? 'bg-slate-300 cursor-not-allowed text-slate-500' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full font-medium flex items-center gap-2 transition-colors`}
                             >
                               {trilha.em_breve ? 'Em Breve' : 'Explorar Trilha'} <ChevronRight className="w-4 h-4"/>
                             </button>
                          </div>
                        </div>
                    </div>
                ))}
             </div>
          )
        )}
      </div>
    );
  }

  if (view === 'course' && selectedCurso) {
    const curriculo = selectedCurso.curriculo_json || [];

    // Calculate total progress using central helper
    const progressoPercent = calculateProgress(selectedCurso, completedSteps);

    let lastSecaoIdx = -1;
    let lastEtapaIdx = -1;
    for (let sIdx = curriculo.length - 1; sIdx >= 0; sIdx--) {
      if (curriculo[sIdx].etapas && curriculo[sIdx].etapas.length > 0) {
        lastSecaoIdx = sIdx;
        lastEtapaIdx = curriculo[sIdx].etapas.length - 1;
        break;
      }
    }
    const isLastStep = selectedLesson && selectedLesson.secaoIdx === lastSecaoIdx && selectedLesson.etapaIdx === lastEtapaIdx;

    return (
      <div className={isGestor ? 'h-full w-full flex overflow-hidden bg-white' : '-mx-4 md:-mx-8 -my-6 bg-white min-h-[calc(100vh-64px)] flex overflow-hidden relative'}>
        {/* Sidebar */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col transition-all duration-300 ${selectedLesson ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200">
            {!previewCourseId && (
              <button 
                onClick={() => {
                  setView('list');
                  setSelectedLesson(null);
                  if (onClearInitialCourse) onClearInitialCourse();
                }}
                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium mb-4"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="truncate">{selectedCurso.nome}</span>
              </button>
            )}
            {previewCourseId && (
              <div className="flex items-center gap-2 text-slate-800 font-medium mb-4">
                <span className="truncate">{selectedCurso.nome}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: `${progressoPercent}%` }}></div>
              </div>
              <span className="text-xs font-bold text-slate-700">{progressoPercent}%</span>
            </div>

          </div>
          
          <div className="flex-1 overflow-y-auto">
            <button 
              onClick={() => setSelectedLesson(null)}
              className={`w-full px-5 py-4 flex items-center gap-3 hover:bg-slate-50 border-b border-slate-200 text-sm font-medium transition-colors ${!selectedLesson ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
            >
              <Info className={`w-5 h-5 ${!selectedLesson ? 'text-blue-600' : 'text-slate-400'}`} />
              Visão geral
            </button>
            
            {curriculo.map((secao: any, sIdx: number) => {
              const isExpanded = expandedSections[sIdx];
              const numEtapas = secao.etapas?.length || 0;
              const completedInSection = secao.etapas?.filter((e: any, eIdx: number) => completedSteps.includes(getStepId(e, sIdx, eIdx))).length || 0;

              return (
                <div key={sIdx} className="border-b border-slate-200">
                  <button 
                    onClick={() => setExpandedSections(prev => ({...prev, [sIdx]: !isExpanded}))}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{secao.nome || `Seção ${sIdx + 1}`}</h4>
                      <p className="text-xs text-slate-500">{completedInSection}/{numEtapas} etapas</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />}
                  </button>

                  {isExpanded && secao.etapas && (
                    <div>
                      {secao.etapas.map((etapa: any, eIdx: number) => {
                        const stepId = getStepId(etapa, sIdx, eIdx);
                        const isSelected = selectedLesson?._calculatedId === stepId;
                        const isCompleted = completedSteps.includes(stepId);
                        return (
                          <button
                            key={eIdx}
                            onClick={() => {
                              setSelectedLesson({ ...etapa, _calculatedId: stepId, cursoNome: selectedCurso.nome, secaoNome: secao.nome, secaoIdx: sIdx, etapaIdx: eIdx });
                            }}
                            className={`w-full text-left px-5 py-4 flex gap-4 ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <div className="mt-0.5">
                              {isCompleted ? (
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                  <CheckCircle className="w-3.5 h-3.5 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center">
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <span className={`text-sm ${isCompleted ? 'text-slate-500' : 'text-slate-800'}`}>{etapa.nome}</span>
                              <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                                {etapa.tipo === 'video' ? <Video className="w-3.5 h-3.5" /> : (etapa.tipo === 'multi_video' ? <List className="w-3.5 h-3.5" /> : (etapa.tipo === 'quiz' ? <CheckCircle className="w-3.5 h-3.5" /> : (etapa.tipo === 'ao_vivo' ? <Video className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />)))}
                                <span className="text-xs">{etapa.tempo_video || (etapa.tipo === 'video' ? 'Vídeo' : (etapa.tipo === 'multi_video' ? 'Multi-vídeo' : (etapa.tipo === 'quiz' ? 'Quiz' : (etapa.tipo === 'ao_vivo' ? 'Ao vivo' : 'Artigo'))))}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-1 bg-white flex flex-col relative h-[calc(100vh-64px)] overflow-hidden ${!selectedLesson ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {selectedLesson ? (
              <div>
                <div className="p-6 md:p-10 max-w-5xl mx-auto">
                  {/* Mobile Back Button */}
                  <button 
                    onClick={() => setSelectedLesson(null)}
                    className="flex md:hidden items-center gap-2 text-blue-600 font-bold mb-6"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Voltar para a lista
                  </button>

                  <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-8">{selectedLesson.nome}</h1>
                  
                  {selectedLesson.tipo === 'video' && selectedLesson.url_video && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden mb-8 shadow-sm">
                      {/* @ts-ignore */}
                      <ReactPlayer
                        url={selectedLesson.url_video.trim()}
                        className="w-full h-full border-0"
                        width="100%"
                        height="100%"
                        controls={false}
                        config={{
                          youtube: {
                            playerVars: { 
                              controls: 0,
                              disablekb: 1,
                              modestbranding: 1,
                              rel: 0,
                              iv_load_policy: 3,
                              cc_load_policy: 0
                            }
                          }
                        } as any}
                        light={false}
                        onReady={() => console.log('Player ready')}
                        onProgress={(state: any) => {
                          setVideoProgress(state.played);
                          if (videoSettings?.assistirObrigatorio && state.played >= (videoSettings.porcentagem / 100)) {
                            setVideoWatched(true);
                          }
                        }}
                        onEnded={() => {
                          setVideoWatched(true);
                          if (videoSettings?.reproduzirAutomaticamente) {
                             if (!completedSteps.includes(selectedLesson._calculatedId)) {
                               toggleStepComplete(selectedLesson._calculatedId);
                             }
                             goToNextStep();
                          }
                        }}
                      />
                    </div>
                  )}

                  {selectedLesson.tipo === 'multi_video' && (
                    <div className="space-y-6 mb-8">
                      {currentMultiVideoUrl ? (
                         <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-sm">
                           {/* @ts-ignore */}
                           <ReactPlayer
                             url={currentMultiVideoUrl.trim()}
                             className="w-full h-full border-0"
                             width="100%"
                             height="100%"
                             controls={false}
                             config={{
                               youtube: {
                                 playerVars: { 
                                   controls: 0,
                                   disablekb: 1,
                                   modestbranding: 1,
                                   rel: 0,
                                   iv_load_policy: 3,
                                   cc_load_policy: 0
                                 }
                               }
                             } as any}
                             playing={true}
                             onProgress={(state: any) => {
                               if (videoSettings?.assistirObrigatorio && state.played >= (videoSettings.porcentagem / 100)) {
                                 setVideoWatched(true);
                               }
                             }}
                             onEnded={() => {
                               // No automatic next for multi-video by default, unless it's the last video?
                               // For now, just mark watched.
                               setVideoWatched(true);
                             }}
                           />
                         </div>
                      ) : (
                        <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 italic border-2 border-dashed border-slate-200">
                          Selecione um vídeo abaixo para reproduzir
                        </div>
                      )}

                      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <List className="w-5 h-5 text-blue-600" /> 
                          Coleção de Vídeos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedLesson.videos?.map((video: any, vIdx: number) => (
                            <button
                              key={vIdx}
                              onClick={() => setCurrentMultiVideoUrl(video.url)}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${currentMultiVideoUrl === video.url ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'}`}
                            >
                              <div className={`p-1.5 rounded-full ${currentMultiVideoUrl === video.url ? 'bg-blue-500' : 'bg-slate-100'}`}>
                                <PlayCircle className="w-4 h-4" />
                              </div>
                              <span className="font-medium text-sm line-clamp-1">{video.title || `Vídeo ${vIdx + 1}`}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedLesson.tipo === 'ao_vivo' && (
                    <div className="flex flex-col gap-6 mb-8">
                      {selectedLesson.url_video && (
                        <div className="aspect-video w-full bg-black rounded-xl overflow-hidden shadow-md">
                          <iframe 
                            src={getFormattedVideoUrl(selectedLesson.url_video)} 
                            className="w-full h-full border-0"
                            allowFullScreen
                            title="Live Player"
                          ></iframe>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 flex flex-col overflow-hidden" style={{ minHeight: '400px', maxHeight: '500px' }}>
                          <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
                             <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-blue-600"/> Chat ao vivo</h3>
                             {participantCount > 0 && (
                               <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 rounded-lg border border-green-100 text-[10px] font-bold">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                 {participantCount} {participantCount === 1 ? 'Participante' : 'Participantes'}
                               </div>
                             )}
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                             <div className="text-center text-xs text-slate-400 my-4">O chat foi iniciado. Seja respeitoso e siga as diretrizes.</div>
                             {chatMessages.map(msg => (
                               <div key={msg.id} className="text-sm">
                                 <span className="font-bold text-slate-700 mr-2">{msg.user_name}:</span>
                                 <span className="text-slate-600">{msg.text}</span>
                               </div>
                             ))}
                          </div>
                          <div className="bg-white border-t border-slate-200 p-3">
                             <div className="flex gap-2 relative">
                                <input 
                                  type="text" 
                                  placeholder="Diga algo..." 
                                  value={chatInput}
                                  onChange={e => setChatInput(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                                  className="w-full px-4 py-2 bg-slate-100 border-transparent rounded-full text-sm outline-none focus:bg-white focus:border-slate-300 border transition-colors pr-16" 
                                />
                                <button 
                                  onClick={sendChatMessage}
                                  disabled={!chatInput.trim()}
                                  className="absolute right-1.5 top-1.5 w-auto px-3 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Enviar</button>
                             </div>
                          </div>
                        </div>

                        <div className="lg:col-span-1">
                          <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex flex-col items-center justify-center gap-4 text-center h-full min-h-[200px]">
                             <div>
                               <h4 className="font-bold text-red-900 flex items-center justify-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div> 
                                 Confirmação de Presença
                               </h4>
                               {!isGestor && !attendanceWindow.active && !completedSteps.includes(selectedLesson._calculatedId) && (
                                 <p className="text-xs text-red-800 mt-2">A confirmação de presença será liberada pelo gestor durante a aula e ficará disponível por 3 minutos.</p>
                               )}
                               {(attendanceWindow.active || completedSteps.includes(selectedLesson._calculatedId) || isGestor) && (
                                 <p className="text-sm text-red-800 mt-2">Sua presença ficará registrada no relatório do curso.</p>
                               )}
                             </div>
                             
                             {isGestor ? (
                               <button 
                                 onClick={handleReleaseAttendance}
                                 disabled={attendanceWindow.active}
                                 className={`w-full py-3 rounded-xl font-bold transition-colors ${attendanceWindow.active ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white shadow-md'}`}
                               >
                                 {attendanceWindow.active ? `Liberado (${Math.floor(attendanceTimeLeft / 60)}:${String(attendanceTimeLeft % 60).padStart(2, '0')})` : 'Liberar Presença (3 min)'}
                               </button>
                             ) : (
                               <>
                                 {!attendanceWindow.active && !completedSteps.includes(selectedLesson._calculatedId) ? (
                                   <div className="w-full py-3 rounded-xl font-medium bg-red-100/50 text-red-500/50 cursor-not-allowed border border-red-200/50">
                                     Aguardando Liberação...
                                   </div>
                                 ) : (
                                   <button 
                                     onClick={() => {
                                       if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                          toggleStepComplete(selectedLesson._calculatedId);
                                          setAttendanceWindow({ active: false, expiresAt: null });
                                          goToNextStep();
                                       }
                                     }}
                                     className={`w-full py-3 rounded-xl font-bold transition-colors ${completedSteps.includes(selectedLesson._calculatedId) ? 'bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20'}`}
                                   >
                                      {completedSteps.includes(selectedLesson._calculatedId) ? 'Presença Confirmada' : `Confirmar Presença (${Math.floor(attendanceTimeLeft / 60)}:${String(attendanceTimeLeft % 60).padStart(2, '0')})`}
                                   </button>
                                 )}
                               </>
                             )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedLesson.descricao && selectedLesson.tipo !== 'quiz' && (
                    <div className="prose prose-slate max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: selectedLesson.descricao }} />
                  )}

                  {selectedLesson.tipo === 'quiz' && (
                    <div className="space-y-6">
                      {quizQuestions.length === 0 ? (
                        <div className="text-slate-500 italic p-6 bg-slate-50 rounded-lg text-center">
                          O instrutor não adicionou questões a este quiz ainda.
                        </div>
                      ) : (
                        <>
                          <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-blue-900 font-medium">Instruções</p>
                              <p className="text-sm text-blue-800 mt-1">Responda a todas as perguntas abaixo para concluir a etapa. Você pode tentar quantas vezes quiser, as respostas não precisam estar corretas para avançar.</p>
                            </div>
                          </div>
                          
                          <div className="space-y-8 mt-8">
                            {quizQuestions.map((q, qIdx) => {
                              const text = q.enunciado || q.texto || "";
                              const optionsList = q.opcoes && Array.isArray(q.opcoes) 
                                ? q.opcoes 
                                : [q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.opcao_e].filter(Boolean);
                              
                              const correctLetter = q.gabarito 
                                ? q.gabarito.toUpperCase() 
                                : (q.correta ? String.fromCharCode(65 + parseInt(q.correta, 10)) : '');

                              return (
                                <div key={q.id} className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                  <div className="p-5 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-medium text-slate-900"><span className="text-slate-500 mr-2">{qIdx + 1}.</span> {text}</h3>
                                  </div>
                                  <div className="p-5 space-y-3">
                                    {optionsList.map((optText, optIdx) => {
                                      if (!optText) return null;
                                      const letterChar = String.fromCharCode(65 + optIdx);
                                      const isSelected = quizAnswers[q.id] === letterChar;
                                      const isCorrect = correctLetter === letterChar;
                                      
                                      let optionClass = 'border-slate-200 hover:border-blue-300';
                                      let bgClass = 'bg-white';
                                      let circleClass = 'border-slate-300';
                                      
                                      if (quizSubmitted) {
                                        if (isSelected) {
                                          if (isCorrect) {
                                            optionClass = 'border-emerald-500';
                                            bgClass = 'bg-emerald-50';
                                            circleClass = 'border-emerald-500 bg-emerald-500 text-white';
                                          } else {
                                            optionClass = 'border-red-500';
                                            bgClass = 'bg-red-50';
                                            circleClass = 'border-red-500 bg-red-500 text-white';
                                          }
                                        } else if (isCorrect) {
                                          optionClass = 'border-emerald-500';
                                          bgClass = 'bg-emerald-50';
                                          circleClass = 'border-emerald-500 bg-emerald-500 text-white';
                                        }
                                      } else if (isSelected) {
                                        optionClass = 'border-blue-500 bg-blue-50';
                                        circleClass = 'border-blue-500 bg-blue-500 text-white';
                                      }
                                      
                                      return (
                                        <label 
                                          key={optIdx} 
                                          className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${optionClass} ${bgClass}`}
                                        >
                                          <input 
                                            type="radio" 
                                            name={`question_${q.id}`} 
                                            className="hidden" 
                                            disabled={quizSubmitted}
                                            checked={isSelected}
                                            onChange={() => {
                                              if (!quizSubmitted) {
                                                setQuizAnswers({...quizAnswers, [q.id]: letterChar});
                                              }
                                            }}
                                          />
                                          <div className={`mt-0.5 w-6 h-6 rounded-full border flex flex-shrink-0 items-center justify-center text-xs font-medium ${circleClass}`}>
                                            {!quizSubmitted && isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                            {(quizSubmitted && isSelected && isCorrect) && <Check className="w-3.5 h-3.5" />}
                                            {(quizSubmitted && isSelected && !isCorrect) && <X className="w-3.5 h-3.5" />}
                                            {(quizSubmitted && !isSelected && isCorrect) && <Check className="w-3.5 h-3.5" />}
                                            {(!isSelected && !quizSubmitted) && letterChar}
                                            {(quizSubmitted && !isSelected && !isCorrect) && letterChar}
                                          </div>
                                          <div className="flex-1">
                                            <p className={`text-sm ${quizSubmitted && isCorrect ? 'text-emerald-900 font-medium' : 'text-slate-700'}`}>{optText}</p>
                                            {quizSubmitted && ((isSelected && !isCorrect) || isCorrect) && q.justificativa && (
                                              <div className="mt-3 text-sm p-3 rounded-lg bg-white/50 border border-current opacity-80">
                                                <strong>Justificativa: </strong>{q.justificativa}
                                              </div>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>

                                  {/* AI EXPLANATION BOX */}
                                  {(() => {
                                    const correctLetter = q.gabarito 
                                      ? q.gabarito.toUpperCase() 
                                      : (q.correta ? String.fromCharCode(65 + parseInt(q.correta, 10)) : '');
                                    const selectedLetter = quizAnswers[q.id];
                                    const isIncorrect = selectedLetter !== correctLetter;

                                    if (quizSubmitted && isIncorrect) {
                                      return (
                                        <div className="mx-5 mb-5 p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                          {aiExplanations[q.id] ? (
                                            <div className="space-y-3">
                                              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                                                <Sparkles className="w-4 h-4 text-indigo-500 fill-indigo-100 animate-pulse" />
                                                <span>Explicação do Tutor de IA</span>
                                              </div>
                                              <div className="text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none">
                                                <Markdown remarkPlugins={[remarkGfm]}>
                                                  {aiExplanations[q.id].explicacao}
                                                </Markdown>
                                              </div>
                                              {aiExplanations[q.id].aulaRecomendada && (
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-indigo-100 rounded-xl mt-4 shadow-sm">
                                                  <div className="flex items-center gap-2.5">
                                                    <span className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                                                      <BookOpen size={16} />
                                                    </span>
                                                    <div>
                                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-1">Recomendação de Estudo</p>
                                                      <p className="text-xs font-bold text-slate-700 leading-tight">Rever aula: <span className="text-indigo-600">"{aiExplanations[q.id].aulaRecomendada}"</span></p>
                                                    </div>
                                                  </div>
                                                  <button
                                                    onClick={() => handleGoToRecommendedLesson(aiExplanations[q.id].aulaRecomendada!)}
                                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 self-end sm:self-auto"
                                                  >
                                                    Ir para Aula <ChevronRight size={14} />
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          ) : loadingExplanations[q.id] ? (
                                            <div className="flex items-center justify-center py-4 gap-3 text-slate-500">
                                              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                              <span className="text-sm font-semibold tracking-tight animate-pulse">Gerando explicação inteligente com IA...</span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                              <div>
                                                <h4 className="font-bold text-slate-800 text-sm">Ficou com dúvida nesta questão?</h4>
                                                <p className="text-slate-500 text-xs mt-0.5">O Tutor de IA pode explicar por que você errou e sugerir qual conteúdo revisar.</p>
                                              </div>
                                              <button
                                                onClick={() => handleRequestAiExplanation(q)}
                                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                                              >
                                                <Sparkles className="w-3.5 h-3.5" /> Pedir Explicação com IA
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                          
                          <div className="mt-8 flex justify-end gap-3">
                             {!quizSubmitted ? (
                               <button 
                                 disabled={Object.keys(quizAnswers).length !== quizQuestions.length}
                                 onClick={() => {
                                   let correctCount = 0;
                                   quizQuestions.forEach(q => {
                                     const correctLetter = q.gabarito 
                                       ? q.gabarito.toUpperCase() 
                                       : (q.correta ? String.fromCharCode(65 + parseInt(q.correta, 10)) : '');
                                     if (quizAnswers[q.id] === correctLetter) correctCount++;
                                   });
                                   const newScore = { correct: correctCount, total: quizQuestions.length };
                                   const newScoresObj = { [selectedLesson._calculatedId]: newScore };
                                   
                                   setQuizScores(prev => ({...prev, ...newScoresObj}));
                                   setQuizSubmitted(true);
                                   
                                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                     toggleStepComplete(selectedLesson._calculatedId, newScoresObj);
                                   } else {
                                     // Just force update db with new scores
                                     syncProgressToDb(selectedCurso, completedSteps, { ...quizScores, ...newScoresObj });
                                   }
                                 }}
                                 className={`px-8 py-3 rounded-full font-medium text-white transition-colors ${Object.keys(quizAnswers).length !== quizQuestions.length ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-md'}`}
                               >
                                 Enviar Respostas
                               </button>
                             ) : (
                               <>
                                 {(() => {
                                   let correctCount = 0;
                                   quizQuestions.forEach(q => {
                                     const correctLetter = q.gabarito 
                                       ? q.gabarito.toUpperCase() 
                                       : (q.correta ? String.fromCharCode(65 + parseInt(q.correta, 10)) : '');
                                     if (quizAnswers[q.id] === correctLetter) correctCount++;
                                   });
                                   const scorePercentage = quizQuestions.length > 0 ? (correctCount / quizQuestions.length) : 0;
                                   if (scorePercentage < 0.5) {
                                     return (
                                       <button 
                                         onClick={() => {
                                           setQuizSubmitted(false);
                                           setQuizAnswers({});
                                         }}
                                         className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-full font-medium hover:bg-slate-50 transition-colors shadow-sm"
                                       >
                                         Tentar Novamente
                                       </button>
                                     );
                                   }
                                   return null;
                                 })()}
                                 <button 
                                   onClick={() => {
                                      if (!completedSteps.includes(selectedLesson._calculatedId)) {
                                         toggleStepComplete(selectedLesson._calculatedId);
                                      }
                                      if (isLastStep) {
                                         setView('list');
                                         setSelectedLesson(null);
                                      } else {
                                         goToNextStep();
                                      }
                                   }}
                                   className="px-8 py-3 bg-blue-600 border border-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                 >
                                    {isLastStep ? (
                                      <>Concluir Etapa <CheckCircle className="w-5 h-5"/></>
                                    ) : (
                                      <>Próxima Etapa <ChevronRight className="w-5 h-5"/></>
                                    )}
                                 </button>
                               </>
                             )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {!selectedLesson.url_video && !selectedLesson.descricao && selectedLesson.tipo !== 'quiz' && (
                     <div className="text-slate-500 italic p-6 bg-slate-50 rounded-lg text-center">Nenhum conteúdo disponível para esta etapa.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-10 max-w-5xl mx-auto">
                {/* Mobile Back Button for Overview */}
                <button 
                  onClick={() => setView('list')}
                  className="flex md:hidden items-center gap-2 text-blue-600 font-bold mb-6"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Voltar para cursos
                </button>

                <div className="flex flex-col gap-8 mb-10">
                  <div className="w-full aspect-video bg-slate-100 rounded-2xl border border-slate-200 bg-cover bg-center shadow-lg overflow-hidden flex items-center justify-center" style={{ backgroundImage: selectedCurso.thumbnail_url ? `url("${selectedCurso.thumbnail_url}")` : undefined }}>
                    {!selectedCurso.thumbnail_url && (
                       <div className="text-4xl font-bold text-slate-300 uppercase tracking-widest">{selectedCurso.nome}</div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-6">
                    <div>
                      <h1 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight leading-tight">{selectedCurso.nome}</h1>
                      <div className="flex flex-wrap items-center gap-3 text-sm mb-6">
                        {selectedCurso.carga_horaria && (
                          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200">
                            <Clock className="w-4 h-4" /> {selectedCurso.carga_horaria}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200 capitalize">
                          <RefreshCcw className="w-4 h-4" /> {selectedCurso.ritmo === 'programado' ? 'Programado' : 'Ritmo próprio'}
                        </div>
                        {selectedCurso.tempo && (
                          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-bold border border-slate-200">
                            <Calendar className="w-4 h-4" /> {selectedCurso.tempo === 'com_limite' ? `${selectedCurso.duracao} ${selectedCurso.duracao_tipo}` : 'Sem limite de tempo'}
                          </div>
                        )}
                        {selectedCurso.tem_certificado && (
                          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-bold border border-emerald-200">
                            <Award className="w-4 h-4" /> Certificado Incluso
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 text-slate-100 group-hover:text-slate-200 transition-colors pointer-events-none">
                        <Info className="w-32 h-32 rotate-12" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                          <FileText className="w-4 h-4" />
                        </div>
                        Sobre este curso
                      </h3>
                      <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed font-medium">
                        {selectedCurso.descricao || 'Nenhuma descrição detalhada fornecida para este curso.'}
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4">
                       {progressoPercent >= 100 && selectedCurso.tem_certificado && (
                         <button
                           onClick={() => handleDownloadCertificate(selectedCurso)}
                           disabled={isGeneratingCert}
                           className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-lg hover:from-amber-600 hover:to-orange-600 hover:scale-105 transition-all shadow-xl shadow-amber-500/30 active:scale-95 disabled:opacity-70 disabled:cursor-wait"
                         >
                           {isGeneratingCert ? (
                             <><Loader2 className="w-6 h-6 animate-spin" /> Gerando PDF...</>
                           ) : (
                             <><Trophy className="w-6 h-6" /> Baixar Certificado</>
                           )}
                         </button>
                       )}
                       {progressoPercent < 100 && (
                         <button 
                           onClick={() => {
                              if (selectedCurso.curriculo_json && selectedCurso.curriculo_json[0]?.etapas?.[0]) {
                                 const firstStep = selectedCurso.curriculo_json[0].etapas[0];
                                 setSelectedLesson({ ...firstStep, _calculatedId: getStepId(firstStep, 0, 0), cursoNome: selectedCurso.nome, secaoNome: selectedCurso.curriculo_json[0].nome, secaoIdx: 0, etapaIdx: 0 });
                                 setExpandedSections({ 0: true });
                              }
                           }}
                           className="flex items-center gap-3 px-12 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                         >
                           {progressoPercent > 0 ? 'Continuar de onde parei' : 'Iniciar curso agora'} <ChevronRight className="w-6 h-6" />
                         </button>
                       )}
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          {selectedLesson && (
            <div className="border-t border-slate-200 bg-white p-4 flex flex-col sm:flex-row justify-between items-center gap-4 sticky bottom-0">
              <button 
                disabled={userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))}
                onClick={() => {
                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                      toggleStepComplete(selectedLesson._calculatedId);
                      goToNextStep();
                   } else {
                      toggleStepComplete(selectedLesson._calculatedId);
                   }
                }}
                className={`flex items-center gap-2 font-medium text-sm transition-colors ${
                  userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-blue-600 hover:underline'
                }`}
              >
                {completedSteps.includes(selectedLesson._calculatedId) ? (
                  <><RefreshCcw className="w-4 h-4" /> Desfazer etapa</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Marcar como concluída</>
                )}
              </button>
              
              <button 
                disabled={userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))}
                onClick={() => {
                   if (!completedSteps.includes(selectedLesson._calculatedId)) {
                      toggleStepComplete(selectedLesson._calculatedId);
                   }
                   if (isLastStep) {
                      setView('list');
                      setSelectedLesson(null);
                   } else {
                      goToNextStep();
                   }
                }}
                className={`w-full sm:w-auto px-8 py-2.5 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors ${
                  userRole !== 'avaliador' && ((selectedLesson.tipo === 'video' && videoSettings?.assistirObrigatorio && !videoWatched) || (selectedLesson.tipo === 'ao_vivo' && !completedSteps.includes(selectedLesson._calculatedId)))
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isLastStep ? (
                  <>Concluir <CheckCircle className="w-5 h-5"/></>
                ) : (
                  <>Próximo <ChevronRight className="w-5 h-5"/></>
                )}
              </button>
            </div>
          )}

          {/* AI Tutor Chat Toggle Button */}
          {selectedLesson && (
            <button 
              onClick={() => {
                setIsTutorOpen(!isTutorOpen);
              }}
              className="absolute bottom-20 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all z-[90] active:scale-95 border border-purple-500"
              title="Conversar com Tutor de IA"
            >
              {isTutorOpen ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </button>
          )}

          {/* AI Tutor Chat Panel */}
          {selectedLesson && isTutorOpen && (
            <div className="absolute right-0 top-0 bottom-0 w-80 md:w-96 bg-white border-l border-slate-200 shadow-2xl z-[85] flex flex-col animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                  <span className="font-bold text-slate-800 text-sm">Tutor de IA - Segunda Gaveta</span>
                </div>
                <button onClick={() => setIsTutorOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {tutorMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isTutorLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-400 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm flex items-center gap-2 shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Tutor pensando...</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Input Area */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!tutorInput.trim() || isTutorLoading) return;
                  
                  const text = tutorInput.trim();
                  setTutorInput('');
                  
                  // Append user message
                  const newMsg: any = { role: 'user', content: text };
                  setTutorMessages(prev => [...prev, newMsg]);
                  
                  try {
                    setIsTutorLoading(true);
                    const response = await fetch('/api/ai/tutor-chat', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message_history: tutorMessages,
                        user_message: text,
                        lesson_context: selectedLesson.descricao || selectedLesson.nome || ''
                      })
                    });
                    
                    if (!response.ok) throw new Error('Erro ao obter resposta do tutor.');
                    
                    const data = await response.json();
                    setTutorMessages(prev => [...prev, { role: 'model', content: data.response }]);
                  } catch (err: any) {
                    console.error(err);
                    setTutorMessages(prev => [...prev, { role: 'model', content: 'Desculpe, tive um problema ao tentar responder agora. Tente novamente mais tarde.' }]);
                  } finally {
                    setIsTutorLoading(false);
                  }
                }}
                className="p-3 border-t border-slate-200 bg-white flex gap-2"
              >
                <input 
                  type="text"
                  value={tutorInput}
                  onChange={(e) => setTutorInput(e.target.value)}
                  placeholder="Tire suas dúvidas sobre esta aula..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
                <button 
                  type="submit" 
                  disabled={!tutorInput.trim() || isTutorLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Enviar
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Certificate Celebration Modal */}
        <CertificateCelebrationModal
          isOpen={showCertModal}
          onClose={() => setShowCertModal(false)}
          curso={certModalCurso}
          candidateName={certCandidateName}
          participationId={certParticipationId}
          onDownload={handleDownloadCertificate}
          isGenerating={isGeneratingCert}
        />
      </div>
    );
  }

  return null;
}

// ─── Certificate Celebration Modal ───────────────────────────────────────────
interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  curso: any;
  candidateName: string;
  participationId: string;
  onDownload: (curso: any, name: string, partId: string) => void;
  isGenerating: boolean;
}

function CertificateCelebrationModal({ isOpen, onClose, curso, candidateName, participationId, onDownload, isGenerating }: CertificateModalProps) {
  const stars = Array.from({ length: 20 });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          {/* Confetti stars */}
          {stars.map((_, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              initial={{
                opacity: 1,
                x: Math.random() * window.innerWidth,
                y: -20,
                rotate: 0,
                scale: Math.random() * 0.8 + 0.4
              }}
              animate={{
                y: window.innerHeight + 40,
                rotate: Math.random() * 720 - 360,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: Math.random() * 2 + 1.5,
                delay: Math.random() * 0.8,
                ease: 'easeIn'
              }}
            >
              <Star
                size={i % 3 === 0 ? 20 : i % 3 === 1 ? 14 : 10}
                className="fill-current"
                style={{
                  color: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][i % 6]
                }}
              />
            </motion.div>
          ))}

          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Header gradient */}
            <div className="relative bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 p-10 text-center overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full bg-white"
                    style={{
                      width: `${60 + i * 40}px`,
                      height: `${60 + i * 40}px`,
                      top: `${-20 + i * 15}%`,
                      left: `${-10 + i * 18}%`,
                    }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </div>
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', delay: 0.2, damping: 12 }}
                className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 relative z-10 border-4 border-white/40"
              >
                <Trophy className="w-12 h-12 text-white" strokeWidth={1.5} />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-black text-white relative z-10 leading-tight"
              >
                Parabéns! 🎉
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="text-white/90 font-semibold mt-1 relative z-10"
              >
                Você concluiu o curso com sucesso!
              </motion.p>
            </div>

            {/* Body */}
            <div className="p-8 text-center space-y-6">
              <div>
                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-1">Certificado de Conclusão</p>
                <p className="text-2xl font-black text-slate-900 leading-tight">{curso?.nome}</p>
                <p className="text-slate-500 mt-2 text-sm">
                  Emitido para <span className="font-bold text-slate-700">{candidateName}</span>
                </p>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-amber-700 uppercase tracking-wider">Seu certificado está pronto!</p>
                  <p className="text-sm text-amber-800 mt-0.5">Baixe o PDF oficial com QR Code de autenticidade.</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => onDownload(curso, candidateName, participationId)}
                  disabled={isGenerating}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-500/30 disabled:opacity-70 disabled:cursor-wait"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Gerando PDF...</>
                  ) : (
                    <><Download className="w-5 h-5" /> Baixar Certificado PDF</>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all"
                >
                  Continuar navegando
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
