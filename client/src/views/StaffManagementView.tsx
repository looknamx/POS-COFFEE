import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Check,
  X,
  Lock,
  UserCheck
} from 'lucide-react';
import { StaffUser } from '../types';
import { apiRequest, formatThaiDateTime } from '../api/client';

export interface SystemUserAccount {
  id: number;
  username: string;
  full_name: string;
  role: 'OWNER' | 'CASHIER' | 'STOCK_MANAGER';
  is_active: number;
  last_login_at?: string;
  created_at?: string;
}

interface StaffManagementViewProps {
  currentStaff: StaffUser | null;
}

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({ currentStaff }) => {
  const [users, setUsers] = useState<SystemUserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserAccount | null>(null);

  // Form State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'CASHIER' | 'STOCK_MANAGER'>('CASHIER');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [userToDelete, setUserToDelete] = useState<SystemUserAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await apiRequest<SystemUserAccount[]>('/users');
    if (res.success && res.data) {
      setUsers(res.data);
    }
    setLoading(false);
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUsername('');
    setFullName('');
    setPassword('');
    setRole('CASHIER');
    setIsActive(true);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: SystemUserAccount) => {
    setEditingUser(user);
    setUsername(user.username);
    setFullName(user.full_name);
    setPassword(''); // Leave empty unless changing
    setRole(user.role);
    setIsActive(user.is_active === 1);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (editingUser) {
        // Update user
        const payload: any = {
          full_name: fullName.trim(),
          role,
          is_active: isActive ? 1 : 0
        };
        if (password.trim()) {
          if (password.trim().length < 4) {
            setErrorMsg('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
            setSubmitting(false);
            return;
          }
          payload.password = password.trim();
        }

        const res = await apiRequest(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        if (res.success) {
          setSuccessMsg('อัปเดตข้อมูลพนักงานสำเร็จ');
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setErrorMsg(res.message || 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
        }
      } else {
        // Create user
        if (!username.trim() || !password.trim() || !fullName.trim()) {
          setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วน');
          setSubmitting(false);
          return;
        }

        if (password.trim().length < 4) {
          setErrorMsg('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
          setSubmitting(false);
          return;
        }

        const res = await apiRequest('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: username.trim().toLowerCase(),
            password: password.trim(),
            full_name: fullName.trim(),
            role
          })
        });

        if (res.success) {
          setSuccessMsg('สร้างบัญชีพนักงานใหม่เรียบร้อยแล้ว');
          setIsModalOpen(false);
          fetchUsers();
        } else {
          setErrorMsg(res.message || 'เกิดข้อผิดพลาดในการสร้างบัญชี');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleToggleStatus = async (user: SystemUserAccount) => {
    if (user.id === currentStaff?.id && user.is_active === 1) {
      alert('ไม่สามารถปิดการใช้งานบัญชีที่คุณกำลังล็อกอินอยู่ได้');
      return;
    }

    const nextStatus = user.is_active === 1 ? 0 : 1;
    const res = await apiRequest(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: nextStatus })
    });

    if (res.success) {
      fetchUsers();
    } else {
      alert(res.message || 'ไม่สามารถเปลี่ยนสถานะได้');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);

    try {
      const res = await apiRequest(`/users/${userToDelete.id}`, {
        method: 'DELETE'
      });

      if (res.success) {
        setSuccessMsg(res.message || 'ลบบัญชีพนักงานเรียบร้อย');
        setUserToDelete(null);
        fetchUsers();
      } else {
        alert(res.message || 'ไม่สามารถลบบัญชีพนักงานได้');
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setDeleteLoading(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'OWNER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
            <Shield className="w-3.5 h-3.5 text-amber-700" />
            เจ้าของร้าน (Owner)
          </span>
        );
      case 'STOCK_MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-900 border border-blue-200">
            <Shield className="w-3.5 h-3.5 text-blue-700" />
            ผู้จัดการสต๊อก (Stock)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            แคชเชียร์ (Cashier)
          </span>
        );
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#321d14] flex items-center gap-2.5">
            <UserCheck className="w-7 h-7 text-[#8b5537]" />
            จัดการพนักงานและบัญชีผู้ใช้งาน (Staff & Accounts)
          </h2>
          <p className="text-xs text-[#8b5537] mt-1">
            กำหนดสิทธิ์การใช้งาน เพิ่ม ลบ แก้ไขข้อมูลพนักงาน และตั้งรหัสผ่านสำหรับเครื่องขายหน้าร้าน
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#8b5537] hover:bg-[#714631] text-white rounded-2xl font-bold text-sm shadow-md transition cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มพนักงานใหม่</span>
        </button>
      </div>

      {/* Alert Banner if success */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-[#ecddc8] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือชื่อผู้ใช้ (@username)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-[#8b5537]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-700 font-medium"
          >
            <option value="">ทุกตำแหน่ง / ทุกสิทธิ์</option>
            <option value="OWNER">เจ้าของร้าน (Owner)</option>
            <option value="CASHIER">แคชเชียร์ (Cashier)</option>
            <option value="STOCK_MANAGER">ผู้จัดการสต๊อก (Stock)</option>
          </select>
        </div>
      </div>

      {/* Staff Table Card */}
      <div className="bg-white rounded-3xl border border-[#ecddc8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#fdfaf6] border-b border-[#ecddc8] text-[#714631] font-bold">
                <th className="py-3 px-4">พนักงาน</th>
                <th className="py-3 px-4">ชื่อผู้ใช้ (Username)</th>
                <th className="py-3 px-4">ตำแหน่ง / สิทธิ์</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4">เข้าใช้งานล่าสุด</th>
                <th className="py-3 px-4">วันที่สร้างบัญชี</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f7f1e7]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    กำลังโหลดข้อมูลพนักงาน...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    ไม่พบบัญชีพนักงานตามเงื่อนไขที่ค้นหา
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = currentStaff?.id === user.id;
                  const isActiveUser = user.is_active === 1;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-[#fdfaf6] transition ${
                        !isActiveUser ? 'opacity-60 bg-stone-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ddc2a3] to-[#ba8452] text-white font-black text-sm flex items-center justify-center shadow-xs">
                            {user.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 flex items-center gap-1.5">
                              {user.full_name}
                              {isCurrent && (
                                <span className="bg-[#8b5537] text-white text-[10px] px-1.5 py-0.2 rounded-md font-medium">
                                  คุณกำลังล็อกอิน
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400">ID: #{user.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-stone-700">
                        @{user.username}
                      </td>

                      <td className="py-3 px-4">{getRoleBadge(user.role)}</td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          title="คลิกเพื่อเปิด/ปิดการใช้งาน"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.8 rounded-full text-xs font-semibold cursor-pointer transition ${
                            isActiveUser
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200'
                          }`}
                        >
                          {isActiveUser ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              เปิดใช้งาน
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                              ระงับใช้งาน
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-stone-500">
                        {user.last_login_at ? formatThaiDateTime(user.last_login_at) : 'ยังไม่เคยเข้าสู่ระบบ'}
                      </td>

                      <td className="py-3 px-4 text-stone-500">
                        {user.created_at ? formatThaiDateTime(user.created_at) : '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(user)}
                            className="p-1.5 text-stone-500 hover:text-[#8b5537] hover:bg-[#f7f1e7] rounded-lg transition cursor-pointer"
                            title="แก้ไขข้อมูล / เปลี่ยนรหัสผ่าน"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setUserToDelete(user)}
                            disabled={isCurrent}
                            className={`p-1.5 rounded-lg transition ${
                              isCurrent
                                ? 'text-stone-300 cursor-not-allowed'
                                : 'text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer'
                            }`}
                            title={isCurrent ? 'ไม่สามารถลบบัญชีตัวเองได้' : 'ลบบัญชี'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-[#ecddc8] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#ecddc8] flex items-center justify-between bg-[#fdfaf6]">
              <div className="flex items-center gap-2 text-stone-900 font-bold text-base">
                <Users className="w-5 h-5 text-[#8b5537]" />
                <span>{editingUser ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ชื่อ-นามสกุล (พนักงาน)*</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#8b5537]"
                />
              </div>

              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">
                  ชื่อผู้ใช้ (Username)* {editingUser && '(ไม่สามารถเปลี่ยน username ได้)'}
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  placeholder="เช่น somchai"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm font-mono focus:outline-none focus:border-[#8b5537] ${
                    editingUser ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
                  <span>{editingUser ? 'รหัสผ่านใหม่ (เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน)' : 'รหัสผ่าน (Password)*'}</span>
                  <span className="text-[11px] text-stone-400 font-normal">อย่างน้อย 4 ตัวอักษร</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-stone-400" />
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={editingUser ? '•••••••• (ปล่อยว่างเพื่อคงเดิม)' : 'กรอกรหัสผ่าน...'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#8b5537]"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700">ตำแหน่ง / สิทธิ์การใช้งาน*</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-sm font-semibold focus:outline-none focus:border-[#8b5537]"
                >
                  <option value="CASHIER">แคชเชียร์ (CASHIER) - บันทึกการขายหน้าร้าน พิมพ์บิล</option>
                  <option value="STOCK_MANAGER">ผู้จัดการสต๊อก (STOCK_MANAGER) - รับของเข้า ตรวจสต๊อก</option>
                  <option value="OWNER">เจ้าของร้าน (OWNER) - สิทธิ์สูงสุด ดูแลการเงินและตั้งค่า</option>
                </select>
              </div>

              {/* Active Toggle (Edit mode) */}
              {editingUser && (
                <div className="pt-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-[#8b5537] rounded border-stone-300 focus:ring-[#8b5537]"
                  />
                  <label htmlFor="isActiveCheck" className="text-xs font-medium text-stone-700 cursor-pointer">
                    เปิดใช้งานบัญชีนี้ (สามารถเข้าสู่ระบบและขายของได้)
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#8b5537] hover:bg-[#714631] text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  <span>{editingUser ? 'บันทึกการแก้ไข' : 'สร้างพนักงาน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-red-200 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-base text-stone-900">ยืนยันการลบบัญชี?</h3>
              <p className="text-xs text-stone-500">
                คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีพนักงาน{' '}
                <span className="font-bold text-stone-900">{userToDelete.full_name}</span> (@{userToDelete.username})?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg mt-2 text-left">
                * หากพนักงานมีประวัติการขายในระบบ ระบบจะเปลี่ยนสถานะเป็น "ระงับใช้งาน" โดยอัตโนมัติเพื่อรักษาความถูกต้องของข้อมูลบิล
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteUser}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {deleteLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>ยืนยันลบบัญชี</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

