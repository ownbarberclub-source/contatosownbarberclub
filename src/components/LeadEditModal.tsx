import React, { useState, useEffect } from 'react';
import { X, User, Phone, Scissors, ShieldAlert, BadgeCheck, FileText, CalendarDays, CreditCard, Settings } from 'lucide-react';
import { ReferralRecord, ContactPerson, Barber, Seller, Plan } from '../types';
import { detectIdentifierType } from '../utils';

interface LeadEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedContact: ContactPerson, newBarberId: string) => Promise<void>;
  contact: ContactPerson | null;
  clientName: string;
  clientCpf: string;
  currentBarberId: string;
  barbers: Barber[];
  sellers: Seller[];
  plans: Plan[];
  isReadOnly: boolean;
  records: ReferralRecord[];
  campaignId?: string;
}

export function LeadEditModal({
  isOpen,
  onClose,
  onSave,
  contact,
  clientName,
  clientCpf,
  currentBarberId,
  barbers,
  sellers,
  plans,
  isReadOnly,
  records,
  campaignId,
}: LeadEditModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<any>('pending');
  const [fidelimaxStatus, setFidelimaxStatus] = useState<any>('pending');
  const [sellerId, setSellerId] = useState('');
  const [barberId, setBarberId] = useState('');
  const [planId, setPlanId] = useState('');
  const [notes, setNotes] = useState('');
  const [activationDate, setActivationDate] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phone);
      const initialStatus = contact.status || (contact.subscriptionClosed ? 'converted' : contact.called ? 'contacted' : 'pending');
      setStatus(initialStatus);
      setFidelimaxStatus(contact.fidelimaxStatus || (initialStatus === 'converted' ? 'pending' : 'not_applicable'));
      setSellerId(contact.sellerId || '');
      setBarberId(currentBarberId);
      setPlanId(contact.planId || '');
      setNotes(contact.notes || '');
      setActivationDate(contact.activationDate || '');
      setCardNumber(contact.cardNumber || '');
    }
  }, [contact, currentBarberId, isOpen]);

  if (!isOpen || !contact) return null;

  const handleStatusChange = (newStatus: any) => {
    setStatus(newStatus);
    if (newStatus === 'converted') {
      if (!activationDate) {
        setActivationDate(new Date().toISOString().split('T')[0]);
      }
      if (fidelimaxStatus === 'not_applicable') {
        setFidelimaxStatus('pending');
      }
    } else {
      setActivationDate('');
      setCardNumber('');
      setPlanId('');
      setFidelimaxStatus('not_applicable');
    }
  };

  const handlePhoneChange = (val: string) => {
    // Formatação de telefone rápida: (XX) XXXXX-XXXX
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 11) cleaned = cleaned.slice(0, 11);
    
    let formatted = cleaned;
    if (cleaned.length > 2) {
      formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    }
    if (cleaned.length > 7) {
      formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nome do lead é obrigatório.');
      return;
    }
    const hasSelectedBarber = barberId && barberId !== 'none';
    if (!hasSelectedBarber && !sellerId) {
      alert('Selecione o barbeiro responsável ou um vendedor atribuído.');
      return;
    }

    setSaving(true);
    try {
      const isConverted = status === 'converted';
      const isCalled = status !== 'pending';

      const cleanedNewPhone = phone.replace(/\D/g, '');
      const otherRecords = records;
      const sameCampaignRecords = otherRecords.filter(r => r.campaign_id === campaignId);

      const isDuplicate = sameCampaignRecords.some(r =>
        r.contacts?.some(c => c.id !== contact?.id && c.phone.replace(/\D/g, '') === cleanedNewPhone)
      );

      if (isDuplicate) {
        alert('Este número de telefone já está cadastrado como lead nesta campanha.');
        setSaving(false);
        return;
      }

      const updatedContact: ContactPerson = {
        ...contact,
        name: name.trim(),
        phone: phone.trim(),
        status,
        fidelimaxStatus: isConverted ? fidelimaxStatus : 'not_applicable',
        sellerId: sellerId || undefined,
        planId: isConverted ? (planId || undefined) : undefined,
        notes: notes.trim() || undefined,
        subscriptionClosed: isConverted,
        called: isCalled,
        calledAt: isCalled ? (contact.calledAt || new Date().toISOString()) : undefined,
        activationDate: isConverted ? (activationDate || new Date().toISOString().split('T')[0]) : undefined,
        cardNumber: isConverted ? (cardNumber.trim() || undefined) : undefined
      };

      await onSave(updatedContact, barberId);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as informações do lead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
              <User className="w-5 h-5 text-brand" />
              Editar Informações do Lead
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Configure todos os detalhes do lead e do atendimento comercial</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-2 hover:bg-zinc-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form id="lead-edit-form" onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          
          {/* Card Indicador (Quem Indicou) */}
          <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono block">Quem Indicou</span>
              <span className="text-sm font-semibold text-zinc-200 block">{clientName}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono block">
                {detectIdentifierType(clientCpf) === 'cpf' ? 'CPF do Indicador' : 'Celular do Indicador'}
              </span>
              <span className="text-xs text-zinc-400 font-mono block">{clientCpf}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Nome do Lead */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Nome do Lead</label>
              <div className="relative">
                <input
                  disabled={isReadOnly}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand disabled:opacity-50"
                  placeholder="Nome do Lead"
                />
                <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            {/* Telefone do Lead */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Telefone</label>
              <div className="relative">
                <input
                  disabled={isReadOnly}
                  type="text"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand disabled:opacity-50 font-mono"
                  placeholder="(00) 00000-0000"
                />
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            {/* Barbeiro Responsável */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Barbeiro Indicado</label>
              <div className="relative">
                <select
                  disabled={isReadOnly}
                  value={barberId}
                  onChange={(e) => setBarberId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer disabled:opacity-50"
                >
                  <option value="none">Sem Barbeiro (Venda Direta)</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <Scissors className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            {/* Vendedor Responsável */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Vendedor Atribuído</label>
              <div className="relative">
                <select
                  disabled={isReadOnly}
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer disabled:opacity-50"
                >
                  <option value="">Sem Vendedor</option>
                  {sellers.filter(s => s.is_active || s.id === sellerId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <User className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            {/* Status ROI */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-400">Status Atendimento (ROI)</label>
              <div className="relative">
                <select
                  disabled={isReadOnly}
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer disabled:opacity-50"
                >
                  <option value="pending">Pendente</option>
                  <option value="contacted">Contatado</option>
                  <option value="no_response">Não Respondeu</option>
                  <option value="declined">Recusou</option>
                  <option value="invalid_number">Número não existe</option>
                  <option value="frequent">Frequente</option>
                  <option value="scheduled">Agendou 📅</option>
                  <option value="converted">Assinou ✅</option>
                </select>
                <BadgeCheck className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            {/* Status Fidelimax */}
            {(status === 'converted') && (
              <div className="space-y-1.5 animate-in slide-in-from-top-4 duration-200">
                <label className="block text-xs font-semibold text-zinc-400">Status Fidelimax</label>
                <div className="relative">
                  <select
                    disabled={isReadOnly}
                    value={fidelimaxStatus}
                    onChange={(e) => setFidelimaxStatus(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer disabled:opacity-50"
                  >
                    <option value="pending">Pendente</option>
                    <option value="launched">Lançado ✅</option>
                    <option value="not_applicable">Não se aplica 🚫</option>
                  </select>
                  <ShieldAlert className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                </div>
              </div>
            )}

          </div>

          {/* Dados de Assinatura (Condicional para Converted) */}
          {(status === 'converted') && (
            <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-4 duration-200">
              
              {/* Plano Contratado */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Plano Contratado</label>
                <div className="relative">
                  <select
                    disabled={isReadOnly}
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:outline-none focus:border-brand cursor-pointer disabled:opacity-50"
                  >
                    <option value="">Selecione Plano...</option>
                    {plans.filter(p => p.is_active || p.id === planId).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Settings className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                </div>
              </div>

              {/* Data Ativação */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Data de Ativação</label>
                <div className="relative">
                  <input
                    disabled={isReadOnly}
                    type="date"
                    value={activationDate}
                    onChange={(e) => setActivationDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand disabled:opacity-50 font-mono [&::-webkit-calendar-picker-indicator]:invert"
                  />
                  <CalendarDays className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                </div>
              </div>

              {/* Número do Cartão */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-400">Número do Cartão</label>
                <div className="relative">
                  <input
                    disabled={isReadOnly}
                    type="text"
                    placeholder="Ex: 1234"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-brand disabled:opacity-50 font-mono placeholder-zinc-700"
                  />
                  <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                </div>
              </div>

            </div>
          )}

          {/* Observações / Anotações */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-400">Anotações / Observações do Atendimento</label>
            <div className="relative">
              <textarea
                disabled={isReadOnly}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Insira anotações sobre o lead (ex: melhor horário para ligar, serviços preferidos, feedbacks...)"
                className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-brand disabled:opacity-50"
              />
              <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!isReadOnly && (
            <button
              type="submit"
              form="lead-edit-form"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-all shadow-lg shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
