import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Award, Calendar, User, BookOpen, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';

interface ValidacaoCertificadoProps {
  idCertificado?: string;
}

const ValidacaoCertificado: React.FC<ValidacaoCertificadoProps> = ({ idCertificado }) => {
  const [id, setId] = useState<string | null>(idCertificado || null);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgNome, setOrgNome] = useState<string | null>(null);
  const [orgColor, setOrgColor] = useState<string | null>(null);

  useEffect(() => {
    // Busca o logo da primeira organização encontrada como fallback global
    const fetchGlobalLogo = async () => {
      try {
        const { data } = await supabase.from('organizacoes').select('nome, logo_url, cor_primaria').limit(1).maybeSingle();
        if (data) {
          if (data.logo_url) setOrgLogo(data.logo_url);
          setOrgNome(data.nome);
          if (data.cor_primaria) setOrgColor(data.cor_primaria);
        }
      } catch (e) {
        console.warn("Could not fetch global logo", e);
      }
    };
    fetchGlobalLogo();

    if (!id) {
      if (window.location.pathname.startsWith('/validar/')) {
        const parts = window.location.pathname.split('/');
        const pathId = parts[parts.length - 1];
        if (pathId) setId(pathId);
      }
    }
  }, [id, idCertificado]);

  useEffect(() => {
    const validar = async () => {
      if (!id || id === 'temp') {
        if (id === 'temp') {
          setErro(null);
          setLoading(true);
        }
        setErro('ID de certificado inválido ou não fornecido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro(null);

      try {
        // 1. Tentar Cursos (curso_participantes)
        const { data: cursoCore } = await supabase
          .from('curso_participantes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (cursoCore) {
          const { data: usuario } = await supabase.from('usuarios').select('nome').eq('id', cursoCore.usuario_id).maybeSingle();
          const { data: curso } = await supabase.from('cursos').select('nome, carga_horaria, organizacao_id').eq('id', cursoCore.curso_id).maybeSingle();

          if (curso?.organizacao_id) {
            const { data: org } = await supabase
              .from('organizacoes')
              .select('nome, logo_url, cor_primaria')
              .eq('id', curso.organizacao_id)
              .maybeSingle();
            if (org) {
              setOrgLogo(org.logo_url);
              setOrgNome(org.nome);
              setOrgColor(org.cor_primaria || '#6366f1');
            }
          }

          setDados({
            tipo: 'Curso Livre / Evento',
            nome: usuario?.nome || 'Participante',
            titulo: curso?.nome || 'Curso Online',
            data: cursoCore.updated_at || cursoCore.created_at || '--',
            cargaHoraria: curso?.carga_horaria || '--',
            valido: true
          });
          setLoading(false);
          return;
        }

        // 2. Tentar Trilhas (trilha_participantes)
        const { data: trilhaCore } = await supabase
          .from('trilha_participantes')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (trilhaCore) {
          const { data: usuario } = await supabase.from('usuarios').select('nome').eq('id', trilhaCore.usuario_id).maybeSingle();
          const { data: trilha } = await supabase.from('trilhas').select('nome, organizacao_id').eq('id', trilhaCore.trilha_id).maybeSingle();

          if (trilha?.organizacao_id) {
            const { data: org } = await supabase
              .from('organizacoes')
              .select('nome, logo_url, cor_primaria')
              .eq('id', trilha.organizacao_id)
              .maybeSingle();
            if (org) {
              setOrgLogo(org.logo_url);
              setOrgNome(org.nome);
              setOrgColor(org.cor_primaria || '#6366f1');
            }
          }

          setDados({
            tipo: 'Trilha de Aprendizado / Programa',
            nome: usuario?.nome || 'Participante',
            titulo: trilha?.nome || 'Trilha de Cursos',
            data: trilhaCore.updated_at || trilhaCore.created_at || '--',
            cargaHoraria: '--',
            valido: true
          });
          setLoading(false);
          return;
        }

        setErro('Nenhum registro de certificado encontrado para este código.');
      } catch (err) {
        console.error('Erro na validação:', err);
        setErro('Ocorreu um erro ao consultar o sistema de validação. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    validar();
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header Branding */}
        <div className="p-10 text-center text-white relative" style={{ backgroundColor: orgColor || '#4f46e5' }}>
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white scale-150"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white p-3 rounded-2xl shadow-lg mb-6 w-24 h-24 flex items-center justify-center">
              {orgLogo ? (
                <img 
                  src={orgLogo} 
                  alt={`Logo ${orgNome || 'Organização'}`} 
                  className="max-w-full max-h-full object-contain"
                  onError={() => setOrgLogo(null)}
                />
              ) : (
                <Award className="w-12 h-12" style={{ color: orgColor || '#4f46e5' }} />
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-1 uppercase">{orgNome || 'Academia Digital'}</h1>
            <p className="text-white/80 text-sm font-medium tracking-wide">Portal de Validação Digital</p>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 rounded-full border-t-transparent animate-spin" style={{ borderColor: `${orgColor || '#4f46e5'} transparent transparent transparent` }}></div>
              </div>
              <p className="text-slate-400 font-medium animate-pulse">Autenticando documento...</p>
            </div>
          ) : erro ? (
            <div className="text-center py-4">
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 border-4 border-red-100">
                <XCircle size={64} strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Não Encontrado</h2>
              <p className="text-slate-500 leading-relaxed mb-8 px-4">{erro}</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transform active:scale-[0.98] transition-all shadow-lg"
              >
                Voltar à Página Inicial
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="text-center">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 border-4 border-green-100">
                  <CheckCircle size={64} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Certificado Autêntico</h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck size={14} /> Documento Verificado
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <User size={18} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Participante Oficial</span>
                  </div>
                  <p className="text-xl font-black text-slate-900 ml-1">{dados.nome}</p>
                </div>

                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Award size={18} className="text-slate-400" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualificação Registrada</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 ml-1 leading-tight">{dados.titulo}</p>
                  <p className="text-xs text-slate-500 ml-1 mt-1 font-medium">{dados.tipo}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</span>
                    </div>
                    <p className="font-bold text-slate-900 ml-1">
                      {dados.data && dados.data !== '--' 
                        ? new Date(dados.data).toLocaleDateString('pt-BR') 
                        : '--'}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group transition-colors hover:bg-slate-100/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <BookOpen size={18} className="text-slate-400" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carga Horária</span>
                    </div>
                    <p className="font-bold text-slate-900 ml-1">{dados.cargaHoraria && dados.cargaHoraria !== '--' ? `${dados.cargaHoraria} h` : '--'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Código de Autenticidade</p>
                <div className="inline-block relative">
                  <div className="absolute -inset-1 bg-slate-100 rounded-lg blur-[2px]"></div>
                  <code className="relative text-xs bg-white px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-mono shadow-sm">
                    {id}
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      
      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="text-slate-400 text-[10px] text-center max-w-xs leading-relaxed uppercase tracking-tighter opacity-80">
          Este sistema de validação é exclusivo para certificados emitidos através do portal oficial de {orgNome || 'nossa plataforma'}.
        </p>
        <div className="flex gap-4 grayscale opacity-40 items-center justify-center">
          <Award className="w-6 h-6 text-slate-400" />
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Validação Certificada</span>
        </div>
      </div>
    </div>
  );
};

export default ValidacaoCertificado;
