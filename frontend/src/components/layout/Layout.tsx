import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
  variant?: 'default' | 'fullbleed';
}

export function Layout({ children, variant = 'default' }: LayoutProps) {
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
    <div className="flex h-screen overflow-hidden bg-[#F5F8FC]">
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-[#FAFAFA]">
        <main className={
          variant === 'fullbleed'
            ? 'flex-1 overflow-hidden flex flex-col min-h-0'
            : 'flex-1 overflow-auto px-10 py-8 max-w-[1440px] w-full mx-auto'
        }>
          {children}
        </main>
      </div>
    </div>
  );
}
