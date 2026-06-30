import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Award, Palette, Image, Globe, Mail, Phone, MessageSquare, ShieldCheck, Ticket, DollarSign } from 'lucide-react';
import { CuponsAdmin } from './CuponsAdmin';
import { DadosRecebimento } from './DadosRecebimento';

interface ConfiguracaoAdminProps {
  loggedUser: any;
  orgId: string;
  onOrgUpdate: (updatedOrg: any) => void;
  showToast: (text: string, type: 'success' | 'error' | 'info') => void;
}

const PRESET_COLORS = [
  { name: 'Indigo (Default)', value: '#6366f1' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Azul Real', value: '#3b82f6' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Rosa Carmim', value: '#ec4899' },
  { name: 'Âmbar', value: '#f59e0b' },
  { name: 'Vermelho Coral', value: '#f43f5e' },
];

export function ConfiguracaoAdmin({ loggedUser, orgId, onOrgUpdate, showToast }: ConfiguracaoAdminProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'contato' | 'integracao' | 'cupons' | 'recebimento'>('visual');

  // Form states
  const [nome, setNome] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [corPrimaria, setCorPrimaria] = useState('#6366f1');
  
  // config_json states
  const [suporteEmail, setSuporteEmail] = useState('');
  const [suporteTelefone, setSuporteTelefone] = useState('');
  const [chatAtivo, setChatAtivo] = useState(true);
  const [validacaoPublica, setValidacaoPublica] = useState(true);

  useEffect(() => {
    const fetchOrgData = async () => {
      if (!orgId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('organizacoes')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setNome(data.nome || '');
          setLogoUrl(data.logo_url || '');
          setCorPrimaria(data.cor_primaria || '#6366f1');
          
          const cfg = data.config_json || {};
          setSuporteEmail(cfg.suporte_email || '');
          setSuporteTelefone(cfg.suporte_telefone || '');
          setChatAtivo(cfg.chat_ativo !== false);
          setValidacaoPublica(cfg.validacao_publica !== false);
        }
      } catch (err: any) {
        console.error('Error fetching org settings:', err);
        showToast('Erro ao carregar as configurações da organização.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;

    setSaving(true);
    const updatedConfigJson = {
      suporte_email: suporteEmail,
      suporte_telefone: suporteTelefone,
      chat_ativo: chatAtivo,
      validacao_publica: validacaoPublica
    };

    try {
      const { data, error } = await supabase
        .from('organizacoes')
        .update({
          nome,
          logo_url: logoUrl,
          cor_primaria: corPrimaria,
          config_json: updatedConfigJson
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onOrgUpdate(data);
        showToast('Configurações atualizadas com sucesso!', 'success');
      }
    } catch (err: any) {
      console.error('Error updating org settings:', err);
      showToast(err.message || 'Erro ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Banner */}
      <div className="p-8 text-white relative flex flex-col justify-end min-h-[160px] overflow-hidden" style={{ backgroundColor: corPrimaria }}>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white scale-150 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight mb-2">Configurações Gerais</h2>
          <p className="text-white/80 font-medium max-w-xl">
            Personalize a identidade visual, canais de suporte e integrações da sua academia digital.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 px-6 relative z-10">
        <button
          type="button"
          onClick={() => setActiveTab('visual')}
          className={`py-4 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'visual'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
          style={{ borderColor: activeTab === 'visual' ? corPrimaria : undefined, color: activeTab === 'visual' ? corPrimaria : undefined }}
        >
          <Palette size={18} />
          Identidade Visual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contato')}
          className={`py-4 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'contato'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
          style={{ borderColor: activeTab === 'contato' ? corPrimaria : undefined, color: activeTab === 'contato' ? corPrimaria : undefined }}
        >
          <Mail size={18} />
          Suporte & Contato
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('integracao')}
          className={`py-4 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'integracao'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
          style={{ borderColor: activeTab === 'integracao' ? corPrimaria : undefined, color: activeTab === 'integracao' ? corPrimaria : undefined }}
        >
          <Globe size={18} />
          Recursos & Validação
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cupons')}
          className={`py-4 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'cupons'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
          style={{ borderColor: activeTab === 'cupons' ? corPrimaria : undefined, color: activeTab === 'cupons' ? corPrimaria : undefined }}
        >
          <Ticket size={18} />
          Cupons de Desconto
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recebimento')}
          className={`py-4 px-4 font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'recebimento'
              ? 'text-slate-900 border-slate-900'
              : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}
          style={{ borderColor: activeTab === 'recebimento' ? corPrimaria : undefined, color: activeTab === 'recebimento' ? corPrimaria : undefined }}
        >
          <DollarSign size={18} />
          Dados de Recebimento
        </button>
      </div>

      {/* Content / Form */}
      {activeTab === 'cupons' ? (
        <div className="p-8">
          <CuponsAdmin orgId={orgId} corPrimaria={corPrimaria} showToast={showToast} />
        </div>
      ) : activeTab === 'recebimento' ? (
        <div className="p-8">
          <DadosRecebimento loggedUser={loggedUser} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {activeTab === 'visual' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">Nome da Organização</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium text-slate-800"
                    placeholder="Nome do seu portal"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">URL da Logomarca</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium text-slate-800"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>

              {/* Logo Preview */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Image className="text-slate-300 w-8 h-8" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">Visualização da Logo</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Esta logo será exibida na barra lateral do painel e no portal de validação de certificados.
                  </p>
                </div>
              </div>

              {/* Color Palette */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">Cor Primária da Marca</label>
                
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCorPrimaria(preset.value)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-xs font-semibold"
                      style={{
                        borderColor: corPrimaria === preset.value ? preset.value : '#e2e8f0',
                        backgroundColor: corPrimaria === preset.value ? `${preset.value}15` : 'white',
                        color: corPrimaria === preset.value ? preset.value : '#475569',
                      }}
                    >
                      <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: preset.value }}></span>
                      {preset.name}
                    </button>
                  ))}

                  {/* Custom Color Input */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-slate-500 font-semibold">Cor Personalizada:</span>
                    <input
                      type="color"
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 bg-transparent p-0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contato' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Mail size={16} className="text-slate-400" /> E-mail de Suporte
                  </label>
                  <input
                    type="email"
                    value={suporteEmail}
                    onChange={(e) => setSuporteEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium text-slate-800"
                    placeholder="suporte@suaempresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone size={16} className="text-slate-400" /> WhatsApp / Telefone
                  </label>
                  <input
                    type="tel"
                    value={suporteTelefone}
                    onChange={(e) => setSuporteTelefone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all font-medium text-slate-800"
                    placeholder="(71) 99999-9999"
                  />
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="font-semibold text-slate-800 text-sm mb-1">Informações de Contato</p>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Esses dados são usados para preencher os canais de contato da organização nos rodapés das páginas e páginas de checkout dos alunos.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'integracao' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <label className="font-bold text-slate-800 text-sm">Habilitar Chat de Aula Ao Vivo</label>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Permite que alunos troquem mensagens em tempo real durante transmissões "Ao Vivo".
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={chatAtivo}
                    onChange={(e) => setChatAtivo(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    style={{ accentColor: corPrimaria }}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <label className="font-bold text-slate-800 text-sm">Habilitar Validação Pública de Certificados</label>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Permite que terceiros validem a autenticidade dos certificados emitidos através do link público.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={validacaoPublica}
                    onChange={(e) => setValidacaoPublica(e.target.checked)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                    style={{ accentColor: corPrimaria }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit Bar */}
          <div className="pt-6 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 text-white font-bold rounded-2xl flex items-center gap-2 hover:opacity-90 transform active:scale-[0.98] transition-all shadow-md cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: corPrimaria }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Salvar Configurações
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
