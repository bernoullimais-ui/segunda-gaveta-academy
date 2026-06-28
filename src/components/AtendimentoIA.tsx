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
  organizacao?: { nome: string } | null;
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
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  const [filtroOrg, setFiltroOrg] = useState<string>('todas');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notificacoesPermitidas, setNotificacoesPermitidas] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const isSuperAdmin = loggedRole === 'super_admin';
  const orgId = loggedUser?.organizacao_id;

  // ── Carrega organizações (apenas para super_admin) ─────────────
  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('organizacoes').select('id, nome').order('nome').then(({ data }) => {
        if (data) setOrganizacoes(data);
      });
    }
  }, [isSuperAdmin]);

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
      if (isSuperAdmin && filtroOrg !== 'todas') params.set('org_id', filtroOrg);
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
  const [transferindo, setTransferindo] = useState(false);
  const [atendentesList, setAtendentesList] = useState<any[]>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from('usuarios').select('id, nome, role, organizacao:organizacoes(nome)')
        .in('role', ['super_admin', 'admin', 'gestor', 'especialista'])
        .order('nome')
        .then(({ data }) => { if (data) setAtendentesList(data); });
    }
  }, [isSuperAdmin]);

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

  const transferirConversa = async (novoAtendenteId: string, contexto?: string) => {
    if (!conversaSelecionada) return;
    await fetch(`/api/whatsapp/conversas/${conversaSelecionada.id}/takeover`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atendente_id: novoAtendenteId, contexto }),
    });
    setConversaSelecionada(prev => prev ? { ...prev, status: 'em_atendimento', atendente_id: novoAtendenteId } : null);
    carregarConversas();
    setTransferindo(false);
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
            {/* Filtro Org (Admin) */}
            {isSuperAdmin && (
              <div className="px-3 pt-3">
                <select
                  className="w-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-lg p-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={filtroOrg}
                  onChange={(e) => setFiltroOrg(e.target.value)}
                >
                  <option value="todas">Todas as Organizações</option>
                  {organizacoes.map(o => (
                    <option key={o.id} value={o.id}>{o.nome}</option>
                  ))}
                </select>
              </div>
            )}

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
              ) : (
                (() => {
                  const map = new Map<string, WaConversa>();
                  conversasFiltradas.forEach(c => {
                    const existing = map.get(c.contato_telefone);
                    if (!existing) {
                      map.set(c.contato_telefone, c);
                    } else {
                      const existingIsActive = existing.status !== 'encerrada';
                      const newIsActive = c.status !== 'encerrada';
                      if (newIsActive && !existingIsActive) {
                        map.set(c.contato_telefone, c);
                      } else if (newIsActive === existingIsActive) {
                        if (new Date(c.ultima_mensagem_em || c.criado_em).getTime() > new Date(existing.ultima_mensagem_em || existing.criado_em).getTime()) {
                          map.set(c.contato_telefone, c);
                        }
                      }
                    }
                  });
                  const agrupadas = Array.from(map.values()).sort((a, b) => new Date(b.ultima_mensagem_em || b.criado_em).getTime() - new Date(a.ultima_mensagem_em || a.criado_em).getTime());

                  if (agrupadas.length === 0) {
                    return (
                      <div className="p-8 text-center">
                        <MessageCircle size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-slate-400 text-sm">Nenhuma conversa</p>
                      </div>
                    );
                  }

                  return agrupadas.map(conversa => {
                    const cfg = STATUS_CONFIG[conversa.status];
                    const isSelected = conversaSelecionada?.contato_telefone === conversa.contato_telefone;
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
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              {conversa.is_aluno && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-teal-50 text-teal-700">
                                  Aluno
                                </span>
                              )}
                              {conversa.organizacao?.nome && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold border border-slate-200 text-slate-500 truncate max-w-[120px]">
                                  {conversa.organizacao.nome}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  });
                })()
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
                  {mensagens.map((msg, index) => {
                    const isFirstOfGroup = index > 0 && mensagens[index - 1].conversa_id !== msg.conversa_id;
                    const isEntrada = msg.direcao === 'entrada';
                    const isSistema = msg.direcao === 'sistema';

                    if (isSistema) {
                      return (
                        <div key={msg.id} className="flex justify-center my-4">
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-lg max-w-[80%] text-center shadow-sm">
                            <span className="font-bold block mb-1">🔒 Nota Interna de Transferência</span>
                            {msg.conteudo}
                            <span className="block text-[10px] text-amber-600/70 mt-1">{formatFullTime(msg.criado_em)}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <React.Fragment key={msg.id}>
                        {isFirstOfGroup && (
                          <div className="flex items-center justify-center my-6 opacity-70">
                            <div className="h-px bg-slate-300 flex-1"></div>
                            <span className="px-3 text-[10px] uppercase font-bold text-slate-400">
                              Conversa Encerrada
                            </span>
                            <div className="h-px bg-slate-300 flex-1"></div>
                          </div>
                        )}
                        <div className={`flex ${isEntrada ? 'justify-start' : 'justify-end'}`}>
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
                      </React.Fragment>
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

                {isSuperAdmin && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setTransferindo(!transferindo)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-white text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-all mb-2"
                    >
                      <User size={14} />
                      {transferindo ? 'Cancelar Transferência' : 'Transferir Conversa'}
                    </button>
                    {transferindo && (
                      <div className="flex flex-col gap-2 mt-2">
                        <select
                          className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id="selectTransfer"
                          defaultValue=""
                        >
                          <option value="" disabled>Selecione um atendente...</option>
                          {atendentesList.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.nome} {a.organizacao?.nome ? `(${a.organizacao.nome})` : ''}
                            </option>
                          ))}
                        </select>
                        <textarea 
                          id="contextoTransfer"
                          className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          rows={3}
                          placeholder="Mensagem de contexto interno (visível apenas para a equipe)..."
                        />
                        <button
                          onClick={() => {
                            const select = document.getElementById('selectTransfer') as HTMLSelectElement;
                            const ctx = document.getElementById('contextoTransfer') as HTMLTextAreaElement;
                            if (select.value) {
                              transferirConversa(select.value, ctx.value);
                            }
                          }}
                          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
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
  const [configTab, setConfigTab] = useState<'agente' | 'base' | 'mensagens' | 'etiquetas'>('agente');
  const [config, setConfig] = useState({
    utalk_token: '', utalk_from_phone: '', utalk_organization_id: '',
    ia_ativa: true, ia_prompt_override: '', palavras_chave_roteamento: '',
    wa_utalk_global_token: '', wa_utalk_global_from_phone: '', wa_utalk_global_organization_id: '',
    wa_ia_ativa_global: true
  });
  const [promptGlobal, setPromptGlobal] = useState('');
  const [editPromptGlobal, setEditPromptGlobal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  const [orgEditandoBase, setOrgEditandoBase] = useState<{ id: string; nome: string } | null>(null);

  const carregarConfig = async () => {
    try {
      const res = await fetch(`/api/whatsapp/config/${orgId}`);
      const d = await res.json();
      if (d?.prompt_global) { setPromptGlobal(d.prompt_global); setEditPromptGlobal(d.prompt_global); }
      if (d?.config || d?.global_tokens) {
        setConfig(prev => ({
          ...prev,
          ...(d.config || {}),
          ...(d.global_tokens || {}),
        }));
      }
    } catch (err) {
      console.error('Erro ao carregar config:', err);
    }
  };

  useEffect(() => {
    if (!orgId) return;
    carregarConfig();
  }, [orgId]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetch('/api/whatsapp/conversas?limit=1')
        .then(() => {})
        .catch(() => {});
      // carrega orgs para a seção de base de conhecimento
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('organizacoes').select('id, nome').order('nome').then(({ data }) => {
          if (data) setOrganizacoes(data);
        });
      });
    }
  }, [isSuperAdmin]);

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
    const res = await fetch('/api/whatsapp/config/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: editPromptGlobal,
        wa_utalk_global_token: (config as any).wa_utalk_global_token,
        wa_utalk_global_from_phone: (config as any).wa_utalk_global_from_phone,
        wa_utalk_global_organization_id: (config as any).wa_utalk_global_organization_id,
        wa_ia_ativa_global: (config as any).wa_ia_ativa_global,
      }),
    });
    setStatus(res.ok ? { type: 'success', msg: 'Configurações globais salvas!' } : { type: 'error', msg: 'Erro ao salvar.' });
  };

  const configTabs = [
    { key: 'agente' as const, label: 'Agente IA' },
    { key: 'base' as const, label: 'Base de Conhecimento' },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub-tabs de Configuração */}
      <div className="flex gap-1 px-6 pt-4 border-b border-slate-100 bg-white">
        {configTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setConfigTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
              configTab === t.key
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Aba: Agente IA */}
      {configTab === 'agente' && (
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
              { key: 'palavras_chave_roteamento', label: 'Palavras-Chave de Roteamento (separadas por vírgula)', placeholder: 'Ex: Dojo One, dojo' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{field.label}</label>
                <input
                  type="text"
                  value={(config as any)[field.key] || ''}
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
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><Bot size={16} className="text-indigo-500" />Configuração Global (Super Admin)</h3>

              <div className="space-y-3 mb-6">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Tokens uTalk Globais (Fallback)</h4>
                {['wa_utalk_global_token', 'wa_utalk_global_from_phone', 'wa_utalk_global_organization_id'].map(key => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase">{key.replace('wa_utalk_global_', '')}</label>
                    <input
                      type="text"
                      value={(config as any)[key] || ''}
                      onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors mb-6">
                <input
                  type="checkbox"
                  checked={(config as any).wa_ia_ativa_global}
                  onChange={e => setConfig(prev => ({ ...prev, wa_ia_ativa_global: e.target.checked }))}
                  className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700 text-sm">IA Ativa Globalmente (Triagem / Fallback)</span>
              </label>

              <h4 className="text-xs font-bold text-slate-500 uppercase mt-4 mb-2">Prompt Global da IA</h4>
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
                Salvar Configurações Globais
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aba: Base de Conhecimento */}
      {configTab === 'base' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen size={20} className="text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-800">Base de Conhecimento</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Adicione textos ou faça upload de documentos (PDF, TXT, DOCX, CSV) para orientar a assistente virtual.
            </p>

            {/* Lista de organizações */}
            <div className="space-y-3">
              {(isSuperAdmin ? organizacoes : [{ id: orgId, nome: 'Esta Organização' }]).map(org => (
                <div
                  key={org.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                      {org.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{org.nome}</p>
                      <p className="text-xs text-slate-400">Identidade / Franquia</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOrgEditandoBase(org)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                  >
                    <BookOpen size={13} />
                    Editar Base
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Editor da Base de Conhecimento */}
      {orgEditandoBase && (
        <BaseConhecimentoEditor
          org={orgEditandoBase}
          onClose={() => setOrgEditandoBase(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-componente: Editor da Base de Conhecimento ──────────────────────────

interface BaseConhecimento {
  comportamento: { nome_assistente: string; persona: string; tom_de_voz: string; regras_formatacao: string };
  regras_de_negocio: { texto: string };
  tabelas_banco: Array<{ tabela: string; colunas: string; filtro: string; descricao: string }>;
  websites: Array<{ url: string; descricao: string }>;
  documentos: Array<{ nome: string; conteudo: string }>;
  perguntas_respostas: Array<{ pergunta: string; resposta: string }>;
  script_de_vendas_e_objecoes: { texto: string };
  fluxo_de_transbordo: { condicoes: string; mensagem_transbordo: string; horario_atendimento: string };
}

const BASE_VAZIA: BaseConhecimento = {
  comportamento: { nome_assistente: '', persona: '', tom_de_voz: '', regras_formatacao: '' },
  regras_de_negocio: { texto: '' },
  tabelas_banco: [],
  websites: [],
  documentos: [],
  perguntas_respostas: [],
  script_de_vendas_e_objecoes: { texto: '' },
  fluxo_de_transbordo: { condicoes: '', mensagem_transbordo: '', horario_atendimento: '' },
};

function BaseConhecimentoEditor({ org, onClose }: { org: { id: string; nome: string }; onClose: () => void }) {
  const [base, setBase] = useState<BaseConhecimento>(JSON.parse(JSON.stringify(BASE_VAZIA)));
  const [abertas, setAbertas] = useState<Record<string, boolean>>({ comportamento: true });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetch(`/api/whatsapp/base/${org.id}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setBase(prev => ({
            comportamento: { ...prev.comportamento, ...(data.comportamento || {}) },
            regras_de_negocio: { ...prev.regras_de_negocio, ...(data.regras_de_negocio || {}) },
            tabelas_banco: data.tabelas_banco || [],
            websites: data.websites || [],
            documentos: data.documentos || [],
            perguntas_respostas: data.perguntas_respostas || [],
            script_de_vendas_e_objecoes: { ...prev.script_de_vendas_e_objecoes, ...(data.script_de_vendas_e_objecoes || {}) },
            fluxo_de_transbordo: { ...prev.fluxo_de_transbordo, ...(data.fluxo_de_transbordo || {}) },
          }));
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [org.id]);

  const toggleSecao = (key: string) => setAbertas(prev => ({ ...prev, [key]: !prev[key] }));

  const salvar = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/whatsapp/base/${org.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
      });
      setSaveStatus(res.ok ? 'success' : 'error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const secaoHeader = (key: string, icon: string, label: string, badge?: number) => (
    <button
      onClick={() => toggleSecao(key)}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors rounded-xl"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-slate-800 text-sm">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <ChevronRight size={16} className={`text-slate-400 transition-transform ${abertas[key] ? 'rotate-90' : ''}`} />
    </button>
  );

  const addItem = (campo: 'tabelas_banco' | 'websites' | 'documentos' | 'perguntas_respostas', item: any) => {
    setBase(prev => ({ ...prev, [campo]: [...(prev[campo] as any[]), item] }));
  };

  const removeItem = (campo: 'tabelas_banco' | 'websites' | 'documentos' | 'perguntas_respostas', idx: number) => {
    setBase(prev => ({ ...prev, [campo]: (prev[campo] as any[]).filter((_, i) => i !== idx) }));
  };

  const updateItem = (campo: 'tabelas_banco' | 'websites' | 'documentos' | 'perguntas_respostas', idx: number, patch: any) => {
    setBase(prev => ({
      ...prev,
      [campo]: (prev[campo] as any[]).map((item, i) => i === idx ? { ...item, ...patch } : item),
    }));
  };

  const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";
  const textareaCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {org.nome.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{org.nome}</p>
              <p className="text-indigo-200 text-xs">Base de Conhecimento da IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
            <XCircle size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Corpo rolável */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">

              {/* 1. Comportamento */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('comportamento', '🎭', 'Comportamento', undefined)}
                {abertas['comportamento'] && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Nome do Assistente</label>
                        <input className={inputCls} placeholder="Ex: Sofia, Gabi, Lara..." value={base.comportamento.nome_assistente} onChange={e => setBase(p => ({ ...p, comportamento: { ...p.comportamento, nome_assistente: e.target.value } }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Tom de Voz</label>
                        <input className={inputCls} placeholder="amigável, profissional, animado..." value={base.comportamento.tom_de_voz} onChange={e => setBase(p => ({ ...p, comportamento: { ...p.comportamento, tom_de_voz: e.target.value } }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Persona</label>
                      <input className={inputCls} placeholder="Ex: Especialista simpática em educação digital..." value={base.comportamento.persona} onChange={e => setBase(p => ({ ...p, comportamento: { ...p.comportamento, persona: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Regras de Formatação</label>
                      <textarea className={textareaCls} rows={3} placeholder="Ex: Mensagens curtas. Usar emojis com moderação. Nunca listas longas no WhatsApp..." value={base.comportamento.regras_formatacao} onChange={e => setBase(p => ({ ...p, comportamento: { ...p.comportamento, regras_formatacao: e.target.value } }))} />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Regras de Negócio */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('regras', '📋', 'Regras de Negócio')}
                {abertas['regras'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Limites operacionais, cupons, trocas e devoluções</label>
                    <textarea className={textareaCls} rows={6} placeholder="Ex: Cupons de desconto só são válidos por 48h após emissão. Não há trocas após 7 dias. Reembolsos levam até 5 dias úteis..." value={base.regras_de_negocio.texto} onChange={e => setBase(p => ({ ...p, regras_de_negocio: { texto: e.target.value } }))} />
                  </div>
                )}
              </div>

              {/* 3. Tabelas do Banco */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('tabelas', '🗄️', 'Tabelas do Banco de Dados', base.tabelas_banco.length)}
                {abertas['tabelas'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs text-slate-500">A IA consultará estas tabelas em tempo real para responder com dados atualizados (vagas, preços, turmas, etc.)</p>
                    {base.tabelas_banco.map((t, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">Tabela #{i + 1}</span>
                          <button onClick={() => removeItem('tabelas_banco', i)} className="text-red-400 hover:text-red-600 transition-colors"><XCircle size={14} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Nome da tabela</label>
                            <input className={inputCls} placeholder="Ex: turmas" value={t.tabela} onChange={e => updateItem('tabelas_banco', i, { tabela: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Colunas (vírgula)</label>
                            <input className={inputCls} placeholder="nome, horario, vagas" value={t.colunas} onChange={e => updateItem('tabelas_banco', i, { colunas: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Filtro (opcional)</label>
                            <input className={inputCls} placeholder="ativo=true" value={t.filtro} onChange={e => updateItem('tabelas_banco', i, { filtro: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Descrição (contexto para IA)</label>
                            <input className={inputCls} placeholder="Turmas ativas da academia" value={t.descricao} onChange={e => updateItem('tabelas_banco', i, { descricao: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => addItem('tabelas_banco', { tabela: '', colunas: '', filtro: '', descricao: '' })} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                      + Adicionar Tabela
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Websites */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('websites', '🌐', 'Websites', base.websites.length)}
                {abertas['websites'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs text-slate-500">Links de referência externa, blogs ou páginas de vendas que a IA poderá citar.</p>
                    {base.websites.map((w, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <input className={inputCls} placeholder="https://..." value={w.url} onChange={e => updateItem('websites', i, { url: e.target.value })} />
                          <input className={inputCls} placeholder="Descrição (ex: Site oficial)" value={w.descricao} onChange={e => updateItem('websites', i, { descricao: e.target.value })} />
                        </div>
                        <button onClick={() => removeItem('websites', i)} className="text-red-400 hover:text-red-600 mt-2 flex-shrink-0"><XCircle size={15} /></button>
                      </div>
                    ))}
                    <button onClick={() => addItem('websites', { url: '', descricao: '' })} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                      + Adicionar Website
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Documentos */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('docs', '📄', 'Documentos', base.documentos.length)}
                {abertas['docs'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs text-slate-500">Manuais, PDFs institucionais, termos de uso. Cole o texto extraído do documento.</p>
                    {base.documentos.map((d, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <input className={`${inputCls} flex-1 mr-2`} placeholder="Nome do documento" value={d.nome} onChange={e => updateItem('documentos', i, { nome: e.target.value })} />
                          <button onClick={() => removeItem('documentos', i)} className="text-red-400 hover:text-red-600 flex-shrink-0"><XCircle size={14} /></button>
                        </div>
                        <textarea className={textareaCls} rows={4} placeholder="Cole aqui o texto do documento (PDF, manual, termos de uso)..." value={d.conteudo} onChange={e => updateItem('documentos', i, { conteudo: e.target.value })} />
                      </div>
                    ))}
                    <button onClick={() => addItem('documentos', { nome: '', conteudo: '' })} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                      + Adicionar Documento
                    </button>
                  </div>
                )}
              </div>

              {/* 6. FAQ */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('faq', '💬', 'Perguntas e Respostas (FAQ)', base.perguntas_respostas.length)}
                {abertas['faq'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <p className="text-xs text-slate-500">Respostas diretas para as dúvidas mais comuns e recorrentes.</p>
                    {base.perguntas_respostas.map((qa, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-500">Q{i + 1}</span>
                          <button onClick={() => removeItem('perguntas_respostas', i)} className="text-red-400 hover:text-red-600"><XCircle size={14} /></button>
                        </div>
                        <input className={inputCls} placeholder="Pergunta frequente..." value={qa.pergunta} onChange={e => updateItem('perguntas_respostas', i, { pergunta: e.target.value })} />
                        <textarea className={textareaCls} rows={3} placeholder="Resposta ideal para essa pergunta..." value={qa.resposta} onChange={e => updateItem('perguntas_respostas', i, { resposta: e.target.value })} />
                      </div>
                    ))}
                    <button onClick={() => addItem('perguntas_respostas', { pergunta: '', resposta: '' })} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-semibold hover:border-indigo-400 hover:text-indigo-600 transition-all">
                      + Adicionar Pergunta e Resposta
                    </button>
                  </div>
                )}
              </div>

              {/* 7. Script de Vendas e Objeções */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('script', '🎯', 'Script de Vendas e Objeções')}
                {abertas['script'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Técnicas de contorno de objeções e gatilhos mentais</label>
                    <textarea className={textareaCls} rows={7} placeholder={'Ex: Quando o lead disser "está caro", responda com: "Entendo! Mas pensa bem — você vai ter acesso a X horas de conteúdo por apenas R$Y por mês. É menos que um café por dia."\n\nGatilhos mentais: escassez, prova social, autoridade...'}
                      value={base.script_de_vendas_e_objecoes.texto}
                      onChange={e => setBase(p => ({ ...p, script_de_vendas_e_objecoes: { texto: e.target.value } }))}
                    />
                  </div>
                )}
              </div>

              {/* 8. Fluxo de Transbordo */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {secaoHeader('transbordo', '🔀', 'Fluxo de Transbordo')}
                {abertas['transbordo'] && (
                  <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Condições para transferir ao humano</label>
                      <textarea className={textareaCls} rows={3} placeholder="Ex: Transferir quando: reclamação, pedido de reembolso, lead pergunta sobre parcelamento especial, ou após 3ª mensagem sem conversão..." value={base.fluxo_de_transbordo.condicoes} onChange={e => setBase(p => ({ ...p, fluxo_de_transbordo: { ...p.fluxo_de_transbordo, condicoes: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Mensagem ao transferir</label>
                      <input className={inputCls} placeholder="Ex: Um especialista vai te atender em instantes! 😊" value={base.fluxo_de_transbordo.mensagem_transbordo} onChange={e => setBase(p => ({ ...p, fluxo_de_transbordo: { ...p.fluxo_de_transbordo, mensagem_transbordo: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Horário de atendimento humano</label>
                      <input className={inputCls} placeholder="Ex: Seg–Sex, 9h–18h (Brasília)" value={base.fluxo_de_transbordo.horario_atendimento} onChange={e => setBase(p => ({ ...p, fluxo_de_transbordo: { ...p.fluxo_de_transbordo, horario_atendimento: e.target.value } }))} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Salvar */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center gap-3">
              {saveStatus === 'success' && <span className="text-emerald-600 text-sm font-semibold flex-1">✓ Base salva com sucesso!</span>}
              {saveStatus === 'error' && <span className="text-red-600 text-sm font-semibold flex-1">✗ Erro ao salvar. Tente novamente.</span>}
              {saveStatus === 'idle' && <span className="flex-1 text-xs text-slate-400">As alterações ficam ativas imediatamente.</span>}
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={isSaving}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isSaving ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : '💾 Salvar Base'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default AtendimentoIA;
