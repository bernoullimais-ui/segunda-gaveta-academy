import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Save, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function TrilhaModal({ isOpen, onClose, fetchTrilhas, editingTrilha, orgId }: { isOpen: boolean, onClose: () => void, fetchTrilhas: () => void, editingTrilha?: any, orgId?: string }) {
  const [activeTab, setActiveTab] = useState<'geral' | 'conteudos' | 'participantes' | 'engajamento' | 'landing_page'>('geral');
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState(0);
  const [emBreve, setEmBreve] = useState(false);
  const [capaUrl, setCapaUrl] = useState('');
  const [coordenadorNome, setCoordenadorNome] = useState('');
  const [coordenadorTitulo, setCoordenadorTitulo] = useState('');
  const [coordenadorFotoUrl, setCoordenadorFotoUrl] = useState('');
  const [listaProfessores, setListaProfessores] = useState<{nome: string, titulo: string}[]>([]);
  const [descricao, setDescricao] = useState('');
  const [cursosDisponiveis, setCursosDisponiveis] = useState<any[]>([]);
  const [cursosSelecionados, setCursosSelecionados] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lpData, setLpData] = useState<any>({
    enabled: true,
    hero_title: '',
    hero_subtitle: '',
    hero_video_url: '',
    about: '',
    benefits: [''],
    target_audience: '',
    faq: [{ question: '', answer: '' }],
    primary_color: '#059669',
    instructor: {
      name: '',
      bio: '',
      avatar_url: '',
      role: 'Coordenador(a)'
    },
    testimonials: [],
    bonuses: [],
    guarantee_days: 7,
    cta_text: 'Garantir minha vaga',
    courses_title: 'Cursos inclusos nesta trilha',
    courses_description: 'Confira os programas que fazem parte desta jornada completa.'
  });

  useEffect(() => {
    const fetchData = async () => {
        const { data: cursos } = await supabase.from('cursos').select('id, nome');
        const sortedCursos = (cursos || []).sort((a, b) => a.nome.localeCompare(b.nome));
        setCursosDisponiveis(sortedCursos);
        
        if (editingTrilha) {
            setNome(editingTrilha.nome || '');
            setPreco(editingTrilha.preco || 0);
            setEmBreve(editingTrilha.em_breve || false);
            setCapaUrl(editingTrilha.capa_url || '');
            setCoordenadorNome(editingTrilha.coordenador_nome || '');
            setCoordenadorTitulo(editingTrilha.coordenador_titulo || '');
            setCoordenadorFotoUrl(editingTrilha.coordenador_foto_url || '');
            
            // Tenta carregar do JSON novo, se não existir, tenta converter o texto antigo
            if (editingTrilha.professores_extra_json && Array.isArray(editingTrilha.professores_extra_json) && editingTrilha.professores_extra_json.length > 0) {
              setListaProfessores(editingTrilha.professores_extra_json);
            } else if (editingTrilha.professores_convidados) {
              setListaProfessores([{ 
                nome: editingTrilha.professores_convidados, 
                titulo: editingTrilha.professores_titulos || '' 
              }]);
            } else {
              setListaProfessores([{ nome: '', titulo: '' }]);
            }

            if (editingTrilha.descricao) {
              setDescricao(editingTrilha.descricao || '');
            }

            if (editingTrilha.configuracao_json?.lp) {
              setLpData({
                ...lpData,
                ...editingTrilha.configuracao_json.lp
              });
            } else {
              setLpData({
                enabled: true,
                hero_title: editingTrilha.nome || '',
                hero_subtitle: editingTrilha.descricao || '',
                hero_video_url: '',
                about: editingTrilha.descricao || '',
                benefits: [''],
                target_audience: '',
                faq: [{ question: '', answer: '' }],
                primary_color: '#059669',
                instructor: {
                  name: editingTrilha.coordenador_nome || '',
                  bio: '',
                  avatar_url: editingTrilha.coordenador_foto_url || '',
                  role: 'Coordenador(a)'
                },
                testimonials: [],
                bonuses: [],
                guarantee_days: 7,
                cta_text: 'Garantir minha vaga',
                courses_title: 'Cursos inclusos nesta trilha',
                courses_description: 'Confira os programas que fazem parte desta jornada completa.'
              });
            }

            const { data: trilhaCursos } = await supabase.from('trilha_cursos').select('curso_id').eq('trilha_id', editingTrilha.id);
            setCursosSelecionados(trilhaCursos?.map(c => c.curso_id) || []);
        } else {
            setNome('');
            setPreco(0);
            setEmBreve(false);
            setCapaUrl('');
            setCoordenadorNome('');
            setCoordenadorTitulo('');
            setCoordenadorFotoUrl('');
            setListaProfessores([{ nome: '', titulo: '' }]);
            setDescricao('');
            setCursosSelecionados([]);
        }
    };
    fetchData();
  }, [isOpen, editingTrilha]);

  if (!isOpen) return null;

  const handleAddProfessor = () => {
    setListaProfessores([...listaProfessores, { nome: '', titulo: '' }]);
  };

  const handleRemoveProfessor = (index: number) => {
    const newList = [...listaProfessores];
    newList.splice(index, 1);
    setListaProfessores(newList.length > 0 ? newList : [{ nome: '', titulo: '' }]);
  };

  const handleProfessorChange = (index: number, field: 'nome' | 'titulo', value: string) => {
    const newList = [...listaProfessores];
    newList[index][field] = value;
    setListaProfessores(newList);
  };

  const handleSave = async () => {
    // Filtra professores vazios
    const profsValidos = listaProfessores.filter(p => p.nome.trim() !== '');
    
    // Para manter compatibilidade com colunas de texto antigas (pega o primeiro ou join)
    const profPrincipal = profsValidos[0]?.nome || '';
    const tituloPrincipal = profsValidos[0]?.titulo || '';

    let trilhaId = editingTrilha?.id;
    let error;

    const trilhaData: any = { 
        nome, 
        preco, 
        em_breve: emBreve,
        capa_url: capaUrl, 
        coordenador_nome: coordenadorNome, 
        coordenador_titulo: coordenadorTitulo,
        coordenador_foto_url: coordenadorFotoUrl,
        professores_convidados: profPrincipal, 
        professores_titulos: tituloPrincipal,
        professores_extra_json: profsValidos, // Salva a lista completa aqui
        descricao, 
        configuracao_json: {
          lp: lpData
        },
        status: 'Rascunho'
    };

    if (orgId) {
      trilhaData.organizacao_id = orgId;
    }

    setIsSaving(true);
    if (trilhaId) {
        const { error: updateError } = await supabase.from('trilhas').update(trilhaData).eq('id', trilhaId);
        error = updateError;
    } else {
        const { data: trilha, error: insertError } = await supabase.from('trilhas').insert([trilhaData]).select().single();
        trilhaId = trilha?.id;
        error = insertError;
    }

    if (error) {
        setIsSaving(false);
        console.error('Erro ao salvar trilha:', error);
        if (error.message.includes('configuracao_json')) {
            alert('ERRO CRÍTICO: A coluna "configuracao_json" não foi encontrada no banco de dados. \n\nPor favor, execute o comando SQL enviado no chat dentro do painel do Supabase para corrigir este erro.');
        } else {
            alert('Erro ao salvar trilha: ' + error.message);
        }
    } else {
        console.log('Trilha salva, salvando cursos:', trilhaId);
        // Remove existing cursos first
        await supabase.from('trilha_cursos').delete().eq('trilha_id', trilhaId);
        
        const { error: cursosError } = await supabase.from('trilha_cursos').insert(cursosSelecionados.map(curso_id => ({ trilha_id: trilhaId, curso_id })));                
        if (cursosError) {
          console.error('Erro ao salvar cursos da trilha:', cursosError);
          alert('Erro ao salvar cursos da trilha: ' + cursosError.message);
        } else {
          fetchTrilhas();
          setIsSaving(false);
          onClose();
        }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[100] flex items-center justify-center p-0 md:p-8 overflow-hidden">
      <div className="relative bg-white w-full max-w-7xl h-full md:h-[90vh] md:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-[110] px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
               <X className="w-6 h-6" />
             </button>
             <div>
               <h2 className="text-xl font-bold text-slate-800">{editingTrilha ? 'Editar Trilha' : 'Criar Trilha'}</h2>
               <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                  <span className={`px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-600 text-[10px] uppercase tracking-wider`}>
                    TRILHA DE CURSOS
                  </span>
               </div>
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button
               onClick={onClose}
               className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-50 rounded-full"
             >
               Cancelar
             </button>
             <button
               onClick={handleSave}
               disabled={isSaving}
               className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center gap-2"
             >
               {isSaving ? <Plus className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
               {isSaving ? 'Salvando...' : 'Salvar Trilha'}
             </button>
          </div>
        </div>

        <div className="flex border-b border-slate-100 px-8 bg-white sticky top-[73px] z-[105] overflow-x-auto">
           {(['geral', 'conteudos', 'participantes', 'engajamento', 'landing_page'] as const).map(tab => (
             <button 
               key={tab} 
               onClick={() => setActiveTab(tab)} 
               className={`px-4 py-4 font-bold text-xs uppercase tracking-widest transition-all relative whitespace-nowrap ${
                 activeTab === tab 
                 ? 'text-blue-600' 
                 : 'text-slate-400 hover:text-slate-600'
               }`}
             >
                {tab === 'geral' ? 'Informações' : tab === 'conteudos' ? 'Cursos Inclusos' : tab === 'participantes' ? 'Alunos' : tab === 'engajamento' ? 'Certificado' : 'Página de Vendas'}
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTabTrilha"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" 
                  />
                )}
             </button>
           ))}
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
          <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {activeTab === 'geral' && (
             <div className="space-y-6 max-w-3xl mx-auto">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Informações Básicas</h3>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Nome da Trilha</label>
                    <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Formação Completa em Judô" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Preço (R$)</label>
                      <input type="number" value={preco} onChange={e => setPreco(parseFloat(e.target.value))} placeholder="0.00" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input 
                        type="checkbox" 
                        id="emBreve" 
                        checked={emBreve} 
                        onChange={e => setEmBreve(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <label htmlFor="emBreve" className="font-bold text-slate-700">Em Breve</label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">URL da Imagem da capa</label>
                    <input value={capaUrl} onChange={e => setCapaUrl(e.target.value)} placeholder="https://..." className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Coordenador</h3>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Nome</label>
                      <input value={coordenadorNome} onChange={e => setCoordenadorNome(e.target.value)} placeholder="Nome do coordenador" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Título</label>
                      <input value={coordenadorTitulo} onChange={e => setCoordenadorTitulo(e.target.value)} placeholder="Ex: Mestre 6º Dan" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Foto do Coordenador (URL)</label>
                    <input value={coordenadorFotoUrl} onChange={e => setCoordenadorFotoUrl(e.target.value)} placeholder="https://..." className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors"/>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Professores Convidados</h3>
                    <button 
                      type="button"
                      onClick={handleAddProfessor}
                      className="text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 uppercase tracking-tighter"
                    >
                      <Plus className="w-4 h-4" /> Adicionar
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {listaProfessores.map((prof, index) => (
                      <div key={index} className="flex gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-100 relative group">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Nome</label>
                          <input 
                            value={prof.nome} 
                            onChange={e => handleProfessorChange(index, 'nome', e.target.value)} 
                            placeholder="Nome completo" 
                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-400 mb-1 block uppercase">Título</label>
                          <input 
                            value={prof.titulo} 
                            onChange={e => handleProfessorChange(index, 'titulo', e.target.value)} 
                            placeholder="Ex: Professor Convidado" 
                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-blue-500"
                          />
                        </div>
                        {listaProfessores.length > 1 && (
                          <button 
                            onClick={() => handleRemoveProfessor(index)} 
                            className="mt-6 p-2 text-slate-400 hover:text-red-500 rounded-full hover:bg-white transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Descrição da Trilha</label>
                  <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Conte mais sobre o que compõe esta trilha..." className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-blue-500 transition-colors" rows={4}/>
                </div>
             </div>
          )}
          {activeTab === 'conteudos' && (
            <div className="space-y-2">
                {cursosDisponiveis.map(curso => (
                    <label key={curso.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={cursosSelecionados.includes(curso.id)} onChange={e => {
                            if (e.target.checked) setCursosSelecionados([...cursosSelecionados, curso.id]);
                            else setCursosSelecionados(cursosSelecionados.filter(id => id !== curso.id));
                        }}/>
                        {curso.nome}
                    </label>
                ))}
            </div>
          )}
          {activeTab === 'participantes' && <div className="p-4 bg-slate-50 text-slate-500 text-center rounded">Participantes da trilha e desempenho</div>}
          {activeTab === 'engajamento' && <div className="p-4 bg-slate-50 text-slate-500 text-center rounded">Configuração de certificado</div>}
          
          {activeTab === 'landing_page' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-200">
                    <Save className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-emerald-900">Página Comercial da Trilha</h3>
                    <p className="text-sm text-emerald-700">Personalize o visual da sua trilha para atrair mais alunos.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      if (!editingTrilha?.id) {
                        alert('Salve a trilha pela primeira vez para visualizar a página.');
                        return;
                      }
                      window.open(`${window.location.origin}/public/trilha/${editingTrilha.id}`, '_blank');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 transition-all font-bold text-sm shadow-sm active:scale-95"
                  >
                    <Eye className="w-4 h-4 text-emerald-600" />
                    Visualizar Página
                  </button>
                </div>
              </div>

              {/* Seção Hero */}
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-4 mb-2">
                  <Plus className="w-5 h-5 text-blue-500" />
                  <h4 className="font-bold text-lg">Apresentação Principal (Hero)</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2">Título de Impacto</label>
                    <input 
                      type="text" 
                      value={lpData.hero_title}
                      onChange={(e) => setLpData({...lpData, hero_title: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Ex: Formação Mestre do Judô"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2">Subtítulo Persuasivo</label>
                    <textarea 
                      value={lpData.hero_subtitle}
                      onChange={(e) => setLpData({...lpData, hero_subtitle: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Uma frase curta que resuma o benefício principal..."
                    />
                  </div>
                </div>
              </div>

              {/* Detalhes dos Cursos Inclusos */}
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center gap-2 text-slate-800 border-b border-slate-100 pb-4 mb-2">
                  <Save className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-bold text-lg">Conteúdo da Trilha (Lista de Cursos)</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2">Título da Listagem</label>
                    <input 
                      type="text" 
                      value={lpData.courses_title}
                      onChange={(e) => setLpData({...lpData, courses_title: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Ex: Programas inclusos neste pacote"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-2">Descrição dos Programas</label>
                    <textarea 
                      value={lpData.courses_description}
                      onChange={(e) => setLpData({...lpData, courses_description: e.target.value})}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 min-h-[100px] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Detalhe por que esses cursos juntos são poderosos..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
