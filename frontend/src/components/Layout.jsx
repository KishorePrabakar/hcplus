import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const staffLinks = [
  { to: '/queue', label: 'Queue' },
  { to: '/approvals', label: 'Approvals' },
];

const adminLinks = [{ to: '/users', label: 'Users & Invites' }];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', label: user.role === 'STUDENT' ? 'My Complaints' : 'Dashboard', end: true },
    ...(user.role === 'WARDEN' ? staffLinks : []),
    ...(user.role === 'ADMIN' ? [...staffLinks, ...adminLinks] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-indigo-600">
            HostelCare<span className="text-slate-800">+</span>
          </NavLink>
          <nav className="ml-2 flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 sm:block">{user.name.split(' ')[0]}</span>
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
