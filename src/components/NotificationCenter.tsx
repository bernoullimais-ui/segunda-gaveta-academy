import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Bell, 
  Check, 
  Trash2, 
  MessageCircle, 
  Heart, 
  Mail, 
  BookOpen, 
  Award, 
  Circle,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Notification {
  id: string;
  usuario_id: string;
  organizacao_id: string;
  tipo: 'like' | 'reply' | 'dm' | 'curso' | 'aula' | 'medalha';
  titulo: string;
  mensagem: string;
  link: any;
  lida: boolean;
  criado_em: string;
}

interface NotificationCenterProps {
  loggedUser: any;
  onNavigate: (link: any) => void;
}

export function NotificationCenter({ loggedUser, onNavigate }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.lida).length;

  useEffect(() => {
    if (!loggedUser?.id) return;

    fetchNotifications();

    // Setup Supabase Realtime Subscription
    const channel = supabase
      .channel(`realtime-notifications-${loggedUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${loggedUser.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          // Optional: Play a subtle notification sound
          try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-120.wav');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch (e) {}
        }
      )
      .subscribe();

    // Close dropdown on click outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [loggedUser?.id]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', loggedUser.id)
        .order('criado_em', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('usuario_id', loggedUser.id)
        .eq('lida', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const { error } = await supabase
        .from('notificacoes')
        .delete()
        .eq('usuario_id', loggedUser.id);

      if (error) throw error;
      setNotifications([]);
    } catch (err) {
      console.error('Error deleting notifications:', err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    setIsOpen(false);
    if (!notif.lida) {
      try {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', notif.id);
          
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, lida: true } : n));
      } catch (err) {
        console.error('Error marking single notification read:', err);
      }
    }
    // Redirect user
    if (notif.link) {
      onNavigate(notif.link);
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'like':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
      case 'reply':
        return <MessageCircle className="w-4 h-4 text-indigo-500 fill-indigo-500" />;
      case 'dm':
        return <Mail className="w-4 h-4 text-emerald-500 fill-emerald-500" />;
      case 'curso':
      case 'aula':
        return <BookOpen className="w-4 h-4 text-amber-500" />;
      case 'medalha':
        return <Award className="w-4 h-4 text-yellow-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getBgColor = (tipo: string) => {
    switch (tipo) {
      case 'like': return 'bg-rose-50';
      case 'reply': return 'bg-indigo-50';
      case 'dm': return 'bg-emerald-50';
      case 'curso': return 'bg-amber-50';
      case 'medalha': return 'bg-yellow-50';
      default: return 'bg-slate-50';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all relative cursor-pointer active:scale-95 duration-200"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-0.75 border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl border border-slate-100 shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Notificações</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{unreadCount} não lidas</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    title="Marcar todas como lidas"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    title="Limpar todas"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Bell className="w-8 h-8 text-slate-200" />
                  <p className="text-xs font-semibold">Tudo tranquilo por aqui!</p>
                  <p className="text-[10px] text-slate-400">Você não tem nenhuma notificação.</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 flex items-start gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer relative ${
                      !notif.lida ? 'bg-indigo-50/20' : ''
                    }`}
                  >
                    {/* Unread marker bar */}
                    {!notif.lida && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r"></div>
                    )}
                    
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getBgColor(notif.tipo)}`}>
                      {getIcon(notif.tipo)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-slate-900 text-xs truncate">{notif.titulo}</span>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap pt-0.5">
                          {new Date(notif.criado_em).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed break-words">
                        {notif.mensagem}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
