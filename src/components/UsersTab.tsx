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

const AVAILABLE_PERMISSIONS = [
  { id: 'view_ranking', label: 'Visualizar Relatórios e Ranking' },
  { id: 'export_data', label: 'Exportar Excel/PDF' },
  { id: 'delete_records', label: 'Excluir Cadastros Permanentemente' },
];

export function UsersTab({ users, onAddUser, onRemoveUser, onUpdateUser, currentUser }: UsersTabProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  const handleToggleCreatePermission = (permId: string) => {
    setPermissions(prev => prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]);
  };

  const handleToggleEditPermission = (permId: string) => {
    setEditPermissions(prev => prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]);
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword('');
    setEditIsAdmin(user.isAdmin);
    setEditPermissions(user.permissions || []);
  };

  const handleUpdateFullUser = (id: string) => {
    const data: Partial<User> = {
      name: editName.trim(),
      email: editEmail.trim(),
      isAdmin: editIsAdmin,
      permissions: editPermissions
    };
    if (editPassword.trim()) {
      data.password = editPassword;
    }
    onUpdateUser(id, data);
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
      isAdmin,
      permissions
    });
    
    setName('');
    setEmail('');
    setPassword('');
    setIsAdmin(false);
    setPermissions([]);
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
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer mt-2 mb-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="w-5 h-5 rounded border-zinc-700 text-red-600 focus:ring-red-600/50 bg-zinc-900"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-zinc-100">Super Administrador (Acesso Total)</span>
                  <span className="text-xs text-zinc-500">Pode ver e modificar absolutamente tudo.</span>
                </div>
              </label>

              {!isAdmin && (
                <div className="space-y-3 p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                  <span className="text-sm font-medium text-zinc-300 block mb-2">Permissões Específicas:</span>
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={() => handleToggleCreatePermission(perm.id)}
                        className="w-4 h-4 rounded border-zinc-700 text-brand focus:ring-brand/50 bg-zinc-900"
                      />
                      <span className="text-sm text-zinc-400">{perm.label}</span>
                    </label>
                  ))}
                </div>
              )}
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
                    {editingUserId === user.id ? null : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEditing(user)}
                          className="text-zinc-500 hover:text-brand transition-colors p-1"
                          title="Editar Usuário"
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
              {/* Active Edit Row */}
              {users.map(user => editingUserId === user.id ? (
                <tr key={`edit-${user.id}`} className="bg-zinc-900 border-y border-brand/20">
                  <td colSpan={4} className="px-6 py-6">
                    <div className="flex flex-col gap-6 max-w-2xl">
                      <div className="flex items-center justify-between">
                        <h4 className="text-zinc-100 font-bold">Editando Acessos: {user.name}</h4>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdateFullUser(user.id)} className="flex items-center gap-2 bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-semibold hover:bg-emerald-600 transition-colors">
                            <Check className="w-4 h-4" /> Salvar Alterações
                          </button>
                          <button onClick={() => setEditingUserId(null)} className="flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded text-xs hover:bg-zinc-700 transition-colors">
                            <X className="w-4 h-4" /> Cancelar
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Nome</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-brand"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">E-mail</label>
                            <input
                              type="email"
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-brand"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Nova Senha (Opcional)</label>
                            <input
                              type="password"
                              placeholder="Deixe em branco para manter a atual"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-brand"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="flex items-center gap-3 cursor-pointer bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                            <input
                              type="checkbox"
                              checked={editIsAdmin}
                              onChange={(e) => setEditIsAdmin(e.target.checked)}
                              className="w-4 h-4 rounded border-zinc-700 text-red-600 focus:ring-red-600/50 bg-zinc-900"
                            />
                            <span className="text-sm font-bold text-zinc-100">Super Administrador</span>
                          </label>

                          {!editIsAdmin && (
                            <div className="space-y-2 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                              <span className="text-xs font-medium text-zinc-400 block mb-2">Permissões Grantidas:</span>
                              {AVAILABLE_PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editPermissions.includes(perm.id)}
                                    onChange={() => handleToggleEditPermission(perm.id)}
                                    className="w-3.5 h-3.5 rounded border-zinc-700 text-brand focus:ring-brand/50 bg-zinc-900"
                                  />
                                  <span className="text-sm text-zinc-300">{perm.label}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
