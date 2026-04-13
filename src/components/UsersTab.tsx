import React, { useState } from 'react';
import { User } from '../types';
import { Shield, User as UserIcon, Plus, Trash2, Key, Check, X } from 'lucide-react';

interface UsersTabProps {
  users: User[];
  onAddUser: (user: Omit<User, 'id'>) => void;
  onRemoveUser: (id: string) => void;
  onUpdateUser: (id: string, data: Partial<User>) => void;
  currentUser: User;
}

export function UsersTab({ users, onAddUser, onRemoveUser, onUpdateUser, currentUser }: UsersTabProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');

  const handleUpdatePassword = (id: string) => {
    if (!editPassword.trim()) return;
    onUpdateUser(id, { password: editPassword });
    setEditingUserId(null);
    setEditPassword('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;
    
    onAddUser({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
      isAdmin
    });
    
    setName('');
    setEmail('');
    setPassword('');
    setIsAdmin(false);
  };

  return (
    <div className="space-y-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Plus className="w-5 h-5 text-brand" />
            Cadastrar Novo Usuário
          </h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                placeholder="Nome do usuário"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                placeholder="••••••"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer mt-6">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-700 text-red-600 focus:ring-red-600/50 bg-zinc-950"
                />
                <span className="text-sm font-medium text-zinc-300">Privilégios de Administrador</span>
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-light transition-colors shadow-lg shadow-brand/20"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Usuário
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-brand" />
            Usuários Cadastrados
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-zinc-950/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nível</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-200">{user.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-400">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isAdmin ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                        <Shield className="w-3.5 h-3.5" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <UserIcon className="w-3.5 h-3.5" />
                        Padrão
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingUserId === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="text"
                          placeholder="Nova senha"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs w-28 focus:outline-none focus:border-brand"
                        />
                        <button
                          onClick={() => handleUpdatePassword(user.id)}
                          className="text-emerald-500 hover:text-emerald-400 transition-colors p-1 bg-emerald-500/10 rounded"
                          title="Salvar senha"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingUserId(null); setEditPassword(''); }}
                          className="text-red-500 hover:text-red-400 transition-colors p-1 bg-red-500/10 rounded"
                          title="Cancelar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingUserId(user.id); setEditPassword(''); }}
                          className="text-zinc-500 hover:text-brand transition-colors p-1"
                          title="Alterar Senha"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => onRemoveUser(user.id)}
                            className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                            title="Remover Usuário"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
