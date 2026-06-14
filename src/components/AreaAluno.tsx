import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Bell,
  Search,
  User as UserIcon,
  MessageSquare,
  LogOut,
  Share2,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardAluno } from './DashboardAluno';
import { Community } from './Community';
import { CursosCandidato } from './CursosCandidato';
import { AreaAfiliados } from './AreaAfiliados';
import { DadosRecebimento } from './DadosRecebimento';
import { supabase } from '../lib/supabase';
import { NotificationCenter } from './NotificationCenter';

interface AreaAlunoProps {
  loggedUser: any;
  userRole: string;
  globalOrgId?: string | null;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'comunidade' | 'cursos' | 'afiliados' | 'dados_recebimento';

export function AreaAluno({ loggedUser, userRole, globalOrgId, onLogout }: AreaAlunoProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [pendingMessages, setPendingMessages] = useState(0);
  const [initialCourseId, setInitialCourseId] = useState<string | null>(null);

  // Redirection states for Community
  const [communityInitialTab, setCommunityInitialTab] = useState<'feed' | 'messages'>('feed');
  const [communityInitialPostId, setCommunityInitialPostId] = useState<string | null>(null);
  const [communityInitialRecipientId, setCommunityInitialRecipientId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingData();
  }, [loggedUser]);

  const fetchPendingData = async () => {
    try {
      const { data, count, error } = await supabase
        .from('community_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', loggedUser.id)
        .eq('read', false);
      
      if (!error && count !== null) {
        setPendingMessages(count);
      }
    } catch (err) {
      console.error('Error fetching unread messages count:', err);
    }
  };

  const handleNavigate = (link: any) => {
    if (link.tab === 'comunidade') {
      setCommunityInitialTab(link.dmSenderId ? 'messages' : 'feed');
      setCommunityInitialPostId(link.postId || null);
      setCommunityInitialRecipientId(link.dmSenderId || null);
      setActiveTab('comunidade');
    } else if (link.tab === 'cursos') {
      setInitialCourseId(link.courseId || null);
      setActiveTab('cursos');
    } else if (link.tab === 'dashboard') {
      setActiveTab('dashboard');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardAluno 
            loggedUser={loggedUser} 
            onNavigateToCourse={(course) => {
              setInitialCourseId(course.id);
              setActiveTab('cursos');
            }}
          />
        );
      case 'comunidade':
        return (
          <Community 
            loggedUser={loggedUser} 
            orgSettings={{}} 
            initialTab={communityInitialTab}
            initialPostId={communityInitialPostId}
            initialRecipientId={communityInitialRecipientId}
          />
        );
      case 'cursos':
        return (
          <CursosCandidato 
            userRole={userRole} 
            globalOrgId={globalOrgId}
            initialCourseId={initialCourseId}
            onClearInitialCourse={() => setInitialCourseId(null)}
          />
        );
      case 'afiliados':
        return (
          <AreaAfiliados 
            loggedUser={loggedUser}
            orgSlug={loggedUser?.organizacoes?.slug || ''}
            organizacaoId={loggedUser?.organizacao_id || ''}
          />
        );
      case 'dados_recebimento':
        return (
          <DadosRecebimento 
            loggedUser={loggedUser}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Navigation / Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo or Area Title */}
            <div className="flex items-center gap-3">
              {loggedUser?.organizacoes?.logo_url ? (
                <img 
                  src={loggedUser.organizacoes.logo_url} 
                  alt="Logo" 
                  className="w-10 h-10 object-contain rounded-lg shrink-0"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xl uppercase tracking-tighter shrink-0"
                  style={{ backgroundColor: loggedUser?.organizacoes?.cor_primaria || '#4f46e5' }}
                >
                  {(loggedUser?.organizacoes?.nome || 'AD').substring(0, 2)}
                </div>
              )}
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
                {loggedUser?.organizacoes?.nome || 'Área do Aluno'}
              </h1>
            </div>

            {/* Main Tabs */}
            <nav className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <TabButton 
                active={activeTab === 'dashboard'} 
                onClick={() => setActiveTab('dashboard')}
                icon={<LayoutDashboard size={18} />}
                label="Dashboard"
              />
              <TabButton 
                active={activeTab === 'comunidade'} 
                onClick={() => {
                  setCommunityInitialTab('feed');
                  setCommunityInitialPostId(null);
                  setCommunityInitialRecipientId(null);
                  setActiveTab('comunidade');
                }}
                icon={<MessageSquare size={18} />}
                label="Comunidade"
                badge={pendingMessages > 0 ? pendingMessages : undefined}
              />
              <TabButton 
                active={activeTab === 'cursos'} 
                onClick={() => setActiveTab('cursos')}
                icon={<Users size={18} />}
                label="Cursos"
              />
              <TabButton 
                active={activeTab === 'afiliados'} 
                onClick={() => setActiveTab('afiliados')}
                icon={<Share2 size={18} />}
                label="Afiliados"
              />
            </nav>

            {/* Profile / Notifications / Logout */}
            <div className="flex items-center gap-3">
              <NotificationCenter loggedUser={loggedUser} onNavigate={handleNavigate} />
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none mb-1">{loggedUser.nome || loggedUser.email}</span>
                <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-widest">{userRole}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                {loggedUser.nome ? loggedUser.nome.charAt(0) : <UserIcon size={20} />}
              </div>
              <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 mx-1"></div>
              <button 
                onClick={onLogout}
                className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Minimalist Footer */}
      <footer className="mt-auto py-6 border-t border-slate-200 dark:border-slate-800 text-center flex-shrink-0">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          By <span className="text-slate-500 dark:text-slate-400 font-bold">Segunda Gaveta Academy</span>
        </p>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all relative ${
        active 
          ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm shadow-indigo-100 dark:shadow-none ring-1 ring-indigo-50 dark:ring-slate-700' 
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 border-2 border-slate-50 dark:border-slate-800">
          {badge}
        </span>
      )}
    </button>
  );
}
