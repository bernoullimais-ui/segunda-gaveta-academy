import React, { useState, useEffect } from 'react';

interface ActionModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  type: 'alert' | 'confirm' | 'prompt' | 'multiselect';
  inputLabel?: string;
  checkboxLabel?: string;
  options?: { label: string, value: string }[];
  onConfirm: (value?: any, checked?: boolean) => void;
  onCancel: () => void;
}

export function ActionModal({
  isOpen,
  title,
  message,
  type,
  inputLabel,
  checkboxLabel,
  options,
  onConfirm,
  onCancel
}: ActionModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setCheckboxValue(false);
      setSelectedOptions([]);
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        {message && <p className="text-slate-600 mb-4">{message}</p>}
        
        {type === 'prompt' && (
          <div className="mb-4">
            {inputLabel && <label className="block text-sm font-medium text-slate-700 mb-1">{inputLabel}</label>}
            {options ? (
              <>
                <input
                  type="text"
                  list="modal-options"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && inputValue.trim()) {
                      onConfirm(inputValue, checkboxValue);
                    }
                  }}
                  placeholder="Selecione ou digite..."
                />
                <datalist id="modal-options">
                  {options.map((opt, i) => (
                    <option key={i} value={opt.value}>{opt.label}</option>
                  ))}
                </datalist>
              </>
            ) : (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    onConfirm(inputValue, checkboxValue);
                  }
                }}
              />
            )}
          </div>
        )}

        {type === 'multiselect' && options && (
          <div className="mb-4">
            {inputLabel && <label className="block text-sm font-medium text-slate-700 mb-2">{inputLabel}</label>}
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-red-500 outline-none mb-3"
            />
            <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
              {options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase())).map((opt, i) => (
                <label key={i} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(opt.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOptions([...selectedOptions, opt.value]);
                      } else {
                        setSelectedOptions(selectedOptions.filter(v => v !== opt.value));
                      }
                    }}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
              {options.filter(opt => opt.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="text-sm text-slate-500 text-center py-2">Nenhuma opção encontrada.</div>
              )}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {selectedOptions.length} selecionada(s)
            </div>
          </div>
        )}

        {checkboxLabel && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="modal-checkbox"
              checked={checkboxValue}
              onChange={(e) => setCheckboxValue(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
            />
            <label htmlFor="modal-checkbox" className="text-sm text-slate-700">{checkboxLabel}</label>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          {type !== 'alert' && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => {
              if (type === 'multiselect') {
                onConfirm(selectedOptions, checkboxValue);
              } else {
                onConfirm(inputValue, checkboxValue);
              }
            }}
            disabled={(type === 'prompt' && !inputValue.trim()) || (type === 'multiselect' && selectedOptions.length === 0)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {type === 'alert' ? 'OK' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
