export interface ContactPerson {
  id: string;
  name: string;
  phone: string;
  subscriptionClosed?: boolean;
  called?: boolean;
  calledAt?: string;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  isAdmin: boolean;
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
  createdAt?: string;
}
