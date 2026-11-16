import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('PARENT_CAREGIVER');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 10 || new TextEncoder().encode(password).length > 72 ||
        !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must be at least 10 characters and include uppercase, lowercase and a number (maximum 72 bytes).');
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone, password, confirmPassword, accountType }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
          setError(body.error);
        } else {
          setError('Unable to create your account. Please try again.');
        }
        return;
      }
      if (response.status !== 201 || !body || typeof body !== 'object' || !('user' in body)) {
        setError('The server returned an invalid response. Please try signing in or contact support.');
        return;
      }
      navigate('/login', {
        replace: true,
        state: { registrationSuccess: true, email: email.trim().toLowerCase() },
      });
    } catch {
      setError('Unable to reach the registration server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none';
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-[#0F2942]">Create account</h1>
      <p className="mt-2 text-sm text-slate-600">Create a parent or caregiver account to sign in.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-sm border border-slate-200 bg-white p-6">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <label htmlFor="reg-name" className="block text-sm font-medium text-slate-800">Full name</label>
          <input id="reg-name" className={inputClass} autoComplete="name" required maxLength={150} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="reg-email" className="block text-sm font-medium text-slate-800">Email address</label>
          <input id="reg-email" type="email" className={inputClass} autoComplete="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="reg-phone" className="block text-sm font-medium text-slate-800">Phone number</label>
          <input id="reg-phone" type="tel" className={inputClass} autoComplete="tel" required maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label htmlFor="reg-type" className="block text-sm font-medium text-slate-800">Account type</label>
          <select id="reg-type" className={inputClass} value={accountType} onChange={(e) => setAccountType(e.target.value)}>
            <option value="PARENT_CAREGIVER">Parent / Caregiver</option>
            <option value="PAYING_PARENT">Paying Parent</option>
          </select>
          <p className="mt-1 text-xs text-slate-600">Both options create the same parent / caregiver account. Whether you pay or receive is set per child through approved family links and maintenance arrangements, not by this choice.</p>
        </div>
        <div>
          <label htmlFor="reg-password" className="block text-sm font-medium text-slate-800">Password</label>
          <input id="reg-password" type="password" className={inputClass} autoComplete="new-password" required minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-slate-600">At least 10 characters, including uppercase, lowercase and a number; maximum 72 bytes.</p>
        </div>
        <div>
          <label htmlFor="reg-confirm" className="block text-sm font-medium text-slate-800">Confirm password</label>
          <input id="reg-confirm" type="password" className={inputClass} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded-sm bg-[#006847] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#005238] disabled:opacity-60">
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
        <p className="text-center text-xs text-slate-600">Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#006847] hover:underline">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
