import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setError('');
    if (!token) return setError('This reset link is missing its token.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try { await api.post('/auth/reset-password', { token, new_password: password, confirm_password: confirm }); setDone(true); setTimeout(()=>navigate('/login'), 1200); }
    catch (err) { setError(err.response?.data?.error || 'Unable to reset password.'); }
    finally { setLoading(false); }
  };

  return <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 sm:px-6"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center"><div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 sm:p-8"><Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4"/> Back to login</Link>{done?<div className="mt-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600"/><h1 className="mt-4 text-2xl font-semibold text-slate-950">Password updated</h1><p className="mt-2 text-sm text-slate-500">You can sign in with your new password.</p></div>:<><div className="mt-7"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><KeyRound className="h-6 w-6"/></div><h1 className="mt-5 text-2xl font-semibold text-slate-950">Set a new password</h1><p className="mt-2 text-sm text-slate-500">Choose a strong password with at least 8 characters.</p></div>{error&&<div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-7 space-y-5"><Password label="New password" value={password} onChange={setPassword} show={show} toggle={()=>setShow(v=>!v)}/><Password label="Confirm new password" value={confirm} onChange={setConfirm} show={show} toggle={()=>setShow(v=>!v)}/><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:null}{loading?'Updating…':'Update password'}</button></form></>}</div></div></main>;
}
function Password({label,value,onChange,show,toggle}){return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{label}</span><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type={show?'text':'password'} minLength={8} required value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"/><button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></label>}
