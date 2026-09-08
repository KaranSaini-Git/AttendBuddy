import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Mail, Plus, Search, Upload, UserPlus, X, CheckCircle2, Copy } from 'lucide-react';
import api from '@/services/api';
import { useToast } from '@/context/ToastContext';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

const parseDelimited = (text) => {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if ((ch === ',' || ch === '\t') && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.toLowerCase().replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim());
  const aliases = {
    name: ['student name','name','student'],
    student_id: ['regd no','regd no.','registration no','registration number','student id','id'],
    email: ['email id','email','email address','mail']
  };
  const findIndex = (names) => headers.findIndex((h) => names.includes(h));
  const indexes = { name: findIndex(aliases.name), student_id: findIndex(aliases.student_id), email: findIndex(aliases.email) };
  return rows.slice(1).map((r) => ({
    name: indexes.name >= 0 ? r[indexes.name] || '' : '',
    student_id: indexes.student_id >= 0 ? r[indexes.student_id] || '' : '',
    email: indexes.email >= 0 ? r[indexes.email] || '' : ''
  })).filter((r) => r.name || r.student_id || r.email);
};

export default function Students() {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [confirmStudent, setConfirmStudent] = useState(null);
  const [form, setForm] = useState({ student_id: '', name: '', email: '', section_id: '' });
  const [saving, setSaving] = useState(false);
  const [importSection, setImportSection] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importSource, setImportSource] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [credentials, setCredentials] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, sectionsRes] = await Promise.all([api.get('/teacher/students'), api.get('/teacher/sections')]);
      setStudents(studentsRes.data || []); setSections(sectionsRes.data || []);
    } catch { showToast('Failed to load students.', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => students.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    return matchesSearch && (!sectionFilter || String(s.section_id) === String(sectionFilter));
  }), [students, search, sectionFilter]);

  const openAdd = () => { setEditingStudent(null); setForm({ student_id: '', name: '', email: '', section_id: sections[0]?.id || '' }); setModal('add'); };
  const openEdit = (s) => { setEditingStudent(s); setForm({ student_id: s.student_id, name: s.name, email: s.email || '', section_id: s.section_id }); setModal('edit'); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editingStudent) { await api.put(`/teacher/students/${editingStudent.id}`, form); showToast('Student updated.', 'success'); }
      else { const { data } = await api.post('/teacher/students', form); setCredentials([{ student_id: data.student.student_id, name: data.student.name, email: data.student.email, temp_password: data.tempPassword }]); showToast('Student account created.', 'success'); }
      setModal(null); await fetchData();
    } catch (err) { showToast(err.response?.data?.error || 'Unable to save student.', 'error'); }
    finally { setSaving(false); }
  };

  const toggle = async () => {
    if (!confirmStudent) return;
    try { await api.put(`/teacher/students/${confirmStudent.id}`, { active: !confirmStudent.active }); showToast(confirmStudent.active ? 'Student deactivated.' : 'Student activated.', 'success'); setConfirmStudent(null); fetchData(); }
    catch { showToast('Unable to update student status.', 'error'); }
  };

  const loadImportText = (text, source='') => {
    const rows = parseDelimited(text);
    if (!rows.length) return setImportError('No rows were found. Export your Google Sheet as CSV or paste the header + rows.');
    const valid = rows.filter((r) => r.name && r.email);
    setImportRows(valid); setImportSource(source); setImportError(valid.length ? '' : 'Could not find usable Student name + email columns.');
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => loadImportText(String(reader.result || ''), file.name); reader.readAsText(file);
  };

  const runImport = async () => {
    if (!importSection) return setImportError('Choose the destination section first.');
    if (!importRows.length) return setImportError('Add or upload some students first.');
    setImporting(true); setImportError('');
    try {
      const { data } = await api.post('/teacher/students/import', { section_id: importSection, students: importRows });
      setCredentials((data.created || []).map((r) => ({ student_id: r.student_id, name: r.name, email: r.email, temp_password: r.temp_password })));
      showToast(data.message, data.created?.length ? 'success' : 'info');
      setModal(null); await fetchData();
      setImportRows([]); setImportSource('');
    } catch (err) { setImportError(err.response?.data?.error || 'Import failed.'); }
    finally { setImporting(false); }
  };

  const downloadCredentials = () => {
    const header = 'Student ID,Name,Email,Temporary Password\n';
    const csv = header + credentials.map((r) => [r.student_id, r.name, r.email, r.temp_password].map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'attendbuddy-student-credentials.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">People</p><h2 className="page-title mt-1">Students</h2><p className="mt-1 text-sm text-slate-500">Add students individually or import an entire Google Sheet in seconds.</p></div>
      <div className="flex w-full gap-2 sm:w-auto"><Button variant="outline" icon={Upload} onClick={()=>{setImportSection(sections[0]?.id || '');setImportRows([]);setImportError('');setModal('import');}}>Import from Sheet</Button><Button icon={Plus} onClick={openAdd}>Add Student</Button></div>
    </div>

    <div className="surface overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, ID or email…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"/></div>
        <div className="w-full sm:w-56"><Select value={sectionFilter} onChange={(e)=>setSectionFilter(e.target.value)} placeholder="All sections" options={sections.map(s=>({value:s.id,label:s.section_name}))}/></div>
      </div>
      {loading ? <div className="flex justify-center py-14"><Spinner/></div> : filtered.length===0 ? <div className="py-16 text-center"><UserPlus className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 text-sm font-semibold text-slate-700">No students found</p><p className="mt-1 text-sm text-slate-500">Try another filter or import your class list.</p></div> : <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr>{['Student','Email','Section','Status','Actions'].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(s=><tr key={s.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{s.name.charAt(0)}</div><div><div className="font-semibold text-slate-800">{s.name}</div><div className="text-xs text-slate-500">{s.student_id}</div></div></div></td><td className="px-5 py-4 text-sm text-slate-600">{s.email || '—'}</td><td className="px-5 py-4 text-sm text-slate-600">{s.section_name || '—'}</td><td className="px-5 py-4"><Badge variant={s.active?'success':'danger'}>{s.active?'Active':'Inactive'}</Badge></td><td className="px-5 py-4"><div className="flex gap-2"><button onClick={()=>openEdit(s)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white">Edit</button><button onClick={()=>setConfirmStudent(s)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${s.active?'border-red-200 text-red-600 hover:bg-red-50':'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{s.active?'Deactivate':'Activate'}</button></div></td></tr>)}</tbody></table></div>}
    </div>

    <Modal isOpen={modal==='add'||modal==='edit'} onClose={()=>setModal(null)} title={editingStudent?'Edit student':'Add student'} size="lg"><form onSubmit={save} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Input label="Student ID / Registration no." value={form.student_id} onChange={(e)=>setForm(v=>({...v,student_id:e.target.value}))} required/><Input label="Full name" value={form.name} onChange={(e)=>setForm(v=>({...v,name:e.target.value}))} required/></div><Input type="email" label="Email address" value={form.email} onChange={(e)=>setForm(v=>({...v,email:e.target.value}))} required/><Select label="Section" value={form.section_id} onChange={(e)=>setForm(v=>({...v,section_id:e.target.value}))} options={sections.map(s=>({value:s.id,label:s.section_name}))} required/><div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">A student login is created automatically. A temporary password will be shown after saving.</div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={()=>setModal(null)}>Cancel</Button><Button type="submit" loading={saving}>{editingStudent?'Save changes':'Create student'}</Button></div></form></Modal>

    <Modal isOpen={modal==='import'} onClose={()=>setModal(null)} title="Import students from Google Sheets" size="xl"><div className="space-y-6"><div className="grid gap-4 md:grid-cols-[220px_1fr]"><div><Select label="Add to section" value={importSection} onChange={(e)=>setImportSection(e.target.value)} options={sections.map(s=>({value:s.id,label:s.section_name}))} required/></div><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-blue-900"><FileSpreadsheet className="h-4 w-4"/> Supported columns</div><p className="mt-2 text-xs leading-5 text-blue-800">Student name · Regd no. · email id</p><p className="mt-1 text-xs leading-5 text-blue-700">You can upload a CSV exported from Google Sheets or paste the rows below.</p></div></div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"><Upload className="h-5 w-5 text-blue-600"/> Choose CSV file<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="sr-only" onChange={handleFile}/></label><div><label className="mb-2 block text-sm font-medium text-slate-700">Or paste directly from Google Sheets</label><textarea rows={8} onChange={(e)=>loadImportText(e.target.value,'pasted from Google Sheets')} placeholder={'Student name\tRegd no.\temail id\nAnkit Raj\t24EE118A32\tankitraj@example.com'} className="w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10"/></div>{importSource&&<p className="text-xs text-slate-500">Loaded: <span className="font-semibold">{importSource}</span></p>}{importError&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>}{importRows.length>0&&<div className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-4 py-3"><div><span className="text-sm font-semibold text-slate-800">Preview</span><span className="ml-2 text-xs text-slate-500">{importRows.length} students</span></div><button onClick={()=>setImportRows([])} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4"/></button></div><div className="max-h-64 overflow-auto"><table className="min-w-full text-xs"><thead className="sticky top-0 bg-white text-left text-slate-400"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Registration no.</th><th className="px-4 py-2">Email</th></tr></thead><tbody className="divide-y divide-slate-100">{importRows.slice(0,50).map((r,i)=><tr key={i}><td className="px-4 py-2 text-slate-700">{r.name}</td><td className="px-4 py-2 text-slate-600">{r.student_id||'Auto-generate'}</td><td className="px-4 py-2 text-slate-600">{r.email}</td></tr>)}</tbody></table></div></div>}<div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={()=>setModal(null)}>Cancel</Button><Button icon={Upload} loading={importing} disabled={!importRows.length} onClick={runImport}>Import {importRows.length || ''} students</Button></div></div></Modal>

    <Modal isOpen={credentials.length>0} onClose={()=>setCredentials([])} title="Student credentials created" size="lg"><div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-semibold text-emerald-900"><CheckCircle2 className="h-5 w-5"/> Accounts created successfully</div><p className="mt-1 text-sm text-emerald-700">Share each temporary password securely. Students will be asked to change it on first login.</p></div><div className="mt-5 max-h-72 overflow-auto rounded-2xl border border-slate-200"><table className="min-w-full text-xs"><thead className="bg-slate-50 text-left text-slate-400"><tr><th className="px-4 py-2">Student</th><th className="px-4 py-2">ID</th><th className="px-4 py-2">Temporary password</th></tr></thead><tbody className="divide-y divide-slate-100">{credentials.map((r,i)=><tr key={i}><td className="px-4 py-3"><div className="font-semibold text-slate-700">{r.name}</div><div className="text-slate-400">{r.email}</div></td><td className="px-4 py-3 font-mono text-slate-600">{r.student_id}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-slate-700">{r.temp_password}</code><button onClick={()=>navigator.clipboard?.writeText(r.temp_password)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Copy password"><Copy className="h-3.5 w-3.5"/></button></div></td></tr>)}</tbody></table></div><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" icon={Download} onClick={downloadCredentials}>Download credentials CSV</Button><Button onClick={()=>setCredentials([])}>Done</Button></div></div></Modal>

    <ConfirmDialog isOpen={Boolean(confirmStudent)} title={confirmStudent?.active?'Deactivate student':'Activate student'} message={confirmStudent?`Are you sure you want to ${confirmStudent.active?'deactivate':'activate'} ${confirmStudent.name}?`:''} onClose={()=>setConfirmStudent(null)} onConfirm={toggle} variant={confirmStudent?.active?'danger':'primary'} />
  </div>;
}
