import React, { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Baby,
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatSADateShort } from '../utils/format';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

export function DashboardLayout() {
  const { currentUser, logout, switchDemoFamilyUser } = useAuth();
  const { db, markNotificationRead, markAllNotificationsRead } = useData();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!currentUser) return null;

  const isSocialWorker = currentUser.role === 'SOCIAL_WORKER';

  const parentNav: NavItem[] = [
    { to: '/parent/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: '/parent/children', label: 'Children', icon: <Baby className="h-4 w-4" /> },
    {
      to: '/parent/arrangements',
      label: 'Arrangements',
      icon: <ClipboardList className="h-4 w-4" />,
    },
    { to: '/parent/payments', label: 'Payments', icon: <CreditCard className="h-4 w-4" /> },
    { to: '/parent/history', label: 'Payment History', icon: <History className="h-4 w-4" /> },
    { to: '/parent/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
    {
      to: '/parent/profile',
      label: 'Profile',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const socialWorkerNav: NavItem[] = [
    {
      to: '/social-worker/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      to: '/social-worker/families',
      label: 'Assigned Families',
      icon: <Users className="h-4 w-4" />,
    },
    {
      to: '/social-worker/children',
      label: 'Children',
      icon: <Baby className="h-4 w-4" />,
    },
    {
      to: '/social-worker/payments',
      label: 'Payments',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      to: '/social-worker/concerns',
      label: 'Payment Concerns',
      icon: <AlertTriangle className="h-4 w-4" />,
    },
    { to: '/social-worker/reports', label: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
    {
      to: '/social-worker/profile',
      label: 'Profile',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const navItems = isSocialWorker ? socialWorkerNav : parentNav;
  const userNotifications = db.notifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unreadCount = userNotifications.filter((n) => !n.isRead).length;

  const isMokoenaDemoAccount =
    currentUser.id === 'user-parent-thandiwe' || currentUser.id === 'user-parent-sipho';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#0F2942] text-white'
        : 'text-slate-700 hover:bg-slate-100 hover:text-[#0F2942]'
    }`;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white flex flex-col transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <Link to="/" className="font-display text-base font-bold text-[#0F2942]">
            Mzansi ChildCare
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-800"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#006847]">
            {isSocialWorker ? 'Social Worker Portal' : 'Parent / Caregiver Portal'}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#0F2942] truncate">
            {currentUser.fullName}
          </p>
          <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Dashboard navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={navLinkClass}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {isMokoenaDemoAccount && (
          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Switch account
            </p>
            <button
              type="button"
              onClick={() =>
                switchDemoFamilyUser(
                  currentUser.id === 'user-parent-thandiwe'
                    ? 'user-parent-sipho'
                    : 'user-parent-thandiwe'
                )
              }
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F2942] hover:bg-slate-100"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>
                {currentUser.id === 'user-parent-thandiwe'
                  ? 'Sipho · Paying'
                  : 'Thandiwe · Receiving'}
              </span>
            </button>
          </div>
        )}

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-sm border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="no-print border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded-sm border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  className="relative flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4 text-[#0F2942]" />
                  <span className="hidden sm:inline">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-sm bg-[#006847] px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-sm border border-slate-200 bg-white shadow-md z-50">
                    <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5">
                      <span className="text-xs font-semibold text-[#0F2942]">
                        Notifications ({unreadCount} unread)
                      </span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => markAllNotificationsRead(currentUser.id)}
                          className="text-xs text-[#006847] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {userNotifications.length === 0 ? (
                        <p className="p-4 text-xs text-slate-500">No notifications yet.</p>
                      ) : (
                        userNotifications.slice(0, 8).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              markNotificationRead(n.id);
                              setNotifOpen(false);
                              if (n.linkTo) navigate(n.linkTo);
                            }}
                            className={`block w-full text-left px-3.5 py-2.5 hover:bg-slate-50 ${
                              n.isRead ? 'bg-white' : 'bg-emerald-50/40'
                            }`}
                          >
                            <p className="text-xs font-semibold text-[#0F2942]">{n.title}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {formatSADateShort(n.createdAt)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
