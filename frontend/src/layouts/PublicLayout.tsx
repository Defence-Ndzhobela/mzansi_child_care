import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PublicLayout() {
  const { currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardPath =
    currentUser?.role === 'SOCIAL_WORKER'
      ? '/social-worker/dashboard'
      : '/parent/dashboard';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
      isActive
        ? 'text-[#006847] underline underline-offset-4'
        : 'text-slate-700 hover:text-[#0F2942] hover:underline hover:underline-offset-4'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0"
          >
            Mzansi ChildCare
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/about" className={navLinkClass}>
              About
            </NavLink>
            <NavLink to="/how-it-works" className={navLinkClass}>
              How It Works
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Contact
            </NavLink>
            {!currentUser && (
              <NavLink to="/login" className={navLinkClass}>
                Login
              </NavLink>
            )}
          </nav>

          <div className="hidden md:flex items-center shrink-0">
            {currentUser ? (
              <Link
                to={dashboardPath}
                className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] transition-colors whitespace-nowrap shrink-0"
              >
                Open Dashboard
              </Link>
            ) : (
              <Link
                to="/register"
                className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238] transition-colors whitespace-nowrap shrink-0"
              >
                Register
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden rounded-sm border border-slate-300 p-2 text-slate-700 hover:bg-slate-50"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            className="md:hidden border-t border-slate-200 bg-slate-50 px-4 py-3 space-y-2"
            aria-label="Mobile navigation"
          >
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm font-medium text-slate-800"
            >
              Home
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm font-medium text-slate-800"
            >
              About
            </Link>
            <Link
              to="/how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm font-medium text-slate-800"
            >
              How It Works
            </Link>
            <Link
              to="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-1.5 text-sm font-medium text-slate-800"
            >
              Contact
            </Link>
            <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-200">
              {currentUser ? (
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white"
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-5 text-xs text-slate-600 sm:px-6">
          <Link to="/" className="font-display font-semibold text-[#0F2942]">
            Mzansi ChildCare
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer navigation">
            <Link to="/about" className="hover:underline">
              About
            </Link>
            <Link to="/how-it-works" className="hover:underline">
              How it works
            </Link>
            <Link to="/contact" className="hover:underline">
              Contact
            </Link>
          </nav>
          <p>Mzansi ChildCare is an independent community initiative.</p>
          <span>© 2026 Mzansi ChildCare</span>
        </div>
      </footer>
    </div>
  );
}
