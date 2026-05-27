import React, { useState } from 'react';
import { X, DollarSign, Save } from 'lucide-react';

interface PricingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig: any;
  allCourses: any[];
}

export const PricingConfigModal: React.FC<PricingConfigModalProps> = ({ isOpen, onClose, onSave, initialConfig, allCourses }) => {
  const [config, setConfig] = useState(initialConfig);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Configurar Condições Financeiras</h2>
          <button onClick={onClose}><X className="text-slate-400" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Passaporte Full (Preço Normal)</label>
            <input type="number" value={config.fullPrecoNormal} onChange={e => setConfig({...config, fullPrecoNormal: e.target.value})} className="w-full p-3 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Passaporte Full (Preço Lançamento)</label>
            <input type="number" value={config.fullPrecoLancamento} onChange={e => setConfig({...config, fullPrecoLancamento: e.target.value})} className="w-full p-3 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data Limite Preço Lançamento (Full)</label>
            <input type="date" value={config.fullDataLimite} onChange={e => setConfig({...config, fullDataLimite: e.target.value})} className="w-full p-3 border rounded-lg" />
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-2">Trilhas</h3>
            <div className="space-y-4 mb-4">
              {(config.trilhas || []).map((trilha: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nome da Trilha" 
                      value={trilha.nome} 
                      onChange={e => {
                        const newTrilhas = [...config.trilhas];
                        newTrilhas[index].nome = e.target.value;
                        setConfig({...config, trilhas: newTrilhas});
                      }}
                      className="flex-grow p-2 border rounded-lg text-sm"
                    />
                    <input 
                      type="number" 
                      placeholder="Preço" 
                      value={trilha.preco} 
                      onChange={e => {
                        const newTrilhas = [...config.trilhas];
                        newTrilhas[index].preco = parseFloat(e.target.value);
                        setConfig({...config, trilhas: newTrilhas});
                      }}
                      className="w-24 p-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-slate-700">Cursos incluídos:</span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {allCourses.map(curso => (
                        <label key={curso.id} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={(trilha.cursos || []).includes(curso.id)}
                            onChange={(e) => {
                              const newTrilhas = [...config.trilhas];
                              const currentCursos = newTrilhas[index].cursos || [];
                              if (e.target.checked) {
                                newTrilhas[index].cursos = [...currentCursos, curso.id];
                              } else {
                                newTrilhas[index].cursos = currentCursos.filter((id: string) => id !== curso.id);
                              }
                              setConfig({...config, trilhas: newTrilhas});
                            }}
                          />
                          {curso.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button 
              type="button"
              onClick={() => {
                const newTrilha = { id: crypto.randomUUID(), nome: '', preco: 0, cursos: [] };
                setConfig({ ...config, trilhas: [...(config.trilhas || []), newTrilha] });
              }}
              className="text-sm text-blue-600 font-medium"
            >
              + Adicionar Trilha
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button onClick={() => onSave(config)} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
            <Save className="w-4 h-4" /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
