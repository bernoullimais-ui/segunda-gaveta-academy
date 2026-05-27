import React from 'react';
import { X, Copy, Check } from 'lucide-react';

interface MarketingLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicBaseUrl: string;
  cursos: any[];
  trilhas: any[];
}

export const MarketingLinksModal: React.FC<MarketingLinksModalProps> = ({ isOpen, onClose, publicBaseUrl, cursos, trilhas }) => {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const links = [
    ...(trilhas || []).map((trilha: any) => ({
      id: `trilha-${trilha.id}`,
      label: `Trilha: ${trilha.nome}`,
      url: `${publicBaseUrl}/public/trilha/${trilha.id}`
    })),
    ...cursos.map((curso: any) => ({
      id: `curso-${curso.id}`,
      label: `Curso: ${curso.nome}`,
      url: `${publicBaseUrl}/public/curso/${curso.id}`
    }))
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Links de Divulgação</h2>
          <button onClick={onClose}><X className="text-slate-400" /></button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {links.map(link => (
            <div key={link.id} className="p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="text-sm font-medium pr-4">{link.label}</span>
              <button 
                onClick={() => copyToClipboard(link.url, link.id)}
                className="p-2 text-slate-500 hover:text-blue-600"
              >
                {copiedId === link.id ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
