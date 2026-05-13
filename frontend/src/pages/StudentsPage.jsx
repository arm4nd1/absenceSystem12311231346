import { useState } from "react";
import { UserPlus, Search, Pencil, Trash2, Fingerprint } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader     from "../components/PageHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal          from "../components/Modal";
import {
  useStudents, useCreateStudent, useUpdateStudent,
  useDeleteStudent, useAssignFingerprint,
} from "../hooks/useStudents";
import { useEnrollFingerprint } from "../hooks/useSessions";

function StudentForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name:          initial.name          || "",
    studentNumber: initial.studentNumber || "",
    email:         initial.email         || "",
  });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div>
        <label className="label">Full Name *</label>
        <input className="input" value={form.name} onChange={set("name")} required
               placeholder="Juan dela Cruz" />
      </div>
      <div>
        <label className="label">Student Number *</label>
        <input className="input" value={form.studentNumber} onChange={set("studentNumber")}
               required placeholder="2021-12345" />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={form.email} onChange={set("email")}
               placeholder="student@school.edu" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}

export default function StudentsPage() {
  const [search,       setSearch]       = useState("");
  const [showCreate,   setShowCreate]   = useState(false);
  const [editStudent,  setEditStudent]  = useState(null);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [fpId,         setFpId]         = useState("");

  const { data: students = [], isLoading } = useStudents();
  const createMutation   = useCreateStudent();
  const updateMutation   = useUpdateStudent();
  const deleteMutation   = useDeleteStudent();
  const assignMutation   = useAssignFingerprint();
  const enrollMutation   = useEnrollFingerprint();

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.studentNumber.includes(search)
  );

  async function handleCreate(data) {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Student created.");
      setShowCreate(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create student.");
    }
  }

  async function handleUpdate(data) {
    try {
      await updateMutation.mutateAsync({ id: editStudent.id, ...data });
      toast.success("Student updated.");
      setEditStudent(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update.");
    }
  }

  async function handleDelete(student) {
    if (!confirm(`Delete ${student.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(student.id);
      toast.success("Student deleted.");
    } catch (err) {
      toast.error("Failed to delete.");
    }
  }

  async function handleEnroll() {
    if (!fpId) return toast.error("Enter a fingerprint ID.");
    try {
      await enrollMutation.mutateAsync(Number(fpId));
      await assignMutation.mutateAsync({ id: enrollTarget.id, fingerprintId: Number(fpId) });
      toast.success(`Fingerprint enrollment started for ID ${fpId}. Please follow sensor prompts.`);
      setEnrollTarget(null);
      setFpId("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Enrollment failed.");
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Students"
        subtitle={`${students.length} students registered`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <UserPlus size={16} /> Add Student
          </button>
        }
      />

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-10"
          placeholder="Search by name or number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{search ? "No students match your search." : "No students yet."}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Student No.</th>
                <th className="table-header">Email</th>
                <th className="table-header">Fingerprint</th>
                <th className="table-header">Subjects</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="table-cell font-medium text-white">{s.name}</td>
                  <td className="table-cell font-mono">{s.studentNumber}</td>
                  <td className="table-cell text-slate-400">{s.email || "—"}</td>
                  <td className="table-cell">
                    {s.fingerprintId != null ? (
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <Fingerprint size={14} /> ID {s.fingerprintId}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">not enrolled</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className="text-slate-400">{s.subjects?.length || 0}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEnrollTarget(s); setFpId(s.fingerprintId ?? ""); }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400
                                   hover:bg-blue-500/10 transition-all"
                        title="Enroll fingerprint"
                      >
                        <Fingerprint size={15} />
                      </button>
                      <button
                        onClick={() => setEditStudent(s)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400
                                   hover:bg-amber-500/10 transition-all"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400
                                   hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Student">
        <StudentForm onSubmit={handleCreate} loading={createMutation.isPending} />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editStudent} onClose={() => setEditStudent(null)} title="Edit Student">
        {editStudent && (
          <StudentForm initial={editStudent} onSubmit={handleUpdate}
                       loading={updateMutation.isPending} />
        )}
      </Modal>

      {/* Enroll fingerprint modal */}
      <Modal isOpen={!!enrollTarget} onClose={() => setEnrollTarget(null)} title="Enroll Fingerprint">
        {enrollTarget && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
              <p className="font-semibold mb-1">{enrollTarget.name}</p>
              <p className="text-xs text-slate-400">
                Assign a fingerprint template slot ID (0–127) and the bridge will
                instruct the sensor to capture two scans.
              </p>
            </div>
            <div>
              <label className="label">Fingerprint Slot ID (0–127)</label>
              <input
                className="input"
                type="number"
                min={0} max={127}
                value={fpId}
                onChange={e => setFpId(e.target.value)}
                placeholder="e.g. 1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setEnrollTarget(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleEnroll}
                      disabled={enrollMutation.isPending || assignMutation.isPending}>
                <Fingerprint size={15} /> Start Enrollment
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
