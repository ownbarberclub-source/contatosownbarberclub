import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Users, UserPlus, CheckCircle2, Edit2, Trash2, Scissors, MessageCircle, PhoneCall, CalendarDays, Circle, PhoneForwarded, LogOut, FileText, FileSpreadsheet, Lock, AlertTriangle, TrendingUp } from 'lucide-react';
import Logo from './assets/logo.png';
import { ReferralRecord, ContactPerson, User, Unit, Barber } from './types';
import { formatCPF, cleanCPF, cleanPhone } from './utils';
import { RecordModal } from './components/RecordModal';
import { BarbersTab } from './components/BarbersTab';
import { DashboardTab } from './components/DashboardTab';
import { exportToExcel, exportToPDF } from './exportUtils';
import { supabase } from './supabaseClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hubLoading, setHubLoading] = useState(true);
  const [hubBlocked, setHubBlocked] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'users' | 'barbers' | 'dashboard'>('leads');

  const [records, setRecords] = useState<ReferralRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReferralRecord | null>(null);
  const [preFilledClient, setPreFilledClient] = useState<{ cpf: string; name: string } | null>(null);

  // ── Hub SSO Authentication ───────────────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      setHubLoading(true);

      const params = new URLSearchParams(window.location.search);
      const hubUser = params.get('hub_user');
      const hubPass = params.get('hub_pass');
      const hubToken = params.get('hub_token');

      setDebugMsg(`Params: user=${hubUser ? '✓' : '✗'} pass=${hubPass ? '✓' : '✗'} token=${hubToken ? '✓' : '✗'}`);

      // 1. Tenta autenticar via relay de senha (hub_pass presente)
      if (hubUser && hubPass) {
        try {
          const password = atob(hubPass);
          const { error: authErr } = await supabase.auth.signInWithPassword({ email: hubUser, password });
          if (authErr) setDebugMsg(`PassRelay: ${authErr.message}`);
        } catch (e: any) {
          setDebugMsg(`PassRelay Exception: ${e.message}`);
        }
      }

      // 2. Verifica sessão ativa no Supabase
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) setDebugMsg(prev => prev + ` | SessionErr: ${sessionErr.message}`);

      // 3. Token relay fallback
      if (!session?.user && hubUser && hubToken) {
        try {
          const decoded = JSON.parse(atob(hubToken));
          setDebugMsg(prev => prev + ` | Token: uid=${decoded.uid?.slice(0,8)} exp=${decoded.exp > Date.now() ? 'valid' : 'expired'}`);
          if (decoded.uid && decoded.exp > Date.now()) {
            const { data: profileByToken, error: profErr } = await supabase
              .from('hub_profiles')
              .select('*')
              .eq('id', decoded.uid)
              .single();

            setDebugMsg(prev => prev + ` | Profile: ${profileByToken ? `found is_active=${profileByToken.is_active} role=${profileByToken.role}` : `null err=${profErr?.message}`}`);

            if (profileByToken && profileByToken.is_active !== false) {
              const url = new URL(window.location.href);
              ['hub_user','hub_pass','hub_role','hub_token','hub_name'].forEach(p => url.searchParams.delete(p));
              window.history.replaceState({}, '', url.toString());
              setCurrentUser({ id: profileByToken.id, name: profileByToken.name || hubUser.split('@')[0], email: hubUser, password: '', isAdmin: profileByToken.role === 'admin', permissions: profileByToken.role === 'admin' ? ['view_ranking', 'export_data', 'delete_records'] : [] });
              setHubLoading(false);
              loadAppData();
              return;
            }
          }
        } catch (e: any) {
          setDebugMsg(prev => prev + ` | TokenErr: ${e.message}`);
        }
      }

      if (!session?.user) {
        setDebugMsg(prev => prev + ' | BLOCKED: no session');
        setHubBlocked(true);
        setHubLoading(false);
        return;
      }

      // 4. Busca perfil no hub_profiles
      const { data: profile, error: profErr2 } = await supabase
        .from('hub_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile || profile.is_active === false) {
        setDebugMsg(prev => prev + ` | BLOCKED: profile=${profile ? `found is_active=${profile.is_active} role=${profile.role}` : `null err=${profErr2?.message}`}`);
        setHubBlocked(true);
        setHubLoading(false);
        return;
      }

      const url = new URL(window.location.href);
      ['hub_user','hub_pass','hub_role','hub_token','hub_name'].forEach(p => url.searchParams.delete(p));
      window.history.replaceState({}, '', url.toString());

      setCurrentUser({ id: session.user.id, name: profile.name || session.user.email?.split('@')[0] || 'Usuário', email: session.user.email || '', password: '', isAdmin: profile.role === 'admin', permissions: profile.role === 'admin' ? ['view_ranking', 'export_data', 'delete_records'] : [] });
      setHubLoading(false);
      loadAppData();
    };

    initAuth();
  }, []);

  const loadAppData = async () => {
    const { data: recordsData } = await supabase
      .from('referral_records')
      .select('*')
      .order('createdAt', { ascending: false });
    if (recordsData) setRecords(recordsData);

    const { data: unitsData } = await supabase.from('previa_units').select('*');
    if (unitsData) setUnits(unitsData);

    const { data: barbersData } = await supabase.from('previa_barbers').select('*');
    if (barbersData) setBarbers(barbersData);

    // Realtime
    const channel = supabase.channel('realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referral_records' }, () => loadAppData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'previa_barbers' }, () => loadAppData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'previa_units' }, () => loadAppData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setHubBlocked(true);
    setActiveTab('leads');
  };

  const handleAddUnit = async (name: string) => {
    const newUnit = { id: crypto.randomUUID(), name };
    setUnits([...units, newUnit]);
    await supabase.from('previa_units').insert([newUnit]);
  };

  const handleRemoveUnit = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover esta unidade? Barbeiros associados a ela ficarão órfãos.')) {
      setUnits(units.filter(u => u.id !== id));
      await supabase.from('previa_units').delete().eq('id', id);
    }
  };

  const handleAddBarber = async (name: string, unitId: string) => {
    const newBarber = { id: crypto.randomUUID(), name, unit_id: unitId };
    setBarbers([...barbers, newBarber]);
    await supabase.from('previa_barbers').insert([newBarber]);
  };

  const handleUpdateBarber = async (id: string, data: Partial<Barber>) => {
    const updatedBarber = barbers.find(b => b.id === id);
    if (!updatedBarber) return;
    
    const newBarber = { ...updatedBarber, ...data };
    setBarbers(barbers.map(b => b.id === id ? newBarber : b));
    await supabase.from('previa_barbers').update(data).eq('id', id);
  };

  const handleRemoveBarber = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este barbeiro?')) {
      setBarbers(barbers.filter(b => b.id !== id));
      await supabase.from('previa_barbers').delete().eq('id', id);
    }
  };

  const handleSaveRecord = async (recordData: Omit<ReferralRecord, 'id' | 'createdAt'>) => {
    if (editingRecord) {
      const updatedRecord = { ...editingRecord, ...recordData };
      setRecords(records.map(r => 
        r.id === editingRecord.id 
          ? updatedRecord
          : r
      ));
      await supabase.from('referral_records').update(updatedRecord).eq('id', updatedRecord.id);
    } else {
      const newRecord: ReferralRecord = {
        ...recordData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        createdByName: currentUser.name,
      };
      setRecords([newRecord, ...records]);
      await supabase.from('referral_records').insert([newRecord]);
    }
  };

  const updateContactData = async (recordId: string, contactId: string, updates: Partial<ContactPerson>) => {
    let updatedRecordToSave: ReferralRecord | null = null;
    
    setRecords(records.map(record => {
      if (record.id === recordId) {
        const newContacts = record.contacts.map(contact => {
          if (contact.id === contactId) {
            const updatedContact = { ...contact, ...updates };
            
            // Sincroniza campos legados com o novo sistema de status
            if (updates.status) {
              if (updates.status === 'converted') {
                updatedContact.subscriptionClosed = true;
                updatedContact.called = true;
                const timeString = new Date().toISOString().split('T')[1] || '00:00:00.000Z';
                if (!updatedContact.calledAt) updatedContact.calledAt = `${selectedDate}T${timeString}`;
              } else if (updates.status === 'pending') {
                updatedContact.subscriptionClosed = false;
                updatedContact.called = false;
                updatedContact.calledAt = undefined;
              } else {
                // contacted, no_response, declined
                updatedContact.subscriptionClosed = false;
                updatedContact.called = true;
                const timeString = new Date().toISOString().split('T')[1] || '00:00:00.000Z';
                if (!updatedContact.calledAt) updatedContact.calledAt = `${selectedDate}T${timeString}`;
              }
            }
            
            return updatedContact;
          }
          return contact;
        });
        
        const updated = { ...record, contacts: newContacts };
        updatedRecordToSave = updated;
        return updated;
      }
      return record;
    }));

    if (updatedRecordToSave) {
      // @ts-ignore
      await supabase.from('referral_records').update({ contacts: updatedRecordToSave.contacts }).eq('id', updatedRecordToSave.id);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      setRecords(records.filter(r => r.id !== id));
      await supabase.from('referral_records').delete().eq('id', id);
    }
  };

  const openEditModal = (record: ReferralRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingRecord(null);
    setPreFilledClient(null);
    setIsModalOpen(true);
  };

  const openNewModalWithClient = (cpf: string, name: string) => {
    setEditingRecord(null);
    setPreFilledClient({ cpf, name });
    setIsModalOpen(true);
  };

  const clientGroups = useMemo(() => {
    const groups: Record<string, {
      clientName: string;
      clientCpf: string;
      batches: ReferralRecord[];
    }> = {};

    records.forEach(record => {
      const cpf = cleanCPF(record.clientCpf);
      if (!groups[cpf]) {
        groups[cpf] = {
          clientName: record.clientName,
          clientCpf: record.clientCpf,
          batches: [],
        };
      }
      groups[cpf].batches.push(record);
    });

    return Object.values(groups);
  }, [records]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return clientGroups;
    const query = searchQuery.toLowerCase();
    const cleanQuery = cleanCPF(searchQuery);
    
    return clientGroups.filter(group => {
      const matchName = group.clientName.toLowerCase().includes(query);
      const matchCpf = cleanQuery.length > 0 && cleanCPF(group.clientCpf).includes(cleanQuery);
      const matchBarber = group.batches.some(b => b.barberName.toLowerCase().includes(query));
      const matchLead = group.batches.some(b => b.contacts?.some(c => c.name.toLowerCase().includes(query) || cleanPhone(c.phone).includes(cleanQuery)));
      
      return matchName || matchCpf || matchBarber || matchLead;
    });
  }, [clientGroups, searchQuery]);

  const stats = useMemo(() => {
    const allContacts = records.flatMap(r => r.contacts || []);
    const called = allContacts.filter(c => c.status && c.status !== 'pending').length;
    const converted = allContacts.filter(c => c.status === 'converted' || c.subscriptionClosed).length;
    const noResponse = allContacts.filter(c => c.status === 'no_response').length;

    return {
      totalClients: new Set(records.map(r => cleanCPF(r.clientCpf))).size,
      totalLeads: allContacts.length,
      leadsToCall: allContacts.filter(c => !c.status || c.status === 'pending').length,
      conversionRate: allContacts.length > 0 ? Math.round((converted / allContacts.length) * 100) : 0,
      noResponseRate: called > 0 ? Math.round((noResponse / called) * 100) : 0,
    };
  }, [records]);

  if (hubLoading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b', color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #E10600', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#71717a', fontSize: 14 }}>Verificando acesso via Hub...</p>
        </div>
      </div>
    );
  }

  if (hubBlocked || !currentUser) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Space Grotesk, sans-serif' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', background: '#18181b', padding: 40, borderRadius: 24, border: '1px solid #27272a' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #E10600, #B00400)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 24px rgba(225,6,0,0.3)' }}>
            <Lock size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f4f4f5', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Acesso Restrito</h2>
          <p style={{ color: '#71717a', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Este sistema é exclusivo para operadores autorizados.<br />Por favor, acesse pelo <strong style={{ color: '#fff' }}>OWN Hub</strong>.
          </p>
          {debugMsg && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 24, textAlign: 'left', fontSize: 11, color: '#f87171', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {debugMsg}
            </div>
          )}
          <a
            href="https://ownpainel.vercel.app"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E10600', color: '#fff', textDecoration: 'none', padding: '12px 28px', borderRadius: 12, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 8px 24px rgba(225,6,0,0.3)' }}
          >
            → Ir para o OWN Hub
          </a>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-brand/30">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 p-1.5 shadow-lg">
                  <img 
                    src={Logo} 
                    alt="OWN" 
                    className="w-full h-full object-contain brightness-0 invert"
                  />
               </div>
               <h1 className="text-xl font-black tracking-tighter text-zinc-100 hidden sm:block uppercase italic">
                 OWN <span className="text-brand">BARBER</span> CLUB
               </h1>
            </div>
            
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('leads')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'leads' 
                    ? 'bg-zinc-800 text-brand' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                Leads
              </button>
              {(currentUser.isAdmin || currentUser.permissions?.includes('view_ranking')) && (
                <button
                  onClick={() => setActiveTab('barbeiros')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'barbeiros' 
                      ? 'bg-zinc-800 text-brand' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Barbeiros &amp; Rank
                </button>
              )}
              {currentUser.isAdmin && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'dashboard' 
                      ? 'bg-zinc-800 text-brand' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Analytics
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="text-sm text-zinc-400">Olá, <strong className="text-zinc-200">{currentUser.name}</strong></span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activeTab === 'users' ? (
          <UsersTab 
            users={users} 
            onAddUser={handleAddUser} 
            onRemoveUser={handleRemoveUser} 
            onUpdateUser={handleUpdateUser}
            currentUser={currentUser} 
          />
        ) : activeTab === 'barbeiros' ? (
          <BarbersTab
            units={units}
            barbers={barbers}
            records={records}
            currentUser={currentUser}
            onAddUnit={handleAddUnit}
            onRemoveUnit={handleRemoveUnit}
            onAddBarber={handleAddBarber}
            onUpdateBarber={handleUpdateBarber}
            onRemoveBarber={handleRemoveBarber}
          />
        ) : activeTab === 'dashboard' && currentUser.isAdmin ? (
          <DashboardTab records={records} />
        ) : (
          <>
            {/* Stats & Filter Row */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
                  <CalendarDays className="w-5 h-5 text-brand" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-zinc-100 focus:outline-none text-sm font-medium cursor-pointer"
                  />
                </div>

                <div className="flex-1 w-full md:w-auto flex flex-col md:flex-row gap-3 justify-end">
                  <div className="w-full md:w-80 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-zinc-500" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por nome, barbeiro ou CPF..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl leading-5 bg-zinc-900 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all sm:text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {(currentUser.isAdmin || currentUser.permissions?.includes('export_data')) && (
                      <>
                        <button
                          onClick={() => exportToPDF(records)}
                          className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                          title="Exportar para PDF"
                        >
                          <FileText className="w-4 h-4 text-red-400" />
                          <span className="hidden lg:inline">PDF</span>
                        </button>
                        <button
                          onClick={() => exportToExcel(records)}
                          className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700"
                          title="Exportar para Excel"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                          <span className="hidden lg:inline">Excel</span>
                        </button>
                      </>
                    )}
                    <button
                      onClick={openNewModal}
                      className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Novo Registro</span>
                    </button>
                  </div>
                </div>
              </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Users className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">Clientes</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{stats.totalClients}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <UserPlus className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">Total Leads</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{stats.totalLeads}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-400">
                <PhoneCall className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">A Chamar</p>
              </div>
              <p className="text-2xl font-bold text-blue-400">{stats.leadsToCall}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-orange-400">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">Taxa de Vácuo</p>
              </div>
              <p className="text-2xl font-bold text-orange-400">{stats.noResponseRate}%</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand">
                <TrendingUp className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">ROI Conversão</p>
              </div>
              <p className="text-2xl font-bold text-brand">{stats.conversionRate}%</p>
            </div>
          </div>
        </div>

        {/* Data Sections */}
        <div className="space-y-6">
          {filteredGroups.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
              {searchQuery ? 'Nenhum cliente ou lead encontrado para esta busca.' : 'Nenhum cliente cadastrado ainda.'}
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.clientCpf} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/50">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-3">
                      {group.clientName}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">CPF: {group.clientCpf}</p>
                  </div>
                  <button
                    onClick={() => openNewModalWithClient(group.clientCpf, group.clientName)}
                    className="flex items-center gap-2 bg-zinc-800 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Leads
                  </button>
                </div>
                
                {/* Leads Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-800">
                    <thead className="bg-zinc-950/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Lead</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Telefone</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Barbeiro</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status ROI</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Notas / Observações</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
                      {group.batches.flatMap(batch => 
                        (batch.contacts || []).map(contact => (
                          <tr key={contact.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-zinc-200">{contact.name}</td>
                            <td className="px-6 py-3 whitespace-nowrap">
                              <a
                                href={`https://wa.me/55${cleanPhone(contact.phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-2.5 py-1 rounded-md"
                              >
                                <MessageCircle className="w-4 h-4" />
                                {contact.phone}
                              </a>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-zinc-400">{batch.barberName}</td>
                            <td className="px-6 py-3 whitespace-nowrap text-center">
                              <select
                                value={contact.status || (contact.subscriptionClosed ? 'converted' : contact.called ? 'contacted' : 'pending')}
                                onChange={(e) => updateContactData(batch.id, contact.id, { status: e.target.value as any })}
                                className={`text-xs font-bold rounded-md px-2 py-1 bg-zinc-800 border focus:outline-none transition-colors ${
                                  contact.status === 'converted' || contact.subscriptionClosed ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                  contact.status === 'no_response' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                                  contact.status === 'declined' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                  contact.status === 'contacted' || contact.called ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                  'text-zinc-500 border-zinc-700'
                                }`}
                              >
                                <option value="pending">Pendente</option>
                                <option value="contacted">Contatado</option>
                                <option value="no_response">Não Respondeu</option>
                                <option value="declined">Recusou</option>
                                <option value="converted">Assinou ✅</option>
                              </select>
                            </td>
                            <td className="px-6 py-3">
                              <input 
                                type="text"
                                placeholder="Adicionar nota..."
                                value={contact.notes || ''}
                                onChange={(e) => updateContactData(batch.id, contact.id, { notes: e.target.value })}
                                className="w-full bg-transparent border-none text-xs text-zinc-400 focus:text-zinc-200 focus:outline-none placeholder-zinc-700"
                              />
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => openEditModal(batch)}
                                className="text-zinc-500 hover:text-brand transition-colors p-1"
                                title="Editar Lote"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {(currentUser.isAdmin || currentUser.permissions?.includes('delete_records')) && (
                                <button
                                  onClick={() => handleDelete(batch.id)}
                                  className="text-zinc-500 hover:text-red-500 transition-colors p-1 ml-2"
                                  title="Excluir Lote"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                      {group.batches.every(b => !b.contacts || b.contacts.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-500">
                            Nenhum lead registrado para este cliente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
        </>
        )}
      </main>

      <RecordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRecord}
        initialData={editingRecord}
        records={records}
        barbers={barbers}
        preFilledClient={preFilledClient}
      />
    </div>
  );
}
