import React, { useState, useEffect } from "react";
import api from "@/services/api";
import { useToast } from "@/context/ToastContext";
import { Card, CardContent } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    assignment: null,
  });

  const [formData, setFormData] = useState({
    section_id: "",
    subject_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    room: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  const { showToast } = useToast();

  const days = [
    { value: "Monday", label: "Monday" },
    { value: "Tuesday", label: "Tuesday" },
    { value: "Wednesday", label: "Wednesday" },
    { value: "Thursday", label: "Thursday" },
    { value: "Friday", label: "Friday" },
    { value: "Saturday", label: "Saturday" },
    { value: "Sunday", label: "Sunday" },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, sectionsRes, subjectsRes] = await Promise.all([
        api.get("/teacher/assignments"),
        api.get("/teacher/sections"),
        api.get("/teacher/subjects"),
      ]);
      setAssignments(assignmentsRes.data || []);
      setSections(sectionsRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (error) {
      showToast("Failed to fetch assignments data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (assignment = null) => {
    if (assignment) {
      setEditingAssignment(assignment);
      setFormData({
        section_id: String(assignment.section_id ?? ""),
        subject_id: String(assignment.subject_id ?? ""),
        day_of_week: assignment.day || "",
        start_time: assignment.start_time,
        end_time: assignment.end_time,
        room: assignment.room || "",
      });
    } else {
      setEditingAssignment(null);
      setFormData({
        section_id: "",
        subject_id: "",
        day_of_week: "",
        start_time: "",
        end_time: "",
        room: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.section_id ||
      !formData.subject_id ||
      !formData.day_of_week ||
      !formData.start_time ||
      !formData.end_time
    ) {
      showToast("Please complete all required fields.", "error");
      return;
    }

    if (formData.start_time >= formData.end_time) {
      showToast("End time must be later than start time.", "error");
      return;
    }

    setFormLoading(true);
    try {
      if (editingAssignment) {
        const payload = { ...formData, day: formData.day_of_week };
        delete payload.day_of_week;
        await api.put(`/teacher/assignments/${editingAssignment.id}`, payload);
        showToast("Assignment updated successfully", "success");
      } else {
        const payload = { ...formData, day: formData.day_of_week };
        delete payload.day_of_week;
        await api.post("/teacher/assignments", payload);
        showToast("Assignment created successfully", "success");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "Error saving assignment";
      showToast(message, "error");
      console.error("Assignment save failed:", error.response?.data || error);
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!confirmDialog.assignment) return;
    try {
      await api.put(`/teacher/assignments/${confirmDialog.assignment.id}`, {
        active: !confirmDialog.assignment.active,
      });
      showToast("Assignment status updated", "success");
      setConfirmDialog({ isOpen: false, assignment: null });
      fetchData();
    } catch (error) {
      showToast("Error updating status", "error");
    }
  };

  const columns = [
    { key: "section_name", label: "Section" },
    { key: "subject_name", label: "Subject" },
    { key: "day_of_week", label: "Day" },
    {
      key: "time",
      label: "Time",
      render: (_, a) => `${a.start_time} - ${a.end_time}`,
    },
    { key: "room", label: "Room" },
    {
      key: "active",
      label: "Status",
      render: (active) => (
        <Badge variant={active ? "success" : "danger"}>
          {active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, assignment) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal(assignment)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant={assignment.active ? "danger" : "success"}
            onClick={() => setConfirmDialog({ isOpen: true, assignment })}
          >
            {assignment.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Teaching Assignments
        </h1>
        <Button onClick={() => handleOpenModal()}>Add Assignment</Button>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Spinner />
            </div>
          ) : (
            <Table
              columns={columns}
              data={assignments}
              emptyMessage="No teaching assignments found."
            />
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? "Edit Assignment" : "Add Assignment"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Section"
            value={formData.section_id}
            onChange={(e) =>
              setFormData({ ...formData, section_id: e.target.value })
            }
            options={sections.map((s) => ({
              value: String(s.id),
              label: s.section_name,
            }))}
            required
          />
          <Select
            label="Subject"
            value={formData.subject_id}
            onChange={(e) =>
              setFormData({ ...formData, subject_id: e.target.value })
            }
            options={subjects.map((s) => ({
              value: String(s.id),
              label: s.subject_name,
            }))}
            required
          />
          <Select
            label="Day"
            value={formData.day_of_week}
            onChange={(e) =>
              setFormData({ ...formData, day_of_week: e.target.value })
            }
            options={days}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="time"
              label="Start Time"
              value={formData.start_time}
              onChange={(e) =>
                setFormData({ ...formData, start_time: e.target.value })
              }
              required
            />
            <Input
              type="time"
              label="End Time"
              value={formData.end_time}
              onChange={(e) =>
                setFormData({ ...formData, end_time: e.target.value })
              }
              required
            />
          </div>
          <Input
            label="Room"
            value={formData.room}
            onChange={(e) => setFormData({ ...formData, room: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.assignment?.active
            ? "Deactivate Assignment"
            : "Activate Assignment"
        }
        message={`Are you sure you want to ${confirmDialog.assignment?.active ? "deactivate" : "activate"} this assignment?`}
        onClose={() => setConfirmDialog({ isOpen: false, assignment: null })}
        onConfirm={toggleStatus}
        variant={confirmDialog.assignment?.active ? "danger" : "primary"}
      />
    </div>
  );
}
