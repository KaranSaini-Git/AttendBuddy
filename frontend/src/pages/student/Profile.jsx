import React, { useEffect, useState } from 'react';
import { Mail, UserCircle } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/context/ToastContext';

export default function Profile() {
  const [profile,setProfile]=useState(null); const {showToast}=useToast();
  useEffect(()=>{api.get('/student/profile').then(r=>setProfile(r.data)).catch(()=>showToast('Failed to load profile','error'));},[showToast]);
  if(!profile) return <div className="flex justify-center py-16"><Spinner size="lg"/></div>;
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold text-gray-900">Profile</h1><p className="text-sm text-gray-500 mt-1">Your account and academic details.</p></div><Card><CardContent><div className="flex items-center gap-4"><div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-2xl">{profile.name?.charAt(0)}</div><div><h2 className="text-xl font-semibold text-gray-900">{profile.name}</h2><p className="text-sm text-gray-500">{profile.student_id}</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6"><div className="p-4 rounded-xl bg-gray-50"><p className="text-xs text-gray-500">Email</p><p className="font-medium mt-1">{profile.email}</p></div><div className="p-4 rounded-xl bg-gray-50"><p className="text-xs text-gray-500">Section</p><p className="font-medium mt-1">{profile.section_name || 'Not assigned'}</p></div></div></CardContent></Card></div>;
}
