import React, { useEffect, useState } from 'react';
import { Mail, UserCircle } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const [profile,setProfile]=useState(null); const [form,setForm]=useState({name:'',email:''}); const [saving,setSaving]=useState(false);
  const {showToast}=useToast(); const {user}=useAuth();
  useEffect(()=>{api.get('/teacher/profile').then(r=>{setProfile(r.data);setForm({name:r.data.name||'',email:r.data.email||''});}).catch(()=>showToast('Failed to load profile','error'));},[showToast]);
  const save=async(e)=>{e.preventDefault();setSaving(true);try{const r=await api.put('/teacher/profile',form);setProfile({...profile,...r.data});showToast('Profile updated','success');}catch(e){showToast(e.response?.data?.error||'Failed to update profile','error')}finally{setSaving(false)}};
  if(!profile) return <div className="flex justify-center py-16"><span className="animate-spin">◌</span></div>;
  return <div className="space-y-6 max-w-2xl"><div><h1 className="text-2xl font-bold text-gray-900">Profile</h1><p className="text-sm text-gray-500 mt-1">Manage your teacher account details.</p></div><Card><CardContent><div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-2xl">{(profile.name||user?.name||'T').charAt(0)}</div><div><h2 className="text-xl font-semibold">{profile.name}</h2><p className="text-sm text-gray-500">Teacher ID: {profile.teacher_id}</p></div></div><form onSubmit={save} className="space-y-4"><Input label="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/><Input label="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/><Button type="submit" loading={saving}>Save changes</Button></form></CardContent></Card></div>;
}
