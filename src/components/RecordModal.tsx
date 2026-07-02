import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { ReferralRecord, ContactPerson, Barber, Seller } from '../types';
import { formatCPF, formatPhone, cleanCPF, cleanPhone, detectIdentifierType } from '../utils';

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
  sellers: Seller[];
}

export function RecordModal({ isOpen, onClose, onSave, onAddContact, initialData, isReadOnly = false, records, barbers, preFilledClient, activeCampaignId, sellers }: RecordModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [identifierType, setIdentifierType] = useState<'cpf' | 'phone'>('cpf');
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
      setIdentifierType(detectIdentifierType(initialData.clientCpf));
      setBarberId(initialData.barberId || '');
      setContacts(initialData.contacts || []);
    } else if (preFilledClient) {
      setClientCpf(preFilledClient.cpf);
      setClientName(preFilledClient.name);
      setIdentifierType(detectIdentifierType(preFilledClient.cpf));
      setBarberId('');
      setContacts([]);
      setNewContactName('');
      setNewContactPhone('');
    } else {
      setClientName('');
      setClientCpf('');
      setIdentifierType('cpf');
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

  // Auto-fill when typing CPF or Phone
  useEffect(() => {
    if (!initialData && !preFilledClient && clientCpf) {
      const cleanInput = cleanCPF(clientCpf);
      if (cleanInput.length >= 10 && cleanInput.length <= 11) {
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
      status: 'pending',
      fidelimaxStatus: 'not_applicable',
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

  const handleStatusChange = (id: string, newStatus: any) => {
    setContacts(contacts.map(c => {
      if (c.id === id) {
        const isConverted = newStatus === 'converted';
        const isCalled = newStatus !== 'pending';
        const updates: Partial<ContactPerson> = {
          status: newStatus,
          subscriptionClosed: isConverted,
          called: isCalled
        };
        
        if (isCalled && !c.called) {
          updates.calledAt = new Date().toISOString();
        } else if (!isCalled) {
          updates.calledAt = undefined;
        }
        
        if (isConverted) {
          if (!c.activationDate) {
            updates.activationDate = new Date().toISOString().split('T')[0];
          }
          if (c.fidelimaxStatus === 'not_applicable' || !c.fidelimaxStatus) {
            updates.fidelimaxStatus = 'pending';
          }
        } else {
          updates.activationDate = undefined;
          updates.cardNumber = undefined;
          updates.fidelimaxStatus = 'not_applicable';
        }
        return { ...c, ...updates };
      }
      return c;
    }));
  };

  const updateContactField = (id: string, field: keyof ContactPerson, value: any) => {
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
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-zinc-300">
                  Documento / Contato do Cliente
                </label>
                <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      setIdentifierType('cpf');
                      setClientCpf(formatCPF(clientCpf));
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      identifierType === 'cpf'
                        ? 'bg-zinc-800 text-zinc-100 shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    CPF
                  </button>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => {
                      setIdentifierType('phone');
                      setClientCpf(formatPhone(clientCpf));
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      identifierType === 'phone'
                        ? 'bg-zinc-800 text-zinc-100 shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Celular
                  </button>
                </div>
              </div>
              <input
                disabled={isReadOnly}
                type="text"
                required
                value={clientCpf}
                onChange={(e) => {
                  const val = e.target.value;
                  if (identifierType === 'cpf') {
                    setClientCpf(formatCPF(val));
                  } else {
                    setClientCpf(formatPhone(val));
                  }
                }}
                maxLength={identifierType === 'cpf' ? 14 : 15}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={identifierType === 'cpf' ? "000.000.000-00" : "(00) 00000-0000"}
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
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Status ROI select */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider font-mono">Status ROI:</span>
                            <select
                              disabled={isReadOnly}
                              value={contact.status || (contact.subscriptionClosed ? 'converted' : contact.called ? 'contacted' : 'pending')}
                              onChange={(e) => handleStatusChange(contact.id, e.target.value as any)}
                              className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-brand cursor-pointer"
                            >
                              <option value="pending">Pendente</option>
                              <option value="contacted">Contatado</option>
                              <option value="no_response">Não Respondeu</option>
                              <option value="declined">Recusou</option>
                              <option value="invalid_number">Número Não Existe</option>
                              <option value="frequent">Frequente</option>
                              <option value="scheduled">Agendou 📅</option>
                              <option value="converted">Assinou ✅</option>
                            </select>
                          </div>

                          {/* Fidelimax select */}
                          {(contact.status === 'converted' || contact.subscriptionClosed) && (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider font-mono">Fidelimax:</span>
                              <select
                                disabled={isReadOnly}
                                value={contact.fidelimaxStatus || 'pending'}
                                onChange={(e) => updateContactField(contact.id, 'fidelimaxStatus', e.target.value)}
                                className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-brand cursor-pointer"
                              >
                                <option value="pending">Pendente</option>
                                <option value="launched">Lançado ✅</option>
                                <option value="not_applicable">N/A 🚫</option>
                              </select>
                            </div>
                          )}

                          {/* Seller select */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider font-mono">Vendedor:</span>
                            <select
                              disabled={isReadOnly}
                              value={contact.sellerId || ''}
                              onChange={(e) => updateContactField(contact.id, 'sellerId', e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-300 focus:outline-none focus:border-brand cursor-pointer"
                            >
                              <option value="">Nenhum</option>
                              {sellers.filter(s => s.is_active).map(seller => (
                                <option key={seller.id} value={seller.id}>{seller.name}</option>
                              ))}
                            </select>
                          </div>

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

                      {/* Observações / Anotações */}
                      <div className="flex flex-col gap-1 pt-1.5 border-t border-zinc-800/40">
                        <label className="text-[9px] uppercase font-semibold tracking-wider text-zinc-500 font-mono">Anotações / Observações</label>
                        <input
                          disabled={isReadOnly}
                          type="text"
                          placeholder="Adicione observações sobre o atendimento deste lead..."
                          value={contact.notes || ''}
                          onChange={(e) => updateContactField(contact.id, 'notes', e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand"
                        />
                      </div>

                      {/* Se assinou, abre campos de data de ativação e número do cartão */}
                      {(contact.status === 'converted' || contact.subscriptionClosed) && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-2 mt-0.5 border-t border-zinc-800/40 bg-zinc-950/20 p-2 rounded-lg border border-zinc-800/40">
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
