import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Plus, Trash2, Mail, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';

export const WebsiteEditor: React.FC = () => {
  const [config, setConfig] = useState<any>({});
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'conteudo' | 'leads'>('conteudo');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, leadsRes] = await Promise.all([
        supabase.from('configuracoes_plataforma').select('website_config').eq('id', 1).maybeSingle(),
        supabase.from('leads_contato').select('*').order('created_at', { ascending: false })
      ]);

      if (configRes.data?.website_config) {
        setConfig(configRes.data.website_config);
      } else {
        // Fallback default
        setConfig({
          hero_title: "Transforme seu Conhecimento em um Negócio Digital de Sucesso",
          hero_subtitle: "A plataforma white-label definitiva...",
          hero_images: [""],
          services: [],
          differentials: [],
          testimonials: [],
          contact: { title: "Fale com nossos consultores", email: "" }
        });
      }

      if (leadsRes.data) {
        setLeads(leadsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('configuracoes_plataforma')
        .update({ website_config: config })
        .eq('id', 1);

      if (error) throw error;
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const markLeadAsRead = async (id: string) => {
    try {
      await supabase.from('leads_contato').update({ lido: true }).eq('id', id);
      setLeads(leads.map(l => l.id === id ? { ...l, lido: true } : l));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;
    try {
      await supabase.from('leads_contato').delete().eq('id', id);
      setLeads(leads.filter(l => l.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('conteudo')}
          className={`py-3 px-4 font-bold border-b-2 transition-colors ${activeTab === 'conteudo' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Conteúdo do Site
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          className={`py-3 px-4 font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'leads' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Caixa de Entrada (Leads)
          {leads.filter(l => !l.lido).length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
              {leads.filter(l => !l.lido).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'conteudo' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Editor do Site Institucional</h2>
              <p className="text-sm text-slate-500 mt-1">Configure os textos e seções exibidos na página principal (segundagaveta.com.br).</p>
            </div>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Hero */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Hero (Banner Principal)</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título Principal</label>
                <textarea 
                  value={config.hero_title || ''} 
                  onChange={e => setConfig({...config, hero_title: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subtítulo</label>
                <textarea 
                  value={config.hero_subtitle || ''} 
                  onChange={e => setConfig({...config, hero_subtitle: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Imagens do Carrossel (URLs)</label>
                {(config.hero_images || []).map((img: string, idx: number) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      value={img} 
                      onChange={e => {
                        const newImgs = [...config.hero_images];
                        newImgs[idx] = e.target.value;
                        setConfig({...config, hero_images: newImgs});
                      }}
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                      placeholder="https://..."
                    />
                    <button 
                      onClick={() => {
                        const newImgs = config.hero_images.filter((_: any, i: number) => i !== idx);
                        setConfig({...config, hero_images: newImgs});
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setConfig({...config, hero_images: [...(config.hero_images || []), '']})}
                  className="text-xs font-bold text-indigo-600 flex items-center gap-1 mt-2"
                >
                  <Plus className="w-3 h-3" /> Adicionar Imagem
                </button>
              </div>
            </div>

            {/* Serviços */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Serviços</h3>
              {(config.services || []).map((svc: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                  <button 
                    onClick={() => {
                      const newSvc = config.services.filter((_: any, i: number) => i !== idx);
                      setConfig({...config, services: newSvc});
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <input 
                    value={svc.title} 
                    onChange={e => {
                      const newSvc = [...config.services];
                      newSvc[idx].title = e.target.value;
                      setConfig({...config, services: newSvc});
                    }}
                    className="w-full p-2 mb-2 bg-white border border-slate-200 rounded text-sm font-bold"
                    placeholder="Título do Serviço"
                  />
                  <textarea 
                    value={svc.description} 
                    onChange={e => {
                      const newSvc = [...config.services];
                      newSvc[idx].description = e.target.value;
                      setConfig({...config, services: newSvc});
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-sm resize-none"
                    placeholder="Descrição do Serviço"
                    rows={2}
                  />
                  <div className="mt-2 flex gap-2 items-center">
                    <span className="text-xs text-slate-500">Ícone:</span>
                    <select 
                      value={svc.icon}
                      onChange={e => {
                        const newSvc = [...config.services];
                        newSvc[idx].icon = e.target.value;
                        setConfig({...config, services: newSvc});
                      }}
                      className="p-1 border border-slate-200 rounded text-xs bg-white"
                    >
                      <option value="Rocket">Foguete</option>
                      <option value="ShieldCheck">Escudo</option>
                      <option value="Users">Usuários</option>
                      <option value="MonitorPlay">Monitor/Vídeo</option>
                    </select>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => setConfig({...config, services: [...(config.services || []), { title: '', description: '', icon: 'Rocket' }]})}
                className="text-xs font-bold text-indigo-600 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Serviço
              </button>
            </div>

            {/* Diferenciais */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Diferenciais</h3>
              {(config.differentials || []).map((diff: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                  <button 
                    onClick={() => {
                      const newDiff = config.differentials.filter((_: any, i: number) => i !== idx);
                      setConfig({...config, differentials: newDiff});
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <input 
                    value={diff.title} 
                    onChange={e => {
                      const newDiff = [...config.differentials];
                      newDiff[idx].title = e.target.value;
                      setConfig({...config, differentials: newDiff});
                    }}
                    className="w-full p-2 mb-2 bg-white border border-slate-200 rounded text-sm font-bold"
                    placeholder="Título do Diferencial"
                  />
                  <textarea 
                    value={diff.text} 
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
                onClick={() => setConfig({...config, differentials: [...(config.differentials || []), { title: '', text: '' }]})}
                className="text-xs font-bold text-indigo-600 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Diferencial
              </button>
            </div>

            {/* Depoimentos */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 border-b pb-2">Depoimentos</h3>
              {(config.testimonials || []).map((test: any, idx: number) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative">
                  <button 
                    onClick={() => {
                      const newTest = config.testimonials.filter((_: any, i: number) => i !== idx);
                      setConfig({...config, testimonials: newTest});
                    }}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input 
                      value={test.author} 
                      onChange={e => {
                        const newTest = [...config.testimonials];
                        newTest[idx].author = e.target.value;
                        setConfig({...config, testimonials: newTest});
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded text-sm font-bold"
                      placeholder="Nome do Autor"
                    />
                    <input 
                      value={test.role} 
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
                    value={test.text} 
                    onChange={e => {
                      const newTest = [...config.testimonials];
                      newTest[idx].text = e.target.value;
                      setConfig({...config, testimonials: newTest});
                    }}
                    className="w-full p-2 bg-white border border-slate-200 rounded text-sm resize-none"
                    placeholder="Mensagem do depoimento..."
                    rows={3}
                  />
                </div>
              ))}
              <button 
                onClick={() => setConfig({...config, testimonials: [...(config.testimonials || []), { author: '', role: '', text: '' }]})}
                className="text-xs font-bold text-indigo-600 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar Depoimento
              </button>
            </div>
            
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              Nenhum contato recebido ainda.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leads.map(lead => (
                <div key={lead.id} className={`p-6 transition-colors ${!lead.lido ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`text-lg ${!lead.lido ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{lead.nome}</h3>
                        {!lead.lido && <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Novo</span>}
                        <span className="text-xs text-slate-400">{new Date(lead.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                          <Mail className="w-4 h-4" /> {lead.email}
                        </a>
                        {lead.telefone && (
                          <a href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                            WhatsApp: {lead.telefone}
                          </a>
                        )}
                      </div>
                      
                      <div className="bg-white border border-slate-200 p-4 rounded-xl text-slate-700 text-sm whitespace-pre-wrap">
                        {lead.mensagem}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 shrink-0">
                      {!lead.lido && (
                        <button 
                          onClick={() => markLeadAsRead(lead.id)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Marcar como Lido
                        </button>
                      )}
                      <button 
                        onClick={() => deleteLead(lead.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir Mensagem"
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
};
