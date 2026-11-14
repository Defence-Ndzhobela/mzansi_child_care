import { Link } from 'react-router-dom';

export function RegisterPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-[#0F2942]">Create account</h1>
      <div className="mt-6 border border-slate-200 bg-white p-6 rounded-sm text-sm text-slate-700">
        Registration is not available while authentication is connected to the database.
        Please use an existing demo account to{' '}
        <Link to="/login" className="font-semibold text-[#006847] hover:underline">sign in</Link>.
      </div>
    </div>
  );
}
