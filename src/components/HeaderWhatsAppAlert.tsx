import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderWhatsAppAlertProps {
  loggedUser: any;
  loggedRole: string;
  onNavigate: (view: string) => void;
}

interface WaConversa {
  id: string;
  status: string;
  contato_nome?: string;
  contato_telefone?: string;
}

export function HeaderWhatsAppAlert({ loggedUser, loggedRole, onNavigate }: HeaderWhatsAppAlertProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [notificacoesPermitidas, setNotificacoesPermitidas] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apenas quem tem permissão para ver Atendimento IA deve ver este componente
  const hasAccess = ['gestor', 'especialista', 'super_admin'].includes(loggedRole);

  // ── Pede permissão de push notification (global)
  useEffect(() => {
    if (!hasAccess) return;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificacoesPermitidas(true);
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          setNotificacoesPermitidas(perm === 'granted');
        });
      }
    }
  }, [hasAccess]);

  // ── Áudio
  useEffect(() => {
    if (!hasAccess) return;
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA' +
      'EAAQAQAAAAAAAAABAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  }, [hasAccess]);

  const tocarSom = useCallback(() => {
    try { audioRef.current?.play(); } catch (_) {}
  }, []);

  const enviarNotificacaoPush = useCallback((titulo: string, corpo: string) => {
    if (notificacoesPermitidas && document.hidden) {
      new Notification(titulo, { body: corpo, icon: '/favicon.ico' });
    }
  }, [notificacoesPermitidas]);

  // ── Carrega e assina conversas
  useEffect(() => {
    if (!hasAccess || !loggedUser?.id) return;

    // 1. Fetch inicial de conversas aguardando humano
    const fetchAguardando = async () => {
      try {
        const { data, error } = await supabase
          .from('wa_conversas')
          .select('id')
          .eq('status', 'aguardando_humano');
        
        if (!error && data) {
          setPendingCount(data.length);
        }
      } catch (err) {
        console.error('[HeaderWhatsAppAlert] Erro ao carregar contagem', err);
      }
    };

    fetchAguardando();

    // 2. Realtime listener APENAS para wa_conversas
    const channel = supabase
      .channel('wa-header-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversas' }, (payload) => {
        const velha = payload.old as WaConversa;
        const nova = payload.new as WaConversa;
        
        // Verifica transição para aguardando_humano
        const isNewAguardando = nova.status === 'aguardando_humano' && velha?.status !== 'aguardando_humano';
        const isLeavingAguardando = velha?.status === 'aguardando_humano' && nova.status !== 'aguardando_humano';

        if (isNewAguardando) {
          tocarSom();
          enviarNotificacaoPush(
            '⚡ Nova conversa aguardando atendimento',
            `${nova.contato_nome || nova.contato_telefone} precisa de ajuda`
          );
          setPendingCount(p => p + 1);
        } else if (isLeavingAguardando) {
          setPendingCount(p => Math.max(0, p - 1));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasAccess, loggedUser?.id, tocarSom, enviarNotificacaoPush]);

  if (!hasAccess) return null;

  return (
    <button
      onClick={() => onNavigate('atendimento_ia')}
      className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
      title="Atendimento IA (WhatsApp)"
    >
      <MessageCircle size={22} className={pendingCount > 0 ? "text-emerald-600" : "text-slate-600"} />
      
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
