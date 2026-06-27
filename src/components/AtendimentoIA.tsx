/**
 * src/components/AtendimentoIA.tsx — Painel de Atendimento IA via WhatsApp
 *
 * Layout 3 colunas:
 *  - Esquerda: Lista de conversas com filtros e badges
 *  - Centro: Chat com histórico e input de resposta
 *  - Direita: Info do contato + ações (assumir, devolver para IA, encerrar)
 *
 * Utiliza Supabase Realtime para atualizações instantâneas.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  MessageCircle,
  Bot,
  User,
  Phone,
  Send,
  UserCheck,
  Zap,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  BarChart2,
  Settings,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WaConversa {
  id: string;
  contato_telefone: string;
  contato_nome: string | null;
  contato_email: string | null;
  is_aluno: boolean;
  status: 'ia_ativa' | 'aguardando_humano' | 'em_atendimento' | 'encerrada';
  atendente_id: string | null;
  organizacao_id: string | null;
  criado_em: string;
  ultima_mensagem_em: string;
  encerrado_em: string | null;
  atendente?: { nome: string; email: string } | null;
  _preview?: string;
}

interface WaMensagem {
  id: string;
  conversa_id: string;
  direcao: 'entrada' | 'saida';
  conteudo: string;
  enviado_por: 'ia' | 'humano' | 'contato';
  criado_em: string;
}

interface AtendimentoIAProps {
  loggedUser: any;
  loggedRole: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ia_ativa: { label: 'IA Ativa', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', icon: Bot },
  aguardando_humano: { label: 'Aguardando', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', icon: AlertCircle },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', icon: UserCheck },
  encerrada: { label: 'Encerrada', color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400', icon: CheckCircle2 },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFullTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function AtendimentoIA({ loggedUser, loggedRole }: AtendimentoIAProps) {
  const [conversas, setConversas] = useState<WaConversa[]>([]);
  const [conversaSelecionada, setConversaSelecionada] = useState<WaConversa | null>(null);
  const [mensagens, setMensagens] = useState<WaMensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [isEnviando, setIsEnviando] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'metricas' | 'config'>('chat');
  const [metrics, setMetrics] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notificacoesPermitidas, setNotificacoesPermitidas] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const isSuperAdmin = loggedRole === 'super_admin';
  const orgId = loggedUser?.organizacao_id;

  // ── Solicita permissão de notificação push ────────────────────────────────
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificacoesPermitidas(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          setNotificacoesPermitidas(perm === 'granted');
        });
      }
    }
  }, []);

  // ── Cria elemento de áudio para alerta ────────────────────────────────────
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA' +
      'EAAQAQAAAAAAAAABAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  }, []);

  const tocarSom = useCallback(() => {
    try { audioRef.current?.play(); } catch (_) {}
  }, []);

  const enviarNotificacaoPush = useCallback((titulo: string, corpo: string) => {
    if (notificacoesPermitidas && document.hidden) {
      new Notification(titulo, { body: corpo, icon: '/favicon.ico' });
    }
  }, [notificacoesPermitidas]);

  // ── Carrega conversas ─────────────────────────────────────────────────────
  const carregarConversas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!isSuperAdmin && orgId) params.set('org_id', orgId);
      if (filtroStatus !== 'todas') params.set('status', filtroStatus);
      params.set('limit', '100');

      const res = await fetch(`/api/whatsapp/conversas?${params}`);
      if (!res.ok) return;
      const data: WaConversa[] = await res.json();
      setConversas(data);
      setPendingCount(data.filter(c => c.status === 'aguardando_humano').length);

      if (conversaSelecionada) {
        const atualizada = data.find(c => c.id === conversaSelecionada.id);
        if (atualizada) setConversaSelecionada(atualizada);
      }
    } catch (err) {
      console.error('[AtendimentoIA] Erro ao carregar conversas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroStatus, isSuperAdmin, orgId, conversaSelecionada]);

  useEffect(() => {
    carregarConversas();
  }, [filtroStatus]);

  // ── Supabase Realtime — escuta wa_conversas e wa_mensagens ───────────────
  useEffect(() => {
    const channelConversas = supabase
      .channel('wa-conversas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversas' }, (payload) => {
        const nova = payload.new as WaConversa;
        setConversas(prev => {
          const existe = prev.find(c => c.id === nova.id);
          if (!existe) {
            if (nova.status === 'aguardando_humano') {
              tocarSom();
              enviarNotificacaoPush(
                '⚡ Nova conversa aguardando atendimento',
                `${nova.contato_nome || nova.contato_telefone} precisa de ajuda`
              );
              setPendingCount(p => p + 1);
            }
            return [nova, ...prev];
          }
          return prev.map(c => c.id === nova.id ? { ...c, ...nova } : c);
        });
        if (conversaSelecionada?.id === nova.id) {
          setConversaSelecionada(prev => prev ? { ...prev, ...nova } : null);
        }
      })
      .subscribe();

    const channelMensagens = supabase
      .channel('wa-mensagens-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_mensagens' }, (payload) => {
        const nova = payload.new as WaMensagem;
        if (conversaSelecionada?.id === nova.conversa_id) {
          setMensagens(prev => [...prev, nova]);
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        if (nova.direcao === 'entrada') {
          tocarSom();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelConversas);
      supabase.removeChannel(channelMensagens);
    };
  }, [conversaSelecionada, tocarSom, enviarNotificacaoPush]);

  // ── Carrega mensagens da conversa selecionada ─────────────────────────────
  useEffect(() => {
    if (!conversaSelecionada) return;
    const carregar = async () => {
      const res = await fetch(`/api/whatsapp/conversas/${conversaSelecionada.id}/mensagens`);
      if (res.ok) {
        const data = await res.json();
        setMensagens(data);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    carregar();
  }, [conversaSelecionada?.id]);

  // ── Carrega métricas ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'metricas') return;
    const params = new URLSearchParams({ periodo: '30' });
    if (!isSuperAdmin && orgId) params.set('org_id', orgId);
    fetch(`/api/whatsapp/metrics?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMetrics(d); });
  }, [activeTab, isSuperAdmin, orgId]);

  // ── Ações da conversa ─────────────────────────────────────────────────────
  const assumirConversa = async () => {
    if (!conversaSelecionada) return;
    await fetch(`/api/whatsapp/conversas/${conversaSelecionada.id}/takeover`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atendente_id: loggedUser.id }),
    });
    setConversaSelecionada(prev => prev ? { ...prev, status: 'em_atendimento', atendente_id: loggedUser.id } : null);
    carregarConversas();
  };

  const devolverParaIA = async () => {
    if (!conversaSelecionada) return;
    await fetch(`/api/whatsapp/conversas/${conversaSelecionada.id}/release`, { method: 'PATCH' });
    setConversaSelecionada(prev => prev ? { ...prev, status: 'ia_ativa', atendente_id: null } : null);
    carregarConversas();
  };

  const encerrarConversa = async () => {
    if (!conversaSelecionada || !confirm('Encerrar esta conversa?')) return;
    await fetch(`/api/whatsapp/conversas/${conversaSelecionada.id}/close`, { method: 'PATCH' });
    setConversaSelecionada(null);
    carregarConversas();
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaSelecionada || isEnviando) return;
    setIsEnviando(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: conversaSelecionada.id,
          mensagem: novaMensagem.trim(),
          atendente_id: loggedUser.id,
        }),
      });
      if (res.ok) {
        setNovaMensagem('');
      }
    } finally {
      setIsEnviando(false);
    }
  };

  // ── Filtra conversas para exibição ────────────────────────────────────────
  const conversasFiltradas = conversas.filter(c => {
    if (filtroStatus === 'todas') return c.status !== 'encerrada';
    return c.status === filtroStatus;
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-0 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <MessageCircle size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Atendimento IA</h1>
            <p className="text-violet-200 text-xs mt-0.5">WhatsApp · Umbler uTalk</p>
          </div>
          {pendingCount > 0 && (
            <span className="ml-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pendingCount} aguardando
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'chat' ? 'bg-white text-indigo-700' : 'text-white/80 hover:bg-white/10'}`}
          >
            <MessageCircle size={14} className="inline mr-1" />Chat
          </button>
          <button
            onClick={() => setActiveTab('metricas')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'metricas' ? 'bg-white text-indigo-700' : 'text-white/80 hover:bg-white/10'}`}
          >
            <BarChart2 size={14} className="inline mr-1" />Métricas
          </button>
          {(isSuperAdmin || loggedRole === 'gestor') && (
            <button
              onClick={() => setActiveTab('config')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'config' ? 'bg-white text-indigo-700' : 'text-white/80 hover:bg-white/10'}`}
            >
              <Settings size={14} className="inline mr-1" />Config
            </button>
          )}
        </div>
      </div>

      {/* Tab: Chat */}
      {activeTab === 'chat' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Coluna Esquerda — Lista de Conversas */}
          <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
            {/* Filtros */}
            <div className="p-3 border-b border-slate-100 flex gap-1 flex-wrap">
              {[
                { key: 'todas', label: 'Todas' },
                { key: 'aguardando_humano', label: '⚡ Fila' },
                { key: 'ia_ativa', label: '🤖 IA' },
                { key: 'em_atendimento', label: '👤 Humano' },
                { key: 'encerrada', label: '✓ Enc.' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroStatus(f.key)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filtroStatus === f.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
              <button onClick={carregarConversas} className="ml-auto p-1 text-slate-400 hover:text-slate-600">
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 text-sm">Carregando...</div>
              ) : conversasFiltradas.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">Nenhuma conversa</p>
                </div>
              ) : (
                conversasFiltradas.map(conversa => {
                  const cfg = STATUS_CONFIG[conversa.status];
                  const isSelected = conversaSelecionada?.id === conversa.id;
                  return (
                    <button
                      key={conversa.id}
                      onClick={() => setConversaSelecionada(conversa)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-white transition-all ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${conversa.status === 'aguardando_humano' ? 'animate-pulse' : ''}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-slate-800 text-sm truncate">
                              {conversa.contato_nome || conversa.contato_telefone}
                            </span>
                            <span className="text-slate-400 text-xs flex-shrink-0">{formatTime(conversa.ultima_mensagem_em)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {conversa.is_aluno && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700">
                                Aluno
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Central — Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!conversaSelecionada ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <MessageCircle size={48} className="mb-4 opacity-20" />
                <p className="font-medium">Selecione uma conversa</p>
                <p className="text-sm mt-1">para ver o histórico de mensagens</p>
              </div>
            ) : (
              <>
                {/* Header da conversa */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div>
                    <h2 className="font-bold text-slate-800">
                      {conversaSelecionada.contato_nome || conversaSelecionada.contato_telefone}
                    </h2>
                    <p className="text-xs text-slate-400">{conversaSelecionada.contato_telefone}</p>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_CONFIG[conversaSelecionada.status].color}`}>
                    {STATUS_CONFIG[conversaSelecionada.status].label}
                  </div>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  {mensagens.map(msg => {
                    const isEntrada = msg.direcao === 'entrada';
                    return (
                      <div key={msg.id} className={`flex ${isEntrada ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[72%] group`}>
                          {!isEntrada && (
                            <p className="text-[10px] text-slate-400 text-right mb-1 mr-1">
                              {msg.enviado_por === 'ia' ? '🤖 IA' : '👤 Atendente'}
                            </p>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isEntrada
                              ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                              : msg.enviado_por === 'ia'
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-violet-600 text-white rounded-tr-sm'
                          }`}>
                            {msg.conteudo}
                          </div>
                          <p className={`text-[10px] text-slate-400 mt-1 ${isEntrada ? 'ml-1' : 'text-right mr-1'}`}>
                            {formatFullTime(msg.criado_em)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>

                {/* Input de resposta */}
                <div className="p-4 border-t border-slate-100 bg-white">
                  {conversaSelecionada.status === 'em_atendimento' ? (
                    <div className="flex gap-2">
                      <textarea
                        value={novaMensagem}
                        onChange={e => setNovaMensagem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
                        placeholder="Digite sua resposta... (Enter para enviar)"
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={2}
                      />
                      <button
                        onClick={enviarMensagem}
                        disabled={isEnviando || !novaMensagem.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all"
                      >
                        {isEnviando ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  ) : (
                    <div className={`text-center text-sm py-3 px-4 rounded-xl ${
                      conversaSelecionada.status === 'aguardando_humano'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : conversaSelecionada.status === 'ia_ativa'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {conversaSelecionada.status === 'aguardando_humano' && '⚡ Aguardando atendente — clique em "Assumir" para responder'}
                      {conversaSelecionada.status === 'ia_ativa' && '🤖 IA está respondendo esta conversa'}
                      {conversaSelecionada.status === 'encerrada' && '✓ Conversa encerrada'}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Coluna Direita — Info + Ações */}
          {conversaSelecionada && (
            <div className="w-64 border-l border-slate-100 flex flex-col bg-white">
              {/* Info do contato */}
              <div className="p-4 border-b border-slate-100">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-3">
                  {(conversaSelecionada.contato_nome || conversaSelecionada.contato_telefone).charAt(0).toUpperCase()}
                </div>
                <p className="font-bold text-slate-800 text-center text-sm">
                  {conversaSelecionada.contato_nome || 'Sem nome'}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Phone size={11} className="text-slate-400" />
                  <p className="text-slate-500 text-xs">{conversaSelecionada.contato_telefone}</p>
                </div>
                {conversaSelecionada.contato_email && (
                  <p className="text-slate-400 text-xs text-center mt-1 truncate">{conversaSelecionada.contato_email}</p>
                )}
                <div className="mt-3 flex justify-center">
                  {conversaSelecionada.is_aluno ? (
                    <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold flex items-center gap-1">
                      <BookOpen size={11} />Aluno ativo
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">
                      Lead / Prospecto
                    </span>
                  )}
                </div>
              </div>

              {/* Info da conversa */}
              <div className="p-4 border-b border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversa</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1"><Clock size={11} />Início</span>
                  <span className="text-slate-700 font-medium">{formatFullTime(conversaSelecionada.criado_em)}</span>
                </div>
                {conversaSelecionada.atendente && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1"><User size={11} />Atendente</span>
                    <span className="text-slate-700 font-medium truncate max-w-[100px]">{conversaSelecionada.atendente.nome}</span>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="p-4 space-y-2 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Ações</p>

                {conversaSelecionada.status === 'aguardando_humano' && (
                  <button
                    onClick={assumirConversa}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                  >
                    <UserCheck size={14} />
                    Assumir Conversa
                  </button>
                )}

                {conversaSelecionada.status === 'em_atendimento' && (
                  <button
                    onClick={devolverParaIA}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-xl text-xs font-bold hover:bg-violet-100 transition-all"
                  >
                    <Bot size={14} />
                    Devolver para IA
                  </button>
                )}

                {conversaSelecionada.status === 'ia_ativa' && (
                  <button
                    onClick={assumirConversa}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                  >
                    <UserCheck size={14} />
                    Intervir
                  </button>
                )}

                {conversaSelecionada.status !== 'encerrada' && (
                  <button
                    onClick={encerrarConversa}
                    className="w-full flex items-center gap-2 px-3 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
                  >
                    <XCircle size={14} />
                    Encerrar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Métricas */}
      {activeTab === 'metricas' && (
        <div className="flex-1 overflow-y-auto p-6">
          {!metrics ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={24} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-xl font-bold text-slate-800">Métricas dos últimos 30 dias</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total de Conversas', value: metrics.total, icon: MessageCircle, color: 'indigo' },
                  { label: 'Aguardando Humano', value: metrics.aguardando_humano, icon: AlertCircle, color: 'amber' },
                  { label: 'Taxa de Transbordo', value: `${metrics.taxa_transbordo_pct}%`, icon: ChevronRight, color: 'violet' },
                  { label: 'Tempo Médio (min)', value: metrics.tempo_medio_min, icon: Clock, color: 'teal' },
                ].map(m => (
                  <div key={m.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className={`w-10 h-10 bg-${m.color}-50 rounded-xl flex items-center justify-center mb-3`}>
                      <m.icon size={20} className={`text-${m.color}-600`} />
                    </div>
                    <p className="text-3xl font-black text-slate-800">{m.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: '🤖 IA Ativas', value: metrics.ativas },
                  { label: '👤 Em Atendimento', value: metrics.em_atendimento },
                  { label: '✅ Encerradas', value: metrics.encerradas },
                ].map(m => (
                  <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <p className="text-slate-600 text-sm">{m.label}</p>
                    <p className="text-2xl font-bold text-slate-800">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Configurações */}
      {activeTab === 'config' && (
        <AtendimentoIAConfig
          loggedUser={loggedUser}
          loggedRole={loggedRole}
          isSuperAdmin={isSuperAdmin}
          orgId={orgId}
        />
      )}
    </div>
  );
}

// ─── Sub-componente: Configurações ────────────────────────────────────────────

function AtendimentoIAConfig({
  loggedUser, loggedRole, isSuperAdmin, orgId
}: { loggedUser: any; loggedRole: string; isSuperAdmin: boolean; orgId: string }) {
  const [config, setConfig] = useState({ utalk_token: '', utalk_from_phone: '', utalk_organization_id: '', ia_ativa: true, ia_prompt_override: '' });
  const [promptGlobal, setPromptGlobal] = useState('');
  const [editPromptGlobal, setEditPromptGlobal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/whatsapp/config/${orgId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.config) setConfig({ ...config, ...d.config });
        if (d?.prompt_global) { setPromptGlobal(d.prompt_global); setEditPromptGlobal(d.prompt_global); }
      });
  }, [orgId]);

  const salvarConfig = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/whatsapp/config/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      setStatus(res.ok ? { type: 'success', msg: 'Configuração salva!' } : { type: 'error', msg: 'Erro ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const salvarPromptGlobal = async () => {
    const res = await fetch('/api/whatsapp/config/global/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: editPromptGlobal }),
    });
    setStatus(res.ok ? { type: 'success', msg: 'Prompt global salvo!' } : { type: 'error', msg: 'Erro ao salvar prompt.' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-slate-800">Configurações do Canal WhatsApp</h2>

      {status && (
        <div className={`p-3 rounded-xl text-sm font-semibold ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {status.msg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2"><Zap size={16} className="text-amber-500" />Credenciais Umbler uTalk</h3>
        {[
          { key: 'utalk_token', label: 'Token de Autorização', placeholder: 'Bearer eyJ...' },
          { key: 'utalk_from_phone', label: 'Número de Origem (fromPhone)', placeholder: '5511999999999' },
          { key: 'utalk_organization_id', label: 'Organization ID', placeholder: 'org_...' },
        ].map(field => (
          <div key={field.key}>
            <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{field.label}</label>
            <input
              type="text"
              value={(config as any)[field.key]}
              onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={field.placeholder}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ))}

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="ia_ativa"
            checked={config.ia_ativa}
            onChange={e => setConfig(prev => ({ ...prev, ia_ativa: e.target.checked }))}
            className="w-4 h-4 accent-indigo-600"
          />
          <label htmlFor="ia_ativa" className="text-sm font-semibold text-slate-700">IA ativa para esta organização</label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Prompt personalizado (opcional)</label>
          <textarea
            value={config.ia_prompt_override}
            onChange={e => setConfig(prev => ({ ...prev, ia_prompt_override: e.target.value }))}
            placeholder="Deixe em branco para usar o prompt global..."
            rows={4}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          onClick={salvarConfig}
          disabled={isSaving}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {isSuperAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-slate-700 flex items-center gap-2"><Bot size={16} className="text-indigo-500" />Prompt Global da IA (super_admin)</h3>
          <textarea
            value={editPromptGlobal}
            onChange={e => setEditPromptGlobal(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          />
          <button
            onClick={salvarPromptGlobal}
            className="w-full py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-all"
          >
            Salvar Prompt Global
          </button>
        </div>
      )}
    </div>
  );
}

export default AtendimentoIA;
