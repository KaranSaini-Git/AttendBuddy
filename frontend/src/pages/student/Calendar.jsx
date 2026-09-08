import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';

export default function Calendar() {
  const [cursor, setCursor] = useState(new Date());
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;

  useEffect(() => {
    setLoading(true);
    api.get('/student/calendar', { params: { year, month } })
      .then(res => setDays(res.data || []))
      .catch(() => showToast('Failed to load calendar', 'error'))
      .finally(() => setLoading(false));
  }, [year, month, showToast]);

  const byDate = useMemo(() => Object.fromEntries(days.map(d => [new Date(d.date).toISOString().slice(0,10), d])), [days]);
  const first = new Date(year, month - 1, 1);
  const offset = first.getDay();
  const count = new Date(year, month, 0).getDate();
  const cells = Array.from({length: offset + count}, (_, i) => i < offset ? null : i - offset + 1);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Attendance Calendar</h1><p className="text-sm text-gray-500 mt-1">Daily attendance at a glance.</p></div>
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-5">
            <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setCursor(new Date(year, month - 2, 1))}><ChevronLeft size={20}/></button>
            <h2 className="font-semibold text-gray-900">{cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2>
            <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setCursor(new Date(year, month, 1))}><ChevronRight size={20}/></button>
          </div>
          {loading ? <div className="flex justify-center py-12"><Spinner/></div> : !days.length ? <EmptyState icon={CalendarDays} title="No attendance yet" description="Attendance for this month will appear here."/> : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} className="py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} className="aspect-square"/>;
                  const key = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const item = byDate[key];
                  const state = item ? (item.absent_count > 0 && item.present_count === 0 ? 'absent' : item.present_count > 0 && item.absent_count === 0 ? 'present' : 'mixed') : '';
                  return <div key={i} className={`aspect-square rounded-lg border flex items-center justify-center text-sm ${state==='present'?'bg-green-50 border-green-200 text-green-700':state==='absent'?'bg-red-50 border-red-200 text-red-700':state==='mixed'?'bg-amber-50 border-amber-200 text-amber-700':'border-gray-100 text-gray-700'}`}>{day}</div>;
                })}
              </div>
              <div className="flex flex-wrap gap-4 mt-5 text-xs text-gray-500">
                <span>🟢 Present</span><span>🔴 Absent</span><span>🟠 Mixed</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
