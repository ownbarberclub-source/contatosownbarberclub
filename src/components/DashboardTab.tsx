import React, { useState, useMemo } from 'react';
import { ReferralRecord } from '../types';
import { BarChart3, Users, TrendingUp, TrendingDown, Target, Zap, Crown, AlertTriangle } from 'lucide-react';

interface DashboardTabProps {
  records: ReferralRecord[];
}

export function DashboardTab({ records }: DashboardTabProps) {
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
    let noResponseLeads = 0;

    const barberPerformance: Record<string, { leads: number, conversions: number, noResponse: number }> = {};
    const receptionistPerformance: Record<string, { created: number, conversions: number }> = {};

    filteredRecords.forEach(record => {
      const bName = record.barberName || 'Desconhecido';
      const rName = record.createdByName || 'Sistema';

      if (!barberPerformance[bName]) barberPerformance[bName] = { leads: 0, conversions: 0, noResponse: 0 };
      if (!receptionistPerformance[rName]) receptionistPerformance[rName] = { created: 0, conversions: 0 };

      const validContacts = record.contacts || [];
      const loteSize = validContacts.length;

      totalLeads += loteSize;
      if (record.isDirectSale) {
        totalLeads += 1; // Venda direta conta como 1 lead convertido
        convertedLeads++;
        barberPerformance[bName].leads += 1;
        barberPerformance[bName].conversions++;
        receptionistPerformance[rName].created += 1;
        receptionistPerformance[rName].conversions++;
      }
      
      barberPerformance[bName].leads += loteSize;
      receptionistPerformance[rName].created += loteSize;

      validContacts.forEach(contact => {
        if (contact.status && contact.status !== 'pending') {
          contactedLeads++;
        }
        if (contact.status === 'no_response') {
          noResponseLeads++;
          barberPerformance[bName].noResponse++;
        }
        
        const isConverted = contact.status 
          ? contact.status === 'converted' 
          : contact.subscriptionClosed;

        if (isConverted) {
          convertedLeads++;
          barberPerformance[bName].conversions++;
          receptionistPerformance[rName].conversions++;
        }
      });
    });

    const contactRate = totalLeads > 0 ? Math.round((contactedLeads / totalLeads) * 100) : 0;
    const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;
    const noResponseRate = contactedLeads > 0 ? Math.round((noResponseLeads / contactedLeads) * 100) : 0;

    // Ordenação do Top 5 Barbeiros (pela qtde de conversões, depois leads)
    const topBarbers = Object.entries(barberPerformance)
      .sort((a, b) => b[1].conversions === a[1].conversions 
          ? b[1].leads - a[1].leads 
          : b[1].conversions - a[1].conversions)
      .slice(0, 5);

    // Ordenação do Top 5 Engajadores por VOLUME (leads criados)
    const topReceptionistsVolume = Object.entries(receptionistPerformance)
      .sort((a, b) => b[1].created - a[1].created)
      .slice(0, 5);

    // Ordenação do Top 5 Engajadores por CONVERSÃO (%)
    const topReceptionistsConversion = Object.entries(receptionistPerformance)
      .filter(([_, data]) => data.created > 0)
      .sort((a, b) => {
        const rateA = a[1].conversions / a[1].created;
        const rateB = b[1].conversions / b[1].created;
        return rateB - rateA || b[1].created - a[1].created;
      })
      .slice(0, 5);

    return { totalLeads, contactRate, contactedLeads, conversionRate, convertedLeads, noResponseRate, noResponseLeads, topBarbers, topReceptionistsVolume, topReceptionistsConversion };
  }, [filteredRecords]);

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

        {/* Filtros de Data */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1 ml-1">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:filter-white"
            />
          </div>
          <div className="mt-5 text-zinc-600 font-bold">-</div>
          <div className="flex flex-col">
            <label className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-1 ml-1">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:filter-white"
            />
          </div>
        </div>
      </div>

      {/* Cartões de KPI Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatisticCard 
          title="Total de Leads" 
          value={stats.totalLeads} 
          subtitle="Oportunidades Recebidas"
          icon={Users} 
          color="blue" 
        />
        <StatisticCard 
          title="Taxa de Vácuo" 
          value={`${stats.noResponseRate}%`} 
          subtitle={`${stats.noResponseLeads} leads sem resposta`}
          icon={AlertTriangle} 
          color="orange" 
        />
        <StatisticCard 
          title="ROI Conversão" 
          value={`${stats.conversionRate}%`} 
          subtitle={`${stats.convertedLeads} assinaturas fechadas`}
          icon={Target} 
          color="emerald" 
        />
      </div>

      {/* Painéis de Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel do Barbeiro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Crown className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Top Barbeiros (ROI)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topBarbers.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado no período.</p>
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
                      <span className="block text-xs text-zinc-500 font-medium">ROI</span>
                      <span className="font-bold text-emerald-400">{data.conversions}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel Engajadores VOLUME */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5">
            <Users className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-brand" />
            Top Engajadores (Volume)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topReceptionistsVolume.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado.</p>
            ) : (
              stats.topReceptionistsVolume.map(([name, data], idx) => (
                <div key={name} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 font-bold text-sm text-zinc-500 border border-zinc-800">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-200">{name}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-zinc-500 font-medium uppercase">Leads</span>
                    <span className="font-bold text-brand">{data.created}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel Engajadores QUALIDADE/CONVERSÃO */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target className="w-48 h-48" />
          </div>
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Top Engajadores (Conversão)
          </h3>
          <div className="space-y-4 relative z-10">
            {stats.topReceptionistsConversion.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-6">Nenhum dado gerado.</p>
            ) : (
              stats.topReceptionistsConversion.map(([name, data], idx) => {
                const cRate = data.created > 0 ? Math.round((data.conversions / data.created) * 100) : 0;
                return (
                  <div key={name} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-950/50 transition-colors border border-transparent hover:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-950 font-bold text-sm text-zinc-500 border border-zinc-800">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-200">{name}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-zinc-500 font-medium uppercase">Aproveitamento</span>
                      <span className="font-bold text-blue-400">{cRate}%</span>
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
