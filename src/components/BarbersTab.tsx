import React, { useState, useMemo } from 'react';
import { Unit, Barber, ReferralRecord, User } from '../types';
import { formatCPF } from '../utils';
import { Building2, Scissors, CalendarDays, Plus, Trash2, Trophy, Edit2, Check, X } from 'lucide-react';

interface BarbersTabProps {
  units: Unit[];
  barbers: Barber[];
  records: ReferralRecord[];
  currentUser: User;
  onAddUnit: (name: string) => void;
  onRemoveUnit: (id: string) => void;
  onAddBarber: (name: string, unitId: string) => void;
  onUpdateBarber: (id: string, data: Partial<Barber>) => void;
  onRemoveBarber: (id: string) => void;
}

export function BarbersTab({ units, barbers, records, currentUser, onAddUnit, onRemoveUnit, onAddBarber, onUpdateBarber, onRemoveBarber }: BarbersTabProps) {
  const [newUnitName, setNewUnitName] = useState('');
  const [selectedUnitForBarber, setSelectedUnitForBarber] = useState('');
  
  const [editingBarberId, setEditingBarberId] = useState<string | null>(null);
  const [editBarberUnit, setEditBarberUnit] = useState('');
  
  // Month selector YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    onAddUnit(newUnitName.trim());
    setNewUnitName('');
  };

  const handleAddBarber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarberName.trim() || !selectedUnitForBarber) {
      alert('Preencha o nome e a unidade.');
      return;
    }
    onAddBarber(newBarberName.trim(), selectedUnitForBarber);
    setNewBarberName('');
  };

  const startEditingBarber = (barber: Barber) => {
    setEditingBarberId(barber.id);
    setEditBarberName(barber.name);
    setEditBarberUnit(barber.unit_id);
  };

  const handleUpdateBarber = (id: string) => {
    if (!editBarberName.trim() || !editBarberUnit) {
      alert('Preencha o nome e a unidade.');
      return;
    }
    onUpdateBarber(id, {
      name: editBarberName.trim(),
      unit_id: editBarberUnit
    });
    setEditingBarberId(null);
  };

  // Ranking calculation
  const barbersRanking = useMemo(() => {
    // Filter records by selected month
    const year = selectedMonth.split('-')[0];
    const month = selectedMonth.split('-')[1];

    const monthRecords = records.filter(record => {
      if (!record.createdAt) return false;
      const date = new Date(record.createdAt);
      return date.getFullYear().toString() === year && String(date.getMonth() + 1).padStart(2, '0') === month;
    });

    const ranking = barbers.map(barber => {
      const unit = units.find(u => u.id === barber.unit_id);
      
      // Get all records for this barber in this month
      const barberRecords = monthRecords.filter(r => r.barberId === barber.id || r.barberName === barber.name);
      
      // Sum closed subscriptions
      let closedSubscriptions = 0;
      let totalLeads = 0;

      barberRecords.forEach(record => {
        if (record.contacts) {
          totalLeads += record.contacts.length;
          closedSubscriptions += record.contacts.filter(c => c.subscriptionClosed).length;
        }
      });

      return {
        ...barber,
        unitName: unit?.name || 'Desconhecida',
        closedSubscriptions,
        totalLeads
      };
    });

    // Sort by subscriptions descending
    return ranking.sort((a, b) => b.closedSubscriptions - a.closedSubscriptions);
  }, [selectedMonth, records, barbers, units]);

  return (
    <div className="space-y-8">
      {/* Registration Section */}
      {currentUser.isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Units Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-zinc-100">Gerenciar Unidades</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddUnit} className="flex gap-3 mb-6">
                <input
                  type="text"
                  required
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Nome da Unidade..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:ring-2 focus:ring-brand/50 focus:border-brand"
                />
                <button type="submit" className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border border-zinc-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Incluir
                </button>
              </form>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {units.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Nenhuma unidade cadastrada.</p>
                ) : (
                  units.map(unit => (
                    <div key={unit.id} className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-4 py-3">
                      <span className="text-sm font-medium text-zinc-300">{unit.name}</span>
                      <button onClick={() => onRemoveUnit(unit.id)} className="text-zinc-500 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Barbers Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-zinc-100">Gerenciar Barbeiros</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddBarber} className="flex flex-col gap-3 mb-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    required
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    placeholder="Nome do Barbeiro..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:ring-2 focus:ring-brand/50 focus:border-brand"
                  />
                  <select
                    required
                    value={selectedUnitForBarber}
                    onChange={(e) => setSelectedUnitForBarber(e.target.value)}
                    className="w-44 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:ring-2 focus:ring-brand/50"
                  >
                    <option value="">Selecione a Unidade</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" disabled={units.length === 0} className="w-full bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand/20 flex items-center justify-center gap-2 disabled:opacity-50">
                  <Plus className="w-4 h-4" /> Cadastrar Profissional
                </button>
              </form>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {barbers.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Nenhum barbeiro cadastrado.</p>
                ) : (
                  barbers.map(barber => {
                    const bUnit = units.find(u => u.id === barber.unit_id);
                    return (
                      <div key={barber.id} className="flex flex-col bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-4 py-3">
                        {editingBarberId === barber.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 w-full">
                              <input
                                type="text"
                                value={editBarberName}
                                onChange={(e) => setEditBarberName(e.target.value)}
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-sm focus:border-brand"
                                placeholder="Nome"
                              />
                              <select
                                value={editBarberUnit}
                                onChange={(e) => setEditBarberUnit(e.target.value)}
                                className="w-32 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-sm"
                              >
                                {units.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                              <button onClick={() => handleUpdateBarber(barber.id)} className="text-emerald-500 p-1 bg-emerald-500/10 rounded ml-1"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingBarberId(null)} className="text-red-500 p-1 bg-red-500/10 rounded"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-zinc-300">{barber.name}</span>
                              <span className="text-xs text-zinc-500">
                                {bUnit?.name || '---'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => startEditingBarber(barber)} className="text-zinc-500 hover:text-brand transition-colors p-1">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => onRemoveBarber(barber.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Report / Ranking Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h3 className="text-xl font-bold text-zinc-100">Relatório e Ranking de Indicações</h3>
          </div>
          
          <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
            <CalendarDays className="w-5 h-5 text-brand" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-zinc-100 focus:outline-none text-sm font-medium cursor-pointer uppercase"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-950/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider w-16">Posição</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Profissional</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Unidade</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Leads</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assinaturas Fechadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
              {barbersRanking.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum barbeiro cadastrado para pontuar no ranking.
                  </td>
                </tr>
              ) : (
                barbersRanking.map((barber, index) => (
                  <tr key={barber.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {index === 0 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 font-bold border border-yellow-500/30">1</span>
                      ) : index === 1 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-300/20 text-zinc-300 font-bold border border-zinc-300/30">2</span>
                      ) : index === 2 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-600 font-bold border border-amber-700/30">3</span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-8 h-8 text-zinc-500 font-bold">{index + 1}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-bold text-zinc-100">{barber.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-1 rounded-md">{barber.unitName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-zinc-400">
                      {barber.totalLeads}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${
                        barber.closedSubscriptions > 0 
                          ? 'bg-brand/20 text-brand border border-brand/30' 
                          : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {barber.closedSubscriptions}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
