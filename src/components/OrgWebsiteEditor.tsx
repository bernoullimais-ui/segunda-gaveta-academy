import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Plus, Trash2, Mail, MessageSquare, Loader2, CheckCircle2, User, Image } from 'lucide-react';

interface OrgWebsiteEditorProps {
  orgId: string;
  corPrimaria: string;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

export function OrgWebsiteEditor({ orgId, corPrimaria, showToast }: OrgWebsiteEditorProps) {
  const [config, setConfig] = useState<any>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'conteudo' | 'leads'>('conteudo');
  
  // Fallback default values from courses
  const [defaultSpecialist, setDefaultSpecialist] = useState({ nome: '', titulo: '', foto_url: '' });

  useEffect(() => {
    if (orgId) {
      fetchData();
    }
  }, [orgId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch organization settings
      const { data: orgData, error: orgError } = await supabase
        .from('organizacoes')
        .select('config_json')
        .eq('id', orgId)
        .maybeSingle();

      if (orgError) throw orgError;

      const websiteConfig = orgData?.config_json?.website_config || {};
      
      setConfig({
        hero_title: websiteConfig.hero_title || '',
        hero_subtitle: websiteConfig.hero_subtitle || '',
        hero_images: websiteConfig.hero_images || [''],
        specialist_name: websiteConfig.specialist_name || '',
        specialist_title: websiteConfig.specialist_title || '',
        specialist_foto_url: websiteConfig.specialist_foto_url || '',
        specialist_bio: websiteConfig.specialist_bio || '',
        differentials: websiteConfig.differentials || [],
        testimonials: websiteConfig.testimonials || []
      });

      // 2. Fetch leads for this organization
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads_contato')
        .select('*')
        .eq('organizacao_id', orgId)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;
      setLeads(leadsData || []);

      // 3. Fetch default specialist details from organization courses (as fallback)
      const { data: coursesData } = await supabase
        .from('cursos')
        .select('professor_nome, professor_titulo, professor_foto_url')
        .eq('organizacao_id', orgId)
        .not('professor_nome', 'is', null)
        .limit(1);

      if (coursesData && coursesData.length > 0) {
        setDefaultSpecialist({
          nome: coursesData[0].professor_nome || '',
          titulo: coursesData[0].professor_titulo || '',
          foto_url: coursesData[0].professor_foto_url || ''
        });
      }
    } catch (err: any) {
      console.error('Error fetching website settings/leads:', err);
      showToast('Erro ao carregar configurações do site.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Fetch current organization config_json
      const { data: orgData, error: orgError } = await supabase
        .from('organizacoes')
        .select('config_json')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;

      const currentConfigJson = orgData?.config_json || {};
      
      const updatedConfigJson = {
        ...currentConfigJson,
        website_config: config
      };

      const { error: updateError } = await supabase
        .from('organizacoes')
        .update({ config_json: updatedConfigJson })
        .eq('id', orgId);

      if (updateError) throw updateError;
      showToast('Configurações do website salvas com sucesso!', 'success');
    } catch (err: any) {
      console.error('Error saving website config:', err);
      showToast(err.message || 'Erro ao salvar configurações.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const markLeadAsRead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads_contato')
        .update({ lido: true })
        .eq('id', leadId);

      if (error) throw error;
      setLeads(leads.map(l => l.id === leadId ? { ...l, lido: true } : l));
      showToast('Lead marcado como lido.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao atualizar lead.', 'error');
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
    try {
      const { error } = await supabase
        .from('leads_contato')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      setLeads(leads.filter(l => l.id !== leadId));
      showToast('Lead excluído com sucesso.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao excluir lead.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('conteudo')}
          className="py-3 px-4 font-bold border-b-2 transition-colors cursor-pointer"
          style={{ 
            borderColor: activeTab === 'conteudo' ? corPrimaria : 'transparent',
            color: activeTab === 'conteudo' ? corPrimaria : '#64748b'
          }}
        >
          Conteúdo do Site
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          className="py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer"
          style={{ 
            borderColor: activeTab === 'leads' ? corPrimaria : 'transparent',
            color: activeTab === 'leads' ? corPrimaria : '#64748b'
          }}
        >
          Caixa de Entrada (Leads)
          {leads.filter(l => !l.lido).length > 0 && (
            <span className="text-white text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: corPrimaria }}>
              {leads.filter(l => !l.lido).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'conteudo' && (
        <div className="space-y-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Apresentação do Especialista</h2>
              <p className="text-sm text-slate-500 mt-0.5">Configure as seções da página pública da sua plataforma de cursos.</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: corPrimaria }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8 pt-4">
            {/* Hero */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Hero (Banner Principal)</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título Principal</label>
                <textarea 
                  value={config.hero_title || ''} 
                  onChange={e => setConfig({...config, hero_title: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-500"
                  rows={2}
                  placeholder="Ex: Domine as Melhores Técnicas de..."
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtítulo</label>
                <textarea 
                  value={config.hero_subtitle || ''} 
                  onChange={e => setConfig({...config, hero_subtitle: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-500"
                  rows={2}
                  placeholder="Ex: Aprenda do zero ao avançado com aulas práticas e mentorias..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Imagens do Carrossel (URLs)</label>
                {(config.hero_images || []).map((img: string, idx: number) => (
                  <div key={idx} className="space-y-2 mb-3">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={img} 
                        onChange={e => {
                          const newImgs = [...config.hero_images];
                          newImgs[idx] = e.target.value;
                          setConfig({...config, hero_images: newImgs});
                        }}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                        placeholder="https://images.unsplash.com/photo-..."
                      />
                      <button 
                        onClick={() => {
                          const newImgs = config.hero_images.filter((_: any, i: number) => i !== idx);
                          setConfig({...config, hero_images: newImgs.length > 0 ? newImgs : ['']});
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {img && img.trim().startsWith('http') && (
                      <div className="relative w-full max-w-[200px] h-28 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                        <img 
                          src={img.trim()} 
                          alt="Preview do carrossel" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1594322436404-5a0526db4d13?q=80&w=200&auto=format&fit=crop';
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => setConfig({...config, hero_images: [...(config.hero_images || []), '']})}
                  className="text-xs font-bold flex items-center gap-1 mt-2 cursor-pointer"
                  style={{ color: corPrimaria }}
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Imagem
                </button>
              </div>
            </div>

            {/* Especialista */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Sobre o Especialista (Instrutor)</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Nome do Especialista
                </label>
                <input 
                  type="text"
                  value={config.specialist_name || ''} 
                  onChange={e => setConfig({...config, specialist_name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  placeholder={defaultSpecialist.nome ? `Padrão: ${defaultSpecialist.nome}` : 'Nome do Especialista'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Cargo / Título
                </label>
                <input 
                  type="text"
                  value={config.specialist_title || ''} 
                  onChange={e => setConfig({...config, specialist_title: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  placeholder={defaultSpecialist.titulo ? `Padrão: ${defaultSpecialist.titulo}` : 'Ex: Doutor em Psicologia / Especialista em Vendas'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  URL da Foto
                </label>
                <input 
                  type="text"
                  value={config.specialist_foto_url || ''} 
                  onChange={e => setConfig({...config, specialist_foto_url: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  placeholder={defaultSpecialist.foto_url ? `Padrão: ${defaultSpecialist.foto_url}` : 'https://exemplo.com/foto.jpg'}
                />
                { (config.specialist_foto_url || defaultSpecialist.foto_url) && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={config.specialist_foto_url || defaultSpecialist.foto_url} 
                      alt="Avatar Preview" 
                      className="w-8 h-8 rounded-full object-cover border" 
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <span className="text-[10px] text-slate-400">Pré-visualização do avatar</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Biografia (Apresentação)</label>
                <textarea 
                  value={config.specialist_bio || ''} 
                  onChange={e => setConfig({...config, specialist_bio: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-500 resize-none"
                  rows={3}
                  placeholder="Apresente-se para os visitantes..."
                />
              </div>
            </div>

            {/* Diferenciais */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Diferenciais</h3>
              {(config.differentials || []).map((diff: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                  <button 
                    type="button"
                    onClick={() => {
                      const newDiff = config.differentials.filter((_: any, i: number) => i !== idx);
                      setConfig({...config, differentials: newDiff});
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <input 
                    value={diff.title || ''} 
                    onChange={e => {
                      const newDiff = [...config.differentials];
                      newDiff[idx].title = e.target.value;
                      setConfig({...config, differentials: newDiff});
                    }}
                    className="w-full p-2 mb-2 bg-white border border-slate-200 rounded text-sm font-bold"
                    placeholder="Título do Diferencial"
                  />
                  <textarea 
                    value={diff.text || ''} 
                    onChange={e => {
                      const newDiff = [...config.differentials];
                      newDiff[idx].text = e.target.value;
                      setConfig({...config, differentials: newDiff});
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-sm resize-none"
                    placeholder="Descrição"
                    rows={2}
                  />
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setConfig({...config, differentials: [...(config.differentials || []), { title: '', text: '' }]})}
                className="text-xs font-bold flex items-center gap-1 cursor-pointer"
                style={{ color: corPrimaria }}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Diferencial
              </button>
            </div>

            {/* Depoimentos */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Depoimentos</h3>
              {(config.testimonials || []).map((test: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                  <button 
                    type="button"
                    onClick={() => {
                      const newTest = config.testimonials.filter((_: any, i: number) => i !== idx);
                      setConfig({...config, testimonials: newTest});
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input 
                      value={test.author || ''} 
                      onChange={e => {
                        const newTest = [...config.testimonials];
                        newTest[idx].author = e.target.value;
                        setConfig({...config, testimonials: newTest});
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm font-bold"
                      placeholder="Nome do Autor"
                    />
                    <input 
                      value={test.role || ''} 
                      onChange={e => {
                        const newTest = [...config.testimonials];
                        newTest[idx].role = e.target.value;
                        setConfig({...config, testimonials: newTest});
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm text-slate-500"
                      placeholder="Cargo/Papel"
                    />
                  </div>
                  <textarea 
                    value={test.text || ''} 
                    onChange={e => {
                      const newTest = [...config.testimonials];
                      newTest[idx].text = e.target.value;
                      setConfig({...config, testimonials: newTest});
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-sm resize-none"
                    placeholder="Mensagem do depoimento..."
                    rows={2}
                  />
                </div>
              ))}
              <button 
                type="button"
                onClick={() => setConfig({...config, testimonials: [...(config.testimonials || []), { author: '', role: '', text: '' }]})}
                className="text-xs font-bold flex items-center gap-1 cursor-pointer"
                style={{ color: corPrimaria }}
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Depoimento
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              Nenhum lead de contato recebido ainda nesta organização.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map(lead => (
                <div key={lead.id} className={`p-6 transition-colors ${!lead.lido ? 'bg-indigo-50/10' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`text-base ${!lead.lido ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{lead.nome}</h3>
                        {!lead.lido && (
                          <span className="text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: corPrimaria }}>
                            Novo
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{new Date(lead.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:opacity-85 transition-opacity">
                          <Mail className="w-3.5 h-3.5" /> {lead.email}
                        </a>
                        {lead.telefone && (
                          <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-85 transition-opacity">
                            WhatsApp: {lead.telefone}
                          </a>
                        )}
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-slate-700 text-sm whitespace-pre-wrap">
                        {lead.mensagem}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 shrink-0">
                      {!lead.lido && (
                        <button 
                          onClick={() => markLeadAsRead(lead.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Lido
                        </button>
                      )}
                      <button 
                        onClick={() => deleteLead(lead.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer self-end"
                        title="Excluir Lead"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
