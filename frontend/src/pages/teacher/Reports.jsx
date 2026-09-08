import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/context/ToastContext';

export default function Reports() {
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ section_id: '', subject_id: '', student_id: '', date_from: '', date_to: '' });
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([
      api.get('/teacher/sections'),
      api.get('/teacher/subjects'),
      api.get('/teacher/students')
    ]).then(([a,b,c]) => {
      setSections(a.data || []);
      setSubjects(b.data || []);
      setStudents(c.data || []);
    }).catch(() => showToast('Failed to load report filters', 'error'));
  }, [showToast]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await api.get('/reports', { params });
      setReport(res.data);
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Analyze attendance across your assigned classes.</p>
        </div>
        <Button icon={RefreshCw} onClick={loadReport} loading={loading}>Generate</Button>
      </div>

      <Card>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select label="Section" value={filters.section_id} onChange={e => setFilters({...filters, section_id: e.target.value})}
              options={sections.map(s => ({ value: s.id, label: s.section_name }))} />
            <Select label="Subject" value={filters.subject_id} onChange={e => setFilters({...filters, subject_id: e.target.value})}
              options={subjects.map(s => ({ value: s.id, label: `${s.subject_code} — ${s.subject_name}` }))} />
            <Select label="Student" value={filters.student_id} onChange={e => setFilters({...filters, student_id: e.target.value})}
              options={students.map(s => ({ value: s.id, label: `${s.student_id} — ${s.name}` }))} />
            <Input type="date" label="From" value={filters.date_from} onChange={e => setFilters({...filters, date_from: e.target.value})} />
            <Input type="date" label="To" value={filters.date_to} onChange={e => setFilters({...filters, date_to: e.target.value})} />
          </div>
        </CardContent>
      </Card>

      {!report && !loading && (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="mx-auto text-gray-300" size={44} />
            <p className="mt-3 font-medium text-gray-700">Generate a report to see attendance analytics.</p>
          </CardContent>
        </Card>
      )}

      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}

      {report && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Classes', report.summary.total_classes],
              ['Present', report.summary.total_present],
              ['Absent', report.summary.total_absent],
              ['Attendance', `${Number(report.summary.average_percentage || 0).toFixed(1)}%`]
            ].map(([label, value]) => (
              <Card key={label}><CardContent><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold mt-1 text-gray-900">{value}</p></CardContent></Card>
            ))}
          </div>

          <Card title="Students below 75%" icon={AlertTriangle}>
            <CardContent>
              <Table
                columns={[
                  { key: 'student_id', label: 'Student ID' },
                  { key: 'student_name', label: 'Student' },
                  { key: 'total', label: 'Classes' },
                  { key: 'present', label: 'Present' },
                  { key: 'absent', label: 'Absent' },
                  { key: 'percentage', label: 'Attendance', render: v => <span className="font-semibold text-red-600">{Number(v).toFixed(1)}%</span> }
                ]}
                data={report.below_75 || []}
                emptyMessage="No students are below 75% in this report."
              />
            </CardContent>
          </Card>

          <Card title="Student-wise Attendance">
            <CardContent>
              <Table
                columns={[
                  { key: 'student_id', label: 'Student ID' },
                  { key: 'student_name', label: 'Student' },
                  { key: 'total', label: 'Total' },
                  { key: 'present', label: 'Present' },
                  { key: 'absent', label: 'Absent' },
                  { key: 'percentage', label: 'Attendance', render: v =>
                    <span className={Number(v) < 75 ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>{Number(v).toFixed(1)}%</span>
                  }
                ]}
                data={report.students || []}
                emptyMessage="No attendance records match these filters."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
