import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  Activity, 
  Settings, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Trash2, 
  ShieldCheck,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Inbox,
  Ticket,
  BarChart3,
  Globe,
  Percent,
  ShoppingCart,
  DollarSign,
  Eye,
  MonitorPlay
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ActionModal } from './ActionModal';
import { CursosAdmin } from './CursosAdmin';
import { Community } from './Community';
import { CuponsAdmin } from './CuponsAdmin';
import { WebsiteEditor } from './WebsiteEditor';

export function SuperAdminPanel({ loggedUser }: { loggedUser: any }) {
  const [organizacoes, setOrganizacoes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'organizacoes' | 'cursos' | 'comunidade' | 'atividades' | 'super_admins' | 'cupons' | 'trafego' | 'website'>('organizacoes');
  
  // Traffic Analytics States
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [purchasesData, setPurchasesData] = useState<any[]>([]);
  const [trafficLoading, setTrafficLoading] = useState(false);

  const fetchTrafficAnalytics = async () => {
    setTrafficLoading(true);
    try {
      const [trafficRes, purchasesRes] = await Promise.all([
        supabase.from('traffic_events').select('*'),
        supabase.from('compras').select('*, usuarios(nome, email, organizacao_id)')
      ]);

      if (trafficRes.data) setTrafficData(trafficRes.data);
      if (purchasesRes.data) setPurchasesData(purchasesRes.data);
    } catch (err) {
      console.error("Error fetching traffic analytics:", err);
    } finally {
      setTrafficLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'trafego') {
      fetchTrafficAnalytics();
    }
  }, [activeTab]);
  
  // Dashboard and activity states
  const [metrics, setMetrics] = useState({
    totalOrgs: 0,
    totalUsers: 0,
    totalCursos: 0,
    totalMatriculas: 0,
    totalEngagement: 0
  });
  const [activities, setActivities] = useState<any[]>([]);
  const [isActivitiesLoading, setIsActivitiesLoading] = useState(false);
  const [selectedOrgForCursos, setSelectedOrgForCursos] = useState<string>('');
  
  // Modal state
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type?: 'confirm', title?: string, message?: string, onConfirm?: () => void}>({ isOpen: false });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [orgRes, userRes] = await Promise.all([
        supabase.from('organizacoes').select('*').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('*')
      ]);

      if (orgRes.data) {
        setOrganizacoes(orgRes.data);
        if (orgRes.data.length > 0) {
          setSelectedOrgForCursos(orgRes.data[0].id);
        }
      }
      if (userRes.data) setUsuarios(userRes.data);

      // Fetch other metrics
      const [
        cursosCountRes,
        matriculasCountRes,
        postsCountRes,
        commentsCountRes
      ] = await Promise.all([
        supabase.from('cursos').select('id', { count: 'exact', head: true }),
        supabase.from('curso_participantes').select('id', { count: 'exact', head: true }),
        supabase.from('community_posts').select('id', { count: 'exact', head: true }),
        supabase.from('community_comments').select('id', { count: 'exact', head: true })
      ]);

      setMetrics({
        totalOrgs: orgRes.data?.length || 0,
        totalUsers: userRes.data?.length || 0,
        totalCursos: cursosCountRes.count || 0,
        totalMatriculas: matriculasCountRes.count || 0,
        totalEngagement: (postsCountRes.count || 0) + (commentsCountRes.count || 0)
      });

      // Fetch logs
      await fetchLogs();

    } catch (err) {
      console.error('Erro ao buscar dados do super admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    setIsActivitiesLoading(true);
    try {
      const [
        usuariosRes,
        postsRes,
        commentsRes,
        participantesRes,
        cursosQueryRes
      ] = await Promise.all([
        supabase.from('usuarios').select('id, nome, email, role, created_at, organizacoes(nome)').order('created_at', { ascending: false }).limit(20),
        supabase.from('community_posts').select('id, title, user_nome, user_role, created_at, organizacoes(nome)').order('created_at', { ascending: false }).limit(20),
        supabase.from('community_comments').select('id, conteudo, user_nome, user_role, created_at, community_posts(title)').order('created_at', { ascending: false }).limit(20),
        supabase.from('curso_participantes').select('id, created_at, status, usuarios(nome, email), cursos(nome)').order('created_at', { ascending: false }).limit(20),
        supabase.from('cursos').select('id, nome, created_at, updated_at, organizacoes(nome)').order('created_at', { ascending: false }).limit(20)
      ]);

      // Defensive fallback for cursos query
      let finalCursosData: any[] | null = cursosQueryRes.data;
      if (cursosQueryRes.error) {
        const fallbackRes = await supabase.from('cursos').select('id, nome, created_at, organizacoes(nome)').order('created_at', { ascending: false }).limit(20);
        finalCursosData = fallbackRes.data as any[] | null;
      }

      const merged: any[] = [];

      if (usuariosRes.data) {
        usuariosRes.data.forEach((u: any) => {
          const isSuper = u.role === 'super_admin';
          merged.push({
            id: `cadastro-${u.id}`,
            type: 'cadastro',
            date: actDate(u.created_at),
            title: 'Novo Cadastro de Usuário',
            description: isSuper 
              ? `O Administrador Segunda Gaveta Academy cadastrou-se na plataforma.`
              : `${u.nome || u.email} cadastrou-se na plataforma como ${u.role === 'especialista' ? 'Especialista' : 'Membro'}.`,
            orgName: u.organizacoes?.nome || 'Sem Organização',
            author: isSuper ? 'Administrador Segunda Gaveta Academy' : (u.nome || u.email),
            role: u.role
          });
        });
      }

      if (postsRes.data) {
        postsRes.data.forEach((p: any) => {
          const isSuper = p.user_role === 'super_admin';
          merged.push({
            id: `post-${p.id}`,
            type: 'post_comunidade',
            date: actDate(p.created_at),
            title: 'Nova Postagem na Comunidade',
            description: `Publicou um novo post: "${p.title || 'Sem título'}"`,
            orgName: p.organizacoes?.nome || 'Sem Organização',
            author: isSuper ? 'Administrador Segunda Gaveta Academy' : (p.user_nome || 'Usuário'),
            role: p.user_role
          });
        });
      }

      if (commentsRes.data) {
        commentsRes.data.forEach((c: any) => {
          const isSuper = c.user_role === 'super_admin';
          merged.push({
            id: `comment-${c.id}`,
            type: 'resposta_comunidade',
            date: actDate(c.created_at),
            title: 'Nova Resposta na Comunidade',
            description: `Respondeu no post "${c.community_posts?.title || 'Sem título'}": "${c.conteudo?.substring(0, 60)}${c.conteudo?.length > 60 ? '...' : ''}"`,
            orgName: 'Comunidade',
            author: isSuper ? 'Administrador Segunda Gaveta Academy' : (c.user_nome || 'Usuário'),
            role: c.user_role
          });
        });
      }

      if (participantesRes.data) {
        participantesRes.data.forEach((part: any) => {
          merged.push({
            id: `matricula-${part.id}`,
            type: 'matricula_automatica',
            date: actDate(part.created_at),
            title: 'Matrícula Automática Realizada',
            description: `Aluno ${part.usuarios?.nome || part.usuarios?.email || 'N/A'} matriculou-se no curso "${part.cursos?.nome || 'N/A'}" via checkout integrado.`,
            orgName: 'Pagar.me Checkout',
            author: part.usuarios?.nome || part.usuarios?.email || 'Aluno',
            role: 'membro'
          });
        });
      }

      if (finalCursosData) {
        finalCursosData.forEach((curso: any) => {
          const isUpdate = curso.updated_at && new Date(curso.updated_at).getTime() > new Date(curso.created_at).getTime() + 5000;
          merged.push({
            id: `curso-${curso.id}-${isUpdate ? 'update' : 'create'}`,
            type: isUpdate ? 'alteracao_curso' : 'criacao_curso',
            date: isUpdate ? actDate(curso.updated_at) : actDate(curso.created_at),
            title: isUpdate ? 'Curso Alterado' : 'Novo Curso Criado',
            description: isUpdate 
              ? `O curso "${curso.nome}" foi modificado pelo especialista.`
              : `O curso "${curso.nome}" foi criado na plataforma.`,
            orgName: curso.organizacoes?.nome || 'Sem Organização',
            author: 'Especialista',
            role: 'especialista'
          });
        });
      }

      merged.sort((a, b) => b.date.getTime() - a.date.getTime());
      setActivities(merged);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setIsActivitiesLoading(false);
    }
  };

  const actDate = (dStr: any) => {
    return dStr ? new Date(dStr) : new Date();
  };

  const handleSaveOrg = async () => {
    if (!selectedOrg || !editingName.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizacoes')
        .update({ nome: editingName.trim() })
        .eq('id', selectedOrg.id);
        
      if (error) throw error;
      
      setOrganizacoes(prev => prev.map(org => 
        org.id === selectedOrg.id ? { ...org, nome: editingName.trim() } : org
      ));
      
      setSelectedOrg(null);
      fetchData();
    } catch (err) {
      console.error('Erro ao salvar organização:', err);
      alert('Erro ao salvar organização.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOrg = async (org: any) => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Excluir Organização',
      message: `Tem certeza que deseja EXCLUIR DEFINITIVAMENTE a organização "${org.nome}" e TODOS os seus dados (usuários, avaliações, treinamentos)? Esta ação NÃO pode ser desfeita.`,
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.rpc('delete_organization', { org_id: org.id });
          if (error) throw error;
          
          setOrganizacoes(prev => prev.filter(o => o.id !== org.id));
          setUsuarios(prev => prev.filter(u => u.organizacao_id !== org.id));
          fetchData();
        } catch (err: any) {
          console.error('Erro ao excluir organização:', err);
          alert('Erro ao excluir organização: ' + (err.message || 'Erro desconhecido.'));
        }
      }
    });
  };

  const handleToggleSuperAdmin = async (user: any) => {
    const isSuper = user.role === 'super_admin';
    const newStatus = !isSuper;
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: newStatus ? 'Promover a Super Admin' : 'Remover Super Admin',
      message: newStatus 
        ? `Tem certeza que deseja promover "${user.nome}" a Super Admin? Ele terá acesso total a todas as organizações.`
        : `Tem certeza que deseja remover os privilégios de Super Admin de "${user.nome}"?`,
      onConfirm: async () => {
        setModalConfig({ isOpen: false });
        try {
          const { error } = await supabase.rpc('toggle_super_admin', { 
            user_id: user.id, 
            make_super_admin: newStatus 
          });
          if (error) throw error;
          
          setUsuarios(prev => prev.map(u => 
            u.id === user.id ? { ...u, role: newStatus ? 'super_admin' : 'membro' } : u
          ));
          fetchData();
        } catch (err: any) {
          console.error('Erro ao alterar privilégios:', err);
          alert('Erro ao alterar privilégios: ' + (err.message || 'Erro desconhecido.'));
        }
      }
    });
  };

  const filteredOrgs = organizacoes.filter(org => 
    org.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = usuarios.filter(user => 
    (user.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Carregando painel de administração...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="mb-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel Super-Admin</h1>
        <p className="text-slate-500 mt-1 font-medium">Gestão global da plataforma Segunda Gaveta Academy</p>
      </div>

      {/* Grid de Métricas Globais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{organizacoes.length}</div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Organizações Ativas</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalMatriculas}</div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Alunos Matriculados</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalCursos}</div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Cursos Publicados</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalEngagement}</div>
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Total Interações</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/60 max-w-max">
        <button
          onClick={() => {
            setActiveTab('organizacoes');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'organizacoes' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Organizações
        </button>
        <button
          onClick={() => setActiveTab('cursos')}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'cursos' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Gestão de Cursos
        </button>
        <button
          onClick={() => setActiveTab('comunidade')}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'comunidade' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Comunidade Hub
        </button>
        <button
          onClick={() => {
            setActiveTab('atividades');
            fetchLogs();
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'atividades' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          Atividades Feed
        </button>
        <button
          onClick={() => {
            setActiveTab('super_admins');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'super_admins' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Super Admins
        </button>
        <button
          onClick={() => {
            setActiveTab('cupons');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'cupons' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Cupons & Descontos
        </button>
        <button
          onClick={() => {
            setActiveTab('trafego');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'trafego' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Tráfego & Funis
        </button>
        <button
          onClick={() => {
            setActiveTab('website');
            setSearchTerm('');
          }}
          className={`flex items-center gap-2 px-4 py-2 font-bold text-sm rounded-lg transition-all ${
            activeTab === 'website' ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-white/50 hover:text-slate-900'
          }`}
        >
          <MonitorPlay className="w-4 h-4" />
          Site Institucional
        </button>
      </div>

      {/* Tab Contents */}
      
      {/* 1. Organizações */}
      {activeTab === 'organizacoes' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800">Organizações Cadastradas</h2>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar organização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none w-full sm:w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-4">Nome da Organização</th>
                  <th className="p-4">Data de Cadastro</th>
                  <th className="p-4">Usuários</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrgs.map((org) => {
                  const orgUsers = usuarios.filter(u => u.organizacao_id === org.id);
                  const adminUser = orgUsers.find(u => u.role === 'especialista' || u.role === 'gestor');
                  
                  return (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{org.nome}</div>
                        {org.slug && <div className="text-xs text-indigo-600 font-semibold mt-0.5">Slug: {org.slug}</div>}
                        {adminUser && <div className="text-xs text-slate-500 mt-0.5">Especialista/Dono: {adminUser.email}</div>}
                      </td>
                      <td className="p-4 text-slate-600">
                        {org.created_at ? new Date(org.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {orgUsers.length} usuários
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              if (org.slug) {
                                window.location.href = `/projeto/${org.slug}`;
                              } else {
                                alert('Esta organização não possui um slug configurado.');
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Acessar Portal da Organização"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedOrg(org);
                              setEditingName(org.nome);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                            title="Gerenciar Organização (Avançado)"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteOrg(org)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Organização"
                            disabled={org.id === '00000000-0000-0000-0000-000000000000'}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Nenhuma organização encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Cursos & Especialistas */}
      {activeTab === 'cursos' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Gestão Compartilhada de Cursos</h3>
              <p className="text-sm text-slate-500 mt-1">Selecione o projeto/organização para atuar como coprodutor e gerenciar cursos/módulos.</p>
            </div>
            {organizacoes.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projeto / Organização:</span>
                <select
                  value={selectedOrgForCursos}
                  onChange={(e) => setSelectedOrgForCursos(e.target.value)}
                  className="p-1 border-none rounded-lg bg-transparent text-sm font-bold text-slate-800 outline-none focus:ring-0 cursor-pointer"
                >
                  {organizacoes.map(org => (
                    <option key={org.id} value={org.id}>{org.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {selectedOrgForCursos ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden">
              <CursosAdmin loggedUser={loggedUser} orgId={selectedOrgForCursos} />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200 shadow-sm">
              Crie uma organização primeiro para gerenciar seus cursos.
            </div>
          )}
        </div>
      )}

      {/* 3. Comunidades Hub */}
      {activeTab === 'comunidade' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <Community loggedUser={loggedUser} orgSettings={{}} />
        </div>
      )}

      {/* 4. Timeline de Atividades */}
      {activeTab === 'atividades' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 font-black">Feed de Atividades Recentes</h3>
              <p className="text-sm text-slate-500 mt-1">Histórico em tempo real de novos cadastros, vendas/matrículas, posts de comunidade e cursos das marcas.</p>
            </div>
            <button 
              onClick={fetchLogs}
              disabled={isActivitiesLoading}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200 flex items-center gap-2"
            >
              {isActivitiesLoading ? 'Atualizando...' : 'Atualizar Feed'}
            </button>
          </div>

          {isActivitiesLoading ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
              Buscando novas atividades...
            </div>
          ) : activities.length === 0 ? (
            <div className="py-20 text-center text-slate-400 italic">
              Nenhuma atividade registrada por enquanto.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 pl-6 ml-4 space-y-6">
              {activities.map((act) => {
                let iconBg = 'bg-slate-100 text-slate-600';
                let ActIcon = Users;
                
                if (act.type === 'cadastro') {
                  iconBg = 'bg-blue-50 text-blue-600 border border-blue-100';
                  ActIcon = Users;
                } else if (act.type === 'post_comunidade') {
                  iconBg = 'bg-purple-50 text-purple-600 border border-purple-100';
                  ActIcon = MessageSquare;
                } else if (act.type === 'resposta_comunidade') {
                  iconBg = 'bg-indigo-50 text-indigo-600 border border-indigo-100';
                  ActIcon = MessageSquare;
                } else if (act.type === 'matricula_automatica') {
                  iconBg = 'bg-emerald-50 text-emerald-600 border border-emerald-100';
                  ActIcon = ShieldCheck;
                } else if (act.type === 'criacao_curso') {
                  iconBg = 'bg-amber-50 text-amber-600 border border-amber-100';
                  ActIcon = BookOpen;
                } else if (act.type === 'alteracao_curso') {
                  iconBg = 'bg-orange-50 text-orange-600 border border-orange-100';
                  ActIcon = Settings;
                }

                return (
                  <div key={act.id} className="relative group">
                    <span className={`absolute -left-[37px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center ${iconBg} shadow-sm z-10 transition-transform group-hover:scale-110`}>
                      <ActIcon className="w-3.5 h-3.5" />
                    </span>
                    
                    <div className="bg-slate-50 hover:bg-slate-100/50 p-4 rounded-xl border border-slate-200/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <span className="text-sm font-bold text-slate-800">{act.title}</span>
                        <span className="text-xs text-slate-400 font-medium">
                          {act.date.toLocaleDateString('pt-BR')} às {act.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 font-medium mb-3 leading-relaxed">{act.description}</p>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                          PROJETO: {act.orgName}
                        </span>
                        {act.author && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                            Autor: {act.author} ({act.role})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Gestão de Super Admins */}
      {activeTab === 'super_admins' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800">Todos os Usuários</h2>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none w-full sm:w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-4">Usuário</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Organização</th>
                  <th className="p-4">Status Super Admin</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const userOrg = organizacoes.find(o => o.id === user.organizacao_id);
                  const isSuper = user.role === 'super_admin';
                  
                  return (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{user.nome || 'Sem Nome'}</div>
                        <div className="text-xs text-slate-500 mt-0.5 capitalize">{user.role}</div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {user.email}
                      </td>
                      <td className="p-4 text-slate-600">
                        {userOrg?.nome || 'N/A'}
                      </td>
                      <td className="p-4">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Padrão
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleToggleSuperAdmin(user)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isSuper 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' 
                              : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
                          }`}
                        >
                          {isSuper ? 'Remover Privilégio' : 'Promover a Super Admin'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Cupons de Desconto */}
      {activeTab === 'cupons' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 font-black">Gestão Global de Cupons</h3>
              <p className="text-sm text-slate-500 mt-1">Selecione o projeto/organização para gerenciar e criar cupons promocionais.</p>
            </div>
            {organizacoes.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projeto / Organização:</span>
                <select
                  value={selectedOrgForCursos}
                  onChange={(e) => setSelectedOrgForCursos(e.target.value)}
                  className="p-1 border-none rounded-lg bg-transparent text-sm font-bold text-slate-800 outline-none focus:ring-0 cursor-pointer"
                >
                  {organizacoes.map(org => (
                    <option key={org.id} value={org.id}>{org.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          {selectedOrgForCursos ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
              <CuponsAdmin orgId={selectedOrgForCursos} />
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200 shadow-sm">
              Selecione ou crie uma organização primeiro para gerenciar seus cupons.
            </div>
          )}
        </div>
      )}

      {/* 7. Tráfego e Funis */}
      {activeTab === 'trafego' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800 font-black">Tráfego & Funis de Conversão</h3>
              <p className="text-sm text-slate-500 mt-1">Análise unificada de campanhas, funil de vendas e tráfego multitenant.</p>
            </div>
            <button 
              onClick={fetchTrafficAnalytics}
              disabled={trafficLoading}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
            >
              {trafficLoading ? 'Atualizando...' : 'Atualizar Dados'}
            </button>
          </div>

          {trafficLoading ? (
            <div className="py-20 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4"></div>
              Carregando analytics de tráfego...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Funil de Vendas Visual */}
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                <h4 className="text-base font-bold text-slate-800 uppercase tracking-wider">Funil de Conversão Consolidado</h4>
                
                {(() => {
                  const pvs = trafficData.filter(e => e.event_type === 'page_view').length;
                  const cis = trafficData.filter(e => e.event_type === 'checkout_initiated').length;
                  const sales = purchasesData.filter(p => p.status === 'pago').length;
                  
                  const pvToCiRate = pvs > 0 ? (cis / pvs * 100).toFixed(1) : '0';
                  const ciToSaleRate = cis > 0 ? (sales / cis * 100).toFixed(1) : '0';
                  const overallRate = pvs > 0 ? (sales / pvs * 100).toFixed(1) : '0';

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 text-center">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">1. Visualizações de Página</span>
                          <h5 className="text-3xl font-black text-blue-600 mt-2">{pvs}</h5>
                          <span className="text-[10px] text-slate-400 font-semibold mt-1 block">Acessos a Landing Pages</span>
                        </div>
                        <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100/50 text-center relative">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">2. Checkouts Iniciados</span>
                          <h5 className="text-3xl font-black text-amber-600 mt-2">{cis}</h5>
                          <span className="text-xs font-bold text-slate-500 mt-1 block">Taxa de Avanço: {pvToCiRate}%</span>
                        </div>
                        <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100/50 text-center">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">3. Vendas Confirmadas</span>
                          <h5 className="text-3xl font-black text-emerald-600 mt-2">{sales}</h5>
                          <span className="text-xs font-bold text-slate-500 mt-1 block">Taxa de Fechamento: {ciToSaleRate}%</span>
                        </div>
                      </div>

                      {/* Visual Funnel Representation */}
                      <div className="space-y-4 pt-4 border-t border-slate-100">
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>CONVERSÃO GLOBAL (VISITAS ➔ VENDAS)</span>
                            <span>{overallRate}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, parseFloat(overallRate) * 5)}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Attribution Table by UTM Source */}
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h4 className="text-base font-bold text-slate-800 uppercase tracking-wider">Atribuição por Origem (UTM Source)</h4>
                </div>
                
                {(() => {
                  // Group everything by utm_source
                  const utmMap: Record<string, { pvs: number, cis: number, sales: number, revenue: number }> = {};
                  
                  trafficData.forEach(e => {
                    const src = e.utm_source || 'Direto / Orgânico';
                    if (!utmMap[src]) utmMap[src] = { pvs: 0, cis: 0, sales: 0, revenue: 0 };
                    if (e.event_type === 'page_view') utmMap[src].pvs++;
                    if (e.event_type === 'checkout_initiated') utmMap[src].cis++;
                  });

                  purchasesData.forEach(p => {
                    if (p.status !== 'pago') return;
                    const src = p.utm_source || 'Direto / Orgânico';
                    if (!utmMap[src]) utmMap[src] = { pvs: 0, cis: 0, sales: 0, revenue: 0 };
                    utmMap[src].sales++;
                    utmMap[src].revenue += parseFloat(p.valor_pago) || 0;
                  });

                  const rows = Object.entries(utmMap).map(([source, metrics]) => ({
                    source,
                    ...metrics,
                    conversionRate: metrics.pvs > 0 ? (metrics.sales / metrics.pvs * 100).toFixed(1) : '0.0'
                  })).sort((a, b) => b.revenue - a.revenue);

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                          <tr>
                            <th className="p-4 pl-6">Origem (UTM Source)</th>
                            <th className="p-4 text-center">Page Views</th>
                            <th className="p-4 text-center">Checkouts</th>
                            <th className="p-4 text-center">Vendas</th>
                            <th className="p-4 text-center">Taxa Conversão</th>
                            <th className="p-4 text-right pr-6">Faturamento</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 pl-6 font-bold text-slate-800">{row.source}</td>
                              <td className="p-4 text-center">{row.pvs}</td>
                              <td className="p-4 text-center">{row.cis}</td>
                              <td className="p-4 text-center text-emerald-600 font-bold">{row.sales}</td>
                              <td className="p-4 text-center font-bold">{row.conversionRate}%</td>
                              <td className="p-4 text-right pr-6 font-black text-slate-900">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.revenue)}
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-500">
                                Nenhum dado de tráfego atribuído por enquanto.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Benchmarks by Organization */}
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h4 className="text-base font-bold text-slate-800 uppercase tracking-wider">Benchmark de Projetos (Conversão por Organização)</h4>
                </div>
                <div className="p-6 space-y-6">
                  {organizacoes.map(org => {
                    const orgPvs = trafficData.filter(e => e.organizacao_id === org.id && e.event_type === 'page_view').length;
                    const orgSales = purchasesData.filter(p => p.usuarios?.organizacao_id === org.id && p.status === 'pago').length;
                    const rate = orgPvs > 0 ? (orgSales / orgPvs * 100).toFixed(1) : '0.0';
                    const revenue = purchasesData
                      .filter(p => p.usuarios?.organizacao_id === org.id && p.status === 'pago')
                      .reduce((sum, p) => sum + (parseFloat(p.valor_pago) || 0), 0);

                    return (
                      <div key={org.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100/50 transition-colors">
                        <div>
                          <h5 className="font-bold text-slate-800">{org.nome}</h5>
                          <p className="text-xs text-slate-500 font-semibold mt-0.5">{orgPvs} Visitas ➔ {orgSales} Vendas</p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Taxa</span>
                            <span className="text-lg font-black text-indigo-600">{rate}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Receita</span>
                            <span className="text-lg font-black text-slate-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(revenue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Website Institucional */}
      {activeTab === 'website' && (
        <WebsiteEditor />
      )}

      {/* Modal de Edição de Organização */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-red-600" />
                Gerenciar Organização
              </h3>
              <button 
                onClick={() => setSelectedOrg(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome da Organização</label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                  placeholder="Nome da Organização"
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  Usuários Vinculados ({usuarios.filter(u => u.organizacao_id === selectedOrg.id).length})
                </h4>
                <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-slate-500 font-medium sticky top-0">
                      <tr>
                        <th className="p-3">Nome</th>
                        <th className="p-3">E-mail</th>
                        <th className="p-3">Função</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {usuarios.filter(u => u.organizacao_id === selectedOrg.id).map(u => (
                        <tr key={u.id}>
                          <td className="p-3 font-medium text-slate-800">{u.nome || 'Sem Nome'}</td>
                          <td className="p-3 text-slate-600">{u.email}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'especialista' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-200 text-slate-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrg(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveOrg}
                disabled={isSaving || !editingName.trim()}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
      {modalConfig.isOpen && (
        <ActionModal
          isOpen={modalConfig.isOpen}
          type={modalConfig.type as any}
          title={modalConfig.title || ''}
          message={modalConfig.message}
          onCancel={() => setModalConfig({ isOpen: false })}
          onConfirm={modalConfig.onConfirm}
        />
      )}
    </div>
  );
}
