import { useEffect, useState } from 'react';
import { usersApi } from '../services/api';
import type { User } from '../services/apiTypes';
import { UserPlus, Search, ChevronLeft, ChevronRight, Edit, Trash2, MoreHorizontal, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Input, Badge, Modal, Dropdown } from '../components/UI';
import { useForm } from '../hooks/useForm';
import { cn, getRoleBadge, formatRelativeTime, getErrorMessage } from '../utils/helpers';
import toast from 'react-hot-toast';

interface UserForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  role: 'admin' | 'inspector' | 'auditor' | 'staff';
  department: string;
  phone: string;
  is_active: boolean;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { values, handleChange, setFieldValue, errors, resetForm } = useForm<UserForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'inspector',
    department: '',
    phone: '',
    is_active: true,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({ page, page_size: pageSize, search: search || undefined, role: roleFilter || undefined, is_active: statusFilter === '' ? undefined : statusFilter === 'active' });
      setUsers(res.data.data?.items || []);
      setTotal(res.data.data?.total || 0);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, search, roleFilter, statusFilter]);

  const openCreateModal = () => {
    resetForm();
    setEditingUser(null);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    resetForm();
    setEditingUser(user);
    setFieldValue('username', user.username);
    setFieldValue('email', user.email);
    setFieldValue('full_name', user.full_name);
    setFieldValue('role', user.role);
    setFieldValue('department', user.department || '');
    setFieldValue('phone', user.phone || '');
    setFieldValue('is_active', user.is_active);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) {
      if (values.password !== values.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          email: values.email,
          full_name: values.full_name,
          role: values.role,
          department: values.department || undefined,
          phone: values.phone || undefined,
          is_active: values.is_active,
        });
        toast.success('User updated');
      } else {
        await usersApi.create({
          username: values.username,
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          role: values.role,
          department: values.department || undefined,
          phone: values.phone || undefined,
        });
        toast.success('User created');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Operation failed'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await usersApi.delete(id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Delete failed'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await usersApi.update(user.id, { is_active: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to update'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">Manage system users and their roles</p>
        </div>
        <Button onClick={openCreateModal}>
          <UserPlus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                onKeyDown={e => e.key === 'Enter' && fetchUsers()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="inspector">Inspector</option>
              <option value="auditor">Auditor</option>
            </select>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Last Login</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-gray-500">Loading...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400">No users found</td>
                  </tr>
                )}
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">@{user.username} • {user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getRoleBadge(user.role).replace('text-', '').replace('bg-', '') as any} className={cn('capitalize', getRoleBadge(user.role))}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.department || '—'}</td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(user)}
                        className={cn('px-2 py-1', user.is_active ? 'text-success-600 hover:bg-success-50' : 'text-gray-500 hover:bg-gray-100')}
                      >
                        {user.is_active ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <UserX className="w-3.5 h-3.5 mr-1" />
                            Inactive
                          </>
                        )}
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {user.last_login_at ? formatRelativeTime(user.last_login_at) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <Dropdown
                        trigger={<Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>}
                        items={[
                          { label: 'Edit', onClick: () => openEditModal(user), icon: <Edit className="w-4 h-4" /> },
                          { label: user.is_active ? 'Deactivate' : 'Activate', onClick: () => toggleActive(user), icon: user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" /> },
                          { label: 'Delete', onClick: () => handleDelete(user.id), icon: <Trash2 className="w-4 h-4" />, danger: true },
                        ]}
                        align="right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {total > pageSize && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= total}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            id="full_name"
            value={values.full_name}
            onChange={handleChange}
            error={errors.full_name}
            required
          />
          <Input
            label="Username"
            id="username"
            value={values.username}
            onChange={handleChange}
            error={errors.username}
            required
            disabled={!!editingUser}
          />
          <Input
            label="Email"
            id="email"
            type="email"
            value={values.email}
            onChange={handleChange}
            error={errors.email}
            required
            disabled={!!editingUser}
          />
          {!editingUser && (
            <>
              <Input
                label="Password"
                id="password"
                type="password"
                value={values.password}
                onChange={handleChange}
                error={errors.password}
                required
              />
              <Input
                label="Confirm Password"
                id="confirmPassword"
                type="password"
                value={values.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                required
              />
            </>
          )}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              id="role"
              value={values.role}
              onChange={e => setFieldValue('role', e.target.value as UserForm['role'])}
              className="w-full px-3 py-2 rounded-lg border bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent border-gray-300"
            >
              <option value="admin">Admin</option>
              <option value="inspector">Inspector</option>
              <option value="auditor">Auditor</option>
              <option value="staff">Staff</option>
            </select>
            {errors.role && <p className="mt-1 text-sm text-danger-600" role="alert">{errors.role}</p>}
          </div>
          <Input
            label="Department (Optional)"
            id="department"
            value={values.department}
            onChange={handleChange}
          />
          <Input
            label="Phone (Optional)"
            id="phone"
            type="tel"
            value={values.phone}
            onChange={handleChange}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={values.is_active}
              onChange={e => setFieldValue('is_active', e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={deletingId !== null}>{editingUser ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}