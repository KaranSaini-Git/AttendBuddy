import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';

export default function ExportPage() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({ section_id: '', subject_id: '', student_id: '', date_from: '', date_to: '' });
  const [loading, setLoading] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([api.get('/teacher/sections'), api.get('/teacher/subjects'), api.get('/teacher/students')])
      .then(([a,b,c]) => { setSections(a.data || []); setSubjects(b.data || []); setStudents(c.data || []); })
      .catch(() => showToast('Failed to load export filters', 'error'));
  }, [showToast]);

  const download = async (format) => {
    setLoading(format);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const response = await api.get(`/reports/export/${format}`, { params, responseType: 'blob' });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'excel' ? 'attendance_report.xlsx' : 'attendance_report.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(`${format === 'excel' ? 'Excel' : 'CSV'} report downloaded`, 'success');
    } catch (error) {
      showToast('Failed to export report', 'error');
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">Apply filters, then download the exact records you need.</p>
      </div>
      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select label="Section" value={filters.section_id} onChange={e => setFilters({...filters, section_id:e.target.value})} options={sections.map(s => ({value:s.id,label:s.section_name}))} />
            <Select label="Subject" value={filters.subject_id} onChange={e => setFilters({...filters, subject_id:e.target.value})} options={subjects.map(s => ({value:s.id,label:`${s.subject_code} — ${s.subject_name}`}))} />
            <Select label="Student" value={filters.student_id} onChange={e => setFilters({...filters, student_id:e.target.value})} options={students.map(s => ({value:s.id,label:`${s.student_id} — ${s.name}`}))} />
            <Input label="From" type="date" value={filters.date_from} onChange={e => setFilters({...filters,date_from:e.target.value})} />
            <Input label="To" type="date" value={filters.date_to} onChange={e => setFilters({...filters,date_to:e.target.value})} />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-50 text-red-600"><FileText size={24} /></div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">CSV Report</h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">Portable spreadsheet-friendly export.</p>
                <Button icon={Download} onClick={() => download('csv')} loading={loading === 'csv'}>Download CSV</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-green-50 text-green-600"><FileSpreadsheet size={24} /></div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">Excel Report</h2>
                <p className="text-sm text-gray-500 mt-1 mb-4">Formatted .xlsx report for sharing and analysis.</p>
                <Button icon={Download} onClick={() => download('excel')} loading={loading === 'excel'}>Download Excel</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
