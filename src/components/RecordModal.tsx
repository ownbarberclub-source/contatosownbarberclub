import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { ReferralRecord, ContactPerson, Barber } from '../types';
import { formatCPF, formatPhone, cleanCPF, cleanPhone } from '../utils';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<ReferralRecord, 'id' | 'createdAt'>) => void;
  /** Chamado imediatamente ao clicar "Incluir" quando há registro existente sendo editado */
  onAddContact?: (recordId: string, contact: ContactPerson) => Promise<void>;
  initialData?: ReferralRecord | null;
  isReadOnly?: boolean;
  records: ReferralRecord[];
  barbers: Barber[];
  preFilledClient?: { cpf: string; name: string } | null;
  activeCampaignId?: string;
}

export function RecordModal({ isOpen, onClose, onSave, onAddContact, initialData, isReadOnly = false, records, barbers, preFilledClient, activeCampaignId }: RecordModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [barberId, setBarberId] = useState('');
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // ─── Efeito de inicialização do formulário ───────────────────────────────
  // IMPORTANTE: `barbers` foi removido das dependências propositalmente.
  // Quando o realtime atualiza `barbers`, a referência do array muda e
  // dispararia este efeito, resetando os contatos que o usuário ainda não salvou.
  // O barberId legado (por nome) é tratado em um efeito separado abaixo.
  useEffect(() => {
    setPhoneError('');
    if (initialData) {
      setClientName(initialData.clientName);
      setClientCpf(initialData.clientCpf);
      setBarberId(initialData.barberId || '');
      setContacts(initialData.contacts || []);
    } else if (preFilledClient) {
      setClientCpf(preFilledClient.cpf);
      setClientName(preFilledClient.name);
      setBarberId('');
      setContacts([]);
      setNewContactName('');
      setNewContactPhone('');
    } else {
      setClientName('');
      setClientCpf('');
      setBarberId('');
      setContacts([]);
      setNewContactName('');
      setNewContactPhone('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.id, preFilledClient?.cpf, isOpen]);

  // Lookup de barberId por nome para registros antigos (sem barberId salvo)
  const barberLookupDone = useRef(false);
  useEffect(() => {
    if (initialData && !initialData.barberId && initialData.barberName && !barberLookupDone.current) {
      const found = barbers.find(b => b.name === initialData.barberName);
      if (found) setBarberId(found.id);
      barberLookupDone.current = true;
    }
    if (!initialData) barberLookupDone.current = false;
  }, [initialData?.id, barbers]);

  // Auto-fill when typing CPF
  useEffect(() => {
    if (!initialData && !preFilledClient && clientCpf) {
      const cleanInput = cleanCPF(clientCpf);
      if (cleanInput.length === 11) {
        const existing = records.find(r => cleanCPF(r.clientCpf) === cleanInput);
        if (existing) {
          setClientName(existing.clientName);
        }
      }
    }
  }, [clientCpf, initialData, preFilledClient, records]);

  if (!isOpen) return null;

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    const cleanedNewPhone = cleanPhone(newContactPhone);

    // Check current session contacts
    const isDuplicateInCurrent = contacts.some(c => cleanPhone(c.phone) === cleanedNewPhone);

    // Check global records (excluding the current record being edited)
    const otherRecords = initialData ? records.filter(r => r.id !== initialData.id) : records;
    
    // Filtra para verificar duplicados apenas dentro da mesma campanha
    const currentCampaignId = initialData?.campaign_id || activeCampaignId;
    const sameCampaignRecords = otherRecords.filter(r => r.campaign_id === currentCampaignId);
    
    const isDuplicateInGlobal = sameCampaignRecords.some(r =>
      r.contacts?.some(c => cleanPhone(c.phone) === cleanedNewPhone)
    );

    if (isDuplicateInCurrent || isDuplicateInGlobal) {
      setPhoneError('Este número de telefone já está cadastrado como lead nesta campanha.');
      return;
    }

    setPhoneError('');
    const newContact: ContactPerson = {
      id: crypto.randomUUID(),
      name: newContactName.trim(),
      phone: newContactPhone.trim(),
      subscriptionClosed: false,
      called: false,
    };

    // ── Save-imediato: se estiver editando um registro existente, salva no banco agora ──
    // Isso garante que o contato não seja perdido se o realtime recarregar antes do "Salvar Registro"
    if (initialData?.id && onAddContact) {
      setSavingContact(true);
      try {
        await onAddContact(initialData.id, newContact);
      } catch (err) {
        console.error('Erro ao salvar contato imediatamente:', err);
        setPhoneError('Falha ao salvar contato. Tente novamente.');
        setSavingContact(false);
        return;
      }
      setSavingContact(false);
    }

    setContacts(prev => [...prev, newContact]);
    setNewContactName('');
    setNewContactPhone('');
  };

  const handleRemoveContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const toggleContactField = (id: string, field: 'subscriptionClosed' | 'called') => {
    setContacts(contacts.map(c => {
      if (c.id === id) {
        const newValue = !c[field];
        const updates: Partial<ContactPerson> = { [field]: newValue };
        if (field === 'called') {
          updates.calledAt = newValue ? new Date().toISOString() : undefined;
        }
        if (field === 'subscriptionClosed') {
          if (newValue) {
            updates.status = 'converted';
          } else {
            updates.status = 'pending';
            updates.activationDate = undefined;
            updates.cardNumber = undefined;
          }
        }
        return { ...c, ...updates };
      }
      return c;
    }));
  };

  const updateContactField = (id: string, field: 'activationDate' | 'cardNumber', value: string) => {
    setContacts(contacts.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddContact();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barberId) {
      alert("Por favor, selecione um barbeiro para continuar.");
      return;
    }
    
    const selectedBarber = barbers.find(b => b.id === barberId);
    
    onSave({
      clientName,
      clientCpf,
      barberId: selectedBarber?.id || '',
      barberName: selectedBarber?.name || '',
      contacts,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">
            {initialData ? (isReadOnly ? 'Visualizar Registro' : 'Editar Registro') : 'Novo Registro'}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="record-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Nome do Cliente
              </label>
              <input
                disabled={isReadOnly}
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                CPF do Cliente
              </label>
              <input
                disabled={isReadOnly}
                type="text"
                required
                value={clientCpf}
                onChange={(e) => setClientCpf(formatCPF(e.target.value))}
                maxLength={14}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Barbeiro Solicitante
              </label>
              <select
                disabled={isReadOnly}
                required
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Selecione um barbeiro...</option>
                {barbers.map(barber => (
                  <option key={barber.id} value={barber.id}>{barber.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-300">
                Contatos Indicados
              </label>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nome do contato"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                  <input
                    type="text"
                    value={newContactPhone}
                    onChange={(e) => {
                      setNewContactPhone(formatPhone(e.target.value));
                      if (phoneError) setPhoneError('');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    className="w-36 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddContact}
                    disabled={!newContactName.trim() || !newContactPhone.trim() || savingContact}
                    className="px-3 py-2 bg-zinc-800 text-zinc-100 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {savingContact ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    <span className="hidden sm:inline">{savingContact ? 'Salvando...' : 'Incluir'}</span>
                  </button>
                </div>
              )}
              {phoneError && (
                <p className="text-sm text-red-400 mt-1.5">{phoneError}</p>
              )}

              {contacts.length > 0 && (
                <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 space-y-2 max-h-40 overflow-y-auto">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex flex-col bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-200">{contact.name}</span>
                          <span className="text-xs text-zinc-500">{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              disabled={isReadOnly}
                              type="checkbox"
                              checked={!!contact.called}
                              onChange={() => toggleContactField(contact.id, 'called')}
                              className="w-4 h-4 rounded border-zinc-700 text-blue-500 focus:ring-blue-500/50 bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-xs text-zinc-400">Chamou?</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              disabled={isReadOnly}
                              type="checkbox"
                              checked={!!contact.subscriptionClosed}
                              onChange={() => toggleContactField(contact.id, 'subscriptionClosed')}
                              className="w-4 h-4 rounded border-zinc-700 text-red-600 focus:ring-red-600/50 bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <span className="text-xs text-zinc-400">Assinou?</span>
                          </label>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(contact.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 transition-colors ml-1 cursor-pointer"
                              title="Remover contato"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {contact.subscriptionClosed && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-3 mt-1.5 border-t border-zinc-800/50 bg-zinc-950/30 p-2.5 rounded-lg border border-zinc-800/40">
                          <div className="flex-1">
                            <label className="block text-[9px] uppercase font-semibold tracking-wider text-zinc-500 mb-1 font-mono">Data Ativação</label>
                            <input
                              disabled={isReadOnly}
                              type="date"
                              value={contact.activationDate || ''}
                              onChange={(e) => updateContactField(contact.id, 'activationDate', e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand/30 focus:border-brand font-mono [&::-webkit-calendar-picker-indicator]:invert"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[9px] uppercase font-semibold tracking-wider text-zinc-500 mb-1 font-mono">Número do Cartão</label>
                            <input
                              disabled={isReadOnly}
                              type="text"
                              placeholder="Ex: 1234"
                              value={contact.cardNumber || ''}
                              onChange={(e) => updateContactField(contact.id, 'cardNumber', e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-brand/30 focus:border-brand font-mono placeholder-zinc-700"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            {isReadOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!isReadOnly && (
            <button
              type="submit"
              form="record-form"
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
            >
              Salvar Registro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
