import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList, Plus, Trash2, ChevronDown, ChevronUp, Settings, Users,
  CheckCircle2, Clock, FileText, Lock, Send, MessageSquare, Download,
  Eye, Search, GripVertical, X, Save, AlertCircle, ToggleLeft, ToggleRight,
  Loader2, UserPlus, UserMinus, ExternalLink, Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import { CampoRenderer } from './CampoRenderer';
import { exportarProjetoPDF } from '../lib/projetoUtils';
import type {
  ProjetoTemplate, ProjetoMissao, ProjetoResposta, ProjetoDelegacao,
  CampoConfig, CampoTipo
} from '../types';

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const CAMPO_TIPOS: { tipo: CampoTipo; label: string; icon: string }[] = [
  { tipo: 'texto_curto',  label: 'Texto curto',      icon: '✏️' },
  { tipo: 'texto_longo',  label: 'Texto longo',       icon: '📝' },
  { tipo: 'numero',       label: 'Número',             icon: '🔢' },
  { tipo: 'checkbox',     label: 'Checkbox múltiplo', icon: '☑️' },
  { tipo: 'selecao_unica',label: 'Seleção única',     icon: '🔘' },
  { tipo: 'data',         label: 'Data',               icon: '📅' },
  { tipo: 'tabela',       label: 'Tabela',             icon: '📊' },
  { tipo: 'upload',       label: 'Upload de arquivo',  icon: '📎' },
  { tipo: 'calculado',    label: 'Calculado (Fórmula)',icon: '🧮' },
];

const GATILHO_LABELS: Record<string, string> = {
  concluir_etapa: 'Concluir a aula',
  assistir_70: 'Assistir 70% do vídeo',
  concluir_secao: 'Concluir toda a seção',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  bloqueada:    { label: 'Bloqueada',    color: 'text-slate-400 bg-slate-100',  icon: <Lock className="w-3.5 h-3.5" /> },
  rascunho:     { label: 'Rascunho',    color: 'text-amber-700 bg-amber-100',  icon: <Clock className="w-3.5 h-3.5" /> },
  submetido:    { label: 'Submetida',   color: 'text-blue-700 bg-blue-100',    icon: <Send className="w-3.5 h-3.5" /> },
  com_feedback: { label: 'Com Feedback',color: 'text-green-700 bg-green-100',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
};

interface ProjetoAdminProps {
  cursoId: string;
  orgId?: string;
  nomeCurso?: string;
  curriculo?: any[];
  loggedUser?: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

function CampoEditorModal({
  campo, onSave, onClose, missoes
}: {
  campo: Partial<CampoConfig> | null;
  onSave: (c: CampoConfig) => void;
  onClose: () => void;
  missoes: ProjetoMissao[];
}) {
  const [form, setForm] = useState<Partial<CampoConfig>>(campo || { tipo: 'texto_curto', label: '', obrigatorio: false });
  const [opcoesText, setOpcoesText] = useState((campo?.opcoes || []).join('\n'));
  const [colunasText, setColunasText] = useState((campo?.colunas || []).join('\n'));
  const [rotulosText, setRotulosText] = useState((campo?.linhas_rotulos || []).join('\n'));
  const [formulaText, setFormulaText] = useState(campo?.formula || '');
  const formulaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inp = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  const insertIntoFormula = (textToInsert: string) => {
    const el = formulaTextareaRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = formulaText;
      
      let prefix = '';
      if (textToInsert.startsWith('=')) {
        // Se estiver inserindo uma função que começa com '=' e já tem '=', remove o '='
        if (current.trim().startsWith('=')) {
          textToInsert = textToInsert.substring(1);
        } else if (start === 0) {
          // Se for o começo de tudo, mantém '='
        }
      }
      
      const newValue = current.substring(0, start) + textToInsert + current.substring(end);
      setFormulaText(newValue);
      
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
      }, 0);
    } else {
      setFormulaText(f => f ? f + textToInsert : (textToInsert.startsWith('=') ? textToInsert : '=' + textToInsert));
    }
  };
  const handleSave = () => {
    if (!form.label?.trim()) return;
    const c: CampoConfig = {
      id: form.id || genId(), tipo: form.tipo || 'texto_curto', label: form.label.trim(),
      placeholder: form.placeholder || undefined, obrigatorio: !!form.obrigatorio,
      unidade: form.unidade || undefined,
      opcoes: ['checkbox','selecao_unica'].includes(form.tipo||'') ? opcoesText.split('\n').map(o=>o.trim()).filter(Boolean) : undefined,
      colunas: form.tipo==='tabela' ? colunasText.split('\n').map(c=>c.trim()).filter(Boolean) : undefined,
      linhas_rotulos: form.tipo==='tabela' ? rotulosText.split('\n').map(c=>c.trim()).filter(Boolean) : undefined,
      linhas: form.tipo==='tabela' ? (form.linhas||5) : undefined,
      formula: form.tipo==='calculado' ? formulaText.trim() : undefined,
    };
    onSave(c);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">{form.id ? 'Editar campo' : 'Novo campo'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Tipo de campo</label>
          <div className="grid grid-cols-2 gap-2">
            {CAMPO_TIPOS.map(t => (
              <button key={t.tipo} type="button" onClick={()=>setForm(f=>({...f,tipo:t.tipo}))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${form.tipo===t.tipo?'border-blue-500 bg-blue-50 text-blue-700 font-semibold':'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Label *</label>
          <input className={inp} placeholder="Ex: Nome do studio" value={form.label||''} onChange={e=>setForm(f=>({...f,label:e.target.value}))} /></div>
        <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Placeholder / dica</label>
          <input className={inp} placeholder="Ex: Digite o nome..." value={form.placeholder||''} onChange={e=>setForm(f=>({...f,placeholder:e.target.value}))} /></div>
        {['numero', 'calculado'].includes(form.tipo||'')&&(<div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Unidade (ex: R$, %)</label>
          <input className={inp} placeholder="R$" value={form.unidade||''} onChange={e=>setForm(f=>({...f,unidade:e.target.value}))} /></div>)}
        {['checkbox','selecao_unica'].includes(form.tipo||'')&&(<div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Opções (uma por linha)</label>
          <textarea className={`${inp} resize-none`} rows={4} value={opcoesText} onChange={e=>setOpcoesText(e.target.value)} placeholder={"Sim\nNão\nParcialmente"} /></div>)}
        {form.tipo==='tabela'&&(<><div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Colunas (uma por linha)</label>
          <textarea className={`${inp} resize-none`} rows={3} value={colunasText} onChange={e=>setColunasText(e.target.value)} placeholder={"Canal\nQuantidade"} /></div>
          <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Rótulos da 1ª Coluna (Opcional, um por linha)</label>
          <textarea className={`${inp} resize-none`} rows={3} value={rotulosText} onChange={e=>setRotulosText(e.target.value)} placeholder={"Ex: Clientes\nFaturamento"} /></div>
          <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Nº de linhas</label>
          <input className={inp} type="number" min={1} max={20} value={form.linhas||5} onChange={e=>setForm(f=>({...f,linhas:Number(e.target.value)}))} /></div></>)}
        {form.tipo==='calculado'&&(
          <>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Fórmula</label>
              <textarea ref={formulaTextareaRef} className={`${inp} resize-y font-mono text-xs`} rows={3} value={formulaText} onChange={e=>setFormulaText(e.target.value)} placeholder="Ex: =SE([ID]>0; [ID]*2; 0)" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Funções</label>
                <div className="h-40 overflow-y-auto border border-slate-200 rounded-lg p-1.5 bg-slate-50 flex flex-col gap-1">
                  {[
                    { f: 'SE(condição; v; f)', v: 'SE( ; ; )' },
                    { f: 'SOMA(v1; v2)', v: 'SOMA( ; )' },
                    { f: 'MÉDIA(v1; v2)', v: 'MÉDIA( ; )' },
                    { f: 'MÁXIMO(v1; v2)', v: 'MÁXIMO( ; )' },
                    { f: 'MÍNIMO(v1; v2)', v: 'MÍNIMO( ; )' },
                    { f: 'ARRED(v; casas)', v: 'ARRED( ; 0)' },
                    { f: 'TETO(v)', v: 'TETO( )' },
                    { f: 'PISO(v)', v: 'PISO( )' },
                    { f: 'ABS(v)', v: 'ABS( )' },
                    { f: 'SEERRO(v; fallback)', v: 'SEERRO( ; 0)' },
                  ].map(func => (
                    <button type="button" key={func.f} onClick={() => insertIntoFormula(func.v)} className="text-left text-[11px] text-emerald-700 hover:bg-emerald-100 p-1.5 rounded transition-colors break-words font-mono font-semibold">
                      {func.f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Variáveis (Campos)</label>
                <div className="h-40 overflow-y-auto border border-slate-200 rounded-lg p-1.5 bg-slate-50 flex flex-col gap-1">
                  {missoes.map(m => (m.campos_json || []).map(c => {
                    if (c.tipo === 'tabela') {
                      return (c.colunas || []).map((col, idx) => {
                        // Se a coluna for a primeira (0) e a tabela tiver linhas_rotulos, ela é apenas texto, então pulamos
                        if (idx === 0 && c.linhas_rotulos?.length) return null;
                        
                        return (
                          <React.Fragment key={`${c.id}-${idx}`}>
                            <button type="button" onClick={() => insertIntoFormula(`[${c.id}:${idx}]`)} className="text-left text-[11px] text-blue-600 hover:bg-blue-100 p-1.5 rounded transition-colors break-words">
                              <span className="font-semibold text-slate-600 truncate block">{m.titulo}</span> <span className="text-slate-400">({col}{c.linhas_rotulos?.length ? ' - Soma de todas' : ''})</span>
                            </button>
                            {(c.linhas_rotulos || []).map((rotulo: string, lineIdx: number) => (
                              <button type="button" key={`${c.id}-${idx}-${lineIdx}`} onClick={() => insertIntoFormula(`[${c.id}:${idx}:${lineIdx}]`)} className="text-left text-[11px] text-blue-600 hover:bg-blue-100 p-1.5 rounded transition-colors break-words pl-3 border-l-2 border-blue-200 ml-1">
                                ↳ <span className="text-slate-400">({rotulo})</span>
                              </button>
                            ))}
                          </React.Fragment>
                        );
                      });
                    } else if (['numero', 'calculado'].includes(c.tipo) && c.id !== form.id) {
                      return (
                        <button type="button" key={c.id} onClick={() => insertIntoFormula(`[${c.id}]`)} className="text-left text-[11px] text-blue-600 hover:bg-blue-100 p-1.5 rounded transition-colors break-words">
                          <span className="font-semibold text-slate-600 truncate block">{m.titulo}</span> {c.label}
                        </button>
                      );
                    }
                    return null;
                  }))}
                </div>
              </div>
            </div>
          </>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="accent-blue-600" checked={!!form.obrigatorio} onChange={e=>setForm(f=>({...f,obrigatorio:e.target.checked}))} />
          <span className="text-sm text-slate-700">Campo obrigatório</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!form.label?.trim()} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">{form.id?'Salvar':'Adicionar campo'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── MissoesPreview: Modo de teste das missões como se fosse um aluno ────────
function MissoesPreview({ template, missoes, cursoId, loggedUser, showToast }: {
  template: ProjetoTemplate | null;
  missoes: ProjetoMissao[];
  cursoId: string;
  loggedUser: any;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [respostas, setRespostas] = useState<Record<string, ProjetoResposta | null>>({});
  const [drafts, setDrafts] = useState<Record<string, Record<string, any>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = loggedUser?.id;

  useEffect(() => {
    if (!template?.id || !userId) { setIsLoading(false); return; }
    async function load() {
      setIsLoading(true);
      const { data } = await supabase
        .from('projeto_conclusao_respostas')
        .select('*')
        .eq('curso_id', cursoId)
        .eq('usuario_id', userId);
      const map: Record<string, ProjetoResposta | null> = {};
      missoes.forEach(m => { map[m.id] = null; });
      (data || []).forEach((r: ProjetoResposta) => { if (r.missao_id) map[r.missao_id] = r; });
      setRespostas(map);
      const draftMap: Record<string, Record<string, any>> = {};
      (data || []).forEach((r: ProjetoResposta) => { if (r.missao_id) draftMap[r.missao_id] = r.respostas_json || {}; });
      setDrafts(draftMap);
      setIsLoading(false);
    }
    load();
  }, [template?.id, userId, cursoId, missoes]);

  const isUnlocked = (idx: number): boolean => {
    if (!template?.bloqueio_estrito) return true;
    if (idx === 0) return true;
    const prevMissao = missoes[idx - 1];
    const prevResp = respostas[prevMissao?.id];
    return !!prevResp && (prevResp.status === 'submetido' || prevResp.status === 'com_feedback');
  };

  const handleSave = async (missao: ProjetoMissao, submit: boolean) => {
    if (!userId || !template?.id) return;
    setSaving(missao.id);
    try {
      const respJson = drafts[missao.id] || {};
      const existing = respostas[missao.id];
      const status = submit ? 'submetido' : 'rascunho';

      if (existing?.id) {
        await supabase.from('projeto_conclusao_respostas').update({
          respostas_json: respJson,
          status,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
        setRespostas(prev => ({ ...prev, [missao.id]: { ...existing, respostas_json: respJson, status } }));
      } else {
        const { data } = await supabase.from('projeto_conclusao_respostas').insert({
          template_id: template.id,
          missao_id: missao.id,
          curso_id: cursoId,
          usuario_id: userId,
          respostas_json: respJson,
          status,
        }).select().single();
        if (data) setRespostas(prev => ({ ...prev, [missao.id]: data }));
      }
      showToast(submit ? 'Missão submetida!' : 'Rascunho salvo!', 'success');
    } catch (e: any) {
      showToast('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  if (!template) return <div className="text-center py-12 text-slate-400 text-sm">Nenhum projeto configurado.</div>;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-800 text-sm">Modo de Teste — Visão do Aluno</p>
          <p className="text-amber-700 text-xs mt-0.5">Você está preenchendo as missões com seu próprio usuário. As respostas são reais e aparecerão na aba "Respostas dos Alunos".</p>
        </div>
      </div>

      {missoes.map((missao, idx) => {
        const unlocked = isUnlocked(idx);
        const resposta = respostas[missao.id];
        const status = resposta?.status || (unlocked ? 'rascunho' : 'bloqueada');
        const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['bloqueada'];
        const isExpanded = expanded.includes(missao.id);

        return (
          <div key={missao.id} className={`rounded-2xl border transition-all ${unlocked ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-200 opacity-60'}`}>
            <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => unlocked && setExpanded(prev => prev.includes(missao.id) ? prev.filter(id => id !== missao.id) : [...prev, missao.id])}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${unlocked ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{idx + 1}</div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{missao.titulo}</p>
                  {missao.descricao && <p className="text-xs text-slate-400 mt-0.5">{missao.descricao}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
                {unlocked && (isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />)}
                {!unlocked && <Lock className="w-4 h-4 text-slate-300" />}
              </div>
            </div>

            {unlocked && isExpanded && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
                {missao.campos_json.map(campo => (
                  <CampoRenderer
                    key={campo.id}
                    campo={campo}
                    value={drafts[missao.id]?.[campo.id]}
                    onChange={(val: any) => setDrafts(prev => ({ ...prev, [missao.id]: { ...(prev[missao.id] || {}), [campo.id]: val } }))}
                    readOnly={status === 'submetido' || status === 'com_feedback'}
                  />
                ))}
                {status !== 'submetido' && status !== 'com_feedback' && (
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => handleSave(missao, false)} disabled={saving === missao.id} className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                      {saving === missao.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho
                    </button>
                    <button onClick={() => handleSave(missao, true)} disabled={saving === missao.id} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {saving === missao.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submeter missão
                    </button>
                  </div>
                )}
                {(status === 'submetido' || status === 'com_feedback') && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-semibold pt-2">
                    <CheckCircle2 className="w-4 h-4" /> Missão submetida
                  </div>
                )}
                {status === 'com_feedback' && respostas[missao.id]?.feedback_publicado && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Feedback do instrutor</p>
                    <p className="text-sm text-slate-700">{respostas[missao.id]?.feedback_geral}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


export function ProjetoAdmin({ cursoId, orgId, nomeCurso, curriculo=[], loggedUser, showToast }: ProjetoAdminProps) {
  const [subTab, setSubTab] = useState<'configurar'|'respostas'|'missoes'>('configurar');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [template, setTemplate] = useState<ProjetoTemplate|null>(null);
  const [missoes, setMissoes] = useState<ProjetoMissao[]>([]);
  const [delegacoes, setDelegacoes] = useState<ProjetoDelegacao[]>([]);
  const [respostas, setRespostas] = useState<ProjetoResposta[]>([]);
  const [alunosFiltrados, setAlunosFiltrados] = useState<any[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<any|null>(null);
  const [alunoRespostas, setAlunoRespostas] = useState<ProjetoResposta[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string,string>>({});
  const [feedbackCamposDraft, setFeedbackCamposDraft] = useState<Record<string,Record<string,string>>>({});
  const [feedbackPublicadoDraft, setFeedbackPublicadoDraft] = useState<Record<string,boolean>>({});
  const [isSavingFeedback, setIsSavingFeedback] = useState<string|null>(null);
  const [expandedMissoes, setExpandedMissoes] = useState<string[]>([]);
  const [editingCampo, setEditingCampo] = useState<{missaoId:string;campo:Partial<CampoConfig>|null}|null>(null);
  const [searchAluno, setSearchAluno] = useState('');
  const [delegacaoSearch, setDelegacaoSearch] = useState('');
  const [orgUsers, setOrgUsers] = useState<any[]>([]);

  const allEtapas = curriculo.flatMap((secao:any,sIdx:number)=>(secao.etapas||[]).map((etapa:any,eIdx:number)=>({id:etapa.id||`step-${sIdx}-${eIdx}`,nome:etapa.nome,secao:secao.nome})));

  const loadTemplate = useCallback(async()=>{
    setIsLoading(true);
    try {
      const {data:tpl} = await supabase.from('projeto_conclusao_templates').select('*').eq('curso_id',cursoId).maybeSingle();
      if (tpl) {
        setTemplate(tpl);
        const {data:miss} = await supabase.from('projeto_conclusao_missoes').select('*').eq('template_id',tpl.id).order('ordem');
        setMissoes(miss||[]);
        const {data:deleg} = await supabase.from('projeto_conclusao_delegacoes').select('*, usuarios(id, nome, email)').eq('template_id',tpl.id);
        setDelegacoes((deleg||[]) as ProjetoDelegacao[]);
      } else { setTemplate(null); setMissoes([]); }
    } catch(e){console.error(e);} finally{setIsLoading(false);}
  },[cursoId]);

  const loadRespostas = useCallback(async()=>{
    if (!template?.id) return;
    const {data} = await supabase.from('projeto_conclusao_respostas').select('*, usuarios(id,nome,email), projeto_conclusao_missoes(id,titulo,ordem)').eq('curso_id',cursoId).order('created_at',{ascending:false});
    setRespostas(data||[]);
    const alunosMap:Record<string,any>={};
    (data||[]).forEach((r:any)=>{if(r.usuarios)alunosMap[r.usuario_id]=r.usuarios;});
    setAlunosFiltrados(Object.values(alunosMap));
  },[template?.id,cursoId]);

  const loadOrgUsers = useCallback(async()=>{
    if (!orgId) return;
    const {data} = await supabase.from('usuarios').select('id,nome,email,role').eq('organizacao_id',orgId);
    setOrgUsers(data||[]);
  },[orgId]);

  useEffect(()=>{loadTemplate();},[loadTemplate]);
  useEffect(()=>{if(subTab==='respostas')loadRespostas();},[subTab,loadRespostas]);
  useEffect(()=>{loadOrgUsers();},[loadOrgUsers]);

  const criarTemplate = async()=>{
    setIsSaving(true);
    try {
      const {data,error} = await supabase.from('projeto_conclusao_templates').insert({curso_id:cursoId,organizacao_id:orgId,titulo:'Projeto de Conclusão',ativo:false,bloqueio_estrito:true}).select().single();
      if(error)throw error;
      setTemplate(data); showToast('Projeto de Conclusão criado!','success');
    } catch(e:any){showToast('Erro ao criar projeto: '+e.message,'error');} finally{setIsSaving(false);}
  };

  const salvarTemplate = async()=>{
    if(!template)return; setIsSaving(true);
    try {
      await supabase.from('projeto_conclusao_templates').update({titulo:template.titulo,descricao:template.descricao,ativo:template.ativo,bloqueio_estrito:template.bloqueio_estrito,updated_at:new Date().toISOString()}).eq('id',template.id);
      showToast('Projeto salvo!','success');
    } catch(e:any){showToast('Erro: '+e.message,'error');} finally{setIsSaving(false);}
  };

  const adicionarMissao = async()=>{
    if(!template)return;
    const ordem=missoes.length;
    const {data,error} = await supabase.from('projeto_conclusao_missoes').insert({template_id:template.id,titulo:`Missão ${ordem+1}`,campos_json:[],ordem,gatilho_tipo:'concluir_etapa'}).select().single();
    if(error){showToast('Erro ao criar missão','error');return;}
    setMissoes(prev=>[...prev,data as ProjetoMissao]); setExpandedMissoes(prev=>[...prev,data.id]);
  };

  const salvarMissao = async(missao:ProjetoMissao)=>{
    await supabase.from('projeto_conclusao_missoes').update({titulo:missao.titulo,descricao:missao.descricao,campos_json:missao.campos_json,gatilho_etapa_id:missao.gatilho_etapa_id,gatilho_tipo:missao.gatilho_tipo,ordem:missao.ordem}).eq('id',missao.id);
  };

  const excluirMissao = async(missaoId:string)=>{
    await supabase.from('projeto_conclusao_missoes').delete().eq('id',missaoId);
    setMissoes(prev=>prev.filter(m=>m.id!==missaoId)); showToast('Missão removida','info');
  };

  const updateMissaoLocal = (missaoId:string, patch:Partial<ProjetoMissao>)=>{
    setMissoes(prev=>prev.map(m=>m.id===missaoId?{...m,...patch}:m));
  };

  const handleSaveCampo = async(missaoId:string, campo:CampoConfig)=>{
    const missao=missoes.find(m=>m.id===missaoId); if(!missao)return;
    const exists=missao.campos_json.some(c=>c.id===campo.id);
    const newCampos=exists?missao.campos_json.map(c=>c.id===campo.id?campo:c):[...missao.campos_json,campo];
    const updated={...missao,campos_json:newCampos};
    updateMissaoLocal(missaoId,{campos_json:newCampos}); await salvarMissao(updated); setEditingCampo(null);
  };

  const excluirCampo = async(missaoId:string, campoId:string)=>{
    const missao=missoes.find(m=>m.id===missaoId); if(!missao)return;
    const newCampos=missao.campos_json.filter(c=>c.id!==campoId);
    updateMissaoLocal(missaoId,{campos_json:newCampos}); await salvarMissao({...missao,campos_json:newCampos});
  };

  const adicionarDelegacao = async(userId:string)=>{
    if(!template)return;
    const {data,error}=await supabase.from('projeto_conclusao_delegacoes').insert({template_id:template.id,usuario_id:userId}).select('*, usuarios(id,nome,email)').single();
    if(!error&&data){setDelegacoes(prev=>[...prev,data as ProjetoDelegacao]);showToast('Acesso delegado!','success');}
  };

  const removerDelegacao = async(delegId:string)=>{
    await supabase.from('projeto_conclusao_delegacoes').delete().eq('id',delegId);
    setDelegacoes(prev=>prev.filter(d=>d.id!==delegId)); showToast('Acesso removido','info');
  };

  const salvarFeedback = async(resposta:ProjetoResposta)=>{
    if(!resposta.id)return; setIsSavingFeedback(resposta.id);
    try {
      await supabase.from('projeto_conclusao_respostas').update({feedback_geral:feedbackDraft[resposta.id]??resposta.feedback_geral,feedbacks_campos_json:feedbackCamposDraft[resposta.id]??resposta.feedbacks_campos_json,feedback_publicado:feedbackPublicadoDraft[resposta.id]??resposta.feedback_publicado,status:'com_feedback'}).eq('id',resposta.id);
      showToast('Feedback salvo!','success'); await loadRespostas();
    } catch(e:any){showToast('Erro: '+e.message,'error');} finally{setIsSavingFeedback(null);}
  };

  const handleExportPDF = async(aluno:any)=>{
    if(!template)return;
    const resps=respostas.filter(r=>r.usuario_id===aluno.id);
    await exportarProjetoPDF({template,missoes,respostas:resps,nomeAluno:aluno.nome||aluno.email,nomeCurso:nomeCurso||''});
  };

  const filteredAlunos = alunosFiltrados.filter(a=>(a.nome||'').toLowerCase().includes(searchAluno.toLowerCase())||(a.email||'').toLowerCase().includes(searchAluno.toLowerCase()));
  const getMissaoStatus = (missaoId:string,alunoId:string)=>{ const r=respostas.find(r=>r.missao_id===missaoId&&r.usuario_id===alunoId); if(!r)return 'bloqueada'; return r.status; };

  // ── Drag-and-drop ─────────────────────────────────────────────────────────────
  const onDragEnd = useCallback(async(result:DropResult)=>{
    const {destination,source,type}=result;
    if(!destination)return;
    if(destination.droppableId===source.droppableId&&destination.index===source.index)return;
    if(type==='MISSAO'){
      const reordered=Array.from(missoes);
      const [removed]=reordered.splice(source.index,1);
      reordered.splice(destination.index,0,removed);
      const withOrdem=reordered.map((m,i)=>({...m,ordem:i}));
      setMissoes(withOrdem);
      await Promise.all(withOrdem.map(m=>supabase.from('projeto_conclusao_missoes').update({ordem:m.ordem}).eq('id',m.id)));
    } else if(type==='CAMPO'){
      const sourceMissaoId = source.droppableId.replace('campos-','');
      const destMissaoId = destination.droppableId.replace('campos-','');
      
      const sourceMissao = missoes.find(m => m.id === sourceMissaoId);
      const destMissao = missoes.find(m => m.id === destMissaoId);
      if (!sourceMissao || !destMissao) return;

      if (sourceMissaoId === destMissaoId) {
        // Reordering within the same mission
        const reordered = Array.from(sourceMissao.campos_json);
        const [removed] = reordered.splice(source.index, 1);
        reordered.splice(destination.index, 0, removed);
        
        const updated = { ...sourceMissao, campos_json: reordered };
        updateMissaoLocal(sourceMissaoId, { campos_json: reordered }); 
        await salvarMissao(updated);
      } else {
        // Moving from one mission to another
        const sourceCampos = Array.from(sourceMissao.campos_json);
        const destCampos = Array.from(destMissao.campos_json);
        
        const [removed] = sourceCampos.splice(source.index, 1);
        destCampos.splice(destination.index, 0, removed);
        
        updateMissaoLocal(sourceMissaoId, { campos_json: sourceCampos });
        updateMissaoLocal(destMissaoId, { campos_json: destCampos });
        
        await Promise.all([
          salvarMissao({ ...sourceMissao, campos_json: sourceCampos }),
          salvarMissao({ ...destMissao, campos_json: destCampos })
        ]);
      }
    }
  },[missoes]);

  if(isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  if(!template) return (
    <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center"><ClipboardList className="w-8 h-8 text-blue-600" /></div>
      <div>
        <h3 className="font-bold text-slate-900 text-lg mb-1">Nenhum Projeto de Conclusão configurado</h3>
        <p className="text-slate-500 text-sm max-w-sm">Crie um projeto para que seus alunos preencham progressivamente a cada aula concluída.</p>
      </div>
      <button onClick={criarTemplate} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
        {isSaving?<Loader2 className="w-4 h-4 animate-spin" />:<Plus className="w-4 h-4" />} Criar Projeto de Conclusão
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['configurar','missoes','respostas'] as const).map(t=>(
          <button key={t} onClick={()=>setSubTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab===t?'bg-white text-blue-700 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            {t==='configurar'?<Settings className="w-4 h-4" />:t==='missoes'?<ClipboardList className="w-4 h-4" />:<Users className="w-4 h-4" />}
            {t==='configurar'?'Configurar':t==='missoes'?'Missões (Teste)':'Respostas dos Alunos'}
          </button>
        ))}
      </div>

      {/* TAB: CONFIGURAR */}
      {subTab==='configurar'&&(
        <div className="space-y-5">
          {/* Config geral */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Configurações gerais</h3>
              <button onClick={salvarTemplate} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {isSaving?<Loader2 className="w-4 h-4 animate-spin" />:<Save className="w-4 h-4" />} Salvar
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div><p className="font-semibold text-slate-800 text-sm">Projeto publicado</p><p className="text-xs text-slate-500 mt-0.5">Alunos podem ver e preencher o projeto</p></div>
              <button onClick={()=>setTemplate(t=>t?{...t,ativo:!t.ativo}:t)} className="transition-transform hover:scale-110">
                {template.ativo?<ToggleRight className="w-9 h-9 text-blue-600" />:<ToggleLeft className="w-9 h-9 text-slate-400" />}
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div><p className="font-semibold text-slate-800 text-sm">Bloqueio sequencial</p><p className="text-xs text-slate-500 mt-0.5">Aluno precisa submeter cada missão antes de ver a próxima</p></div>
              <button onClick={()=>setTemplate(t=>t?{...t,bloqueio_estrito:!t.bloqueio_estrito}:t)} className="transition-transform hover:scale-110">
                {template.bloqueio_estrito?<ToggleRight className="w-9 h-9 text-blue-600" />:<ToggleLeft className="w-9 h-9 text-slate-400" />}
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Título do projeto</label>
              <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" value={template.titulo} onChange={e=>setTemplate(t=>t?{...t,titulo:e.target.value}:t)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição / instrução</label>
              <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Ex: Ferramenta prática para diagnosticar gargalos..." value={template.descricao||''} onChange={e=>setTemplate(t=>t?{...t,descricao:e.target.value}:t)} />
            </div>
          </div>

          {/* Missões com DnD */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Missões ({missoes.length})</h3>
              <button onClick={adicionarMissao} className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar Missão
              </button>
            </div>
            {missoes.length===0&&<div className="text-center py-8 text-slate-400 text-sm">Nenhuma missão ainda. Adicione a primeira missão para começar.</div>}

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="missoes-list" type="MISSAO">
                {(lp,ls)=>(
                  <div ref={lp.innerRef} {...lp.droppableProps} className={`space-y-3 rounded-xl transition-colors ${ls.isDraggingOver?'bg-blue-50/40 p-2':''}`}>
                    {missoes.map((missao,idx)=>(
                      <Draggable key={missao.id} draggableId={missao.id} index={idx}>
                        {(dp,ds)=>(
                          <div ref={dp.innerRef} {...dp.draggableProps} className={`border rounded-xl overflow-hidden transition-shadow ${ds.isDragging?'border-blue-300 shadow-xl shadow-blue-100/60 bg-white':'border-slate-200 bg-white'}`}>
                            {/* Header */}
                            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={()=>setExpandedMissoes(prev=>prev.includes(missao.id)?prev.filter(id=>id!==missao.id):[...prev,missao.id])}>
                              <div {...dp.dragHandleProps} onClick={e=>e.stopPropagation()} className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-slate-100 transition-colors shrink-0" title="Arrastar para reordenar">
                                <GripVertical className="w-4 h-4 text-slate-300" />
                              </div>
                              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-blue-700">{idx+1}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-800 text-sm truncate">{missao.titulo}</p>
                                <p className="text-xs text-slate-400">{missao.campos_json.length} campo{missao.campos_json.length!==1?'s':''} · {missao.gatilho_etapa_id?allEtapas.find(e=>e.id===missao.gatilho_etapa_id)?.nome||'Aula vinculada':'Sempre disponível'}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={e=>{e.stopPropagation();excluirMissao(missao.id);}} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"><Trash2 className="w-4 h-4" /></button>
                                {expandedMissoes.includes(missao.id)?<ChevronUp className="w-4 h-4 text-slate-400" />:<ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>
                            {/* Body */}
                            <AnimatePresence>
                              {expandedMissoes.includes(missao.id)&&(
                                <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
                                  <div className="p-4 pt-0 border-t border-slate-100 space-y-4 bg-slate-50/50">
                                    <div>
                                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Título</label>
                                      <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={missao.titulo} onChange={e=>updateMissaoLocal(missao.id,{titulo:e.target.value})} onBlur={()=>salvarMissao(missao)} />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição / contexto</label>
                                      <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" placeholder="Explique o objetivo desta missão..." value={missao.descricao||''} onChange={e=>updateMissaoLocal(missao.id,{descricao:e.target.value})} onBlur={()=>salvarMissao(missao)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Aula gatilho</label>
                                        <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={missao.gatilho_etapa_id||''} onChange={e=>{updateMissaoLocal(missao.id,{gatilho_etapa_id:e.target.value});salvarMissao({...missao,gatilho_etapa_id:e.target.value});}}>
                                          <option value="">Sem gatilho (sempre disponível)</option>
                                          {allEtapas.map(e=><option key={e.id} value={e.id}>{e.secao} › {e.nome}</option>)}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Critério</label>
                                        <select className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={missao.gatilho_tipo} onChange={e=>{updateMissaoLocal(missao.id,{gatilho_tipo:e.target.value as any});salvarMissao({...missao,gatilho_tipo:e.target.value as any});}}>
                                          {Object.entries(GATILHO_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                                        </select>
                                      </div>
                                    </div>
                                    {/* Campos com DnD */}
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Campos ({missao.campos_json.length})</label>
                                        <button onClick={()=>setEditingCampo({missaoId:missao.id,campo:null})} className="text-xs flex items-center gap-1 px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-semibold">
                                          <Plus className="w-3.5 h-3.5" /> Adicionar campo
                                        </button>
                                      </div>
                                      <Droppable droppableId={`campos-${missao.id}`} type="CAMPO">
                                        {(cp,cs)=>(
                                          <div ref={cp.innerRef} {...cp.droppableProps} className={`space-y-2 rounded-lg transition-colors min-h-[8px] ${cs.isDraggingOver?'bg-blue-50 p-1':''}` }>
                                            {missao.campos_json.map((campo,ci)=>(
                                              <Draggable key={campo.id} draggableId={campo.id} index={ci}>
                                                {(fp,fs)=>(
                                                  <div ref={fp.innerRef} {...fp.draggableProps} className={`flex items-center gap-2 p-3 bg-white rounded-lg border transition-shadow ${fs.isDragging?'border-blue-300 shadow-md':'border-slate-200'}`}>
                                                    <div {...fp.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-slate-100 transition-colors shrink-0" title="Arrastar para reordenar">
                                                      <GripVertical className="w-4 h-4 text-slate-300" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <span className="text-sm font-semibold text-slate-700">{campo.label}</span>
                                                      <span className="ml-2 text-xs text-slate-400">{CAMPO_TIPOS.find(t=>t.tipo===campo.tipo)?.label}</span>
                                                      {campo.obrigatorio&&<span className="ml-1 text-xs text-red-500">*</span>}
                                                    </div>
                                                    <button onClick={()=>setEditingCampo({missaoId:missao.id,campo})} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                                    <button onClick={()=>excluirCampo(missao.id,campo.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                  </div>
                                                )}
                                              </Draggable>
                                            ))}
                                            {cp.placeholder}
                                            {missao.campos_json.length===0&&<p className="text-xs text-slate-400 text-center py-4 bg-white rounded-lg border border-dashed border-slate-200">Nenhum campo adicionado ainda.</p>}
                                          </div>
                                        )}
                                      </Droppable>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {lp.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Delegações */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Revisores do Projeto</h3>
            <p className="text-sm text-slate-500">Usuários que podem acompanhar e dar feedback nas respostas dos alunos.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Buscar usuário da organização..." value={delegacaoSearch} onChange={e=>setDelegacaoSearch(e.target.value)} />
            </div>
            {delegacaoSearch&&(
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {orgUsers.filter(u=>((u.nome||'').toLowerCase().includes(delegacaoSearch.toLowerCase())||(u.email||'').toLowerCase().includes(delegacaoSearch.toLowerCase()))&&!delegacoes.some(d=>d.usuario_id===u.id)).slice(0,5).map(u=>(
                  <button key={u.id} onClick={()=>{adicionarDelegacao(u.id);setDelegacaoSearch('');}} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-slate-600">{(u.nome||u.email||'?')[0].toUpperCase()}</span></div>
                    <div className="min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{u.nome||u.email}</p><p className="text-xs text-slate-400">{u.role}</p></div>
                    <UserPlus className="w-4 h-4 text-blue-500 ml-auto shrink-0" />
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {delegacoes.map(d=>(
                <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-blue-700">{((d.usuarios?.nome||d.usuarios?.email||'?')[0]).toUpperCase()}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800">{d.usuarios?.nome||d.usuarios?.email}</p><p className="text-xs text-slate-400">{d.usuarios?.email}</p></div>
                  <button onClick={()=>removerDelegacao(d.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><UserMinus className="w-4 h-4" /></button>
                </div>
              ))}
              {delegacoes.length===0&&<p className="text-sm text-slate-400 text-center py-4">Nenhum revisor delegado ainda.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TAB: RESPOSTAS */}
      {subTab==='respostas'&&(
        <div className="space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="Buscar aluno..." value={searchAluno} onChange={e=>setSearchAluno(e.target.value)} />
          </div>
          {filteredAlunos.length===0?(
            <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">{respostas.length===0?'Nenhum aluno preencheu o projeto ainda.':'Nenhum aluno encontrado.'}</div>
          ):(
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[180px]">Aluno</th>
                      {missoes.map((m,i)=>(<th key={m.id} className="text-center px-3 py-3 font-semibold text-slate-700 min-w-[120px]"><span className="text-xs">M{i+1}</span><br/><span className="text-xs text-slate-400 font-normal truncate block max-w-[100px]">{m.titulo}</span></th>))}
                      <th className="px-4 py-3 min-w-[80px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlunos.map(aluno=>(
                      <tr key={aluno.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={()=>{
                        setSelectedAluno(aluno); setAlunoRespostas(respostas.filter(r=>r.usuario_id===aluno.id));
                        const fbD:Record<string,string>={},fbCD:Record<string,Record<string,string>>={},fbPD:Record<string,boolean>={};
                        respostas.filter(r=>r.usuario_id===aluno.id).forEach(r=>{ if(r.id){fbD[r.id]=r.feedback_geral||'';fbCD[r.id]=r.feedbacks_campos_json||{};fbPD[r.id]=r.feedback_publicado;} });
                        setFeedbackDraft(fbD);setFeedbackCamposDraft(fbCD);setFeedbackPublicadoDraft(fbPD);
                      }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0"><span className="text-xs font-bold text-blue-700">{(aluno.nome||aluno.email||'?')[0].toUpperCase()}</span></div>
                            <div className="min-w-0"><p className="font-semibold text-slate-800 text-xs truncate">{aluno.nome||'—'}</p><p className="text-xs text-slate-400 truncate">{aluno.email}</p></div>
                          </div>
                        </td>
                        {missoes.map(m=>{const status=getMissaoStatus(m.id,aluno.id);const cfg=STATUS_CONFIG[status];return(<td key={m.id} className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.icon}{cfg.label}</span></td>);})}
                        <td className="px-4 py-3" onClick={e=>e.stopPropagation()}><button onClick={()=>handleExportPDF(aluno)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar PDF"><Download className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <AnimatePresence>
            {selectedAluno&&(
              <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} className="bg-white rounded-2xl border border-blue-200 shadow-lg">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center"><span className="text-sm font-bold text-white">{(selectedAluno.nome||selectedAluno.email||'?')[0].toUpperCase()}</span></div>
                    <div><p className="font-bold text-slate-900">{selectedAluno.nome||selectedAluno.email}</p><p className="text-xs text-slate-400">{selectedAluno.email}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>handleExportPDF(selectedAluno)} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"><Download className="w-4 h-4" /> Exportar PDF</button>
                    <button onClick={()=>setSelectedAluno(null)} className="p-2 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="p-5 space-y-6">
                  {missoes.map((missao,mIdx)=>{
                    const resposta=alunoRespostas.find(r=>r.missao_id===missao.id);
                    if(!resposta) return (<div key={missao.id} className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200"><p className="text-sm text-slate-400 flex items-center gap-2"><Lock className="w-4 h-4" />Missão {mIdx+1}: {missao.titulo} — não preenchida</p></div>);
                    const fbGeral=feedbackDraft[resposta.id!]??resposta.feedback_geral??'';
                    const fbCampos=feedbackCamposDraft[resposta.id!]??resposta.feedbacks_campos_json??{};
                    const fbPublicado=feedbackPublicadoDraft[resposta.id!]??resposta.feedback_publicado;
                    return (
                      <div key={missao.id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
                          <div><p className="font-bold text-slate-800">Missão {mIdx+1}: {missao.titulo}</p><p className="text-xs text-slate-400">{missao.descricao}</p></div>
                          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CONFIG[resposta.status].color}`}>{STATUS_CONFIG[resposta.status].icon}{STATUS_CONFIG[resposta.status].label}</span>
                        </div>
                        <div className="p-5 space-y-5">
                          {missao.campos_json.map(campo=>(<CampoRenderer key={campo.id} campo={campo} value={resposta.respostas_json?.[campo.id]} readOnly isAdmin feedbackInline={fbCampos[campo.id]} onFeedbackChange={(campoId,text)=>{setFeedbackCamposDraft(prev=>({...prev,[resposta.id!]:{...(prev[resposta.id!]||{}),[campoId]:text}}));}} />))}
                          <div className="pt-4 border-t border-slate-100 space-y-3">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Feedback geral desta missão</label>
                            <textarea className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" rows={3} placeholder="Escreva seu feedback para o aluno sobre esta missão..." value={fbGeral} onChange={e=>setFeedbackDraft(prev=>({...prev,[resposta.id!]:e.target.value}))} />
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                                <input type="checkbox" className="accent-blue-600" checked={fbPublicado} onChange={e=>setFeedbackPublicadoDraft(prev=>({...prev,[resposta.id!]:e.target.checked}))} />
                                Publicar feedback (aluno pode ver)
                              </label>
                              <button onClick={()=>salvarFeedback(resposta)} disabled={isSavingFeedback===resposta.id} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                                {isSavingFeedback===resposta.id?<Loader2 className="w-4 h-4 animate-spin" />:<Save className="w-4 h-4" />} Salvar feedback
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {subTab==='missoes'&&(
        <MissoesPreview
          template={template}
          missoes={missoes}
          cursoId={cursoId}
          loggedUser={loggedUser}
          showToast={showToast}
        />
      )}

      {editingCampo&&(<CampoEditorModal campo={editingCampo.campo} onSave={c=>handleSaveCampo(editingCampo.missaoId,c)} onClose={()=>setEditingCampo(null)} missoes={missoes} />)}
    </div>
  );
}
