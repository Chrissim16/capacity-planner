import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBanners } from './NotificationBanners';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('ui.sidebarCollapsed');
    if (saved === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('ui.sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-mw-grey-lighter dark:bg-[#0D1B2A]">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <NotificationBanners />
        <main className="flex-1 overflow-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
