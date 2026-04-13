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
