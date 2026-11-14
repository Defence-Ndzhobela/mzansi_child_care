import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.');
      return;
    }

    const res = login(email, password);
    if (!res.ok || !res.user) {
      setError(res.error ?? 'Unable to sign in.');
      return;
    }

    if (res.user.role === 'SOCIAL_WORKER') {
      navigate('/social-worker/dashboard');
    } else {
      navigate('/parent/dashboard');
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-6">
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Sign in</h1>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 border border-slate-200 bg-white p-6 rounded-sm"
          >
            {error && (
              <div className="flex items-start gap-2 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-800">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@demo.co.za"
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-800">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-sm bg-[#006847] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005238] transition-colors"
            >
              Sign In
            </button>

            <p className="text-center text-xs text-slate-600 pt-1">
              Need an account?{' '}
              <Link to="/register" className="font-semibold text-[#006847] hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </div>

        <div className="md:col-span-6 space-y-4">
          <div className="border border-slate-200 bg-slate-50 p-4 rounded-sm">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Demo accounts</h2>
            <p className="mt-1 text-xs text-slate-600">
              Demo sign-in uses this browser. Do not reuse a real password.
            </p>

            <div className="mt-3 space-y-2">
              <div className="border border-slate-200 bg-white p-3 rounded-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#006847]">Caregiver · Receiving</p>
                  <button
                    type="button"
                    onClick={() => fillDemo('parent@demo.co.za', 'Parent123!')}
                    className="rounded-sm border border-slate-300 px-2.5 py-1 text-xs font-medium text-[#0F2942] hover:bg-slate-50"
                  >
                    Use account
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-800">
                  parent@demo.co.za / Parent123!
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-3 rounded-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0F2942]">Caregiver · Paying</p>
                  <button
                    type="button"
                    onClick={() => fillDemo('sipho@demo.co.za', 'Parent123!')}
                    className="rounded-sm border border-slate-300 px-2.5 py-1 text-xs font-medium text-[#0F2942] hover:bg-slate-50"
                  >
                    Use account
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-800">
                  sipho@demo.co.za / Parent123!
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-3 rounded-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0F2942]">Social worker</p>
                  <button
                    type="button"
                    onClick={() => fillDemo('worker@demo.co.za', 'Worker123!')}
                    className="rounded-sm border border-slate-300 px-2.5 py-1 text-xs font-medium text-[#0F2942] hover:bg-slate-50"
                  >
                    Use account
                  </button>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-800">
                  worker@demo.co.za / Worker123!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
