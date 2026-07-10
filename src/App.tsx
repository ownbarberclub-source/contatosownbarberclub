import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Users, UserPlus, CheckCircle2, Edit2, Trash2, Scissors, MessageCircle, PhoneCall, CalendarDays, Circle, PhoneForwarded, LogOut, FileText, FileSpreadsheet, Lock, AlertTriangle, TrendingUp, RefreshCw, Copy, Check, Flag, X } from 'lucide-react';
import Logo from './assets/logo.png';
import { ReferralRecord, ContactPerson, User, Unit, Barber, Campaign, Seller, Plan } from './types';
import { formatCPF, cleanCPF, cleanPhone, detectIdentifierType } from './utils';
import { RecordModal } from './components/RecordModal';
import { BarbersTab } from './components/BarbersTab';
import { UsersTab } from './components/UsersTab';
import { DashboardTab } from './components/DashboardTab';
import { ConfigTab } from './components/ConfigTab';
import { exportToExcel, exportToPDF, exportGroupToPDF, exportGroupToPDFAdmin } from './exportUtils';
import { supabase } from './supabaseClient';
import { LeadEditModal } from './components/LeadEditModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hubLoading, setHubLoading] = useState(true);
  const [hubBlocked, setHubBlocked] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeTab, setActiveTab] = useState<'leads' | 'users' | 'barbeiros' | 'dashboard' | 'configuracoes'>('leads');
  const [users, setUsers] = useState<User[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [records, setRecords] = useState<ReferralRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReferralRecord | null>(null);
  const [preFilledClient, setPreFilledClient] = useState<{ cpf: string; name: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Estados de edição de Lead individual (lápis)
  const [editingLead, setEditingLead] = useState<ContactPerson | null>(null);
  const [editingLeadRecord, setEditingLeadRecord] = useState<ReferralRecord | null>(null);
  const [isLeadEditModalOpen, setIsLeadEditModalOpen] = useState(false);

  // Estados de Filtros Avançados
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterBarberId, setFilterBarberId] = useState<string>('all');
  const [filterSellerId, setFilterSellerId] = useState<string>('all');
  const [filterFidelimax, setFilterFidelimax] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Estados de Campanha
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

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
              const { data: userPerms } = await supabase
                .from('hub_permissions')
                .select('*')
                .eq('user_id', profileByToken.id);

              const isUserAdmin = profileByToken.role === 'admin' || userPerms?.some((p: any) => p.role === 'administrador' || p.role === 'admin');

              const url = new URL(window.location.href);
              ['hub_user','hub_pass','hub_role','hub_token','hub_name'].forEach(p => url.searchParams.delete(p));
              window.history.replaceState({}, '', url.toString());
              setCurrentUser({
                id: profileByToken.id,
                name: profileByToken.name || hubUser.split('@')[0],
                email: hubUser,
                password: '',
                isAdmin: !!isUserAdmin,
                role: isUserAdmin ? 'admin' : 'operator',
                permissions: isUserAdmin ? ['view_ranking', 'export_data', 'delete_records'] : []
              });
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

      const { data: userPerms } = await supabase
        .from('hub_permissions')
        .select('*')
        .eq('user_id', session.user.id);

      const isUserAdmin = profile.role === 'admin' || userPerms?.some((p: any) => p.role === 'administrador' || p.role === 'admin');

      const url = new URL(window.location.href);
      ['hub_user','hub_pass','hub_role','hub_token','hub_name'].forEach(p => url.searchParams.delete(p));
      window.history.replaceState({}, '', url.toString());

      setCurrentUser({
        id: session.user.id,
        name: profile.name || session.user.email?.split('@')[0] || 'Usuário',
        email: session.user.email || '',
        password: '',
        isAdmin: !!isUserAdmin,
        role: isUserAdmin ? 'admin' : 'operator',
        permissions: isUserAdmin ? ['view_ranking', 'export_data', 'delete_records'] : []
      });
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

    const { data: barbersData } = await supabase.from('previa_barbers').select('*').eq('is_hidden_crm', false).eq('is_active', true);
    if (barbersData) setBarbers(barbersData);

    // Carregar campanhas
    const { data: campaignsData } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
    if (campaignsData) {
      setCampaigns(campaignsData);
      const active = campaignsData.find(c => c.status === 'active');
      setActiveCampaign(active || null);
      if (active && selectedCampaignId === 'all') {
        setSelectedCampaignId(active.id);
      }
    }

    // Carregar usuários do hub_profiles
    const { data: usersData } = await supabase.from('hub_profiles').select('*');
    if (usersData) {
      const mappedUsers: User[] = usersData.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email || '',
        password: '',
        isAdmin: u.role === 'admin',
        permissions: u.permissions || []
      }));
      setUsers(mappedUsers);
    }

    // Carregar vendedores
    const { data: sellersData } = await supabase
      .from('sellers')
      .select('*')
      .order('name', { ascending: true });
    if (sellersData) setSellers(sellersData);

    // Carregar planos
    const { data: plansData } = await supabase
      .from('plans')
      .select('*')
      .order('name', { ascending: true });
    if (plansData) setPlans(plansData);
  };

  // Realtime Sync Subscription - Reconfiguração Total
  useEffect(() => {
    console.log("Monitorando banco de dados em tempo real...");

    const channel = supabase.channel('global-sync-v3')
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'referral_records' 
        }, 
        (payload) => {
          console.log("!!! MUDANÇA DETECTADA NO BANCO (referral_records) !!!", payload);
          setRecords(prevRecords => {
            if (payload.eventType === 'INSERT') {
              if (prevRecords.some(r => r.id === payload.new.id)) return prevRecords;
              return [payload.new as ReferralRecord, ...prevRecords];
            }
            if (payload.eventType === 'UPDATE') {
              return prevRecords.map(r => r.id === payload.new.id ? (payload.new as ReferralRecord) : r);
            }
            if (payload.eventType === 'DELETE') {
              return prevRecords.filter(r => r.id !== payload.old.id);
            }
            return prevRecords;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          console.log("!!! MUDANÇA DETECTADA NO BANCO (campaigns) !!!");
          loadAppData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sellers'
        },
        () => {
          console.log("!!! MUDANÇA DETECTADA NO BANCO (sellers) !!!");
          loadAppData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plans'
        },
        () => {
          console.log("!!! MUDANÇA DETECTADA NO BANCO (plans) !!!");
          loadAppData();
        }
      )
      .subscribe((status) => {
        console.log("Conexão Realtime:", status);
        setDebugMsg(prev => `${prev.split(' | SYNC:')[0]} | SYNC:${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCampaignId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setHubBlocked(true);
    setActiveTab('leads');
  };

  const handleStartCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    try {
      const { error: updateErr } = await supabase
        .from('campaigns')
        .update({ status: 'ended' })
        .eq('status', 'active');
      if (updateErr) throw updateErr;

      const newCampaign = {
        id: crypto.randomUUID(),
        name: newCampaignName.trim(),
        status: 'active',
        created_at: new Date().toISOString()
      };
      const { error: insertErr } = await supabase
        .from('campaigns')
        .insert([newCampaign]);
      if (insertErr) throw insertErr;

      setNewCampaignName('');
      setIsCampaignModalOpen(false);
      alert('Nova campanha iniciada com sucesso!');
      setSelectedCampaignId(newCampaign.id);
      loadAppData();
    } catch (err) {
      console.error('Erro ao iniciar nova campanha:', err);
      alert('Falha ao iniciar nova campanha no servidor.');
    }
  };

  const handleEndCampaign = async (campaignId: string) => {
    if (!window.confirm('Tem certeza que deseja encerrar esta campanha? Todos os contatos dela ficarão em modo leitura.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'ended' })
        .eq('id', campaignId);
      if (error) throw error;

      alert('Campanha encerrada com sucesso!');
      loadAppData();
    } catch (err) {
      console.error('Erro ao encerrar campanha:', err);
      alert('Falha ao encerrar campanha.');
    }
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR a campanha "${campaignName}"? TODOS os contatos e indicações vinculados a ela serão deletados permanentemente!`)) {
      return;
    }

    try {
      const { error: recordsErr } = await supabase
        .from('referral_records')
        .delete()
        .eq('campaign_id', campaignId);
      if (recordsErr) throw recordsErr;

      const { error: campaignErr } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);
      if (campaignErr) throw campaignErr;

      alert('Campanha e seus contatos excluídos com sucesso!');
      if (selectedCampaignId === campaignId) {
        setSelectedCampaignId('all');
      }
      loadAppData();
    } catch (err) {
      console.error('Erro ao excluir campanha:', err);
      alert('Falha ao excluir campanha.');
    }
  };

  const isRecordReadOnly = (record: ReferralRecord | null) => {
    if (!record || !record.campaign_id) return false;
    const cmp = campaigns.find(c => c.id === record.campaign_id);
    return cmp ? cmp.status === 'ended' : false;
  };

  const handleAddUser = async (userData: Omit<User, 'id'>) => {
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: { data: { name: userData.name } }
    });

    if (authErr) {
      alert(`Erro ao criar usuário: ${authErr.message}`);
      return;
    }

    if (authData.user) {
      const newUserProfile = {
        id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.isAdmin ? 'admin' : 'operator',
        permissions: userData.permissions,
        is_active: true
      };
      await supabase.from('hub_profiles').insert([newUserProfile]);
      loadAppData();
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    const dbUpdates: any = {};
    if (data.name) dbUpdates.name = data.name;
    if (data.email) dbUpdates.email = data.email;
    if (data.isAdmin !== undefined) dbUpdates.role = data.isAdmin ? 'admin' : 'operator';
    if (data.permissions) dbUpdates.permissions = data.permissions;

    await supabase.from('hub_profiles').update(dbUpdates).eq('id', id);
    loadAppData();
  };

  const handleRemoveUser = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este usuário?')) {
      await supabase.from('hub_profiles').update({ is_active: false }).eq('id', id);
      loadAppData();
    }
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
      await supabase.from('previa_barbers').update({ is_active: false }).eq('id', id);
    }
  };

  const handleAddSeller = async (name: string) => {
    const newSeller = { id: crypto.randomUUID(), name, is_active: true };
    setSellers(prev => [...prev, newSeller]);
    await supabase.from('sellers').insert([newSeller]);
  };

  const handleUpdateSeller = async (id: string, data: Partial<Seller>) => {
    setSellers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    await supabase.from('sellers').update(data).eq('id', id);
  };

  const handleRemoveSeller = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este vendedor?')) {
      setSellers(prev => prev.filter(s => s.id !== id));
      await supabase.from('sellers').delete().eq('id', id);
    }
  };

  const handleAddPlan = async (name: string) => {
    const newPlan = { id: crypto.randomUUID(), name, is_active: true };
    setPlans(prev => [...prev, newPlan]);
    await supabase.from('plans').insert([newPlan]);
  };

  const handleUpdatePlan = async (id: string, data: Partial<Plan>) => {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    await supabase.from('plans').update(data).eq('id', id);
  };

  const handleRemovePlan = async (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este plano?')) {
      setPlans(prev => prev.filter(p => p.id !== id));
      await supabase.from('plans').delete().eq('id', id);
    }
  };

  const handleSaveRecord = async (recordData: Omit<ReferralRecord, 'id' | 'createdAt'>) => {
    if (editingRecord) {
      if (isRecordReadOnly(editingRecord)) {
        alert("Este lote pertence a uma campanha encerrada e não pode ser editado.");
        return;
      }
      try {
        // ── Merge seguro para ambientes multiusuário ──────────────────
        // 1. Busca a versão ATUAL do registro no banco antes de salvar
        const { data: freshData, error: fetchErr } = await supabase
          .from('referral_records')
          .select('contacts')
          .eq('id', editingRecord.id)
          .single();

        if (fetchErr) throw fetchErr;

        const dbContacts: ContactPerson[] = freshData?.contacts || [];

        // IDs de contatos que existiam quando o modal foi aberto
        const originalIds = new Set((editingRecord.contacts || []).map((c: ContactPerson) => c.id));
        // IDs de contatos que o usuário está submetendo agora
        const submittedIds = new Set((recordData.contacts || []).map((c: ContactPerson) => c.id));

        // Contatos NOVOS adicionados por outros usuários no banco (não estavam no estado original)
        const contactsAddedByOthers = dbContacts.filter(c => !originalIds.has(c.id));

        // Contatos que o usuário atual submeteu (pode ter adicionado, editado ou removido)
        const userContacts = recordData.contacts || [];

        // Contatos do banco que o usuário não removeu explicitamente (merge das edições do usuário)
        // Mantém edições do usuário (status, notes) se o ID existir nos dois lados
        const mergedExistingContacts = dbContacts
          .filter(c => submittedIds.has(c.id)) // o usuário não removeu
          .map(c => {
            const userVersion = userContacts.find(uc => uc.id === c.id);
            return userVersion ? { ...c, ...userVersion } : c; // aplica edições do usuário
          });

        // Contatos novos adicionados pelo usuário atual (IDs que não existiam originalmente)
        const newContactsFromUser = userContacts.filter(c => !originalIds.has(c.id));

        // Lista final: contatos mesclados + novos do usuário atual + novos de outros usuários
        const finalContacts: ContactPerson[] = [
          ...mergedExistingContacts,
          ...newContactsFromUser,
          ...contactsAddedByOthers,
        ];

        const updatedRecord = {
          ...editingRecord,
          ...recordData,
          contacts: finalContacts,
        };

        // Atualiza estado local com o merge
        setRecords(records.map(r => r.id === editingRecord.id ? updatedRecord : r));

        const { error } = await supabase
          .from('referral_records')
          .update(updatedRecord)
          .eq('id', updatedRecord.id);

        if (error) throw error;
      } catch (err) {
        console.error("Erro ao atualizar registro:", err);
        alert("Erro ao salvar alterações no servidor!");
        loadAppData();
      }
    } else {
      if (!activeCampaign) {
        alert("Não há nenhuma campanha ativa. Crie uma campanha antes de cadastrar novos leads.");
        return;
      }
      const newRecord: ReferralRecord = {
        ...recordData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        createdByName: currentUser.name,
        campaign_id: activeCampaign.id,
      };
      setRecords([newRecord, ...records]);
      try {
        const { error } = await supabase.from('referral_records').insert([newRecord]);
        if (error) throw error;
      } catch (err) {
        console.error("Erro ao inserir registro:", err);
        alert("Erro ao criar novo registro no servidor!");
        loadAppData();
      }
    }
  };

  const handleCopyPhone = (phone: string, id: string) => {
    const clean = cleanPhone(phone);
    navigator.clipboard.writeText(clean);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleUpdateBatchBarber = async (batchId: string, newBarberId: string) => {
    const record = records.find(r => r.id === batchId);
    if (record && isRecordReadOnly(record)) {
      alert("Este lote pertence a uma campanha encerrada e não pode ser alterado.");
      return;
    }

    const selectedBarber = barbers.find(b => b.id === newBarberId);
    if (!selectedBarber) return;

    // Atualiza estado local para feedback instantâneo
    setRecords(prev => prev.map(r => 
      r.id === batchId ? { ...r, barberId: selectedBarber.id, barberName: selectedBarber.name } : r
    ));

    try {
      const { error } = await supabase
        .from('referral_records')
        .update({ 
          barberId: selectedBarber.id, 
          barberName: selectedBarber.name 
        })
        .eq('id', batchId);
      
      if (error) throw error;
    } catch (err) {
      console.error("Erro ao atualizar barbeiro:", err);
      alert("Erro ao salvar alteração do barbeiro no servidor.");
      loadAppData();
    }
  };

  const updateContactData = async (recordId: string, contactId: string, updates: Partial<ContactPerson>) => {
    const record = records.find(r => r.id === recordId);
    if (record && isRecordReadOnly(record)) {
      alert("Este lote pertence a uma campanha encerrada e não pode ser alterado.");
      return;
    }

    let updatedRecordToSave: ReferralRecord | null = null;
    
    setRecords(records.map(rec => {
      if (rec.id === recordId) {
        const newContacts = rec.contacts.map(contact => {
          if (contact.id === contactId) {
            const updatedContact = { ...contact, ...updates };
            
            // Sincroniza campos legados com o novo sistema de status
            if (updates.status) {
              if (updates.status === 'converted') {
                updatedContact.subscriptionClosed = true;
                updatedContact.called = true;
                const timeString = new Date().toISOString().split('T')[1] || '00:00:00.000Z';
                if (!updatedContact.calledAt) updatedContact.calledAt = `${selectedDate}T${timeString}`;
                if (!updatedContact.activationDate) {
                  updatedContact.activationDate = new Date().toISOString().split('T')[0];
                }
                if (updatedContact.fidelimaxStatus === 'not_applicable' || !updatedContact.fidelimaxStatus) {
                  updatedContact.fidelimaxStatus = 'pending';
                }
              } else if (updates.status === 'pending') {
                updatedContact.subscriptionClosed = false;
                updatedContact.called = false;
                updatedContact.calledAt = undefined;
                updatedContact.activationDate = undefined;
                updatedContact.cardNumber = undefined;
                updatedContact.fidelimaxStatus = 'not_applicable';
              } else {
                // contacted, no_response, declined, etc.
                updatedContact.subscriptionClosed = false;
                updatedContact.called = true;
                const timeString = new Date().toISOString().split('T')[1] || '00:00:00.000Z';
                if (!updatedContact.calledAt) updatedContact.calledAt = `${selectedDate}T${timeString}`;
                updatedContact.activationDate = undefined;
                updatedContact.cardNumber = undefined;
                updatedContact.fidelimaxStatus = 'not_applicable';
              }
            }
            
            return updatedContact;
          }
          return contact;
        });
        
        const updated = { ...rec, contacts: newContacts };
        updatedRecordToSave = updated;
        return updated;
      }
      return rec;
    }));

    if (updatedRecordToSave) {
      try {
        // @ts-ignore
        const { error } = await supabase.from('referral_records').update({ contacts: updatedRecordToSave.contacts }).eq('id', updatedRecordToSave.id);
        if (error) throw error;
      } catch (err) {
        console.error("Erro ao atualizar contato:", err);
        alert("Falha ao salvar alteração no banco de dados.");
        loadAppData(); // Recarrega para não ficar com dado falso na tela
      }
    }
  };

  const handleSaveLead = async (updatedContact: ContactPerson, newBarberId: string) => {
    if (!editingLeadRecord || !editingLead) return;

    const recordId = editingLeadRecord.id;
    const contactId = editingLead.id;

    const selectedBarber = barbers.find(b => b.id === newBarberId);
    const barberName = selectedBarber?.name || editingLeadRecord.barberName;

    // Atualiza estado local
    setRecords(prev => prev.map(rec => {
      if (rec.id !== recordId) return rec;
      return {
        ...rec,
        barberId: newBarberId,
        barberName,
        contacts: rec.contacts.map(c => c.id === contactId ? updatedContact : c)
      };
    }));

    // Persiste no Supabase
    try {
      const record = records.find(r => r.id === recordId);
      if (record) {
        const updatedContacts = record.contacts.map(c => c.id === contactId ? updatedContact : c);
        const { error } = await supabase
          .from('referral_records')
          .update({ 
            barberId: newBarberId,
            barberName,
            contacts: updatedContacts 
          })
          .eq('id', recordId);
        
        if (error) throw error;
      }
    } catch (err) {
      console.error("Erro ao salvar lead:", err);
      alert("Erro ao salvar alterações no servidor.");
      loadAppData();
    }
  };

  /**
   * Salva UM contato diretamente no banco usando merge seguro.
   * Chamado imediatamente ao clicar "Incluir" no modal de edição,
   * garantindo que o contato persista mesmo que o realtime recarregue os dados.
   */
  const handleAddContactImmediate = async (recordId: string, newContact: ContactPerson) => {
    const record = records.find(r => r.id === recordId);
    if (record && isRecordReadOnly(record)) {
      alert("Este lote pertence a uma campanha encerrada e não pode ser alterado.");
      return;
    }

    // Busca contatos atuais do banco para fazer merge sem sobrescrever
    const { data: freshData, error: fetchErr } = await supabase
      .from('referral_records')
      .select('contacts')
      .eq('id', recordId)
      .single();

    if (fetchErr) throw fetchErr;

    const currentContacts: ContactPerson[] = freshData?.contacts || [];

    // Evita duplicata caso já tenha sido salvo por outra operação
    if (currentContacts.some(c => c.id === newContact.id)) return;

    const updatedContacts = [...currentContacts, newContact];

    const { error } = await supabase
      .from('referral_records')
      .update({ contacts: updatedContacts })
      .eq('id', recordId);

    if (error) throw error;

    // Atualiza estado local para refletir imediatamente
    setRecords(prev => prev.map(r =>
      r.id === recordId ? { ...r, contacts: updatedContacts } : r
    ));
  };

  const handleDelete = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (record && isRecordReadOnly(record)) {
      alert("Este lote pertence a uma campanha encerrada e não pode ser excluído.");
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este lote de indicações?')) {
      setRecords(records.filter(r => r.id !== id));
      await supabase.from('referral_records').delete().eq('id', id);
    }
  };

  const handleDeleteContact = async (batchId: string, contactId: string) => {
    const record = records.find(r => r.id === batchId);
    if (record && isRecordReadOnly(record)) {
      alert("Este lote pertence a uma campanha encerrada e não pode ser editado.");
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este lead?')) {
      const updatedContacts = (record?.contacts || []).filter(c => c.id !== contactId);
      
      // Atualiza estado local
      setRecords(records.map(r => r.id === batchId ? { ...r, contacts: updatedContacts } : r));

      try {
        const { error } = await supabase
          .from('referral_records')
          .update({ contacts: updatedContacts })
          .eq('id', batchId);

        if (error) throw error;
      } catch (err) {
        console.error("Erro ao excluir lead:", err);
        alert("Erro ao excluir lead do servidor. Tente novamente.");
        loadAppData();
      }
    }
  };

  const handleDeleteClient = async (cpf: string, name: string) => {
    const clientBatches = records.filter(r => cleanCPF(r.clientCpf) === cleanCPF(cpf));
    const hasReadOnlyBatch = clientBatches.some(b => isRecordReadOnly(b));
    if (hasReadOnlyBatch) {
      alert(`O indicador "${name}" possui indicações pertencentes a uma campanha encerrada e não pode ser excluído.`);
      return;
    }

    if (window.confirm(`AVISO: Deseja excluir o indicador "${name}" e TODAS as indicações dele? Esta ação não pode ser desfeita.`)) {
      // Filtra localmente
      setRecords(records.filter(r => cleanCPF(r.clientCpf) !== cleanCPF(cpf)));
      // Deleta no banco
      const { error } = await supabase
        .from('referral_records')
        .delete()
        .eq('clientCpf', cpf);
      
      if (error) {
        console.error("Erro ao excluir indicador:", error);
        alert("Erro ao excluir. Tente novamente.");
        loadAppData(); // Recarrega para garantir sincronia
      }
    }
  };

  const openEditModal = (record: ReferralRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    if (!activeCampaign) {
      alert("Não há nenhuma campanha ativa. Crie uma campanha antes de cadastrar novos leads.");
      return;
    }
    setEditingRecord(null);
    setPreFilledClient(null);
    setIsModalOpen(true);
  };

  const openNewModalWithClient = (cpf: string, name: string) => {
    if (!activeCampaign) {
      alert("Não há nenhuma campanha ativa. Crie uma campanha antes de cadastrar novos leads.");
      return;
    }
    setEditingRecord(null);
    setPreFilledClient({ cpf, name });
    setIsModalOpen(true);
  };

  const campaignFilteredRecords = useMemo(() => {
    if (selectedCampaignId === 'all') return records;
    return records.filter(r => r.campaign_id === selectedCampaignId);
  }, [records, selectedCampaignId]);

  const filteredRecordsForList = useMemo(() => {
    return campaignFilteredRecords.map(record => {
      // 1. Filtragem por data de criação do lote
      if (filterStartDate || filterEndDate) {
        const recordDate = record.createdAt ? new Date(record.createdAt) : new Date('2024-01-01');
        if (filterStartDate) {
          const start = new Date(filterStartDate + 'T00:00:00');
          if (recordDate < start) return null;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate + 'T23:59:59');
          if (recordDate > end) return null;
        }
      }

      // 2. Filtragem por barbeiro
      if (filterBarberId !== 'all' && record.barberId !== filterBarberId) {
        return null;
      }

      // 3. Filtragem por contatos (status, vendedor, fidelimax)
      const validContacts = record.contacts || [];
      const matchingContacts = validContacts.filter(contact => {
        if (filterStatus !== 'all') {
          const cStatus = contact.status || (contact.subscriptionClosed ? 'converted' : contact.called ? 'contacted' : 'pending');
          if (cStatus !== filterStatus) return false;
        }
        if (filterSellerId !== 'all' && contact.sellerId !== filterSellerId) {
          return false;
        }
        if (filterFidelimax !== 'all') {
          const fStatus = contact.fidelimaxStatus || 'pending';
          if (fStatus !== filterFidelimax) return false;
        }
        return true;
      });

      if ((filterStatus !== 'all' || filterSellerId !== 'all' || filterFidelimax !== 'all') && matchingContacts.length === 0) {
        return null;
      }

      return {
        ...record,
        contacts: matchingContacts
      };
    }).filter((r): r is ReferralRecord => r !== null);
  }, [campaignFilteredRecords, filterStatus, filterBarberId, filterSellerId, filterFidelimax, filterStartDate, filterEndDate]);

  const clientGroups = useMemo(() => {
    const groups: Record<string, {
      clientName: string;
      clientCpf: string;
      batches: ReferralRecord[];
    }> = {};

    filteredRecordsForList.forEach(record => {
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
  }, [filteredRecordsForList]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return clientGroups;
    const query = searchQuery.toLowerCase();
    const cleanQuery = cleanCPF(searchQuery);
    
    return clientGroups.filter(group => {
      const matchName = group.clientName?.toLowerCase().includes(query);
      const matchCpf = cleanQuery.length > 0 && group.clientCpf && cleanCPF(group.clientCpf).includes(cleanQuery);
      const matchBarber = group.batches.some(b => b.barberName?.toLowerCase().includes(query));
      const matchLead = group.batches.some(b => b.contacts?.some(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (cleanQuery.length > 0 && c.phone && cleanPhone(c.phone).includes(cleanQuery))
      ));
      
      return !!(matchName || matchCpf || matchBarber || matchLead);
    });
  }, [clientGroups, searchQuery]);

  const stats = useMemo(() => {
    const allContacts = filteredRecordsForList.flatMap(r => r.contacts || []);
    const calledTotal = allContacts.filter(c => c.status && c.status !== 'pending').length;
    const converted = allContacts.filter(c => c.status === 'converted' || c.subscriptionClosed).length;
    const noResponse = allContacts.filter(c => c.status === 'no_response').length;
    
    const calledToday = allContacts.filter(c => 
      c.status && 
      c.status !== 'pending' && 
      c.calledAt?.split('T')[0] === selectedDate
    ).length;

    const closedToday = allContacts.filter(c => 
      (c.status === 'converted' || c.subscriptionClosed) && 
      c.activationDate === selectedDate
    ).length;

    return {
      totalClients: new Set(filteredRecordsForList.map(r => cleanCPF(r.clientCpf))).size,
      totalLeads: allContacts.length,
      closedSubscriptions: converted,
      closedToday,
      leadsToCall: allContacts.filter(c => !c.status || c.status === 'pending').length,
      calledToday,
      conversionRate: allContacts.length > 0 ? Math.round((converted / allContacts.length) * 100) : 0,
      noResponseRate: calledTotal > 0 ? Math.round((noResponse / calledTotal) * 100) : 0,
    };
  }, [filteredRecordsForList, selectedDate]);

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
              {currentUser.isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'users' 
                      ? 'bg-zinc-800 text-brand' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Usuários
                </button>
              )}
              {currentUser.isAdmin && (
                <button
                  onClick={() => setActiveTab('configuracoes')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'configuracoes' 
                      ? 'bg-zinc-800 text-brand' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  Configurações
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
            currentUser={currentUser!} 
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
          <DashboardTab records={campaignFilteredRecords} sellers={sellers} />
        ) : activeTab === 'configuracoes' && currentUser.isAdmin ? (
          <ConfigTab
            sellers={sellers}
            plans={plans}
            records={records}
            currentUser={currentUser}
            onAddSeller={handleAddSeller}
            onUpdateSeller={handleUpdateSeller}
            onRemoveSeller={handleRemoveSeller}
            onAddPlan={handleAddPlan}
            onUpdatePlan={handleUpdatePlan}
            onRemovePlan={handleRemovePlan}
          />
        ) : (
          <>
            {/* Stats & Filter Row */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
                    <CalendarDays className="w-5 h-5 text-brand" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent border-none text-zinc-100 focus:outline-none text-sm font-medium cursor-pointer"
                    />
                  </div>

                  {/* Seletor de Campanha */}
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5">
                    <span className="text-xs text-zinc-500 font-medium ml-1">Campanha:</span>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="bg-transparent border-none text-zinc-200 focus:outline-none text-sm font-semibold cursor-pointer py-1 pr-6"
                    >
                      <option value="all" className="bg-zinc-900 text-zinc-100">Todas as Campanhas</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">
                          {c.name} {c.status === 'active' ? '(Ativa)' : '(Encerrada)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Botão administrativo para gerenciar campanhas */}
                  {currentUser.isAdmin && (
                    <button
                      onClick={() => setIsCampaignModalOpen(true)}
                      className="flex items-center gap-2 bg-zinc-900 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-zinc-800 hover:bg-zinc-800 transition-all"
                      title="Gerenciar Campanhas"
                    >
                      <Flag className="w-4 h-4 text-brand" />
                      <span className="hidden sm:inline">Gerenciar Campanhas</span>
                    </button>
                  )}
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
                      placeholder="Buscar por nome, barbeiro, CPF ou celular..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-zinc-800 rounded-xl leading-5 bg-zinc-900 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-all sm:text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportToPDF(filteredRecordsForList, sellers)}
                      className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700 cursor-pointer"
                      title="Exportar para PDF"
                    >
                      <FileText className="w-4 h-4 text-red-400" />
                      <span className="hidden lg:inline">PDF</span>
                    </button>
                    {(currentUser.isAdmin || currentUser.permissions?.includes('export_data')) && (
                      <button
                        onClick={() => exportToExcel(filteredRecordsForList, sellers)}
                        className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-zinc-700 hover:text-zinc-100 transition-colors border border-zinc-700 cursor-pointer"
                        title="Exportar para Excel"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span className="hidden lg:inline">Excel</span>
                      </button>
                    )}
                    <button
                      onClick={() => { loadAppData(); }}
                      className="p-2.5 bg-zinc-800 text-zinc-400 rounded-xl hover:text-zinc-100 transition-colors border border-zinc-700"
                      title="Sincronizar Manualmente"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
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

              {/* Filtros Avançados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-xl">
                
                {/* Filtro Status */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Status ROI</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand cursor-pointer h-9"
                  >
                    <option value="all">Todos os Status</option>
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

                {/* Filtro Barbeiro */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Barbeiro</label>
                  <select
                    value={filterBarberId}
                    onChange={(e) => setFilterBarberId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand cursor-pointer h-9"
                  >
                    <option value="all">Todos os Barbeiros</option>
                    {barbers.map(barber => (
                      <option key={barber.id} value={barber.id}>{barber.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Vendedor */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Vendedor</label>
                  <select
                    value={filterSellerId}
                    onChange={(e) => setFilterSellerId(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand cursor-pointer h-9"
                  >
                    <option value="all">Todos os Vendedores</option>
                    {sellers.map(seller => (
                      <option key={seller.id} value={seller.id}>{seller.name}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro Fidelimax */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Status Fidelimax</label>
                  <select
                    value={filterFidelimax}
                    onChange={(e) => setFilterFidelimax(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand cursor-pointer h-9"
                  >
                    <option value="all">Todos os Status</option>
                    <option value="pending">Pendente</option>
                    <option value="launched">Lançado ✅</option>
                    <option value="not_applicable">Não se aplica 🚫</option>
                  </select>
                </div>

                {/* Data Inicial */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Data Cadastro (De)</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:invert h-9 cursor-pointer"
                  />
                </div>

                {/* Data Final */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1">Data Cadastro (Até)</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-brand [&::-webkit-calendar-picker-indicator]:invert h-9 cursor-pointer"
                  />
                </div>

              </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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
                <p className="text-xs font-medium uppercase tracking-wider">Leads Inseridos</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{stats.totalLeads}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-brand">
                <CheckCircle2 className="w-4 h-4 text-red-500" />
                <p className="text-xs font-medium uppercase tracking-wider">Assinaturas Fechadas</p>
              </div>
              <p className="text-2xl font-bold text-brand">{stats.closedSubscriptions}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2 border-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-xs font-medium uppercase tracking-wider">Fechadas Hoje</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{stats.closedToday}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-blue-400">
                <PhoneCall className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">A Chamar</p>
              </div>
              <p className="text-2xl font-bold text-blue-400">{stats.leadsToCall}</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-400">
                <PhoneForwarded className="w-4 h-4" />
                <p className="text-xs font-medium uppercase tracking-wider">Chamados Hoje</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{stats.calledToday}</p>
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
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs text-zinc-400">
                      <span className="font-mono">
                        {detectIdentifierType(group.clientCpf) === 'cpf' ? 'CPF' : 'Celular'}: {group.clientCpf}
                      </span>
                      <span className="hidden sm:inline text-zinc-700">•</span>
                      <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20 font-medium">
                        Leads Inseridos: {group.batches.reduce((acc, b) => acc + (b.contacts?.length || 0), 0)}
                      </span>
                      <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                        Assinaturas Fechadas: {group.batches.reduce((acc, b) => acc + (b.contacts?.filter(c => c.status === 'converted' || c.subscriptionClosed).length || 0), 0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportGroupToPDF(group.clientName, group.clientCpf, group.batches, sellers)}
                      className="flex items-center gap-2 bg-zinc-800 text-zinc-300 hover:text-red-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 cursor-pointer"
                      title="Exportar Indicador para PDF"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="hidden sm:inline">Exportar PDF</span>
                    </button>
                    {currentUser.isAdmin && (
                      <button
                        onClick={() => exportGroupToPDFAdmin(group.clientName, group.clientCpf, group.batches, sellers, plans)}
                        className="flex items-center gap-2 bg-zinc-800 text-amber-400 hover:text-amber-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700 cursor-pointer"
                        title="Exportar PDF Completo (Financeiro/Planos/Cartões)"
                      >
                        <FileText className="w-4 h-4 text-amber-500" />
                        <span className="hidden sm:inline">PDF Admin</span>
                      </button>
                    )}
                    <button
                      onClick={() => openNewModalWithClient(group.clientCpf, group.clientName)}
                      className="flex items-center gap-2 bg-zinc-800 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors border border-zinc-700"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Adicionar Leads</span>
                    </button>
                    <button
                      onClick={() => handleDeleteClient(group.clientCpf, group.clientName)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Excluir Indicador e todos os leads"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Leads Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-800">
                    <thead className="bg-zinc-950/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Lead</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Telefone</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Barbeiro</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Vendedor</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status ROI</th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status Fidelimax</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
                      {group.batches.flatMap(batch => 
                        (batch.contacts || []).map(contact => (
                          <tr key={contact.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-zinc-200">{contact.name}</td>
                            <td className="px-6 py-3 whitespace-nowrap">
                               <button
                                 onClick={() => handleCopyPhone(contact.phone, contact.id)}
                                 className={`inline-flex items-center gap-1.5 text-sm font-medium transition-all px-2.5 py-1 rounded-md border ${
                                   copyFeedback === contact.id 
                                     ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                     : 'bg-zinc-800/50 text-zinc-300 border-zinc-700/50 hover:bg-zinc-800 hover:text-white'
                                 }`}
                                 title="Clique para copiar o número"
                               >
                                 {copyFeedback === contact.id ? (
                                   <>
                                     <Check className="w-4 h-4" />
                                     Copiado!
                                   </>
                                 ) : (
                                   <>
                                     <Copy className="w-4 h-4" />
                                     {contact.phone}
                                   </>
                                 )}
                               </button>
                             </td>
                             <td className="px-6 py-3 whitespace-nowrap text-sm text-zinc-400">
                               <select
                                 disabled={isRecordReadOnly(batch)}
                                 value={batch.barberId || ''}
                                 onChange={(e) => handleUpdateBatchBarber(batch.id, e.target.value)}
                                 className="bg-transparent border-none text-zinc-400 hover:text-zinc-100 focus:text-zinc-100 focus:outline-none cursor-pointer p-0 w-full disabled:cursor-not-allowed disabled:text-zinc-600"
                               >
                                 <option value="" disabled className="bg-zinc-900 text-zinc-500">Selecione...</option>
                                 {barbers.map(barber => (
                                   <option key={barber.id} value={barber.id} className="bg-zinc-900 text-zinc-100">
                                     {barber.name}
                                   </option>
                                 ))}
                               </select>
                             </td>
                             <td className="px-6 py-3 whitespace-nowrap text-sm text-zinc-400">
                               <select
                                 disabled={isRecordReadOnly(batch)}
                                 value={contact.sellerId || ''}
                                 onChange={(e) => updateContactData(batch.id, contact.id, { sellerId: e.target.value })}
                                 className="bg-transparent border-none text-zinc-400 hover:text-zinc-100 focus:text-zinc-100 focus:outline-none cursor-pointer p-0 w-full disabled:cursor-not-allowed disabled:text-zinc-600"
                               >
                                 <option value="" className="bg-zinc-900 text-zinc-500">Sem Vendedor...</option>
                                 {sellers.filter(s => s.is_active).map(seller => (
                                   <option key={seller.id} value={seller.id} className="bg-zinc-900 text-zinc-100">
                                     {seller.name}
                                   </option>
                                 ))}
                               </select>
                             </td>
                             <td className="px-6 py-3 whitespace-nowrap text-center">
                               <div className="inline-flex items-center gap-1.5 justify-center">
                                 <select
                                   disabled={isRecordReadOnly(batch)}
                                   value={contact.status || (contact.subscriptionClosed ? 'converted' : contact.called ? 'contacted' : 'pending')}
                                   onChange={(e) => updateContactData(batch.id, contact.id, { status: e.target.value as any })}
                                   className={`text-xs font-bold rounded-md px-2 py-1 bg-zinc-800 border focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${
                                     contact.status === 'converted' || contact.subscriptionClosed ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                     contact.status === 'no_response' ? 'text-orange-400 border-orange-500/30 bg-orange-500/10' :
                                     contact.status === 'declined' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                     contact.status === 'invalid_number' ? 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' :
                                     contact.status === 'frequent' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                     contact.status === 'scheduled' ? 'text-purple-400 border-purple-500/30 bg-purple-500/10' :
                                     contact.status === 'contacted' || contact.called ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
                                     'text-zinc-500 border-zinc-700'
                                   }`}
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

                                 {(contact.status === 'converted' || contact.subscriptionClosed) && (
                                   <select
                                     disabled={isRecordReadOnly(batch)}
                                     value={contact.planId || ''}
                                     onChange={(e) => updateContactData(batch.id, contact.id, { planId: e.target.value })}
                                     className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[10px] text-zinc-350 focus:outline-none focus:border-brand cursor-pointer h-7"
                                     title="Selecionar Plano"
                                   >
                                     <option value="">Plano...</option>
                                     {plans.filter(p => p.is_active || p.id === contact.planId).map(plan => (
                                       <option key={plan.id} value={plan.id} className="bg-zinc-900 text-zinc-100">
                                         {plan.name}
                                       </option>
                                     ))}
                                   </select>
                                 )}
                               </div>
                             </td>
                             <td className="px-6 py-3 whitespace-nowrap text-center">
                               <select
                                 disabled={isRecordReadOnly(batch)}
                                 value={contact.fidelimaxStatus || 'pending'}
                                 onChange={(e) => updateContactData(batch.id, contact.id, { fidelimaxStatus: e.target.value as any })}
                                 className={`text-xs font-bold rounded-md px-2 py-1 bg-zinc-800 border focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${
                                   contact.fidelimaxStatus === 'launched' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                   contact.fidelimaxStatus === 'not_applicable' ? 'text-zinc-500 border-zinc-800/50 bg-zinc-950' :
                                   'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                                 }`}
                               >
                                 <option value="pending">Pendente</option>
                                 <option value="launched">Lançado ✅</option>
                                 <option value="not_applicable">Não se aplica 🚫</option>
                                </select>
                             </td>
                             <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  setEditingLead(contact);
                                  setEditingLeadRecord(batch);
                                  setIsLeadEditModalOpen(true);
                                }}
                                className="text-zinc-500 hover:text-brand transition-colors p-1"
                                title="Editar Lead"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {!isRecordReadOnly(batch) && (
                                <button
                                  onClick={() => handleDeleteContact(batch.id, contact.id)}
                                  className="text-zinc-500 hover:text-red-500 transition-colors p-1 ml-2"
                                  title="Excluir Lead"
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
                          <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-500">
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
        onAddContact={handleAddContactImmediate}
        initialData={editingRecord}
        isReadOnly={isRecordReadOnly(editingRecord)}
        records={records}
        barbers={barbers}
        sellers={sellers}
        preFilledClient={preFilledClient}
        activeCampaignId={activeCampaign?.id}
      />

      <LeadEditModal
        isOpen={isLeadEditModalOpen}
        onClose={() => setIsLeadEditModalOpen(false)}
        onSave={handleSaveLead}
        contact={editingLead}
        clientName={editingLeadRecord?.clientName || ''}
        clientCpf={editingLeadRecord?.clientCpf || ''}
        currentBarberId={editingLeadRecord?.barberId || ''}
        barbers={barbers}
        sellers={sellers}
        plans={plans}
        isReadOnly={isRecordReadOnly(editingLeadRecord)}
        records={records}
        campaignId={editingLeadRecord?.campaign_id}
      />

      {/* Campaign Manager Modal */}
      {isCampaignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
                <Flag className="w-5 h-5 text-brand" />
                Gerenciar Campanhas
              </h2>
              <button
                onClick={() => setIsCampaignModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Iniciar nova campanha */}
              <form onSubmit={handleStartCampaign} className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Iniciar Nova Campanha</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    placeholder="Nome da nova campanha..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                  />
                  <button
                    type="submit"
                    className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-light transition-colors"
                  >
                    Iniciar
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Nota: Iniciar uma nova campanha irá encerrar automaticamente qualquer campanha atualmente ativa.
                </p>
              </form>

              <hr className="border-zinc-800" />

              {/* Lista de campanhas existentes */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Campanhas Recentes</h3>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">Nenhuma campanha cadastrada.</p>
                  ) : (
                    campaigns.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-zinc-200">{c.name}</span>
                          <span className="text-xs text-zinc-500">
                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div>
                          {c.status === 'active' ? (
                            <button
                              onClick={() => handleEndCampaign(c.id)}
                              className="px-2.5 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/25 border border-red-500/20 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Encerrar
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-xs font-semibold uppercase bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-md">
                                Encerrada
                              </span>
                              {(currentUser?.isAdmin || currentUser?.role === 'admin') && (
                                <button
                                  onClick={() => handleDeleteCampaign(c.id, c.name)}
                                  className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all cursor-pointer"
                                  title="Excluir Campanha e Contatos"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
