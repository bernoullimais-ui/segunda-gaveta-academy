import React, { useRef, useState } from 'react';
import { Upload, X, FileText, Image, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CampoConfig } from '../types';

interface CampoRendererProps {
  campo: CampoConfig;
  value: any;
  onChange?: (campoId: string, value: any) => void;
  readOnly?: boolean;
  feedbackInline?: string;
  onFeedbackChange?: (campoId: string, text: string) => void;
  isAdmin?: boolean;
  cursoId?: string;
  userId?: string;
}

export function CampoRenderer({
  campo,
  value,
  onChange,
  readOnly = false,
  feedbackInline,
  onFeedbackChange,
  isAdmin = false,
  cursoId,
  userId,
}: CampoRendererProps) {
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseInput = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500';

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cursoId || !userId) return;
    setIsUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${cursoId}/${userId}/${campo.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('projeto-uploads')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('projeto-uploads').getPublicUrl(path);
      onChange?.(campo.id, { url: urlData.publicUrl, nome: file.name, tipo: file.type });
    } catch (err) {
      console.error('Erro no upload:', err);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const renderField = () => {
    switch (campo.tipo) {
      case 'texto_curto':
        return (
          <input
            type="text"
            className={baseInput}
            placeholder={campo.placeholder || 'Digite aqui...'}
            value={value || ''}
            onChange={e => onChange?.(campo.id, e.target.value)}
            disabled={readOnly}
          />
        );

      case 'texto_longo':
        return (
          <textarea
            className={`${baseInput} resize-none`}
            rows={4}
            placeholder={campo.placeholder || 'Descreva aqui...'}
            value={value || ''}
            onChange={e => onChange?.(campo.id, e.target.value)}
            disabled={readOnly}
          />
        );

      case 'numero':
      case 'calculado':
        return (
          <div className="flex items-center gap-2 relative">
            {campo.unidade && campo.unidade !== '%' && (
              <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
                {campo.unidade}
              </span>
            )}
            <input
              type="number"
              className={`${baseInput} ${campo.tipo === 'calculado' ? 'bg-slate-50 cursor-not-allowed font-medium text-slate-700 shadow-inner' : ''}`}
              placeholder={campo.tipo === 'calculado' ? 'Automático' : (campo.placeholder || '0')}
              value={value ?? ''}
              onChange={e => {
                if (campo.tipo !== 'calculado') onChange?.(campo.id, e.target.value);
              }}
              disabled={readOnly || campo.tipo === 'calculado'}
              readOnly={campo.tipo === 'calculado'}
            />
            {campo.unidade === '%' && (
              <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 shrink-0">
                %
              </span>
            )}
            {campo.tipo === 'calculado' && value === 0 && (
              <div className="absolute right-3 opacity-60 hover:opacity-100 transition-opacity cursor-help" title="Se este valor for 0 inesperadamente, pode haver campos não preenchidos ou erro na fórmula">
                <span className="text-amber-500 text-sm">⚠️</span>
              </div>
            )}
          </div>
        );

      case 'data':
        return (
          <input
            type="date"
            className={baseInput}
            value={value || ''}
            onChange={e => onChange?.(campo.id, e.target.value)}
            disabled={readOnly}
          />
        );

      case 'checkbox': {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-3">
            {(campo.opcoes || []).map(opcao => (
              <label
                key={opcao}
                className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-all text-sm ${
                  selected.includes(opcao)
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                } ${readOnly ? 'pointer-events-none opacity-75' : ''}`}
              >
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={selected.includes(opcao)}
                  onChange={e => {
                    if (readOnly) return;
                    const next = e.target.checked
                      ? [...selected, opcao]
                      : selected.filter(o => o !== opcao);
                    onChange?.(campo.id, next);
                  }}
                  disabled={readOnly}
                />
                {opcao}
              </label>
            ))}
          </div>
        );
      }

      case 'selecao_unica':
        return (
          <div className="flex flex-wrap gap-3">
            {(campo.opcoes || []).map(opcao => (
              <label
                key={opcao}
                className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-all text-sm ${
                  value === opcao
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                } ${readOnly ? 'pointer-events-none opacity-75' : ''}`}
              >
                <input
                  type="radio"
                  className="accent-blue-600"
                  checked={value === opcao}
                  onChange={() => { if (!readOnly) onChange?.(campo.id, opcao); }}
                  disabled={readOnly}
                />
                {opcao}
              </label>
            ))}
          </div>
        );

      case 'tabela': {
        const cols = campo.colunas || ['Coluna 1', 'Coluna 2'];
        const rotulos = campo.linhas_rotulos || [];
        const numLinhas = Math.max(campo.linhas || 5, rotulos.length);
        
        let rows: string[][] = Array.isArray(value) && value.length > 0 ? value : [];
        if (rows.length < numLinhas) {
          const extra = Array.from({ length: numLinhas - rows.length }, () => cols.map(() => ''));
          rows = [...rows, ...extra];
        }
        if (rotulos.length > 0) {
          rows = rows.map((r, ri) => r.map((c, ci) => ci === 0 && rotulos[ri] ? rotulos[ri] : c));
        }

        return (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {cols.map((col, ci) => (
                    <th key={ci} className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 last:border-0">
                    {cols.map((_col, ci) => {
                      const isFixado = ci === 0 && !!rotulos[ri];
                      return (
                      <td key={ci} className={`px-2 py-1 ${isFixado ? 'bg-slate-50/50 border-r border-slate-100' : ''}`}>
                        {isFixado ? (
                          <span className="block px-2 py-1 text-sm font-semibold text-slate-700">{rotulos[ri]}</span>
                        ) : (
                          <input
                            type="text"
                            className="w-full px-2 py-1 text-sm bg-transparent focus:outline-none focus:bg-blue-50 rounded transition-colors disabled:text-slate-500"
                            value={row[ci] || ''}
                            onChange={e => {
                              if (readOnly) return;
                              const newRows = rows.map((r, rIdx) =>
                                rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? e.target.value : c) : r
                              );
                              onChange?.(campo.id, newRows);
                            }}
                            disabled={readOnly}
                            placeholder="—"
                          />
                        )}
                      </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'upload': {
        const fileValue = value as { url?: string; nome?: string; tipo?: string } | null;
        return (
          <div>
            {fileValue?.url ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                {fileValue.tipo?.startsWith('image/') ? (
                  <Image className="w-5 h-5 text-blue-500 shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                )}
                <a
                  href={fileValue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline truncate"
                >
                  {fileValue.nome || 'Arquivo enviado'}
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onChange?.(campo.id, null)}
                    className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium w-full justify-center ${
                  isUploadingFile ? 'opacity-50 cursor-wait' : ''
                } ${readOnly ? 'pointer-events-none' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={readOnly || isUploadingFile}
              >
                {isUploadingFile
                  ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  : <Upload className="w-4 h-4" />}
                {isUploadingFile ? 'Enviando...' : (campo.placeholder || 'Clique para enviar um arquivo')}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleUpload}
            />
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-slate-700">
          {campo.label}
          {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
        </label>
        {isAdmin && (
          <button
            type="button"
            className={`text-xs flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
              feedbackInline
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-600 opacity-0 group-hover:opacity-100'
            }`}
            onClick={() => setShowFeedbackInput(v => !v)}
          >
            <Paperclip className="w-3 h-3" />
            {feedbackInline ? 'Editar comentário' : 'Comentar'}
          </button>
        )}
      </div>

      {renderField()}

      {!isAdmin && feedbackInline && (
        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <Paperclip className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{feedbackInline}</p>
        </div>
      )}

      {isAdmin && showFeedbackInput && (
        <div className="mt-2">
          <textarea
            className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-amber-50 text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-amber-400"
            rows={2}
            placeholder="Comentário sobre este campo..."
            value={feedbackInline || ''}
            onChange={e => onFeedbackChange?.(campo.id, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
