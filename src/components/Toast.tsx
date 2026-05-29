import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMessage } from '../types';

interface ToastProps {
  message: ToastMessage | null;
  onClose?: () => void;
}

/**
 * Componente de Toast unificado.
 * Substitui as 5+ cópias do bloco de toast JSX espalhadas em App.tsx.
 *
 * Uso:
 *   <Toast message={toastMessage} />
 */
export function Toast({ message, onClose }: ToastProps) {
  if (!message) return null;

  const styles = {
    success: {
      bg: 'bg-emerald-600',
      icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
    },
    error: {
      bg: 'bg-red-600',
      icon: <AlertCircle className="w-5 h-5 flex-shrink-0" />,
    },
    info: {
      bg: 'bg-indigo-600',
      icon: <Info className="w-5 h-5 flex-shrink-0" />,
    },
  };

  const style = styles[message.type] ?? styles.info;

  return (
    <AnimatePresence>
      <motion.div
        key={message.text}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.25 }}
        className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white max-w-sm ${style.bg}`}
      >
        {style.icon}
        <span className="text-sm font-semibold leading-snug">{message.text}</span>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
