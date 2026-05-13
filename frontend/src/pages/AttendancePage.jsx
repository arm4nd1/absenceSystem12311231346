import { useState } from "react";
import { format } from "date-fns";
import {
  ClipboardPlus, Filter, Trash2, Pencil, RefreshCw,
} from "lucide-react";
import toast           from "react-hot-toast";
import PageHeader      from "../components/PageHeader";
import LoadingSpinner  from "../components/LoadingSpinner";
import StatusBadge     from "../components/StatusBadge";
import Modal           from "../components/Modal";
import {
  useAttendance, useUpdateAttendanceStatus,
  useDeleteAttendance, useCreateAttendance,
  useRealtimeAttendance,
} from "../hooks/useAttendance";
import { useStudents } from "../hooks/useStudents";
import { useSubjects } from "../hooks/useSubjects";

const STATUSES = ["present", "late", "absent", "excused"];

export default function AttendancePage() {
  const today = format(new Date(), "yyyy-MM-dd");

  const [filterSubject, setFilterSubject] = useState("");
  const [filterDate,    setFilterDate]    = useState(today);
  const [filterStatus,  setFilterStatus]  = useState("");
  const [showCreate,    setShowCreate]    = useState(false);
  const [editRecord,    setEditRecord]    = useState(null);
  const [liveMode,      setLiveMode]      = useState(true);

  const { data: students = [] } = useStudents();
  const { data: subjects = [] } = useSubjects();

  // REST query for historical / filtered data
  const { data: restRecords = [], isLoading: restLoading, refetch } = useAttendance({
    ...(filterSubject && { subjectId: filterSubject }),
    ...(filterDate    && { date:      filterDate    }),
    ...(filterStatus  && { status:    filterStatus  }),
  });

  // Realtime listener for today live mode
  const { records: liveRecords, loading: liveLoading } =
    useRealtimeAttendance(filterSubject || null, liveMode ? filterDate : null);

  const records  = liveMode ? liveRecords : restRecords;
  const loading  = liveMode ? liveLoading : restLoading;

  const updateMutation = useUpdateAttendanceStatus();
  const deleteMutation = useDeleteAttendance();
  const createMutation = useCreateAttendance();

  const getSubjectName = id => subjects.find(s => s.id === id)?.name || id;
  const getStudentName = id => students.find(s => s.id === id)?.name || id;

  async function handleStatusChange(id, status) {
    try {
      await updateMutation.mutateAsync({ id, status });
      toast.success("Status updated.");
      setEditRecord(null);
    } catch { toast.error("Failed to update."); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this attendance record?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Record deleted.");
    } catch { toast.error("Failed."); }
  }

  // Create manual form
  const [createForm, setCreateForm] = useState({
    studentId: "", subjectId: "", date: today, status: "present"
  });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(createForm);
      toast.success("Attendance record created.");
      setShowCreate(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed.");
    }
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Attendance"
        subtitle={`${records.length} records`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveMode(m => !m)}
              className={`btn ${liveMode ? "btn-success" : "btn-secondary"}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${liveMode ? "bg-white animate-pulse-dot" : "bg-slate-500"}`} />
              {liveMode ? "Live" : "Snapshot"}
            </button>
            {!liveMode && (
              <button className="btn-secondary" onClick={() => refetch()}>
                <RefreshCw size={14} />
              </button>
            )}
            <button className="btn-primary" onClick={() => setShowCreate(true)}>
              <ClipboardPlus size={16} /> Manual Entry
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input w-auto" value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <input type="date" className="input w-auto" value={filterDate}
               onChange={e => setFilterDate(e.target.value)} />

        <select className="input w-auto" value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : records.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Filter size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No attendance records match your filters.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Student</th>
                <th className="table-header">Student No.</th>
                <th className="table-header">Subject</th>
                <th className="table-header">Date</th>
                <th className="table-header">Time</th>
                <th className="table-header">Status</th>
                <th className="table-header">FP ID</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {records.map(r => {
                const ts = r.timestamp?.toDate
                  ? r.timestamp.toDate()
                  : r.timestamp?.seconds
                    ? new Date(r.timestamp.seconds * 1000)
                    : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="table-cell font-medium text-white">{r.studentName || getStudentName(r.studentId)}</td>
                    <td className="table-cell font-mono text-slate-400">{r.studentNumber || "—"}</td>
                    <td className="table-cell text-slate-400">{getSubjectName(r.subjectId)}</td>
                    <td className="table-cell">{r.date}</td>
                    <td className="table-cell text-slate-400">
                      {ts ? format(ts, "HH:mm:ss") : "—"}
                    </td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                    <td className="table-cell text-slate-500">{r.fingerprintId ?? "—"}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setEditRecord(r)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400
                                           hover:bg-amber-500/10 transition-all">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(r.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400
                                           hover:bg-red-500/10 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual entry modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Manual Entry">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Student *</label>
            <select className="input" required value={createForm.studentId}
                    onChange={e => setCreateForm(f => ({ ...f, studentId: e.target.value }))}>
              <option value="">Select student…</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} – {s.studentNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Subject *</label>
            <select className="input" required value={createForm.subjectId}
                    onChange={e => setCreateForm(f => ({ ...f, subjectId: e.target.value }))}>
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" required value={createForm.date}
                     onChange={e => setCreateForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={createForm.status}
                      onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Save</button>
          </div>
        </form>
      </Modal>

      {/* Edit status modal */}
      <Modal isOpen={!!editRecord} onClose={() => setEditRecord(null)} title="Change Status">
        {editRecord && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              <span className="text-white font-medium">{editRecord.studentName}</span>
              {" · "}{getSubjectName(editRecord.subjectId)}{" · "}{editRecord.date}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button key={s} onClick={() => handleStatusChange(editRecord.id, s)}
                        className={`btn ${editRecord.status === s ? "btn-primary" : "btn-secondary"} justify-center`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
