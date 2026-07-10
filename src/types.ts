export interface ContactPerson {
  id: string;
  name: string;
  phone: string;
  subscriptionClosed?: boolean;
  called?: boolean;
  calledAt?: string;
  status?: 'pending' | 'contacted' | 'no_response' | 'declined' | 'scheduled' | 'converted' | 'invalid_number' | 'frequent';
  notes?: string;
  activationDate?: string;
  cardNumber?: string;
  fidelimaxStatus?: 'pending' | 'launched' | 'not_applicable';
  sellerId?: string; // ID do vendedor responsável
  planId?: string;   // ID do plano contratado
}

export interface Seller {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Plan {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'ended';
  created_at: string;
}

export interface ReferralRecord {
  id: string;
  clientName: string;
  clientCpf: string;
  barberName: string;
  barberId?: string;
  contactsProvided?: string; // Mantido para compatibilidade com registros antigos
  contacts: ContactPerson[];
  createdAt: string;
  createdByName?: string;
  campaign_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
  role?: string;
  permissions?: string[];
}

export interface Unit {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Barber {
  id: string;
  name: string;
  unit_id: string;
  cpf?: string;
  createdAt?: string;
}
