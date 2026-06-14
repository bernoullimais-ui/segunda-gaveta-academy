import React, { useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

interface DailyVideoRoomProps {
  roomUrl: string;
  onLeave?: () => void;
}

export function DailyVideoRoom({ roomUrl, onLeave }: DailyVideoRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !roomUrl) return;

    try {
      const callFrame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        lang: 'pt',
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '16px',
          backgroundColor: '#0f172a', // slate-900
        },
      });

      callFrameRef.current = callFrame;

      callFrame.on('joined-meeting', () => {
        setHasJoined(true);
      });

      callFrame.on('left-meeting', () => {
        setHasJoined(false);
        callFrame.destroy();
        callFrameRef.current = null;
        if (onLeave) onLeave();
      });

      callFrame.on('error', (e) => {
        console.error('Erro no Daily:', e);
        setError('Ocorreu um erro ao conectar na sala de vídeo.');
      });

      callFrame.join({ url: roomUrl });

    } catch (e) {
      console.error('Erro ao inicializar DailyIframe:', e);
      setError('Falha ao inicializar o reprodutor de vídeo.');
    }

    return () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
  }, [roomUrl, onLeave]);

  return (
    <div className="w-full aspect-video md:h-[600px] bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
      {!hasJoined && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-400 font-medium">Conectando ao encontro ao vivo...</p>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-20 text-center px-6">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-white font-bold mb-2">{error}</p>
          <button 
            onClick={onLeave}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Voltar
          </button>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
