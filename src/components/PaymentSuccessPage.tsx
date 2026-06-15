import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, BookOpen, ArrowRight, Mail, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PaymentSuccessPageProps {
  participantId: string;
  type?: string;
  subStatus?: string;
}

export function PaymentSuccessPage({ participantId, type, subStatus }: PaymentSuccessPageProps) {
  const [status, setStatus] = useState<'polling' | 'confirmed' | 'error'>('polling');
  const [courseName, setCourseName] = useState<string>('');
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPending = subStatus === 'pending';

  const checkStatus = async () => {
    if (!participantId) { setStatus('error'); return; }
    try {
      const table = type === 'trilha' ? 'trilha_participantes' : 'curso_participantes';
      const joinSelect = type === 'trilha' ? 'id, status, trilhas(nome)' : 'id, status, cursos(nome)';
      const { data, error } = await supabase.from(table).select(joinSelect).eq('id', participantId).maybeSingle();
      if (error || !data) { setPollCount(p => p + 1); return; }
      const nameObj = type === 'trilha' ? data.trilhas : data.cursos;
      const name = Array.isArray(nameObj) ? (nameObj as any[])[0]?.nome : (nameObj as any)?.nome;
      if (name) setCourseName(name);
      const activeStatuses = type === 'trilha' ? ['pago', 'andamento', 'concluido'] : ['inscrito', 'andamento', 'concluido'];
      if (activeStatuses.includes(data.status)) {
        setStatus('confirmed');
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setPollCount(p => p + 1);
      }
    } catch (err) {
      console.error('[PaymentSuccess] Polling error:', err);
      setPollCount(p => p + 1);
    }
  };

  useEffect(() => {
    checkStatus();
    intervalRef.current = setInterval(checkStatus, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [participantId]);

  const goToCourses = () => { window.location.href = window.location.origin; };

  if (status === 'confirmed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-6">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute w-3 h-3 rounded-full animate-bounce"
              style={{
                left: `${5 + (i * 4.75)}%`, top: `${10 + (i % 5) * 15}%`,
                backgroundColor: ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6'][i % 6],
                animationDelay: `${(i * 0.1) % 1}s`, animationDuration: `${1.5 + (i % 3) * 0.3}s`, opacity: 0.65,
              }}
            />
          ))}
        </div>
        <div className="relative bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center border border-emerald-100">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50">
            <CheckCircle className="w-14 h-14 text-emerald-500" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-black uppercase tracking-widest text-amber-500">Pagamento Confirmado!</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3 leading-tight">Acesso Liberado! 🎉</h1>
          {courseName && (
            <p className="text-slate-500 text-base mb-8">
              Você agora tem acesso completo a<br />
              <strong className="text-slate-800 text-lg">{courseName}</strong>
            </p>
          )}
          <button onClick={goToCourses}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-lg shadow-indigo-500/30 active:scale-95">
            <BookOpen className="w-5 h-5" />
            Acessar Meu Curso Agora
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-slate-400 mt-6">Um e-mail de boas-vindas foi enviado para você.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">Verificação em andamento</h1>
          <p className="text-slate-500 mb-8">Não conseguimos verificar seu pagamento agora. Se já pagou, seu acesso será liberado em breve.</p>
          <button onClick={goToCourses} className="w-full px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold">Ir para Meus Cursos</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center border border-slate-100">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
            {isPending ? (
              <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
                <path d="M8 16L14 10L20 16L14 22L8 16Z" fill="#32BCAD"/>
                <path d="M16 8L22 14L28 8L22 2L16 8Z" fill="#32BCAD" opacity="0.6"/>
                <path d="M16 24L22 18L28 24L22 30L16 24Z" fill="#32BCAD" opacity="0.6"/>
                <path d="M4 8L10 14L16 8L10 2L4 8Z" fill="#32BCAD" opacity="0.3"/>
                <path d="M4 24L10 18L16 24L10 30L4 24Z" fill="#32BCAD" opacity="0.3"/>
              </svg>
            ) : (
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-3">
          {isPending ? 'Aguardando confirmação do PIX' : 'Processando seu pagamento…'}
        </h1>
        <p className="text-slate-500 mb-6 leading-relaxed">
          {isPending
            ? 'Após realizar o pagamento via PIX, a confirmação pode levar alguns segundos. Fique nesta tela — avisaremos automaticamente quando seu acesso for liberado!'
            : 'Estamos aguardando a confirmação do seu pagamento. Isso pode levar alguns segundos.'}
        </p>
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        {courseName && (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-left">
            <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium">Produto adquirido</p>
              <p className="text-sm font-bold text-slate-800">{courseName}</p>
            </div>
          </div>
        )}
        {isPending && (
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3 text-left">
            <Mail className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Se fechar essa janela, não se preocupe! Quando seu pagamento for confirmado, você receberá um e-mail com o acesso ao curso.
            </p>
          </div>
        )}
        <p className="text-xs text-slate-300 mt-6">Verificação #{pollCount + 1} em andamento…</p>
      </div>
    </div>
  );
}
