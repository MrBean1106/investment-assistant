import { NavLink, Outlet, useLocation } from 'react-router-dom';
import AIChat from './AIChat';

const NAV_ITEMS = [
  { to: '/', label: '工作台', icon: '▦' },
  { to: '/chain', label: '产业图谱', icon: '◎' },
  { to: '/enterprises', label: '企业库', icon: '▤' },
  { to: '/policies', label: '政策库', icon: '▥' },
  { to: '/properties', label: '物业资源', icon: '◫' },
  { to: '/reports', label: '报告中心', icon: '▣' },
  { to: '/ai', label: 'AI 助手', icon: '✦' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] h-screen flex flex-col flex-shrink-0 select-none" style={{ background: 'var(--color-sidebar-bg)' }}>
        {/* Logo */}
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))' }}>
              招
            </div>
            <div>
              <div className="text-white font-semibold text-[15px] tracking-tight">招商助手</div>
              <div className="text-[11px] tracking-widest uppercase" style={{ color: 'var(--color-sidebar-text)' }}>Investment OS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>张</div>
            <div>
              <div className="text-[12.5px] font-medium" style={{ color: 'var(--color-sidebar-text-active)' }}>招商一部</div>
              <div className="text-[11px]" style={{ color: 'var(--color-sidebar-text)' }}>v1.0 · Online</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* AI Chat Widget */}
      <AIChat />
    </div>
  );
}
