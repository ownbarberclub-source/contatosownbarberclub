import React, { useState, useMemo } from 'react';
import { Seller, Plan, ReferralRecord, User } from '../types';
import { Users, UserPlus, Plus, Trash2, Edit2, Check, X, Award, Percent, Target, CalendarDays, Settings, ShieldAlert } from 'lucide-react';

interface ConfigTabProps {
  sellers: Seller[];
  plans: Plan[];
  records: ReferralRecord[];
  currentUser: User;
  onAddSeller: (name: string) => void;
  onUpdateSeller: (id: string, data: Partial<Seller>) => void;
  onRemoveSeller: (id: string) => void;
  onAddPlan: (name: string) => void;
  onUpdatePlan: (id: string, data: Partial<Plan>) => void;
  onRemovePlan: (id: string) => void;
}

export function ConfigTab({
  sellers,
  plans,
  records,
  currentUser,
  onAddSeller,
  onUpdateSeller,
  onRemoveSeller,
  onAddPlan,
  onUpdatePlan,
  onRemovePlan
}: ConfigTabProps) {
  // Sellers State
  const [newSellerName, setNewSellerName] = useState('');
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editSellerName, setEditSellerName] = useState('');

  // Plans State
  const [newPlanName, setNewPlanName] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanName, setEditPlanName] = useState('');

  // Sellers Ranking State
  const [viewType, setViewType] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    return new Date().getFullYear().toString();
  });

  const yearsOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = 2024; y <= currentYear + 1; y++) {
      years.push(y.toString());
    }
    return years;
  }, []);

  // Handlers for Sellers
  const handleAddSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSellerName.trim()) return;
    onAddSeller(newSellerName.trim());
    setNewSellerName('');
  };

  const startEditingSeller = (seller: Seller) => {
    setEditingSellerId(seller.id);
    setEditSellerName(seller.name);
  };

  const handleUpdateSeller = (id: string) => {
    if (!editSellerName.trim()) {
      alert('Preencha o nome do vendedor.');
      return;
    }
    onUpdateSeller(id, { name: editSellerName.trim() });
    setEditingSellerId(null);
  };

  // Handlers for Plans
  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim()) return;
    onAddPlan(newPlanName.trim());
    setNewPlanName('');
  };

  const startEditingPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setEditPlanName(plan.name);
  };

  const handleUpdatePlan = (id: string) => {
    if (!editPlanName.trim()) {
      alert('Preencha o nome do plano.');
      return;
    }
    onUpdatePlan(id, { name: editPlanName.trim() });
    setEditingPlanId(null);
  };

  // Ranking calculation for Sellers (Desempenho Comercial)
  const sellersRanking = useMemo(() => {
    let monthRecords = records;
    if (viewType === 'monthly') {
      const year = selectedMonth.split('-')[0];
      const month = selectedMonth.split('-')[1];

      monthRecords = records.filter(record => {
        if (!record.createdAt) return false;
        const date = new Date(record.createdAt);
        return date.getFullYear().toString() === year && String(date.getMonth() + 1).padStart(2, '0') === month;
      });
    } else {
      monthRecords = records.filter(record => {
        if (!record.createdAt) return false;
        const date = new Date(record.createdAt);
        return date.getFullYear().toString() === selectedYear;
      });
    }

    const ranking = sellers.map(seller => {
      let closedSubscriptions = 0;
      let totalLeads = 0;
      let contactedLeads = 0;

      monthRecords.forEach(record => {
        if (record.contacts) {
          record.contacts.forEach(contact => {
            if (contact.sellerId === seller.id) {
              totalLeads++;
              if (contact.subscriptionClosed || contact.status === 'converted') {
                closedSubscriptions++;
              }
              if (contact.status && contact.status !== 'pending') {
                contactedLeads++;
              }
            }
          });
        }
      });

      const conversionRate = totalLeads > 0 ? Math.round((closedSubscriptions / totalLeads) * 100) : 0;

      return {
        ...seller,
        closedSubscriptions,
        totalLeads,
        contactedLeads,
        conversionRate
      };
    });

    return ranking.sort((a, b) => b.closedSubscriptions - a.closedSubscriptions || b.totalLeads - a.totalLeads);
  }, [viewType, selectedMonth, selectedYear, records, sellers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Grid: Vendedores + Planos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL: VENDEDORES */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              Equipe de Vendedores
            </h3>
            <span className="text-[10px] bg-brand/15 text-brand px-2 py-0.5 rounded-full font-mono uppercase font-bold border border-brand/20">
              {sellers.length} Cadastrados
            </span>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {currentUser.isAdmin && (
              <form onSubmit={handleAddSeller} className="flex gap-2">
                <input
                  type="text"
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                  placeholder="Nome do novo vendedor..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={!newSellerName.trim()}
                  className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar
                </button>
              </form>
            )}

            <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl max-h-72 overflow-y-auto divide-y divide-zinc-850">
              {sellers.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-500">Nenhum vendedor cadastrado ainda.</div>
              ) : (
                sellers.map((seller) => (
                  <div key={seller.id} className="p-4 hover:bg-zinc-950/20 transition-colors">
                    {editingSellerId === seller.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editSellerName}
                          onChange={(e) => setEditSellerName(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-105 text-sm focus:border-brand"
                          placeholder="Nome"
                        />
                        <button onClick={() => handleUpdateSeller(seller.id)} className="text-emerald-500 p-1.5 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingSellerId(null)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-200">{seller.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium uppercase mt-0.5">
                            {seller.is_active ? <span className="text-emerald-500">Ativo</span> : <span className="text-zinc-600">Inativo</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateSeller(seller.id, { is_active: !seller.is_active })}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium border ${
                              seller.is_active 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {seller.is_active ? 'Inativar' : 'Ativar'}
                          </button>
                          <button onClick={() => startEditingSeller(seller)} className="text-zinc-500 hover:text-brand transition-colors p-1" title="Editar Nome"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => onRemoveSeller(seller.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Remover Vendedor"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* PANEL: PLANOS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand" />
              Planos Contratados
            </h3>
            <span className="text-[10px] bg-brand/15 text-brand px-2 py-0.5 rounded-full font-mono uppercase font-bold border border-brand/20">
              {plans.length} Cadastrados
            </span>
          </div>

          <div className="p-6 space-y-6 flex-1">
            {currentUser.isAdmin && (
              <form onSubmit={handleAddPlan} className="flex gap-2">
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="Nome do novo plano (ex: Plano Mensal, Anual...)..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={!newPlanName.trim()}
                  className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar
                </button>
              </form>
            )}

            <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl max-h-72 overflow-y-auto divide-y divide-zinc-850">
              {plans.length === 0 ? (
                <div className="p-6 text-center text-sm text-zinc-500">Nenhum plano cadastrado ainda.</div>
              ) : (
                plans.map((plan) => (
                  <div key={plan.id} className="p-4 hover:bg-zinc-950/20 transition-colors">
                    {editingPlanId === plan.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editPlanName}
                          onChange={(e) => setEditPlanName(e.target.value)}
                          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-zinc-105 text-sm focus:border-brand"
                          placeholder="Nome"
                        />
                        <button onClick={() => handleUpdatePlan(plan.id)} className="text-emerald-500 p-1.5 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingPlanId(null)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-200">{plan.name}</span>
                          <span className="text-[10px] text-zinc-500 font-medium uppercase mt-0.5">
                            {plan.is_active ? <span className="text-emerald-500">Ativo</span> : <span className="text-zinc-600">Inativo</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdatePlan(plan.id, { is_active: !plan.is_active })}
                            className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium border ${
                              plan.is_active 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {plan.is_active ? 'Inativar' : 'Ativar'}
                          </button>
                          <button onClick={() => startEditingPlan(plan)} className="text-zinc-500 hover:text-brand transition-colors p-1" title="Editar Nome"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => onRemovePlan(plan.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Remover Plano"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Seção do Desempenho Comercial (Vendedores) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/20 text-brand rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Desempenho Comercial (Vendedores)</h3>
              <p className="text-xs text-zinc-400">Assinaturas e conversões fechadas por vendedor no período</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor Mensal / Anual */}
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setViewType('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewType === 'monthly'
                    ? 'bg-zinc-800 text-brand shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setViewType('yearly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewType === 'yearly'
                    ? 'bg-zinc-800 text-brand shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Anual
              </button>
            </div>

            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2">
              <CalendarDays className="w-4 h-4 text-brand" />
              {viewType === 'monthly' ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-zinc-100 focus:outline-none text-xs font-medium cursor-pointer uppercase [&::-webkit-calendar-picker-indicator]:invert"
                />
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent border-none text-zinc-100 focus:outline-none text-xs font-medium cursor-pointer"
                >
                  {yearsOptions.map(y => (
                    <option key={y} value={y} className="bg-zinc-900 text-zinc-100">{y}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-950/30">
              <tr>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider w-16">Posição</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vendedor</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assinaturas Fechadas</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total de Leads</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Taxa de Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 bg-zinc-900">
              {sellersRanking.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum vendedor registrado para pontuar.
                  </td>
                </tr>
              ) : (
                sellersRanking.map((seller, index) => (
                  <tr key={seller.id} className="hover:bg-zinc-950/10 transition-colors">
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
                      <span className="text-sm font-semibold text-zinc-200">{seller.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-sm text-emerald-400 font-bold">
                      {seller.closedSubscriptions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center font-mono text-sm text-zinc-400">
                      {seller.totalLeads}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 bg-brand/10 text-brand px-2.5 py-1 rounded-lg border border-brand/20 font-mono text-xs font-semibold">
                        {seller.conversionRate}%
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
