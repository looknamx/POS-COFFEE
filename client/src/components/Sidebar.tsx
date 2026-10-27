import React from 'react';
import {
  ShoppingCart,
  LayoutDashboard,
  Coffee,
  BookOpen,
  Boxes,
  Truck,
  Building2,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  Database,
  UserCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export type TabKey =
  | 'pos'
  | 'dashboard'
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'purchases'
  | 'suppliers'
  | 'sales'
  | 'expenses'
  | 'reports'
  | 'staff'
  | 'settings'
  | 'backup';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  lowStockCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  lowStockCount = 0,
  isCollapsed,
  onToggleCollapse
}) => {
  const menuItems: { key: TabKey; label: string; icon: React.ReactNode; badge?: number; group?: string }[] = [
    { key: 'pos', label: 'POS ขายหน้าร้าน', icon: <ShoppingCart className="w-5 h-5" />, group: 'หน้าขาย' },
    { key: 'dashboard', label: 'แดชบอร์ดสรุป', icon: <LayoutDashboard className="w-5 h-5" />, group: 'หน้าขาย' },

    { key: 'products', label: 'จัดการเมนูสินค้า', icon: <Coffee className="w-5 h-5" />, group: 'สินค้าและสูตร' },
    { key: 'recipes', label: 'สูตรเครื่องดื่ม (BOM)', icon: <BookOpen className="w-5 h-5" />, group: 'สินค้าและสูตร' },

    {
      key: 'inventory',
      label: 'วัตถุดิบและสต๊อก',
      icon: <Boxes className="w-5 h-5" />,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      group: 'คลังสินค้า'
    },
    { key: 'purchases', label: 'รับสินค้าเข้า', icon: <Truck className="w-5 h-5" />, group: 'คลังสินค้า' },
    { key: 'suppliers', label: 'ซัพพลายเออร์', icon: <Building2 className="w-5 h-5" />, group: 'คลังสินค้า' },

    { key: 'sales', label: 'ประวัติบิลการขาย', icon: <Receipt className="w-5 h-5" />, group: 'การเงินและรายงาน' },
    { key: 'expenses', label: 'ค่าใช้จ่ายร้าน', icon: <Wallet className="w-5 h-5" />, group: 'การเงินและรายงาน' },
    { key: 'reports', label: 'รายงานและวิเคราะห์', icon: <BarChart3 className="w-5 h-5" />, group: 'การเงินและรายงาน' },

    { key: 'staff', label: 'จัดการพนักงาน', icon: <UserCheck className="w-5 h-5" />, group: 'ระบบ' },
    { key: 'settings', label: 'ตั้งค่าร้านค้า', icon: <Settings className="w-5 h-5" />, group: 'ระบบ' },
    { key: 'backup', label: 'สำรองและกู้คืน', icon: <Database className="w-5 h-5" />, group: 'ระบบ' }
  ];

  return (
    <aside
      className={`bg-white border-r border-[#ebdccd] flex flex-col shrink-0 min-h-[calc(100vh-57px)] transition-all duration-300 ease-in-out relative ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button at top right of sidebar */}
      <div className={`p-2 flex ${isCollapsed ? 'justify-center' : 'justify-end'} border-b border-[#f3ece2]`}>
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'ขยายเมนู (Expand Sidebar)' : 'พับเก็บเมนู (Collapse Sidebar)'}
          className="p-1.5 rounded-xl border border-[#ecddc8] bg-[#fdfaf6] hover:bg-[#f7f1e7] text-[#714631] transition cursor-pointer flex items-center justify-center shadow-2xs"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <div className="p-2 space-y-5 flex-1 overflow-y-auto">
        {/* Render by groups */}
        {['หน้าขาย', 'สินค้าและสูตร', 'คลังสินค้า', 'การเงินและรายงาน', 'ระบบ'].map((grp) => {
          const items = menuItems.filter((m) => m.group === grp);
          if (items.length === 0) return null;

          return (
            <div key={grp} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[11px] font-bold tracking-wider uppercase text-[#a76e43] animate-in fade-in duration-200">
                  {grp}
                </div>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onTabChange(item.key)}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center rounded-xl font-medium text-sm transition text-left cursor-pointer relative group ${
                        isCollapsed ? 'justify-center py-2.5 px-0' : 'justify-between px-3 py-2.5'
                      } ${
                        isActive
                          ? 'bg-[#8b5537] text-white shadow-xs font-semibold'
                          : 'text-[#5c3b2b] hover:bg-[#fdfaf6] hover:text-[#321d14]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 ${isActive ? 'text-white' : 'text-[#ba8452]'}`}>
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <span className="truncate animate-in fade-in duration-150">{item.label}</span>
                        )}
                      </div>

                      {/* Badge in expanded mode */}
                      {!isCollapsed && item.badge !== undefined && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                            isActive ? 'bg-amber-400 text-stone-900' : 'bg-red-500 text-white animate-pulse'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Badge in collapsed mode: red dot */}
                      {isCollapsed && item.badge !== undefined && (
                        <span className="absolute top-1.5 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-white"></span>
                      )}

                      {/* Tooltip on hover when collapsed */}
                      {isCollapsed && (
                        <div className="hidden group-hover:block absolute left-full ml-2 px-2.5 py-1 bg-stone-900 text-white text-xs font-medium rounded-lg whitespace-nowrap z-50 shadow-lg pointer-events-none">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Version Info */}
      <div className="p-3 border-t border-[#ebdccd] bg-[#fdfaf6] text-center text-xs text-[#8b5537]">
        {!isCollapsed ? (
          <>
            <div className="font-medium text-[#5c3b2b]">Coffee POS v1.0</div>
            <div className="text-[11px] text-[#a76e43] mt-0.5">ระบบตัดสต๊อกอัตโนมัติ</div>
          </>
        ) : (
          <div className="font-bold text-[10px] text-[#5c3b2b]">v1.0</div>
        )}
      </div>
    </aside>
  );
};
