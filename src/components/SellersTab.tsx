import React, { useState, useMemo } from 'react';
import { Seller, ReferralRecord, User } from '../types';
import { Users, UserPlus, Plus, Trash2, Edit2, Check, X, Award, Percent, Target } from 'lucide-react';

interface SellersTabProps {
  sellers: Seller[];
  records: ReferralRecord[];
  currentUser: User;
  onAddSeller: (name: string) => void;
  onUpdateSeller: (id: string, data: Partial<Seller>) => void;
  onRemoveSeller: (id: string) => void;
}

export function SellersTab({ sellers, records, currentUser, onAddSeller, onUpdateSeller, onRemoveSeller }: SellersTabProps) {
  const [newSellerName, setNewSellerName] = useState('');
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editSellerName, setEditSellerName] = useState('');
  
  // Month selector YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

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

  // Ranking calculation for Sellers
  const sellersRanking = useMemo(() => {
    const year = selectedMonth.split('-')[0];
    const month = selectedMonth.split('-')[1];

    const monthRecords = records.filter(record => {
      if (!record.createdAt) return false;
      const date = new Date(record.createdAt);
      return date.getFullYear().toString() === year && String(date.getMonth() + 1).padStart(2, '0') === month;
    });

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

    // Sort by conversions descending, then by total leads descending
    return ranking.sort((a, b) => b.closedSubscriptions - a.closedSubscriptions || b.totalLeads - a.totalLeads);
  }, [selectedMonth, records, sellers]);

  return (
    <div className="space-y-8">
      {/* Cadastro de Vendedores */}
      {currentUser.isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Novo Vendedor */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-brand" />
              <h3 className="text-lg font-bold text-zinc-100">Cadastrar Novo Vendedor</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddSeller} className="flex gap-3 mb-6">
                <input
                  type="text"
                  required
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                  placeholder="Nome do Vendedor..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-100 focus:ring-2 focus:ring-brand/50 focus:border-brand"
                />
                <button type="submit" className="bg-brand hover:bg-brand-light text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-brand/20 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Incluir
                </button>
              </form>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {sellers.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-4">Nenhum vendedor cadastrado.</p>
                ) : (
                  sellers.map(seller => (
                    <div key={seller.id} className="flex flex-col bg-zinc-950/50 border border-zinc-800/50 rounded-lg px-4 py-3">
                      {editingSellerId === seller.id ? (
                        <div className="flex gap-2 w-full">
                          <input
                            type="text"
                            value={editSellerName}
                            onChange={(e) => setEditSellerName(e.target.value)}
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1 text-sm text-zinc-100 focus:outline-none focus:border-brand"
                          />
                          <button onClick={() => handleUpdateSeller(seller.id)} className="p-1 bg-emerald-500 text-white rounded hover:bg-emerald-600">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setEditingSellerId(null)} className="p-1 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-200">{seller.name}</span>
                            <span className="text-[10px] text-zinc-500 font-medium uppercase mt-0.5">
                              {seller.is_active ? (
                                <span className="text-emerald-500">Ativo</span>
                              ) : (
                                <span className="text-zinc-600">Inativo</span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onUpdateSeller(seller.id, { is_active: !seller.is_active })}
                              className={`text-xs px-2 py-1 rounded transition-colors font-medium border ${
                                seller.is_active 
                                  ? 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200' 
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                            >
                              {seller.is_active ? 'Inativar' : 'Ativar'}
                            </button>
                            <button onClick={() => startEditingSeller(seller)} className="text-zinc-500 hover:text-brand transition-colors p-1" title="Editar Nome">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRemoveSeller(seller.id)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Remover Vendedor">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Mini Info Vendedor */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl flex flex-col justify-center space-y-4">
            <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand" />
              Gestão de Vendas
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              O controle de vendedores permite associar cada lead a uma pessoa específica da sua equipe comercial.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Dessa forma, o time comercial pode ver quem está cuidando de cada indicação, e o administrador consegue mensurar quem fecha mais assinaturas e possui o melhor aproveitamento do ROI da campanha.
            </p>
            <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 text-xs text-zinc-500 space-y-1">
              <span className="font-semibold text-zinc-300 block mb-1">Como Atribuir Leads:</span>
              <p>1. Cadastre o vendedor nesta página.</p>
              <p>2. Vá para a aba principal de Leads.</p>
              <p>3. Na tabela, use a coluna "Vendedor" para associar o lead ao profissional responsável.</p>
            </div>
          </div>

        </div>
      )}

      {/* Ranking Mensal de Vendedores */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand/20 text-brand rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">Desempenho Comercial</h3>
              <p className="text-xs text-zinc-400">Assinaturas e conversões fechadas por vendedor no mês</p>
            </div>
          </div>

          {/* Month Filter */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-2 self-end">
            <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider font-mono">Mês de Referência:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-zinc-100 focus:outline-none text-sm font-semibold cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
            />
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
            <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
              {sellersRanking.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                    Nenhum vendedor cadastrado ou com leads neste mês.
                  </td>
                </tr>
              ) : (
                sellersRanking.map((seller, idx) => (
                  <tr key={seller.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold text-xs mx-auto ${
                        idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]' :
                        idx === 1 ? 'bg-zinc-300/20 text-zinc-300 border border-zinc-300/30' :
                        idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                        'bg-zinc-950 text-zinc-500 border border-zinc-800'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-zinc-200">
                      {seller.name}
                      {!seller.is_active && (
                        <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-bold bg-zinc-800 text-zinc-500 rounded uppercase tracking-wider">Inativo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-emerald-400 font-mono">
                      {seller.closedSubscriptions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-zinc-300 font-mono">
                      {seller.totalLeads}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-sm font-bold text-zinc-100 font-mono">{seller.conversionRate}%</span>
                        <div className="w-16 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 hidden sm:block">
                          <div 
                            className="h-full bg-brand rounded-full" 
                            style={{ width: `${Math.min(seller.conversionRate, 100)}%` }}
                          />
                        </div>
                      </div>
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
