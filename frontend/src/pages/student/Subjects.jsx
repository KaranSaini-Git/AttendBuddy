import React, { useEffect, useState } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/student/subjects')
      .then(res => setSubjects(res.data || []))
      .catch(() => showToast('Failed to load subjects', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!subjects.length) return <EmptyState icon={BookOpen} title="No subjects yet" description="Your enrolled subjects will appear here." />;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">My Subjects</h1><p className="text-sm text-gray-500 mt-1">Attendance performance for every enrolled subject.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {subjects.map(subject => (
          <Card key={subject.subject_id}>
            <CardContent>
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">{subject.subject_code}</p>
                  <h2 className="font-semibold text-gray-900 mt-1">{subject.subject_name}</h2>
                </div>
                {subject.is_low && <AlertTriangle className="text-red-500" size={18} />}
              </div>
              <div className="mt-5">
                <div className="flex justify-between mb-2 text-sm"><span className="text-gray-500">Attendance</span><b className={subject.is_low ? 'text-red-600' : 'text-green-600'}>{subject.percentage}%</b></div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${subject.is_low ? 'bg-red-500' : 'bg-green-500'}`} style={{width:`${Math.min(100, Math.max(0, subject.percentage))}%`}} /></div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-center text-sm">
                  <div><p className="text-gray-400">Total</p><b>{subject.total}</b></div>
                  <div><p className="text-gray-400">Present</p><b className="text-green-600">{subject.present}</b></div>
                  <div><p className="text-gray-400">Absent</p><b className="text-red-600">{subject.absent}</b></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
