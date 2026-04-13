import { User } from './types';
import { supabase } from './supabaseClient';

const CURRENT_USER_KEY = '@barber-contacts:currentUser';

export const getStoredUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Failed to fetch users', error);
    return [];
  }
  return data || [];
};

export const saveUser = async (user: User) => {
  const { error } = await supabase
    .from('users')
    .upsert(user, { onConflict: 'email' });
  if (error) {
    console.error('Failed to save user', error);
  }
};

export const removeUser = async (id: string) => {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) {
    console.error('Failed to remove user', error);
  }
};

export const getStoredCurrentUser = (): User | null => {
  const saved = localStorage.getItem(CURRENT_USER_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse current user', e);
    }
  }
  return null;
};

export const saveCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};
