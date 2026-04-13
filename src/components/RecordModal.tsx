import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { ReferralRecord, ContactPerson } from '../types';
import { formatCPF, formatPhone, cleanCPF, cleanPhone } from '../utils';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<ReferralRecord, 'id' | 'createdAt'>) => void;
  initialData?: ReferralRecord | null;
  records: ReferralRecord[];
  preFilledClient?: { cpf: string; name: string } | null;
}

export function RecordModal({ isOpen, onClose, onSave, initialData, records, preFilledClient }: RecordModalProps) {
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [barberName, setBarberName] = useState('');
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    setPhoneError('');
    if (initialData) {
      setClientName(initialData.clientName);
      setClientCpf(initialData.clientCpf);
      setBarberName(initialData.barberName);
      setContacts(initialData.contacts || []);
    } else if (preFilledClient) {
      setClientCpf(preFilledClient.cpf);
      setClientName(preFilledClient.name);
      setBarberName('');
      setContacts([]);
      setNewContactName('');
      setNewContactPhone('');
    } else {
      setClientName('');
      setClientCpf('');
      setBarberName('');
      setContacts([]);
      setNewContactName('');
      setNewContactPhone('');
    }
  }, [initialData, preFilledClient, isOpen]);

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

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;

    const cleanedNewPhone = cleanPhone(newContactPhone);

    // Check current session contacts
    const isDuplicateInCurrent = contacts.some(c => cleanPhone(c.phone) === cleanedNewPhone);

    // Check global records (excluding the current record being edited)
    const otherRecords = initialData ? records.filter(r => r.id !== initialData.id) : records;
    const isDuplicateInGlobal = otherRecords.some(r =>
      r.contacts?.some(c => cleanPhone(c.phone) === cleanedNewPhone)
    );

    if (isDuplicateInCurrent || isDuplicateInGlobal) {
      setPhoneError('Este número de telefone já está cadastrado como lead.');
      return;
    }

    setPhoneError('');
    setContacts([
      ...contacts,
      {
        id: crypto.randomUUID(),
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
        subscriptionClosed: false,
        called: false,
      },
    ]);
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
        return { ...c, ...updates };
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
    onSave({
      clientName,
      clientCpf,
      barberName,
      contacts,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-100">
            {initialData ? 'Editar Registro' : 'Novo Registro'}
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
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                placeholder="Ex: João Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                CPF do Cliente
              </label>
              <input
                type="text"
                required
                value={clientCpf}
                onChange={(e) => setClientCpf(formatCPF(e.target.value))}
                maxLength={14}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Barbeiro Solicitante
              </label>
              <input
                type="text"
                required
                value={barberName}
                onChange={(e) => setBarberName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all"
                placeholder="Ex: Marcos"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-zinc-300">
                Contatos Indicados
              </label>
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
                  disabled={!newContactName.trim() || !newContactPhone.trim()}
                  className="px-3 py-2 bg-zinc-800 text-zinc-100 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Incluir</span>
                </button>
              </div>
              {phoneError && (
                <p className="text-sm text-red-400 mt-1.5">{phoneError}</p>
              )}

              {contacts.length > 0 && (
                <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 space-y-2 max-h-40 overflow-y-auto">
                  {contacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-200">{contact.name}</span>
                        <span className="text-xs text-zinc-500">{contact.phone}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!contact.called}
                            onChange={() => toggleContactField(contact.id, 'called')}
                            className="w-4 h-4 rounded border-zinc-700 text-blue-500 focus:ring-blue-500/50 bg-zinc-950"
                          />
                          <span className="text-xs text-zinc-400">Chamou?</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!contact.subscriptionClosed}
                            onChange={() => toggleContactField(contact.id, 'subscriptionClosed')}
                            className="w-4 h-4 rounded border-zinc-700 text-red-600 focus:ring-red-600/50 bg-zinc-950"
                          />
                          <span className="text-xs text-zinc-400">Assinou?</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(contact.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors ml-1"
                          title="Remover contato"
                        >
                          <X size={16} />
                        </button>
                      </div>
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
            Cancelar
          </button>
          <button
            type="submit"
            form="record-form"
            className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
          >
            Salvar Registro
          </button>
        </div>
      </div>
    </div>
  );
}
