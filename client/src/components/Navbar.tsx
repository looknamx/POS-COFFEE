import React, { useState, useEffect } from 'react';
import {
  Coffee,
  User,
  ChevronDown,
  CheckCircle,
  Clock,
  Menu,
  Tv,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { StaffUser, StoreSettings } from '../types';
import { apiRequest } from '../api/client';

interface NavbarProps {
  settings: StoreSettings;
  activeStaff: StaffUser | null;
  onStaffChange: (staff: StaffUser) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  activeStaff,
  onStaffChange,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    // Fetch active staff list
    apiRequest<StaffUser[]>('/auth/staff').then((res) => {
      if (res.success && res.data) {
        setStaffList(res.data);
      }
    });

    // Clock ticker in Thai Buddhist Era format (พ.ศ.)
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('th-TH-u-ca-buddhist', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectStaff = (staff: StaffUser) => {
    localStorage.setItem('pos_active_staff_id', String(staff.id));
    onStaffChange(staff);
    setDropdownOpen(false);
  };

  const handleOpenCustomerDisplay = () => {
    const url = `${window.location.origin}${window.location.pathname}?mode=customer-display`;
    window.open(url, 'PosCustomerDisplay', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">เจ้าของร้าน</span>;
      case 'STOCK_MANAGER':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">ผู้จัดการสต๊อก</span>;
      default:
        return <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">แคชเชียร์</span>;
    }
  };

  return (
    <header className="bg-white border-b border-[#ebdccd] sticky top-0 z-30 shadow-xs">
      <div className="flex items-center justify-between px-4 py-2.5 gap-2">
        {/* Left Branding with Sidebar Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'ขยายแถบเมนูข้าง (Expand)' : 'พับแถบเมนูข้าง (Collapse)'}
            className="p-2 rounded-xl border border-[#ecddc8] bg-[#fdfaf6] hover:bg-[#f7f1e7] text-[#714631] transition cursor-pointer"
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5537] to-[#5c3b2b] flex items-center justify-center text-white shadow-sm shrink-0">
            <Coffee className="w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg text-[#321d14] tracking-tight leading-none">
              {settings.store_name || 'ร้านกาแฟหอมละมุน'}
            </h1>
            <p className="text-xs text-[#8b5537] font-medium mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ระบบ POS & สต๊อกพร้อมใช้งาน
            </p>
          </div>
        </div>

        {/* Center Clock in Buddhist Era (พ.ศ.) */}
        <div className="hidden md:flex items-center gap-2 bg-[#fdfaf6] px-3.5 py-1.5 rounded-full border border-[#ecddc8] text-[#714631] text-xs font-semibold">
          <Clock className="w-3.5 h-3.5 text-[#ba8452]" />
          <span>{currentTime}</span>
        </div>

        {/* Right Section: Customer Display Button & Active Staff Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Customer Facing Second Screen Launcher */}
          <button
            onClick={handleOpenCustomerDisplay}
            title="เปิดจอแสดงผลสำหรับลูกค้า (Second Screen)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#ecddc8] bg-white hover:bg-[#fdfaf6] hover:border-[#8b5537] text-[#5c3b2b] text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <Tv className="w-4 h-4 text-[#ba8452]" />
            <span className="hidden md:inline">จอแสดงผลลูกค้า</span>
          </button>

          {/* Active Staff Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-[#ecddc8] bg-[#fdfaf6] hover:bg-[#f7f1e7] transition cursor-pointer text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-[#ddc2a3] text-[#5c3b2b] flex items-center justify-center font-bold text-sm shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden lg:block">
                <div className="text-xs font-semibold text-[#321d14] leading-tight flex items-center gap-1.5">
                  {activeStaff?.fullName || 'ผู้ดูแลระบบ'}
                </div>
                <div className="mt-0.5">{getRoleBadge(activeStaff?.role)}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-[#8b5537]" />
            </button>

            {/* Staff Switcher Dropdown */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#ecddc8] py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-gray-100 text-xs font-semibold text-gray-500">
                  สลับพนักงานประจำเครื่อง
                </div>
                {staffList.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => handleSelectStaff(staff)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#fdfaf6] transition cursor-pointer ${
                      activeStaff?.id === staff.id ? 'bg-[#f7f1e7] text-[#5c3b2b] font-medium' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center text-xs text-stone-700 font-semibold">
                        {staff.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-900">{staff.fullName}</div>
                        <div className="text-[10px] text-gray-500">@{staff.username}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getRoleBadge(staff.role)}
                      {activeStaff?.id === staff.id && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
