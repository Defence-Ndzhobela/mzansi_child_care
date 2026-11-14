import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ToastBanner } from '../../components/ToastBanner';

export function ParentProfilePage() {
  const { currentUser } = useAuth();
  const { updateUserProfile, resetDemoData } = useData();

  const [fullName, setFullName] = useState(currentUser?.fullName ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [region, setRegion] = useState(currentUser?.region ?? '');
  const [confirmReset, setConfirmReset] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  if (!currentUser) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !phone.trim()) {
      setError('Full name and phone number are required.');
      return;
    }
    updateUserProfile(currentUser.id, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      region: region.trim(),
    });
    setToast('Profile updated.');
  };

  const handleReset = () => {
    resetDemoData();
    setConfirmReset(false);
    setToast('Sample data restored.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Profile and Settings</h1>
      </div>

      {toast && <ToastBanner type="success" message={toast} onDismiss={() => setToast('')} />}
      {error && <ToastBanner type="error" message={error} onDismiss={() => setError('')} />}

      <form
        onSubmit={handleSave}
        className="space-y-4 border border-slate-200 bg-white p-6 rounded-sm"
      >
        <h2 className="font-display text-base font-semibold text-[#0F2942]">Account Details</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prof-email" className="block text-xs font-medium text-slate-600">
              Email Address (Read-only)
            </label>
            <input
              id="prof-email"
              type="email"
              disabled
              value={currentUser.email}
              className="mt-1 block w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </div>

          <div>
            <label htmlFor="prof-role" className="block text-xs font-medium text-slate-600">
              Assigned Role
            </label>
            <input
              id="prof-role"
              type="text"
              disabled
              value="Parent / Caregiver"
              className="mt-1 block w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prof-name" className="block text-sm font-medium text-slate-800">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="prof-phone" className="block text-sm font-medium text-slate-800">
              Phone Number
            </label>
            <input
              id="prof-phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prof-region" className="block text-sm font-medium text-slate-800">
            City / Province
          </label>
          <input
            id="prof-region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="rounded-sm bg-[#006847] px-4 py-2 text-sm font-medium text-white hover:bg-[#005238]"
          >
            Save Profile Changes
          </button>
        </div>
      </form>

      <div className="border border-slate-200 bg-white p-6 rounded-sm">
        <h2 className="font-display text-base font-semibold text-[#0F2942]">Reset sample data</h2>
        <p className="mt-1 text-sm text-slate-600">
          Restore the original records. New entries will be cleared.
        </p>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-sm border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset sample data</span>
          </button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm border border-red-200 bg-red-50 p-3.5">
            <span className="text-sm text-red-900">
              Confirm restoring original demo records? Any new entries will be cleared.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-sm bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
