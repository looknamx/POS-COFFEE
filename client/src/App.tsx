import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, TabKey } from './components/Sidebar';
import { PosView } from './views/PosView';
import { DashboardView } from './views/DashboardView';
import { ProductsView } from './views/ProductsView';
import { RecipesView } from './views/RecipesView';
import { InventoryView } from './views/InventoryView';
import { PurchasesView } from './views/PurchasesView';
import { SuppliersView } from './views/SuppliersView';
import { SalesHistoryView } from './views/SalesHistoryView';
import { ExpensesView } from './views/ExpensesView';
import { ReportsView } from './views/ReportsView';
import { StaffManagementView } from './views/StaffManagementView';
import { SettingsView } from './views/SettingsView';
import { BackupView } from './views/BackupView';
import { CustomerDisplayView } from './views/CustomerDisplayView';
import { StaffUser, StoreSettings } from './types';
import { apiRequest } from './api/client';

export function App() {
  // Check if standalone customer display mode is active
  const isCustomerDisplayMode =
    typeof window !== 'undefined' &&
    (window.location.search.includes('mode=customer-display') ||
      window.location.search.includes('display=customer'));

  if (isCustomerDisplayMode) {
    return <CustomerDisplayView />;
  }

  const [activeTab, setActiveTab] = useState<TabKey>('pos');
  const [activeStaff, setActiveStaff] = useState<StaffUser | null>(null);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('pos_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    fetchSettings();
    fetchStaff();
    checkLowStock();
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('pos_sidebar_collapsed', String(next));
      return next;
    });
  };

  const fetchSettings = async () => {
    const res = await apiRequest<StoreSettings>('/settings');
    if (res.success && res.data) {
      setSettings(res.data);
    }
  };

  const fetchStaff = async () => {
    const res = await apiRequest<StaffUser[]>('/auth/staff');
    if (res.success && res.data && res.data.length > 0) {
      const savedStaffId = localStorage.getItem('pos_active_staff_id');
      const found = res.data.find((s) => String(s.id) === savedStaffId) || res.data[0];
      setActiveStaff(found);
    }
  };

  const checkLowStock = async () => {
    const res = await apiRequest('/ingredients?alert_only=1');
    if (res.success && res.summary) {
      setLowStockCount(res.summary.low_stock_count || 0);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf9f6] flex flex-col text-[#2c1e18] selection:bg-[#ecddc8] selection:text-[#5c3b2b]">
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        activeStaff={activeStaff}
        onStaffChange={(staff) => setActiveStaff(staff)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Main Body with Sidebar + Tab Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            checkLowStock();
          }}
          lowStockCount={lowStockCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />

        {/* View Routing */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'pos' && <PosView settings={settings} />}
          {activeTab === 'dashboard' && <DashboardView settings={settings} onNavigateTab={setActiveTab} />}
          {activeTab === 'products' && <ProductsView />}
          {activeTab === 'recipes' && <RecipesView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'purchases' && <PurchasesView />}
          {activeTab === 'suppliers' && <SuppliersView />}
          {activeTab === 'sales' && <SalesHistoryView settings={settings} />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'staff' && <StaffManagementView currentStaff={activeStaff} />}
          {activeTab === 'settings' && <SettingsView settings={settings} onSettingsUpdated={fetchSettings} />}
          {activeTab === 'backup' && <BackupView />}
        </main>
      </div>
    </div>
  );
}

export default App;
