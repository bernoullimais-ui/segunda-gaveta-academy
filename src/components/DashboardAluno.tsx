import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BookOpen, 
  Clock, 
  Award, 
  TrendingUp, 
  CheckCircle, 
  ArrowRight,
  LayoutDashboard,
  Play,
  Flame,
  Trophy
} from 'lucide-react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardAlunoProps {
  loggedUser: any;
  onNavigateToCourse: (course: any) => void;
}

export function DashboardAluno({ loggedUser, onNavigateToCourse }: DashboardAlunoProps) {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCourses: 0,
    completedCourses: 0,
    totalProgress: 0,
  });
  const [streak, setStreak] = useState(0);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);
  const [achievements, setAchievements] = useState({
    primeiroPasso: false,
    habitoSaudavel: false,
    mestreQuiz: false,
    concludente: false,
    maratonista: false,
    totalMinutes: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, [loggedUser]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Buscar matrículas de cursos do aluno
      const { data: participacoes, error } = await supabase
        .from('curso_participantes')
        .select('*, cursos(*)')
        .eq('usuario_id', loggedUser.id);

      if (error) throw error;

      let formatted: any[] = [];
      if (participacoes) {
        formatted = participacoes
          .filter(p => p.status !== 'pendente')
          .map(p => ({
            ...p.cursos,
            progresso: p.progresso,
            status: p.status,
            participacao_id: p.id
          }));

        setCourses(formatted);

        const total = formatted.length;
        const completed = formatted.filter(f => f.status === 'concluido').length;
        const avgProgress = total > 0 ? formatted.reduce((acc, curr) => acc + (curr.progresso || 0), 0) / total : 0;

        setStats({
          totalCourses: total,
          completedCourses: completed,
          totalProgress: Math.round(avgProgress),
        });
      }

      // 2. Buscar logs de tempo de estudo do aluno
      const { data: studyLogs, error: logsError } = await supabase
        .from('registro_estudos')
        .select('*')
        .eq('usuario_id', loggedUser.id)
        .order('data', { ascending: false });

      if (logsError) throw logsError;

      // 3. Calcular Streak (Ofensiva 🔥)
      let calculatedStreak = 0;
      if (studyLogs && studyLogs.length > 0) {
        const uniqueDates = [...new Set(studyLogs.map(log => log.data))];
        const todayStr = new Date().toLocaleDateString('en-CA');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
          calculatedStreak = 1;
          let nextExpectedDate = new Date(uniqueDates[0]);
          for (let i = 1; i < uniqueDates.length; i++) {
            const prevDate = new Date(uniqueDates[i]);
            const diffTime = Math.abs(nextExpectedDate.getTime() - prevDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
              calculatedStreak++;
              nextExpectedDate = prevDate;
            } else if (diffDays > 1) {
              break; // Streak interrompida
            }
          }
        }
      }
      setStreak(calculatedStreak);

      // 4. Formatar dados semanais para o Recharts (últimos 7 dias)
      const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const chartData = [];
      const logs = studyLogs || [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('en-CA');
        const dayName = weekdayNames[d.getDay()];
        
        const dayMinutes = logs
          .filter(log => log.data === dateStr)
          .reduce((acc, curr) => acc + (curr.minutos_estudados || 0), 0);
          
        chartData.push({
          name: dayName,
          minutos: dayMinutes
        });
      }
      setWeeklyChartData(chartData);

      // 5. Verificar Conquistas (Medalhas)
      const totalMinutes = logs.reduce((acc, curr) => acc + (curr.minutos_estudados || 0), 0);
      
      let hasPerfectQuiz = false;
      if (participacoes) {
        participacoes.forEach(p => {
          if (p.quiz_scores) {
            Object.values(p.quiz_scores).forEach((score: any) => {
              if (score === 100) hasPerfectQuiz = true;
            });
          }
        });
      }

      const currentAchievements = {
        primeiroPasso: formatted.length >= 1,
        habitoSaudavel: calculatedStreak >= 3,
        mestreQuiz: hasPerfectQuiz,
        concludente: formatted.some(f => f.status === 'concluido'),
        maratonista: totalMinutes >= 60,
      };

      setAchievements({
        ...currentAchievements,
        totalMinutes
      });

      // 6. Register achievements notifications
      try {
        const { data: existingNotifs } = await supabase
          .from('notificacoes')
          .select('titulo')
          .eq('usuario_id', loggedUser.id)
          .eq('tipo', 'medalha');

        const existingTitles = new Set((existingNotifs || []).map(n => n.titulo));

        const checkAndNotify = async (key: keyof typeof currentAchievements, title: string, message: string) => {
          if (currentAchievements[key] && !existingTitles.has(title)) {
            await supabase.from('notificacoes').insert([{
              usuario_id: loggedUser.id,
              organizacao_id: loggedUser.organizacao_id,
              tipo: 'medalha',
              titulo: title,
              mensagem: message,
              link: { tab: 'dashboard' }
            }]);
          }
        };

        await checkAndNotify('primeiroPasso', 'Medalha Desbloqueada: Primeiro Passo! 🏁', 'Você se matriculou no seu primeiro curso na plataforma.');
        await checkAndNotify('habitoSaudavel', 'Medalha Desbloqueada: Hábito Saudável! 🔥', 'Você manteve uma ofensiva de estudo por 3 dias seguidos ou mais.');
        await checkAndNotify('mestreQuiz', 'Medalha Desbloqueada: Mestre do Quiz! 🧠', 'Você acertou 100% das questões em um quiz de aula.');
        await checkAndNotify('concludente', 'Medalha Desbloqueada: Concludente! 🏆', 'Parabéns por concluir seu primeiro curso completo!');
        await checkAndNotify('maratonista', 'Medalha Desbloqueada: Maratonista! ⏱️', 'Você acumulou mais de 60 minutos de tempo de estudo ativo.');
      } catch (notifErr) {
        console.error('Error handling achievement notifications:', notifErr);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium tracking-tight">Carregando seu progresso...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          icon={<BookOpen className="text-indigo-600" />} 
          label="Cursos Adquiridos" 
          value={stats.totalCourses} 
          color="bg-indigo-50"
        />
        <StatCard 
          icon={<CheckCircle className="text-emerald-600" />} 
          label="Cursos Concluídos" 
          value={stats.completedCourses} 
          color="bg-emerald-50"
        />
        <StatCard 
          icon={<TrendingUp className="text-blue-600" />} 
          label="Progresso Médio" 
          value={`${stats.totalProgress}%`} 
          color="bg-blue-50"
        />
        <StatCard 
          icon={<Flame className={`w-6 h-6 ${streak > 0 ? 'text-orange-500 fill-current' : 'text-slate-300'}`} />} 
          label="Dias Seguidos" 
          value={`${streak} ${streak === 1 ? 'dia' : 'dias'} 🔥`} 
          color={streak > 0 ? 'bg-orange-50/60' : 'bg-slate-50'}
        />
      </div>

      {/* Gamification and Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Progress Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Tempo de Estudo Semanal
              </h3>
              <p className="text-xs text-slate-500">Seus minutos dedicados nos últimos 7 dias</p>
            </div>
            <div className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">
              Total: {achievements.totalMinutes} min
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <defs>
                  <linearGradient id="colorMinutos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="minutos" fill="url(#colorMinutos)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Badges / Achievements Panel */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            Minhas Conquistas
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
            <AchievementBadge 
              unlocked={achievements.primeiroPasso} 
              title="Primeiro Passo" 
              desc="Iniciou ou matriculou-se no primeiro curso" 
              icon="🚀" 
            />
            <AchievementBadge 
              unlocked={achievements.habitoSaudavel} 
              title="Hábito Saudável" 
              desc="Estudou por 3 ou mais dias seguidos" 
              icon="🔥" 
            />
            <AchievementBadge 
              unlocked={achievements.mestreQuiz} 
              title="Mestre do Quiz" 
              desc="Gabaritou pelo menos um quiz com 100% de acerto" 
              icon="🎓" 
            />
            <AchievementBadge 
              unlocked={achievements.concludente} 
              title="Concludente" 
              desc="Concluiu com sucesso o primeiro curso" 
              icon="🏆" 
            />
            <AchievementBadge 
              unlocked={achievements.maratonista} 
              title="Maratonista" 
              desc="Estudou mais de 60 minutos na plataforma" 
              icon="📚" 
            />
          </div>
        </div>
      </div>

      {/* Continue Reading / My Courses */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Play className="w-6 h-6 text-indigo-600 fill-current" />
            Meus Cursos
          </h2>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-100 text-center">
            <LayoutDashboard className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-800">Você ainda não possui cursos</h3>
            <p className="text-slate-500 mb-6">Explore nossa vitrine e comece a aprender hoje mesmo!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <motion.div 
                key={course.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col group cursor-pointer"
                onClick={() => onNavigateToCourse(course)}
              >
                <div 
                  className="aspect-video w-full bg-slate-100 bg-cover bg-center flex items-center justify-center font-bold text-slate-300"
                  style={{ backgroundImage: course.thumbnail_url ? `url(${course.thumbnail_url})` : undefined }}
                >
                  {!course.thumbnail_url && "Sem Thumbnail"}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {course.nome}
                  </h3>
                  
                  <div className="mt-auto space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progresso</span>
                        <span className="text-xs font-bold text-indigo-600">{course.progresso || 0}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                          style={{ width: `${course.progresso || 0}%` }}
                        />
                      </div>
                    </div>

                    <button className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                      {course.progresso === 100 ? 'Revisar Conteúdo' : 'Continuar Assistindo'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number | string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
}

function AchievementBadge({ unlocked, title, desc, icon }: { unlocked: boolean, title: string, desc: string, icon: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300 ${
      unlocked 
        ? 'bg-gradient-to-r from-indigo-50/50 to-blue-50/20 border-indigo-100/80 shadow-sm' 
        : 'bg-slate-50/50 border-slate-100 opacity-60'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${
        unlocked 
          ? 'bg-white border-indigo-100' 
          : 'bg-slate-100 border-slate-200'
      }`}>
        {icon}
      </div>
      <div>
        <h4 className={`text-sm font-bold leading-none mb-1 ${unlocked ? 'text-slate-800' : 'text-slate-500'}`}>
          {title}
        </h4>
        <p className="text-[10px] text-slate-400 font-medium leading-tight">
          {desc}
        </p>
      </div>
    </div>
  );
}
