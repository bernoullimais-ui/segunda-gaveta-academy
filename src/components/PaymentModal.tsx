import React, { useState, useMemo } from 'react';
import { CreditCard, Loader2, ShieldCheck, ExternalLink, CheckCircle } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    description: string;
    amount: number; // Em reais (ex: 99.90)
    type: 'curso' | 'modulo' | 'trilha';
    paymentModel?: string;
    paymentCycle?: string;
    paymentInstallmentsLimit?: string;
  };
  customer: {
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  participantId: string;
  organizacaoId?: string;
  planId?: string;
}

// Installment options: show only options where total is above R$ 5
const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// CPF validation (client-side)
function validateCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  return rem === Number(cpf[10]);
}

export function PaymentModal({ isOpen, onClose, item, customer, participantId, organizacaoId, planId }: PaymentModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cpf, setCpf] = useState(customer.cpf || '');
  const [phone, setPhone] = useState(customer.phone || '');

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto'>('pix');
  const [card, setCard] = useState({ number: '', holder_name: '', exp_month: '', exp_year: '', cvv: '' });
  // M1: installment state
  const [installments, setInstallments] = useState(1);

  // Coupon States
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(0);

  React.useEffect(() => {
    if (isOpen) {
      const trackCheckout = async () => {
        try {
          const visitorId = localStorage.getItem('sg_visitor_id');
          await fetch('/api/traffic/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizacao_id: organizacaoId || '00000000-0000-0000-0000-000000000000',
              curso_id: item.type === 'curso' ? item.id : null,
              trilha_id: item.type === 'trilha' ? item.id : null,
              event_type: 'checkout_initiated',
              utm_source: sessionStorage.getItem('utm_source') || null,
              utm_medium: sessionStorage.getItem('utm_medium') || null,
              utm_campaign: sessionStorage.getItem('utm_campaign') || null,
              visitor_id: visitorId,
              affiliate_id: sessionStorage.getItem('affiliate_ref_id') || null
            })
          });
        } catch (err) {
          console.error('Error tracking checkout initiated:', err);
        }
      };
      trackCheckout();
    }
  }, [isOpen, item.id, item.type, organizacaoId]);

  if (!isOpen) return null;

  const finalAmount = Math.max(0, item.amount - discountApplied);

  // M1: calculate installment value
  const installmentValue = useMemo(
    () => (installments > 1 ? finalAmount / installments : finalAmount),
    [finalAmount, installments]
  );

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: couponInput.trim().toUpperCase(),
          email: customer.email,
          item_id: item.id,
          item_type: item.type,
          org_id: organizacaoId || '00000000-0000-0000-0000-000000000000'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.valid) {
        throw new Error(data.message || 'Cupom inválido ou expirado.');
      }
      setDiscountApplied(data.discount);
      setAppliedCouponCode(data.coupon.codigo);
      setIsCouponApplied(true);
      setCouponError(null);
      setInstallments(1); // Reset installments when coupon is applied
    } catch (err: any) {
      setCouponError(err.message || 'Erro ao validar cupom.');
      setDiscountApplied(0);
      setAppliedCouponCode('');
      setIsCouponApplied(false);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setDiscountApplied(0);
    setAppliedCouponCode('');
    setIsCouponApplied(false);
    setCouponError(null);
  };

  const handlePayment = async () => {
    // M9: Client-side CPF validation
    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits.length !== 11 || !validateCPF(cpf)) {
      setError('Por favor, informe um CPF válido.');
      return;
    }

    if (paymentMethod === 'credit_card' && phone.replace(/\D/g, '').length < 10) {
      setError('Por favor, informe um telefone válido para pagamento com cartão.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const commonMetadata = {
      type: item.type,
      id: item.id,
      participant_id: participantId,
      success_url: `${window.location.origin}/pagamento-sucesso?id=${participantId}&type=${item.type}`,
      utm_source: sessionStorage.getItem('utm_source') || null,
      utm_medium: sessionStorage.getItem('utm_medium') || null,
      utm_campaign: sessionStorage.getItem('utm_campaign') || null,
      affiliate_id: sessionStorage.getItem('affiliate_ref_id') || null
    };

    try {
      if (paymentMethod === 'credit_card') {
        // Tokenizar cartão
        const tokenRes = await fetch('/api/pagarme/tokenize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card: {
              number: card.number.replace(/\s/g, ''),
              holder_name: card.holder_name,
              exp_month: card.exp_month,
              exp_year: card.exp_year.length === 2 ? `20${card.exp_year}` : card.exp_year,
              cvv: card.cvv
            }
          })
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.message || 'Erro ao tokenizar cartão');

        const isSubscriptionMode = planId || item.paymentModel === 'recorrente' || item.paymentModel === 'parcelado';

        // M6: Subscription logic
        if (isSubscriptionMode) {
          const orderRes = await fetch('/api/pagarme/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_id: planId,
              custom_subscription: !planId ? {
                 amount: Math.round(item.amount * 100),
                 description: item.description,
                 cycle: item.paymentCycle,
                 installments: item.paymentModel === 'parcelado' ? item.paymentInstallmentsLimit : undefined
              } : undefined,
              payment_method: 'credit_card',
              card_token: tokenData.id,
              customer: {
                name: customer.name,
                email: customer.email,
                cpf: cpfDigits,
                phone: phone.replace(/\D/g, '')
              },
              metadata: commonMetadata
            })
          });
          const orderData = await orderRes.json();
          if (!orderRes.ok) throw new Error(orderData.message || 'Erro ao criar assinatura');
          window.location.href = `${window.location.origin}/pagamento-sucesso?id=${participantId}`;
        } else {
          // M1: Criar pedido normal com parcelamento
          const orderRes = await fetch('/api/pagarme/create-cc-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: Math.round(item.amount * 100),
              customer: {
                name: customer.name,
                email: customer.email,
                cpf: cpfDigits,
                phone: phone.replace(/\D/g, '')
              },
              items: [{ amount: Math.round(item.amount * 100), description: item.description, code: item.id }],
              metadata: commonMetadata,
              card_token: tokenData.id,
              installments,
              coupon_code: appliedCouponCode || undefined
            })
          });
          const orderData = await orderRes.json();
          if (!orderRes.ok) throw new Error(orderData.message || 'Erro ao criar pedido');
          window.location.href = `${window.location.origin}/pagamento-sucesso?id=${participantId}`;
        }
      } else {
        // PIX ou Boleto
        const isSubscriptionMode = planId || item.paymentModel === 'recorrente' || item.paymentModel === 'parcelado';
        
        if (isSubscriptionMode) {
          const response = await fetch('/api/pagarme/create-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan_id: planId,
              custom_subscription: !planId ? {
                 amount: Math.round(item.amount * 100),
                 description: item.description,
                 cycle: item.paymentCycle,
                 installments: item.paymentModel === 'parcelado' ? item.paymentInstallmentsLimit : undefined
              } : undefined,
              payment_method: paymentMethod,
              customer: {
                name: customer.name,
                email: customer.email,
                ...(phone.replace(/\D/g, '').length >= 10 && { phone: phone.replace(/\D/g, '') }),
                cpf: cpfDigits
              },
              metadata: commonMetadata
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Erro ao processar assinatura');
          window.location.href = `${window.location.origin}/pagamento-sucesso?id=${participantId}&type=${item.type}&sub_status=pending`;
        } else {
          const response = await fetch('/api/pagarme/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: Math.round(item.amount * 100),
              customer: {
                name: customer.name,
                email: customer.email,
                ...(phone.replace(/\D/g, '').length >= 10 && { phone: phone.replace(/\D/g, '') }),
                cpf: cpfDigits
              },
              items: [{ amount: Math.round(item.amount * 100), description: item.description, code: item.id }],
              metadata: commonMetadata,
              coupon_code: appliedCouponCode || undefined
            })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Erro ao processar pagamento');
          window.location.href = data.checkout_url;
        }
      }
    } catch (err: any) {
      console.error('Payment Error:', err);
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCPF = (val: string) => {
    const numbers = val.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').substring(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
    if (digits.length <= 10) return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  };

  const cpfIsValid = validateCPF(cpf);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-600" />
            Pagamento da Inscrição
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Price display */}
          <div className="text-center">
            <p className="text-slate-500 text-sm mb-1">Valor da Inscrição</p>
            {discountApplied > 0 ? (
              <div className="space-y-1">
                <h4 className="text-4xl font-black text-slate-900">{formatBRL(finalAmount)}</h4>
                <div className="text-xs font-bold text-slate-400 line-through">{formatBRL(item.amount)}</div>
                <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Desconto: -{formatBRL(discountApplied)}
                </div>
              </div>
            ) : (
              <h4 className="text-4xl font-black text-slate-900">{formatBRL(item.amount)}</h4>
            )}
          </div>

          {/* Item summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Item:</span>
              <span className="text-slate-900 font-bold text-right max-w-[200px]">{item.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Participante:</span>
              <span className="text-slate-900 font-bold">{customer.name}</span>
            </div>
          </div>

          {/* Payment method selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-2">
              {(['pix', 'credit_card', 'boleto'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => { setPaymentMethod(method); setInstallments(1); }}
                  className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    paymentMethod === method
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {method === 'pix' ? '⚡ PIX' : method === 'credit_card' ? '💳 Cartão' : '📄 Boleto'}
                </button>
              ))}
            </div>
            {paymentMethod === 'boleto' && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-2">
                ⚠️ O boleto vence em <strong>3 dias úteis</strong>. Seu acesso será liberado após a confirmação do pagamento.
              </p>
            )}
          </div>

          {/* Coupon Code */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Cupom de Desconto</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Digite seu cupom"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                disabled={isValidatingCoupon || isCouponApplied}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold uppercase tracking-wider focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
              />
              {isCouponApplied ? (
                <button type="button" onClick={handleRemoveCoupon}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all">
                  Remover
                </button>
              ) : (
                <button type="button" onClick={handleApplyCoupon}
                  disabled={isValidatingCoupon || !couponInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50">
                  {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                </button>
              )}
            </div>
            {couponError && <p className="text-xs text-red-500 font-semibold">{couponError}</p>}
            {isCouponApplied && (
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Cupom "{appliedCouponCode}" aplicado!
              </p>
            )}
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              CPF do Pagador *
              {cpf.replace(/\D/g, '').length === 11 && (
                <span className={`ml-2 text-xs font-semibold ${cpfIsValid ? 'text-green-600' : 'text-red-500'}`}>
                  {cpfIsValid ? '✓ válido' : '✗ inválido'}
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="000.000.000-00"
              className={`w-full p-3 bg-white border-2 rounded-xl outline-none transition-colors ${
                cpf.replace(/\D/g, '').length === 11
                  ? cpfIsValid ? 'border-green-400 focus:border-green-500' : 'border-red-400 focus:border-red-500'
                  : 'border-slate-200 focus:border-indigo-500'
              }`}
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              maxLength={14}
            />
          </div>

          {/* Phone (required for credit card) */}
          {paymentMethod === 'credit_card' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Telefone *</label>
              <input
                type="tel"
                placeholder="(11) 99999-9999"
                className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                maxLength={15}
              />
            </div>
          )}

          {/* Credit card fields */}
          {paymentMethod === 'credit_card' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Dados do Cartão</label>
              <input
                placeholder="Número do Cartão"
                className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                onChange={e => setCard({ ...card, number: e.target.value })}
              />
              <input
                placeholder="Nome no Cartão"
                className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                onChange={e => setCard({ ...card, holder_name: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  placeholder="MM"
                  maxLength={2}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  onChange={e => setCard({ ...card, exp_month: e.target.value })}
                />
                <input
                  placeholder="AA"
                  maxLength={4}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  onChange={e => setCard({ ...card, exp_year: e.target.value })}
                />
                <input
                  placeholder="CVV"
                  maxLength={4}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  onChange={e => setCard({ ...card, cvv: e.target.value })}
                />
              </div>

              {/* M1: Installment selector */}
              {finalAmount >= 10 && item.paymentModel !== 'recorrente' && item.paymentModel !== 'parcelado' && !planId && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Parcelamento</label>
                  <select
                    value={installments}
                    onChange={e => setInstallments(Number(e.target.value))}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {INSTALLMENT_OPTIONS
                      .filter(n => n === 1 || (finalAmount / n) >= 5)
                      .map(n => (
                        <option key={n} value={n}>
                          {n}x de {formatBRL(finalAmount / n)}{n === 1 ? ' (à vista)' : ' sem juros*'}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">* Parcelamento sem juros condicionado à aprovação.</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs overflow-auto max-h-28">
              <p className="font-bold mb-1">Não foi possível processar o pagamento:</p>
              {error}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-[0.98]"
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <ExternalLink className="w-5 h-5" />
                {paymentMethod === 'credit_card'
                  ? `Pagar ${installments > 1 ? `${installments}x de ${formatBRL(installmentValue)}` : formatBRL(finalAmount)}`
                  : paymentMethod === 'boleto'
                    ? `Gerar Boleto de ${formatBRL(finalAmount)}`
                    : `Pagar via PIX — ${formatBRL(finalAmount)}`
                }
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Ambiente de pagamento seguro via Pagar.me
          </p>
        </div>
      </div>
    </div>
  );
}
