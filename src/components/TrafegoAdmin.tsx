import React, { useState } from 'react';
import { Bot, Copy, Download, Loader2, Sparkles, AlertCircle, BarChart3, TrendingUp, DollarSign, Target } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../lib/supabase';

interface TrafegoAdminProps {
  courseId: string;
  courseName: string;
  courseDescription?: string;
  targetAudience?: string;
  curriculoJson?: any;
}

export const TrafegoAdmin: React.FC<TrafegoAdminProps> = ({ 
  courseId, 
  courseName, 
  courseDescription, 
  targetAudience, 
  curriculoJson 
}) => {
  const [format, setFormat] = useState('AIDA');
  const [tone, setTone] = useState('Persuasivo e Direto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [copySuccess, setCopySuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedText('');
    setErrorMsg('');
    try {
      const response = await fetch('/api/trafego/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          courseName,
          courseDescription,
          targetAudience,
          curriculo: curriculoJson,
          format,
          tone
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Falha ao gerar conteúdo.');
      }

      setGeneratedText(data.text);

      // Save to Supabase (History) - non-blocking
      supabase.from('ia_criativos_historico').insert([{
        curso_id: courseId,
        tipo: format,
        conteudo_gerado: data.text,
        prompt_usado: tone
      }]).then(({ error }) => {
        if (error) console.warn('Não foi possível salvar o histórico. Tabela pode não estar criada ainda:', error.message);
      });

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    setCopySuccess('Copiado!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedText], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `criativo-${format.toLowerCase()}-${courseId.substring(0,6)}.md`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* 1. Dashboard Executivo (Mockado Fase 1) */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-black text-lg">Dashboard de Tráfego</h3>
            <p className="text-slate-400 text-xs font-medium">Métricas Meta Ads (Demonstração Fase 1)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Spend Total</p>
            <p className="text-2xl font-black">R$ 1.250,00</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Receita Gerada</p>
            <p className="text-2xl font-black text-emerald-400">R$ 4.500,00</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">ROAS</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-black">3.6x</p>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">CPA Médio</p>
            <p className="text-2xl font-black text-amber-400">R$ 45,50</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 2. Laboratório Criativo (Painel IA) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800">Gerador de Criativos IA</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Formato da Copy</label>
                <select 
                  value={format} 
                  onChange={e => setFormat(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="AIDA">Texto - AIDA (Atenção, Interesse, Desejo, Ação)</option>
                  <option value="PAS">Texto - PAS (Problema, Agitação, Solução)</option>
                  <option value="VIDEO">Roteiro de Vídeo / Reels</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tom de Voz</label>
                <select 
                  value={tone} 
                  onChange={e => setTone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="Persuasivo e Direto">Persuasivo e Direto</option>
                  <option value="Informativo e Educacional">Informativo e Educacional</option>
                  <option value="Agressivo (Foco em Escassez)">Agressivo (Foco em Escassez)</option>
                  <option value="Empático (Foco na Dor)">Empático (Foco na Dor)</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-purple-600/20"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processando IA...</>
                  ) : (
                    <><Bot className="w-5 h-5" /> Gerar com Gemini</>
                  )}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{errorMsg}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Resultado & Histórico */}
        <div className="lg:col-span-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Resultado Gerado
                {generatedText && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black tracking-wider rounded-full">Novo</span>}
              </h3>

              {generatedText && (
                <div className="flex gap-2">
                  <button 
                    onClick={handleCopyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" /> {copySuccess || 'Copiar'}
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" /> Exportar .MD
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {!generatedText && !isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-center max-w-sm">
                    Configure os parâmetros à esquerda e clique em "Gerar" para criar uma nova copy ou roteiro turbinado por Inteligência Artificial.
                  </p>
                </div>
              ) : isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-purple-500 space-y-4 py-20">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <p className="font-bold text-sm uppercase tracking-widest animate-pulse">A IA está escrevendo...</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none prose-h1:text-xl prose-h2:text-lg prose-h3:text-md prose-p:text-slate-600 prose-table:w-full prose-th:bg-slate-50 prose-th:p-3 prose-td:p-3 prose-td:border-t">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {generatedText}
                  </Markdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
