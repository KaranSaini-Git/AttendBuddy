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

export default function Sections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, section: null });
  const [formData, setFormData] = useState({ section_name: '', semester: '', academic_year: '' });
  const [formLoading, setFormLoading] = useState(false);
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    setLoading(true);
    try {
      const res = await api.get('/teacher/sections');
      setSections(res.data || []);
    } catch (error) {
      showToast('Failed to fetch sections', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (section = null) => {
    if (section) {
      setEditingSection(section);
      setFormData({ section_name: section.section_name, semester: section.semester, academic_year: section.academic_year });
    } else {
      setEditingSection(null);
      setFormData({ section_name: '', semester: '', academic_year: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingSection) {
        await api.put(`/teacher/sections/${editingSection.id}`, formData);
        showToast('Section updated successfully', 'success');
      } else {
        await api.post('/teacher/sections', formData);
        showToast('Section created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchSections();
    } catch (error) {
      showToast(error.response?.data?.message || 'Error saving section', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!confirmDialog.section) return;
    try {
      await api.put(`/teacher/sections/${confirmDialog.section.id}`, { active: !confirmDialog.section.active });
      showToast('Section status updated', 'success');
      setConfirmDialog({ isOpen: false, section: null });
      fetchSections();
    } catch (error) {
      showToast('Error updating status', 'error');
    }
  };

  const columns = [
    { key: 'section_name', label: 'Section Name' },
    { key: 'semester', label: 'Semester' },
    { key: 'academic_year', label: 'Academic Year' },
    { key: 'student_count', label: 'Students Enrolled' },
    { key: 'active', label: 'Status', render: (active) => <Badge variant={active ? 'success' : 'danger'}>{active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', label: 'Actions', render: (_, section) => (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => handleOpenModal(section)}>Edit</Button>
        <Button size="sm" variant={section.active ? 'danger' : 'success'} onClick={() => setConfirmDialog({ isOpen: true, section })}>
          {section.active ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    ) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sections</h1>
        <Button onClick={() => handleOpenModal()}>Add Section</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Spinner /></div>
          ) : (
            <Table columns={columns} data={sections} emptyMessage="No sections found." />
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSection ? 'Edit Section' : 'Add Section'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Section Name" value={formData.section_name} onChange={(e) => setFormData({...formData, section_name: e.target.value})} required />
          <Input type="number" label="Semester" value={formData.semester} onChange={(e) => setFormData({...formData, semester: e.target.value})} required />
          <Input label="Academic Year (e.g. 2023-2024)" value={formData.academic_year} onChange={(e) => setFormData({...formData, academic_year: e.target.value})} required />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={formLoading}>Save</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.section?.active ? 'Deactivate Section' : 'Activate Section'}
        message={`Are you sure you want to ${confirmDialog.section?.active ? 'deactivate' : 'activate'} section ${confirmDialog.section?.section_name}?`}
        onClose={() => setConfirmDialog({ isOpen: false, section: null })}
        onConfirm={toggleStatus}
        variant={confirmDialog.section?.active ? 'danger' : 'primary'}
      />
    </div>
  );
}
