import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General enquiry');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please complete your name, email address, and message.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitted(true);
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[#0F2942]">Contact</h1>
      <p className="mt-2 text-sm text-slate-600">Share feedback about the application.</p>

      <div className="mt-6 max-w-2xl">
        <p className="mb-3 text-xs text-slate-500">Demo form only. Messages are not sent.</p>
        {submitted ? (
            <div className="border border-emerald-700/30 bg-emerald-50 p-4 rounded-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold text-emerald-900">Form checked</h2>
                  <p className="mt-1 text-sm text-emerald-800">
                    No message was sent.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 rounded-sm border border-emerald-700/40 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50"
                  >
                    Send another
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-4 border border-slate-200 bg-white p-5 rounded-sm"
            >
              {error && (
                <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-slate-800">
                  Full Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-slate-800">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="contact-subject" className="block text-sm font-medium text-slate-800">
                  Topic
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                >
                  <option>General enquiry</option>
                  <option>Parent / Caregiver feedback</option>
                  <option>Social Worker feedback</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-msg" className="block text-sm font-medium text-slate-800">
                  Message
                </label>
                <textarea
                  id="contact-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Your feedback"
                  className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#006847] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="rounded-sm bg-[#006847] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#005238]"
              >
                Submit feedback
              </button>
            </form>
        )}
      </div>
    </div>
  );
}
