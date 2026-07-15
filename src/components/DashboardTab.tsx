import React, { useState, useMemo } from 'react';
import { ReferralRecord, Seller } from '../types';
import { BarChart3, Users, TrendingUp, TrendingDown, Target, Zap, Crown, AlertTriangle, PhoneOff, RefreshCcw, PhoneCall } from 'lucide-react';

interface DashboardTabProps {
  records: ReferralRecord[];
  sellers: Seller[];
}

export function DashboardTab({ records, sellers }: DashboardTabProps) {
  // Configuração padrão de datas (Últimos 30 dias até hoje)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const setPreset = (preset: '30days' | 'month' | 'year') => {
    const today = new Date();
    if (preset === '30days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'year') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  // Filtragem de records por data
  const filteredRecords = useMemo(() => {
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    return records.filter(record => {
      // Para leads antigos de antes da atualização do sistema, que não tem data, 
      // assumimos uma data antiga fixa para poderem entrar em filtros bem antigos.
      let recordDate;
      if (!record.createdAt) {
        recordDate = new Date('2024-01-01');
      } else {
        recordDate = new Date(record.createdAt);
      }
      return recordDate >= start && recordDate <= end;
    });
  }, [records, startDate, endDate]);

  // Cálculos de KPI
  const stats = useMemo(() => {
    let totalLeads = 0;
    let contactedLeads = 0;
    let convertedLeads = 0;
    let scheduledLeads = 0;
    let noResponseLeads = 0;
    let invalidNumberLeads = 0;
    let frequentLeads = 0;

    const barberPerformance: Record<string, { leads: number, conversions: number, noResponse: number }> = {};
    const receptionistPerformance: Record<string, { created: number, conversions: number }> = {};
    const sellerPerformance: Record<string, { name: string, leads: number, conversions: number }> = {};

    // Inicializa com todos os vendedores ativos para aparecerem com 0 leads se for o caso
    sellers.forEach(s => {
      sellerPerformance[s.id] = { name: s.name, leads: 0, conversions: 0 };
    });

    filteredRecords.forEach(record => {
      const rName = record.createdByName || 'Sistema';

      if (!receptionistPerformance[rName]) receptionistPerformance[rName] = { created: 0, conversions: 0 };

      const validContacts = record.contacts || [];
      const loteSize = validContacts.length;

      totalLeads += loteSize;
      receptionistPerformance[rName].created += loteSize;

      validContacts.forEach(contact => {
        const isNone = contact.barberId === 'none';
        const contactBarberId = isNone ? null : (contact.barberId || record.barberId || null);
        const contactBarberName = isNone ? null : (contact.barberName || record.barberName || null);
        const hasBarber = contactBarberId !== null || contactBarberName !== null;
        
        let targetBarberName = 'Desconhecido';
        if (hasBarber) {
          targetBarberName = contactBarberName || 'Desconhecido';
        } else if (contact.sellerId) {
          const sellerObj = sellers.find(s => s.id === contact.sellerId);
          const sellerName = sellerObj ? sellerObj.name : 'Desconhecido';
          targetBarberName = `${sellerName} (Venda Direta)`;
        }
        
        if (!barberPerformance[targetBarberName]) {
          barberPerformance[targetBarberName] = { leads: 0, conversions: 0, noResponse: 0 };
        }
        
        barberPerformance[targetBarberName].leads++;

        if (contact.status && contact.status !== 'pending') {
          contactedLeads++;
        }
        if (contact.status === 'no_response') {
          noResponseLeads++;
          barberPerformance[targetBarberName].noResponse++;
        }
        if (contact.status === 'invalid_number') {
          invalidNumberLeads++;
        }
        if (contact.status === 'frequent') {
          frequentLeads++;
        }
        if (contact.status === 'scheduled') {
          scheduledLeads++;
        }
        
        // Atribuição de vendedor
        if (contact.sellerId && hasBarber) {
          if (!sellerPerformance[contact.sellerId]) {
            const foundSeller = sellers.find(s => s.id === contact.sellerId);
            sellerPerformance[contact.sellerId] = { 
              name: foundSeller ? foundSeller.name : 'Desconhecido', 
              leads: 0, 
              conversions: 0 
            };
          }
          sellerPerformance[contact.sellerId].leads++;
        }

        // Prioritiza o novo sistema de status para o Analytics
        const isConverted = contact.status 
          ? contact.status === 'converted' 
          : contact.subscriptionClosed;

        if (isConverted) {
          convertedLeads++;
          barberPerformance[targetBarberName].conversions++;
          receptionistPerformance[rName].conversions++;
          if (contact.sellerId && hasBarber) {
            sellerPerformance[contact.sellerId].conversions++;
          }
        }
      });
    });

    const contactRate = totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0;
    const scheduledRate = contactedLeads > 0 ? Math.round((scheduledLeads / contactedLeads) * 100) : 0;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const noResponseRate = contactedLeads > 0 ? Math.round((noResponseLeads / contactedLeads) * 100) : 0;
    const invalidNumberRate = contactedLeads > 0 ? Math.round((invalidNumberLeads / contactedLeads) * 100) : 0;
    const frequentRate = contactedLeads > 0 ? Math.round((frequentLeads / contactedLeads) * 100) : 0;

    // Ordenação do Top 5 Barbeiros (pela qtde de conversões, depois leads)
    const topBarbers = Object.entries(barberPerformance)
      .sort((a, b) => b[1].conversions === a[1].conversions 
          ? b[1].leads - a[1].leads 
          : b[1].conversions - a[1].conversions)
      .slice(0, 5);

    // Ordenação do Top 5 Secretários por VOLUME (qtde de leads criados)
    const topReceptionistsByVolume = Object.entries(receptionistPerformance)
      .sort((a, b) => b[1].created - a[1].created)
      .slice(0, 5);

    // Ordenação do Top 5 Secretários por CONVERSÃO (taxa %)
    // Apenas para quem tem pelo menos 3 leads para evitar 100% de conversão com 1 único lead (sorte)
    const topReceptionistsByConversion = Object.entries(receptionistPerformance)
      .filter(([_, data]) => data.created >= 3) 
      .sort((a, b) => {
        const rateA = a[1].conversions / a[1].created;
        const rateB = b[1].conversions / b[1].created;
        return rateB - rateA;
      })
      .slice(0, 5);

    // Ordenação do Ranking de Vendedores
    const topSellers = Object.entries(sellerPerformance)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.conversions === a.conversions 
          ? b.leads - a.leads 
          : b.conversions - a.conversions);

    return { totalLeads, contactRate, contactedLeads, scheduledRate, scheduledLeads, conversionRate, convertedLeads, noResponseRate, noResponseLeads, invalidNumberRate, invalidNumberLeads, frequentRate, frequentLeads, topBarbers, topReceptionistsByVolume, topReceptionistsByConversion, topSellers };
  }, [filteredRecords, sellers]);

  // UI Components Extras
  const StatisticCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-${color}-500/20`}></div>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-zinc-500 font-medium text-sm mb-1 uppercase tracking-wider">{title}</p>
          <h3 className="text-4xl font-bold text-zinc-100 font-mono tracking-tight">{value}</h3>
          {subtitle && <p className="text-zinc-400 text-sm mt-3 font-medium bg-zinc-950/50 inline-block px-2.5 py-1 rounded-md">{subtitle}</p>}
        </div>
        <div className={`p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-${color}-500 shadow-inner`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600/20 text-red-500 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-100">ROI & Analytics</h2>
            <p className="text-sm text-zinc-400">Desempenho real das indicações e conversões</p>
          </div>
        </div>

        {/* Filtros de Data com Presets */}
        <div className="flex flex-col sm:flex-row items-end gap-3">
          {/* Presets */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-end">
            <button
              type="button"
              onClick={() => setPreset('30days')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-all cursor-pointer"
            >
              30 Dias
            </button>
            <button
              type="button"
              onClick={() => setPreset('month')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-all cursor-pointer"
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setPreset('year')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-all cursor-pointer"
            >
              Ano
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 ml-1">Início</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <div className="mt-5 text-zinc-600 font-bold">-</div>
            <div className="flex flex-col">
              <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1 ml-1">Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Cartões de KPI Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatisticCard 
          title="Total de Leads" 
          value={stats.totalLeads} 
          subtitle="Oportunidades Recebidas"
          icon={Users} 
          color="blue" 
        />
        <StatisticCard 
          title="Leads Chamados" 
          value={stats.contactedLeads} 
          subtitle={`${stats.contactRate}% do total`}
          icon={PhoneCall} 
          color="blue" 
        />
        <StatisticCard 
          title="Agendamentos" 
          value={`${stats.scheduledRate}%`} 
          subtitle={`${stats.scheduledLeads} leads agendaram`}
          icon={Target} 
          color="purple" 
        />
        <StatisticCard 
          title="ROI Conversão" 
          value={`${stats.conversionRate}%`} 
          subtitle={`${stats.convertedLeads} assinaturas fechadas`}
          icon={Target} 
          color="emerald" 
        />
        <StatisticCard 
          title="Taxa de Vácuo" 
          value={`${stats.noResponseRate}%`} 
          subtitle={`${stats.noResponseLeads} leads sem resposta`}
          icon={AlertTriangle} 
          color="orange" 
        />
        <StatisticCard 
          title="Números Inválidos" 
          value={`${stats.invalidNumberRate}%`} 
          subtitle={`${stats.invalidNumberLeads} incorretos`}
          icon={PhoneOff} 
          color="zinc" 
        />
        <StatisticCard 
          title="Frequentes" 
          value={`${stats.frequentRate}%`} 
          subtitle={`${stats.frequentLeads} já são clientes`}
          icon={RefreshCcw} 
          color="yellow" 
        />
      </div>

      {/* Painéis Secundários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Painel do Barbeiro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Crown className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Top Performance (Barbeiros)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topBarbers.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado no período selecionado.</p>
            ) : (
              stats.topBarbers.map(([name, data], idx) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-zinc-950 text-zinc-500 border border-zinc-800'}`}>
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-200">{name}</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-right">
                      <span className="block text-xs text-zinc-500 font-medium">CONVERSÃO</span>
                      <span className="font-bold text-emerald-400">{data.conversions}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-zinc-500 font-medium">LEADS</span>
                      <span className="font-bold text-zinc-300">{data.leads}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel do Vendedor */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <Crown className="w-5 h-5 text-amber-500" />
            Top Performance (Vendedores)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topSellers.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado no período selecionado.</p>
            ) : (
              stats.topSellers.map((seller, idx) => {
                const cRate = seller.leads > 0 ? Math.round((seller.conversions / seller.leads) * 100) : 0;
                return (
                  <div key={seller.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${idx === 0 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-zinc-950 text-zinc-500 border border-zinc-800'}`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-200">{seller.name}</span>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <span className="block text-xs text-zinc-500 font-medium">CONVERSÃO</span>
                        <span className="font-bold text-emerald-400">{seller.conversions} <span className="text-[10px] text-zinc-500">({cRate}%)</span></span>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs text-zinc-500 font-medium">LEADS</span>
                        <span className="font-bold text-zinc-300">{seller.leads}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Rankings de Engajadores (Duas Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Painel Volume de Cadastros */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5">
            <Users className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-brand" />
            Top Engajadores (Volume de Leads)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topReceptionistsByVolume.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado no período selecionado.</p>
            ) : (
              stats.topReceptionistsByVolume.map(([name, data], idx) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 font-bold text-sm text-zinc-500 border border-zinc-800">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-200">{name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-zinc-500 font-medium uppercase">Leads Inseridos</span>
                    <span className="font-bold text-brand">{data.created}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel Qualidade de Conversão */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-emerald-500" />
            Top ROI (Melhor Conversão)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topReceptionistsByConversion.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Aguardando leads suficientes para análise (mín. 3).</p>
            ) : (
              stats.topReceptionistsByConversion.map(([name, data], idx) => {
                const cRate = data.created > 0 ? Math.round((data.conversions / data.created) * 100) : 0;
                return (
                  <div key={name} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm ${idx === 0 ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' : 'bg-zinc-950 text-zinc-500 border border-zinc-800'}`}>
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-200">{name}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-zinc-500 font-medium uppercase">Taxa ROI</span>
                      <span className="font-bold text-emerald-400">{cRate}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
