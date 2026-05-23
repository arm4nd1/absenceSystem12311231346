import { useState } from "react";
import { BookPlus, Search, Pencil, Trash2, UserPlus, UserMinus, BarChart2, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import PageHeader     from "../components/PageHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal          from "../components/Modal";
import {
  useSubjects, useCreateSubject, useUpdateSubject,
  useDeleteSubject, useEnrollStudent, useUnenrollStudent,
} from "../hooks/useSubjects";
import { useStudents } from "../hooks/useStudents";
import { useUpdateGradeComponents } from "../hooks/useMarks";

const DEFAULT_COMPONENTS = [
  { id: "midterm", name: "Midterm",    maxMark: 30 },
  { id: "final",   name: "Final Exam", maxMark: 50 },
  { id: "other",   name: "Coursework", maxMark: 20 },
];

function GradeComponentsModal({ subject, onClose }) {
  const [components, setComponents] = useState(
    subject.gradeComponents?.length ? subject.gradeComponents : DEFAULT_COMPONENTS
  );
  const updateMutation = useUpdateGradeComponents();
  const total = components.reduce((s, c) => s + (Number(c.maxMark) || 0), 0);

  function addRow() {
    setComponents(prev => [
      ...prev,
      { id: `comp_${Date.now()}`, name: "", maxMark: 0 },
    ]);
  }

  function removeRow(idx) {
    setComponents(prev => prev.filter((_, i) => i !== idx));
  }

  function update(idx, field, value) {
    setComponents(prev => prev.map((c, i) =>
      i === idx ? { ...c, [field]: field === "maxMark" ? Number(value) : value } : c
    ));
  }

  async function handleSave() {
    for (const c of components) {
      if (!c.name.trim()) { toast.error("All components need a name."); return; }
      if (Number(c.maxMark) < 0) { toast.error("Max mark must be >= 0."); return; }
    }
    try {
      await updateMutation.mutateAsync({ subjectId: subject.id, gradeComponents: components });
      toast.success("Grade components saved.");
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Configure the grade breakdown for this subject. Click a field to edit it.
      </p>

      <div className="space-y-2">
        {components.map((comp, idx) => (
          <div key={comp.id} className="flex items-center gap-3">
            <input
              className="input flex-1"
              placeholder="Component name (e.g. Midterm)"
              value={comp.name}
              onChange={e => update(idx, "name", e.target.value)}
            />
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                className="input w-20 text-center"
                placeholder="Max"
                value={comp.maxMark}
                onChange={e => update(idx, "maxMark", e.target.value)}
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">pts</span>
            </div>
            <button
              onClick={() => removeRow(idx)}
              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        <Plus size={14} /> Add component
      </button>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <span className={`text-sm font-medium ${total === 100 ? "text-emerald-400" : "text-amber-400"}`}>
          Total: {total} / 100{total !== 100 && " (should be 100)"}
        </span>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="btn-primary"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function SubjectForm({ initial = {}, onSubmit, loading }) {
  const [form, setForm] = useState({
    name:       initial.name       || "",
    code:       initial.code       || "",
    instructor: initial.instructor || "",
    schedule:   initial.schedule   || "",
  });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Subject Name *</label>
          <input className="input" value={form.name} onChange={set("name")} required
                 placeholder="Software Engineering" />
        </div>
        <div>
          <label className="label">Code *</label>
          <input className="input" value={form.code} onChange={set("code")} required
                 placeholder="CS401" />
        </div>
        <div>
          <label className="label">Schedule</label>
          <input className="input" value={form.schedule} onChange={set("schedule")}
                 placeholder="MWF 08:00–09:30" />
        </div>
        <div className="col-span-2">
          <label className="label">Instructor</label>
          <input className="input" value={form.instructor} onChange={set("instructor")}
                 placeholder="Dr. Jose Rizal" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary">Save</button>
      </div>
    </form>
  );
}

export default function SubjectsPage() {
  const [search,          setSearch]          = useState("");
  const [showCreate,      setShowCreate]      = useState(false);
  const [editSubject,     setEditSubject]     = useState(null);
  const [rosterSubject,   setRosterSubject]   = useState(null);
  const [gradesSubject,   setGradesSubject]   = useState(null);

  const { data: subjects = [], isLoading } = useSubjects();
  const { data: students = [] }            = useStudents();
  const createMutation   = useCreateSubject();
  const updateMutation   = useUpdateSubject();
  const deleteMutation   = useDeleteSubject();
  const enrollMutation   = useEnrollStudent();
  const unenrollMutation = useUnenrollStudent();

  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(data) {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Subject created.");
      setShowCreate(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed.");
    }
  }

  async function handleUpdate(data) {
    try {
      await updateMutation.mutateAsync({ id: editSubject.id, ...data });
      toast.success("Subject updated.");
      setEditSubject(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed.");
    }
  }

  async function handleDelete(sub) {
    if (!confirm(`Delete ${sub.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(sub.id);
      toast.success("Subject deleted.");
    } catch { toast.error("Failed to delete."); }
  }

  async function handleEnroll(studentId) {
    try {
      await enrollMutation.mutateAsync({ subjectId: rosterSubject.id, studentId });
      toast.success("Student enrolled.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed.");
    }
  }

  async function handleUnenroll(studentId) {
    try {
      await unenrollMutation.mutateAsync({ subjectId: rosterSubject.id, studentId });
      toast.success("Student unenrolled.");
    } catch { toast.error("Failed."); }
  }

  // get enrolled students for current roster subject
  const enrolledIds  = rosterSubject?.students || [];
  const notEnrolled  = students.filter(s => !enrolledIds.includes(s.id));
  const enrolled     = students.filter(s =>  enrolledIds.includes(s.id));

  return (
    <div className="p-8">
      <PageHeader
        title="Subjects"
        subtitle={`${subjects.length} subjects`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <BookPlus size={16} /> Add Subject
          </button>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Search subjects…"
               value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <BookPlus size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No subjects yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Subject</th>
                <th className="table-header">Code</th>
                <th className="table-header">Instructor</th>
                <th className="table-header">Schedule</th>
                <th className="table-header">Students</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="table-cell font-medium text-white">{s.name}</td>
                  <td className="table-cell font-mono text-blue-400">{s.code}</td>
                  <td className="table-cell text-slate-400">{s.instructor || "—"}</td>
                  <td className="table-cell text-slate-400">{s.schedule || "—"}</td>
                  <td className="table-cell">{s.students?.length || 0}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setRosterSubject(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400
                                         hover:bg-blue-500/10 transition-all" title="Manage roster">
                        <UserPlus size={15} />
                      </button>
                      <button onClick={() => setGradesSubject(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400
                                         hover:bg-purple-500/10 transition-all" title="Grade components">
                        <BarChart2 size={15} />
                      </button>
                      <button onClick={() => setEditSubject(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400
                                         hover:bg-amber-500/10 transition-all">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(s)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400
                                         hover:bg-red-500/10 transition-all">
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

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Subject">
        <SubjectForm onSubmit={handleCreate} loading={createMutation.isPending} />
      </Modal>

      <Modal isOpen={!!editSubject} onClose={() => setEditSubject(null)} title="Edit Subject">
        {editSubject && (
          <SubjectForm initial={editSubject} onSubmit={handleUpdate}
                       loading={updateMutation.isPending} />
        )}
      </Modal>

      {/* Grade Components modal */}
      <Modal isOpen={!!gradesSubject} onClose={() => setGradesSubject(null)}
             title={`Grade Components – ${gradesSubject?.name}`}>
        {gradesSubject && (
          <GradeComponentsModal subject={gradesSubject} onClose={() => setGradesSubject(null)} />
        )}
      </Modal>

      {/* Roster modal */}
      <Modal isOpen={!!rosterSubject} onClose={() => setRosterSubject(null)}
             title={`Roster – ${rosterSubject?.name}`} wide>
        {rosterSubject && (
          <div className="grid grid-cols-2 gap-6">
            {/* Enrolled */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Enrolled ({enrolled.length})
              </h4>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {enrolled.length === 0 && (
                  <p className="text-xs text-slate-600 py-4 text-center">No students enrolled.</p>
                )}
                {enrolled.map(s => (
                  <div key={s.id}
                       className="flex items-center justify-between px-3 py-2 rounded-lg
                                  bg-slate-800/60">
                    <div>
                      <p className="text-sm text-slate-200">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.studentNumber}</p>
                    </div>
                    <button onClick={() => handleUnenroll(s.id)}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                      <UserMinus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Available */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Add Students ({notEnrolled.length})
              </h4>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {notEnrolled.length === 0 && (
                  <p className="text-xs text-slate-600 py-4 text-center">All students enrolled.</p>
                )}
                {notEnrolled.map(s => (
                  <div key={s.id}
                       className="flex items-center justify-between px-3 py-2 rounded-lg
                                  bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
                    <div>
                      <p className="text-sm text-slate-200">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.studentNumber}</p>
                    </div>
                    <button onClick={() => handleEnroll(s.id)}
                            className="p-1 text-slate-600 hover:text-emerald-400 transition-colors">
                      <UserPlus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
