import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function RegisterPage() {
  const { registerParent } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('Johannesburg, Gauteng');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please complete all required fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const res = registerParent({
      fullName,
      email,
      phone,
      password,
      region,
    });

    if (!res.ok) {
      setError(res.error ?? 'Registration failed.');
      return;
    }

    navigate('/parent/dashboard');
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-[#0F2942]">Create account</h1>

      <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        Demo account only. Data stays in this browser; do not enter real personal information.
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 border border-slate-200 bg-white p-6 rounded-sm"
      >
        {error && (
          <div className="flex items-start gap-2 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-slate-800">
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-email" className="block text-sm font-medium text-slate-800">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-800">
              Phone Number
            </label>
            <input
              id="reg-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-region" className="block text-sm font-medium text-slate-800">
            City / Province
          </label>
          <input
            id="reg-region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="reg-pass" className="block text-sm font-medium text-slate-800">
              Password
            </label>
            <input
              id="reg-pass"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-800">
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-sm bg-[#006847] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005238]"
        >
          Create account
        </button>

        <p className="text-center text-xs text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#006847] hover:underline">
            Sign in instead
          </Link>
        </p>
      </form>
    </div>
  );
}
