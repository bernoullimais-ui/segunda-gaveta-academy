import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList, Lock, CheckCircle2, Clock, Send, MessageSquare,
  ChevronRight, ChevronLeft, Download, Loader2, Save, AlertCircle, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { CampoRenderer } from './CampoRenderer';
import { exportarProjetoPDF } from '../lib/projetoUtils';
import { buildGlobalValuesMap } from '../lib/formulaParser';
import type { ProjetoTemplate, ProjetoMissao, ProjetoResposta, ProjetoStatus } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type MissaoComStatus = ProjetoMissao & {
  statusAluno: 'bloqueada' | ProjetoStatus;
  resposta?: ProjetoResposta;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_UI: Record<string, { label: string; color: string; dot: string; icon: React.ReactNode }> = {
  bloqueada:    { label: 'Bloqueada',     color: 'text-slate-400', dot: 'bg-slate-200',  icon: <Lock className="w-4 h-4" /> },
  rascunho:     { label: 'Em andamento',  color: 'text-amber-600', dot: 'bg-amber-400',  icon: <Clock className="w-4 h-4" /> },
  submetido:    { label: 'Submetida',     color: 'text-blue-600',  dot: 'bg-blue-500',   icon: <Send className="w-4 h-4" /> },
  com_feedback: { label: 'Com Feedback',  color: 'text-green-600', dot: 'bg-green-500',  icon: <MessageSquare className="w-4 h-4" /> },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjetoAlunoProps {
  cursoId: string;
  userId: string;
  nomeAluno: string;
  nomeCurso: string;
  completedSteps: string[];        // etapas concluídas pelo aluno (do CursosCandidato)
  watchedPercent?: Record<string, number>; // { etapaId: percent }
  curriculo: any[];                // curriculo_json do curso
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  onClose?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjetoAluno({
  cursoId,
  userId,
  nomeAluno,
  nomeCurso,
  completedSteps,
  watchedPercent = {},
  curriculo,
  showToast,
  onClose,
}: ProjetoAlunoProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [template, setTemplate] = useState<ProjetoTemplate | null>(null);
  const [missoes, setMissoes] = useState<MissaoComStatus[]>([]);
  const [selectedMissaoIdx, setSelectedMissaoIdx] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Helper: verificar se etapa foi concluída na seção ──────────────────────
  const concluiuSecaoDeEtapa = useCallback((gatilhoId: string) => {
    // Encontra a seção que contém a etapa
    for (let sIdx = 0; sIdx < curriculo.length; sIdx++) {
      const secao = curriculo[sIdx];
      const etapas = secao.etapas || [];
      const found = etapas.some((e: any, eIdx: number) => {
        const id = e.id || `step-${sIdx}-${eIdx}`;
        return id === gatilhoId;
      });
      if (found) {
        // Verifica se TODAS as etapas da seção foram concluídas
        return etapas.every((e: any, eIdx: number) => {
          const id = e.id || `step-${sIdx}-${eIdx}`;
          return completedSteps.includes(id);
        });
      }
    }
    return false;
  }, [curriculo, completedSteps]);

  // ── Helper: verificar se missão está desbloqueada ─────────────────────────
  const isMissaoDesbloqueada = useCallback((missao: ProjetoMissao): boolean => {
    if (!missao.gatilho_etapa_id) return true; // sem gatilho = sempre disponível

    switch (missao.gatilho_tipo) {
      case 'concluir_etapa':
        return completedSteps.includes(missao.gatilho_etapa_id);
      case 'assistir_70':
        return (watchedPercent[missao.gatilho_etapa_id] || 0) >= 70;
      case 'concluir_secao':
        return concluiuSecaoDeEtapa(missao.gatilho_etapa_id);
      default:
        return false;
    }
  }, [completedSteps, watchedPercent, concluiuSecaoDeEtapa]);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadProjeto = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: tpl } = await supabase
        .from('projeto_conclusao_templates')
        .select('*')
        .eq('curso_id', cursoId)
        .eq('ativo', true)
        .maybeSingle();

      if (!tpl) { setTemplate(null); setIsLoading(false); return; }
      setTemplate(tpl);

      const { data: miss } = await supabase
        .from('projeto_conclusao_missoes')
        .select('*')
        .eq('template_id', tpl.id)
        .order('ordem');

      const { data: resps } = await supabase
        .from('projeto_conclusao_respostas')
        .select('*')
        .eq('usuario_id', userId)
        .eq('curso_id', cursoId);

      const respostasMap: Record<string, ProjetoResposta> = {};
      (resps || []).forEach(r => { respostasMap[r.missao_id] = r; });

      const missoesComStatus: MissaoComStatus[] = (miss || []).map(m => {
        const resposta = respostasMap[m.id];
        const desbloqueada = !tpl.bloqueio_estrito || isMissaoDesbloqueada(m);
        return {
          ...m,
          campos_json: m.campos_json || [],
          statusAluno: !desbloqueada ? 'bloqueada' : (resposta?.status || 'rascunho'),
          resposta,
        };
      });

      // Abrir primeira disponível por default se nenhuma estiver selecionada
      setMissoes(missoesComStatus);
      setSelectedMissaoIdx(currentIdx => {
        if (currentIdx !== null && missoesComStatus[currentIdx] && missoesComStatus[currentIdx].statusAluno !== 'bloqueada') {
          return currentIdx;
        }
        const firstIdx = missoesComStatus.findIndex(m => m.statusAluno !== 'bloqueada');
        return firstIdx >= 0 ? firstIdx : null;
      });

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [cursoId, userId, isMissaoDesbloqueada]);

  useEffect(() => { loadProjeto(); }, [cursoId, userId]);

  // ── Quando muda de missão, carregar rascunho ───────────────────────────────
  useEffect(() => {
    if (selectedMissaoIdx === null) return;
    const m = missoes[selectedMissaoIdx];
    if (!m) return;
    setRascunho(m.resposta?.respostas_json || {});
  }, [selectedMissaoIdx]);

  // ── Auto-save rascunho a cada 30s ─────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { salvarRascunho(false); }, 30000);
  }, []);

  const handleFieldChange = (campoId: string, value: any) => {
    setRascunho(prev => ({ ...prev, [campoId]: value }));
    triggerAutoSave();
  };

  const respostasMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    missoes.forEach(m => {
      if (m.resposta) map[m.id] = m.resposta;
    });
    return map;
  }, [missoes]);

  const currentMissaoId = selectedMissaoIdx !== null ? missoes[selectedMissaoIdx]?.id : undefined;

  const globalValues = React.useMemo(() => {
    // dynamically imported here to avoid issues, or we can just import it at top.
    // wait, we need to import it at the top of the file!
    return buildGlobalValuesMap(missoes, respostasMap, currentMissaoId, rascunho);
  }, [missoes, respostasMap, currentMissaoId, rascunho]);

  // ── Salvar rascunho ────────────────────────────────────────────────────────
  const salvarRascunho = async (showMsg = true) => {
    if (selectedMissaoIdx === null) return;
    const m = missoes[selectedMissaoIdx];
    if (!m || m.statusAluno === 'bloqueada') return;
    setIsSaving(true);
    
    // Incluir campos calculados atualizados no rascunho a ser salvo
    const rascunhoToSave = { ...rascunho };
    (m.campos_json || []).forEach(c => {
      if (c.tipo === 'calculado') {
        rascunhoToSave[c.id] = globalValues[c.id];
      }
    });
    try {
      await supabase.from('projeto_conclusao_respostas').upsert({
        missao_id: m.id,
        usuario_id: userId,
        curso_id: cursoId,
        respostas_json: rascunhoToSave,
        status: m.resposta?.status === 'com_feedback' || m.resposta?.status === 'submetido'
          ? m.resposta.status
          : 'rascunho',
        feedback_publicado: m.resposta?.feedback_publicado || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'missao_id,usuario_id' });

      if (showMsg) showToast('Rascunho salvo!', 'success');
      await loadProjeto();
    } catch (e: any) {
      if (showMsg) showToast('Erro ao salvar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Submeter missão ────────────────────────────────────────────────────────
  const submeterMissao = async () => {
    if (selectedMissaoIdx === null) return;
    const m = missoes[selectedMissaoIdx];
    if (!m) return;

    // Validar campos obrigatórios
    const camposObrigatorios = m.campos_json.filter(c => c.obrigatorio);
    const faltando = camposObrigatorios.filter(c => {
      // calculado não pode ser vazio pois tem fallback para 0, e geralmente não é obrigatório de digitar,
      // mas se for checado, globalValues tem a resposta
      const v = c.tipo === 'calculado' ? globalValues[c.id] : rascunho[c.id];
      if (v === null || v === undefined || v === '') return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });
    if (faltando.length > 0) {
      showToast(`Preencha os campos obrigatórios: ${faltando.map(c => c.label).join(', ')}`, 'error');
      return;
    }

    setIsSubmitting(true);
    
    // Incluir campos calculados atualizados no rascunho a ser salvo
    const rascunhoToSave = { ...rascunho };
    (m.campos_json || []).forEach(c => {
      if (c.tipo === 'calculado') {
        rascunhoToSave[c.id] = globalValues[c.id];
      }
    });

    try {
      await supabase.from('projeto_conclusao_respostas').upsert({
        missao_id: m.id,
        usuario_id: userId,
        curso_id: cursoId,
        respostas_json: rascunhoToSave,
        status: 'submetido',
        feedback_publicado: m.resposta?.feedback_publicado || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'missao_id,usuario_id' });

      showToast('✅ Missão submetida com sucesso!', 'success');
      await loadProjeto();
    } catch (e: any) {
      showToast('Erro ao submeter: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!template) return;
    const respostas = missoes.map(m => m.resposta).filter(Boolean) as ProjetoResposta[];
    await exportarProjetoPDF({ template, missoes, respostas, nomeAluno, nomeCurso });
  };

  // ── Progress geral ─────────────────────────────────────────────────────────
  const totalMissoes = missoes.length;
  const missoesConcluidas = missoes.filter(m => m.statusAluno === 'submetido' || m.statusAluno === 'com_feedback').length;
  const progressPercent = totalMissoes > 0 ? Math.round((missoesConcluidas / totalMissoes) * 100) : 0;

  const selectedMissao = selectedMissaoIdx !== null ? missoes[selectedMissaoIdx] : null;

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <ClipboardList className="w-12 h-12 text-slate-200" />
        <p className="text-slate-400 text-sm">Nenhum projeto de conclusão disponível neste curso.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-0 overflow-hidden w-full relative">
      {/* ── Sidebar — lista de missões ─────────────────────────────────────── */}
      <div className={`w-full md:w-64 shrink-0 border-r border-slate-200 bg-white flex-col ${selectedMissaoIdx !== null ? 'hidden md:flex' : 'flex'}`}>
        {/* Header sidebar */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            {onClose && (
              <button onClick={onClose} className="md:hidden p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800 rounded">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <ClipboardList className="w-4 h-4 text-blue-600 shrink-0 hidden md:block" />
            <h3 className="font-bold text-slate-900 text-sm truncate">{template.titulo}</h3>
          </div>
          {template.descricao && (
            <p className="text-xs text-slate-500 leading-relaxed mb-3">{template.descricao}</p>
          )}
          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{missoesConcluidas}/{totalMissoes} missões</span>
              <span className="font-semibold text-blue-600">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>

        {/* Lista de missões */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {missoes.map((m, idx) => {
            const st = STATUS_UI[m.statusAluno];
            const isSelected = selectedMissaoIdx === idx;
            return (
              <button
                key={m.id}
                onClick={() => {
                  if (m.statusAluno === 'bloqueada' && template.bloqueio_estrito) return;
                  setSelectedMissaoIdx(idx);
                }}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-blue-50 border border-blue-200'
                    : m.statusAluno === 'bloqueada' && template.bloqueio_estrito
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                  <span className={`text-xs font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>
                    Missão {idx + 1}
                  </span>
                </div>
                <p className={`text-xs font-bold truncate ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                  {m.titulo}
                </p>
                <p className={`text-xs mt-0.5 flex items-center gap-1 ${st.color}`}>
                  {st.icon}
                  {st.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Export PDF */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleExportPDF}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar projeto (PDF)
          </button>
        </div>
      </div>

      {/* ── Main — formulário da missão ────────────────────────────────────── */}
      <div className={`flex-1 overflow-y-auto bg-slate-50/30 w-full ${selectedMissao === null ? 'hidden md:block' : 'block'}`}>
        <AnimatePresence mode="wait">
          {selectedMissao === null ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center p-8 gap-4"
            >
              <ClipboardList className="w-12 h-12 text-slate-200" />
              <p className="text-slate-400 text-sm">Selecione uma missão para começar.</p>
            </motion.div>
          ) : selectedMissao.statusAluno === 'bloqueada' ? (
            <motion.div
              key={`bloqueada-${selectedMissao.id}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full text-center p-8 gap-4"
            >
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-1">Missão bloqueada</h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  {selectedMissao.gatilho_tipo === 'concluir_etapa' && 'Conclua a aula gatilho para desbloquear esta missão.'}
                  {selectedMissao.gatilho_tipo === 'assistir_70' && 'Assista pelo menos 70% do vídeo da aula gatilho para desbloquear.'}
                  {selectedMissao.gatilho_tipo === 'concluir_secao' && 'Conclua todas as aulas da seção para desbloquear esta missão.'}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={selectedMissao.id}
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto p-4 md:p-6 space-y-5 md:space-y-6"
            >
              {/* Botão de voltar (apenas mobile) */}
              <button onClick={() => setSelectedMissaoIdx(null)} className="md:hidden flex items-center text-blue-600 font-semibold text-sm">
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar às missões
              </button>

              {/* Header da missão */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">
                    Missão {selectedMissaoIdx! + 1}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    STATUS_UI[selectedMissao.statusAluno].color
                  } bg-slate-100`}>
                    {STATUS_UI[selectedMissao.statusAluno].icon}
                    {STATUS_UI[selectedMissao.statusAluno].label}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">{selectedMissao.titulo}</h2>
                {selectedMissao.descricao && (
                  <p className="text-sm text-slate-500 mt-1 italic">{selectedMissao.descricao}</p>
                )}
              </div>

              {/* Feedback do especialista (se houver e publicado) */}
              {selectedMissao.resposta?.feedback_geral && selectedMissao.resposta?.feedback_publicado && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3"
                >
                  <MessageSquare className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-green-800 mb-1">Feedback do especialista</p>
                    <p className="text-sm text-green-700 whitespace-pre-line">{selectedMissao.resposta.feedback_geral}</p>
                  </div>
                </motion.div>
              )}

              {/* Campos */}
              {selectedMissao.campos_json.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-white rounded-xl border border-dashed border-slate-200">
                  Esta missão ainda não tem campos configurados.
                </div>
              ) : (
                <div className="space-y-5 bg-white rounded-2xl border border-slate-200 p-6">
                  {selectedMissao.campos_json.map(campo => (
                    <CampoRenderer
                      key={campo.id}
                      campo={campo}
                      value={campo.tipo === 'calculado' ? globalValues[campo.id] : rascunho[campo.id]}
                      onChange={handleFieldChange}
                      readOnly={selectedMissao.statusAluno === 'submetido'}
                      feedbackInline={
                        selectedMissao.resposta?.feedback_publicado
                          ? selectedMissao.resposta?.feedbacks_campos_json?.[campo.id]
                          : undefined
                      }
                      cursoId={cursoId}
                      userId={userId}
                    />
                  ))}
                </div>
              )}

              {/* Ações */}
              {selectedMissao.statusAluno !== 'submetido' && selectedMissao.campos_json.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => salvarRascunho()}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar rascunho
                  </button>
                  <button
                    onClick={submeterMissao}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submeter missão
                  </button>
                </div>
              )}

              {/* Missão submetida sem resubmissão */}
              {selectedMissao.statusAluno === 'submetido' && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-800">Missão submetida</p>
                    <p className="text-xs text-blue-600">Aguardando feedback do especialista.</p>
                  </div>
                </div>
              )}

              {/* Missão com feedback */}
              {selectedMissao.statusAluno === 'com_feedback' && !selectedMissao.resposta?.feedback_publicado && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <MessageSquare className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Feedback em preparação</p>
                    <p className="text-xs text-green-600">O especialista está preparando o feedback.</p>
                  </div>
                </div>
              )}

              {/* Navegação entre missões */}
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setSelectedMissaoIdx(i => (i !== null && i > 0) ? i - 1 : i)}
                  disabled={selectedMissaoIdx === 0}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <button
                  onClick={() => setSelectedMissaoIdx(i => (i !== null && i < missoes.length - 1) ? i + 1 : i)}
                  disabled={selectedMissaoIdx === missoes.length - 1}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
