import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  MessagesSquare, 
  TrendingUp, 
  Award,
  Clock,
  CheckCircle,
  Activity,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { supabase } from '../lib/supabase';

interface DashboardCensoProps {
  loggedUser?: any;
  orgId?: string;
}

interface ActivityLogItem {
  id: string;
  date: Date;
  user: string;
  action: string;
  target: string;
  type: 'completion' | 'enrollment' | 'post';
}

export function DashboardCenso({ loggedUser, orgId }: DashboardCensoProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCourses: 0,
    totalPosts: 0,
    completions: 0
  });
  
  const [courseData, setCourseData] = useState<any[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      // 1. Fetch counts in parallel
      const [
        { count: userCount },
        { count: courseCount },
        { count: postCount },
        { count: completionCount }
      ] = await Promise.all([
        supabase.from('usuarios').select('id', { count: 'exact', head: true }).eq('organizacao_id', orgId),
        supabase.from('cursos').select('id', { count: 'exact', head: true }).eq('organizacao_id', orgId),
        supabase.from('community_posts').select('id', { count: 'exact', head: true }).eq('organizacao_id', orgId),
        supabase.from('curso_participantes').select('id, status, cursos!inner(organizacao_id)', { count: 'exact', head: true })
          .eq('status', 'concluido')
          .eq('cursos.organizacao_id', orgId)
      ]);

      setStats({
        totalUsers: userCount || 0,
        totalCourses: courseCount || 0,
        totalPosts: postCount || 0,
        completions: completionCount || 0
      });

      // 2. Fetch all course enrollments to build both charts
      const { data: participations, error: partError } = await supabase
        .from('curso_participantes')
        .select('created_at, status, cursos!inner(nome, organizacao_id)')
        .eq('cursos.organizacao_id', orgId);

      if (partError) throw partError;

      // --- PROCESS CHART 1: Enrollments Over Time (Last 6 Months) ---
      const monthsData = getPast6Months();
      if (participations) {
        participations.forEach((p: any) => {
          if (p.created_at) {
            const date = new Date(p.created_at);
            const year = date.getFullYear();
            const monthNum = String(date.getMonth() + 1).padStart(2, '0');
            const key = `${year}-${monthNum}`;
            const match = monthsData.find(m => m.yearMonth === key);
            if (match) {
              match.enrollments += 1;
            }
          }
        });
      }
      setEnrollmentData(monthsData.map(m => ({ month: m.label, enrollments: m.enrollments })));

      // --- PROCESS CHART 2: Course Engagement (Students Per Course) ---
      const courseCounts: { [key: string]: number } = {};
      if (participations) {
        participations.forEach((p: any) => {
          const courseName = p.cursos?.nome || 'Sem Nome';
          courseCounts[courseName] = (courseCounts[courseName] || 0) + 1;
        });
      }
      const formattedCourseData = Object.entries(courseCounts)
        .map(([name, count]) => ({ name, students: count }))
        .sort((a, b) => b.students - a.students)
        .slice(0, 5);
      
      setCourseData(formattedCourseData);

      // --- FETCH & PROCESS RECENT ACTIVITY ---
      // Get recent enrollments / completions
      const { data: recentParts } = await supabase
        .from('curso_participantes')
        .select('created_at, updated_at, status, usuarios(nome), cursos!inner(nome, organizacao_id)')
        .eq('cursos.organizacao_id', orgId)
        .order('updated_at', { ascending: false })
        .limit(5);

      // Get recent community posts
      const { data: recentPosts } = await supabase
        .from('community_posts')
        .select('created_at, titulo, usuarios:autor_id(nome)')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);

      const activityFromParts: ActivityLogItem[] = (recentParts || []).map((p: any) => {
        const isCompleted = p.status === 'concluido';
        return {
          id: `p-${p.created_at}-${p.usuarios?.nome}-${p.cursos?.nome}`,
          date: new Date(p.updated_at || p.created_at),
          user: p.usuarios?.nome || 'Aluno Anônimo',
          action: isCompleted ? 'concluiu o curso' : 'iniciou o curso',
          target: p.cursos?.nome || 'Curso',
          type: isCompleted ? 'completion' : 'enrollment'
        };
      });

      const activityFromPosts: ActivityLogItem[] = (recentPosts || []).map((post: any) => {
        return {
          id: `post-${post.created_at}-${post.usuarios?.nome}-${post.titulo}`,
          date: new Date(post.created_at),
          user: post.usuarios?.nome || 'Usuário Anônimo',
          action: 'publicou na comunidade',
          target: post.titulo || 'Nova postagem',
          type: 'post'
        };
      });

      const combinedActivities = [...activityFromParts, ...activityFromPosts]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 5);

      setActivities(combinedActivities);

    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [orgId]);

  const getPast6Months = () => {
    const months = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const name = d.toLocaleString('pt-BR', { month: 'short' });
      const capitalized = name.charAt(0).toUpperCase() + name.slice(1).replace('.', '');
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      months.push({ 
        label: capitalized, 
        yearMonth: `${year}-${monthNum}`, 
        enrollments: 0 
      });
    }
    return months;
  };

  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} h`;
    return `há ${diffDays} dias`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Predefined custom palette
  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<Users className="text-blue-600" />} 
          label="Total de Usuários" 
          value={stats.totalUsers} 
          trend="Alunos e Staff" 
        />
        <StatCard 
          icon={<BookOpen className="text-emerald-600" />} 
          label="Cursos Ativos" 
          value={stats.totalCourses} 
          trend="Grade Escolar" 
        />
        <StatCard 
          icon={<MessagesSquare className="text-purple-600" />} 
          label="Interações na Comunidade" 
          value={stats.totalPosts} 
          trend="Tópicos criados" 
        />
        <StatCard 
          icon={<Award className="text-amber-600" />} 
          label="Certificados Emitidos" 
          value={stats.completions} 
          trend="Conclusões de curso" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Course Popularity */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Alunos por Curso (Top 5)
            </h3>
          </div>
          <div className="h-[300px] w-full min-h-[300px] flex-1 relative flex items-center justify-center">
            {courseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="students" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 opacity-40 text-slate-400" />
                <p>Nenhuma matrícula registrada para exibir gráfico.</p>
              </div>
            )}
          </div>
        </div>

        {/* Enrollment Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Inscrições nos Últimos 6 Meses
            </h3>
          </div>
          <div className="h-[300px] w-full min-h-[300px] flex-1 relative flex items-center justify-center">
            {enrollmentData.some(d => d.enrollments > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={enrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="enrollments" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8 opacity-40 text-slate-400" />
                <p>Nenhuma inscrição efetuada nos últimos 6 meses.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Atividade Recente (Tempo Real)
        </h3>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((act) => (
              <ActivityItem 
                key={act.id}
                icon={
                  act.type === 'completion' ? <CheckCircle className="text-green-500" /> :
                  act.type === 'enrollment' ? <BookOpen className="text-indigo-500" /> :
                  <MessagesSquare className="text-blue-500" />
                }
                user={act.user}
                action={act.action}
                target={act.target}
                time={timeAgo(act.date)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2 border border-dashed border-slate-100 rounded-xl">
            <Activity className="w-8 h-8 opacity-35" />
            <p>Nenhuma atividade registrada recentemente.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: number, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">
          {trend}
        </span>
      </div>
      <div>
        <h4 className="text-slate-500 text-sm font-medium mb-1">{label}</h4>
        <div className="text-2xl font-black text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function ActivityItem({ icon, user, action, target, time }: { icon: React.ReactNode, user: string, action: string, target: string, time: string }) {
  return (
    <div className="flex gap-4 p-4 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100">
      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-slate-900 font-medium">
          <span className="font-bold">{user}</span> {action} <span className="font-bold text-indigo-600">{target}</span>
        </p>
        <p className="text-xs text-slate-400 font-medium mt-0.5">{time}</p>
      </div>
    </div>
  );
}
