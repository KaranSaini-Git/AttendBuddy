import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useToast } from '@/context/ToastContext';
import { Card, CardContent } from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, subject: null });
  const [formData, setFormData] = useState({ subject_code: '', subject_name: '' });
  const [formLoading, setFormLoading] = useState(false);
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teacher/subjects');
      setSubjects(res.data || []);
    } catch (error) {
      showToast('Failed to fetch subjects', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (subject = null) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({ subject_code: subject.subject_code, subject_name: subject.subject_name });
    } else {
      setEditingSubject(null);
      setFormData({ subject_code: '', subject_name: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingSubject) {
        await api.put(`/teacher/subjects/${editingSubject.id}`, formData);
        showToast('Subject updated successfully', 'success');
      } else {
        await api.post('/teacher/subjects', formData);
        showToast('Subject created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchSubjects();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error saving subject', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!confirmDialog.subject) return;
    try {
      await api.put(`/teacher/subjects/${confirmDialog.subject.id}`, { active: !confirmDialog.subject.active });
      showToast('Subject status updated', 'success');
      setConfirmDialog({ isOpen: false, subject: null });
      fetchSubjects();
    } catch (error) {
      showToast('Error updating status', 'error');
    }
  };

  const columns = [
    { key: 'subject_code', label: 'Subject Code' },
    { key: 'subject_name', label: 'Subject Name' },
    { key: 'active', label: 'Status', render: (active) => <Badge variant={active ? 'success' : 'danger'}>{active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: 'Actions', render: (_, subject) => (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => handleOpenModal(subject)}>Edit</Button>
        <Button size="sm" variant={subject.active ? 'danger' : 'success'} onClick={() => setConfirmDialog({ isOpen: true, subject })}>
          {subject.active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    ) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subjects</h1>
        <Button onClick={() => handleOpenModal()}>Add Subject</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : (
            <Table columns={columns} data={subjects} emptyMessage="No subjects found." />
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSubject ? 'Edit Subject' : 'Add Subject'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Subject Code" value={formData.subject_code} onChange={(e) => setFormData({...formData, subject_code: e.target.value})} required />
          <Input label="Subject Name" value={formData.subject_name} onChange={(e) => setFormData({...formData, subject_name: e.target.value})} required />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={formLoading}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.subject?.active ? 'Deactivate Subject' : 'Activate Subject'}
        message={`Are you sure you want to ${confirmDialog.subject?.active ? 'deactivate' : 'activate'} subject ${confirmDialog.subject?.subject_name}?`}
        onClose={() => setConfirmDialog({ isOpen: false, subject: null })}
        onConfirm={toggleStatus}
        variant={confirmDialog.subject?.active ? 'danger' : 'primary'}
      />
    </div>
  );
}
