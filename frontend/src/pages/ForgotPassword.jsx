import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function ForgotPassword() {
  const [form, setForm] = useState({ user_id: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/auth/forgot-password', form);
      setMessage(data.message || 'If the details match an account, a reset link has been sent.');
      setDevResetUrl(data.dev_reset_url || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start the password reset.');
    } finally { setLoading(false); }
  };

  return <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 sm:px-6"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center"><div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8">
    <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Back to login</Link>
    <div className="mt-7"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><KeyRound className="h-6 w-6" /></div><h1 className="mt-5 text-2xl font-semibold text-slate-950">Forgot password?</h1><p className="mt-2 text-sm leading-6 text-slate-500">Enter your User ID and account email. We’ll send a secure reset link if they match.</p></div>
    {message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}{devResetUrl && <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900"><strong>Local development:</strong> Resend is not configured. Use this reset link: <a className="break-all font-semibold underline" href={devResetUrl}>{devResetUrl}</a></div>}
    {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <form onSubmit={submit} className="mt-7 space-y-5"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">User ID</span><input value={form.user_id} onChange={(e)=>setForm(v=>({...v,user_id:e.target.value}))} required placeholder="T001 or S001" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email address</span><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="email" value={form.email} onChange={(e)=>setForm(v=>({...v,email:e.target.value}))} required placeholder="you@example.com" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></div></label><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:null}{loading?'Sending…':'Send reset link'}</button></form>
  </div></div></main>;
}
