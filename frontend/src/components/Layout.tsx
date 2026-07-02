import { NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '工作台', icon: '📊', end: true },
  { to: '/chain', label: '产业图谱', icon: '🔗' },
  { to: '/enterprises', label: '企业库', icon: '🏢' },
  { to: '/policies', label: '政策库', icon: '📋' },
  { to: '/properties', label: '物业资源库', icon: '🏗️' },
  { to: '/reports', label: '报告中心', icon: '📄' },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 h-screen bg-sidebar border-r border-border flex flex-col flex-shrink-0">
        <div className="px-4 py-5 font-semibold text-[15px] text-ink flex items-center gap-2">
          <span className="text-lg">🏭</span> 产业招商助手
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`nav-item px-3 py-2 text-[14px] flex items-center gap-2.5 no-underline text-ink ${isActive ? 'active' : ''}`}
              >
                <span>{item.icon}</span> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border text-[12px] text-muted">
          v1.0 · 招商助手
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
