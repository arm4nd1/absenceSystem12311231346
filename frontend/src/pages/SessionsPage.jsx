import { useState } from "react";
import { format } from "date-fns";
import {
  Play, Square, Fingerprint, Wifi, WifiOff,
  RefreshCw, AlertCircle, Clock, XCircle,
} from "lucide-react";
import toast            from "react-hot-toast";
import PageHeader       from "../components/PageHeader";
import LoadingSpinner   from "../components/LoadingSpinner";
import {
  useActiveSessions, useSessionHistory, useBridgeStatus,
  useOpenSession, useCloseSession,
  useEnrollFingerprint, useDeleteFingerprint,
} from "../hooks/useSessions";
import { useStudents }   from "../hooks/useStudents";
import { useSubjects }   from "../hooks/useSubjects";
import { useRealtimeAttendance } from "../hooks/useAttendance";
import StatusBadge       from "../components/StatusBadge";

export default function SessionsPage() {
  const [selectedSubject, setSelectedSubject] = useState("");
  const [enrollFpId,      setEnrollFpId]      = useState("");

  const { data: bridge,   isLoading: bridgeLoading, refetch: refetchBridge } = useBridgeStatus();
  const { data: sessions = [] }     = useActiveSessions();
  const { data: history  = [] }     = useSessionHistory();
  const { data: subjects = [] }     = useSubjects();
  const { data: students = [] }     = useStudents();
  const openSession    = useOpenSession();
  const closeSession   = useCloseSession();
  const enrollFp       = useEnrollFingerprint();
  const deleteFp       = useDeleteFingerprint();

  const today = format(new Date(), "yyyy-MM-dd");
  // Use active session's subject if available, otherwise show all of today's scans
  const activeSubjectId = sessions[0]?.subjectId || null;
  const { records: liveRecords, loading: liveLoading } =
    useRealtimeAttendance(activeSubjectId, today);

  const hasActiveSession = sessions.length > 0;

  const getSubjectName = id => subjects.find(s => s.id === id)?.name || id;

  async function handleOpen() {
    if (!selectedSubject) return toast.error("Select a subject first.");
    try {
      await openSession.mutateAsync(selectedSubject);
      toast.success("Session opened – scanner is now active.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to open session.");
    }
  }

  async function handleClose() {
    try {
      await closeSession.mutateAsync();
      toast.success("Session closed.");
    } catch { toast.error("Failed to close session."); }
  }

  async function handleEnroll() {
    if (!enrollFpId) return toast.error("Enter a fingerprint ID.");
    try {
      await enrollFp.mutateAsync(Number(enrollFpId));
      toast.success(`Enrollment started for slot ${enrollFpId}. Place finger on sensor twice.`);
    } catch { toast.error("Enrollment command failed."); }
  }

  async function handleDeleteFp() {
    if (!enrollFpId) return toast.error("Enter a fingerprint ID.");
    if (!confirm(`Delete fingerprint slot ${enrollFpId}?`)) return;
    try {
      await deleteFp.mutateAsync(Number(enrollFpId));
      toast.success("Fingerprint deleted from sensor.");
    } catch { toast.error("Delete command failed."); }
  }

  return (
    <div className="p-8">
      <PageHeader title="Sessions" subtitle="Control fingerprint scanner and attendance sessions" />

      {/* Bridge status banner */}
      <div className={`flex items-center gap-4 p-4 rounded-2xl border mb-6
                       ${bridge
                         ? "bg-emerald-500/10 border-emerald-500/20"
                         : "bg-red-500/10 border-red-500/20"}`}>
        {bridgeLoading ? (
          <LoadingSpinner size="sm" />
        ) : bridge ? (
          <Wifi size={20} className="text-emerald-400 shrink-0" />
        ) : (
          <WifiOff size={20} className="text-red-400 shrink-0" />
        )}
        <div className="flex-1">
          <p className={`text-sm font-semibold ${bridge ? "text-emerald-300" : "text-red-300"}`}>
            Bridge {bridge ? "Connected" : "Offline"}
          </p>
          <p className="text-xs text-slate-500">
            {bridge
              ? `Session: ${bridge.sessionOpen ? `OPEN – ${bridge.activeSubjectId}` : "closed"}`
              : "Python bridge is not running or unreachable at localhost:5050"}
          </p>
        </div>
        <button onClick={refetchBridge} className="btn-secondary py-1.5">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Session control */}
        <div className="card">
          <h3 className="text-base font-semibold text-white mb-4">Session Control</h3>

          {sessions.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-300 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                  Session Active
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Subject: {getSubjectName(sessions[0].subjectId)}
                </p>
              </div>
              <button onClick={handleClose} disabled={closeSession.isPending}
                      className="btn-danger w-full justify-center py-3">
                <Square size={16} />
                {closeSession.isPending ? "Closing…" : "Close Session"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Select Subject</label>
                <select className="input" value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}>
                  <option value="">Choose a subject…</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <button onClick={handleOpen} disabled={openSession.isPending || !bridge}
                      className="btn-success w-full justify-center py-3">
                <Play size={16} />
                {openSession.isPending ? "Opening…" : "Start Session"}
              </button>
              {!bridge && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={12} /> Bridge must be online to start a session.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fingerprint management */}
        <div className="card">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Fingerprint size={18} className="text-blue-400" />
            Fingerprint Management
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Enter the slot ID (0–127) stored on the R307 sensor module.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Slot ID</label>
              <input className="input" type="number" min={0} max={127}
                     value={enrollFpId} onChange={e => setEnrollFpId(e.target.value)}
                     placeholder="0" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEnroll} disabled={enrollFp.isPending || !bridge}
                      className="btn-primary flex-1 justify-center">
                <Fingerprint size={15} /> Enroll
              </button>
              <button onClick={handleDeleteFp} disabled={deleteFp.isPending || !bridge}
                      className="btn-danger flex-1 justify-center">
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Live attendance feed */}
        <div className="card lg:col-span-2">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${sessions.length > 0 ? "bg-emerald-400 animate-pulse-dot" : "bg-slate-600"}`} />
            Live Attendance Feed
            {activeSubjectId && (
              <span className="text-xs text-slate-500 ml-auto">
                {getSubjectName(activeSubjectId)}
              </span>
            )}
          </h3>
          {liveLoading ? (
            <LoadingSpinner size="sm" className="py-8" />
          ) : liveRecords.length === 0 ? (
            <div className="text-center py-10 text-slate-600">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {hasActiveSession ? "Waiting for scans…" : "Open a session to start scanning"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="table-header">Name</th>
                    <th className="table-header">Student No.</th>
                    <th className="table-header">Time</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">FP Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {liveRecords.map(r => {
                    const ts = r.timestamp?.toDate
                      ? r.timestamp.toDate()
                      : r.timestamp?.seconds
                        ? new Date(r.timestamp.seconds * 1000)
                        : null;
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="table-cell font-medium text-white">{r.studentName}</td>
                        <td className="table-cell font-mono text-slate-400">{r.studentNumber}</td>
                        <td className="table-cell">{ts ? format(ts, "HH:mm:ss") : "—"}</td>
                        <td className="table-cell"><StatusBadge status={r.status} /></td>
                        <td className="table-cell text-slate-500">{r.score ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Session history */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Session History</h3>
            {history.some(s => s.isActive) && (
              <button
                onClick={() => {
                  if (confirm("Force-close ALL active sessions?")) handleClose();
                }}
                className="btn-danger py-1.5 text-xs"
              >
                <XCircle size={13} /> Close All Active
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-600 py-4 text-center">No past sessions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="table-header">Subject</th>
                    <th className="table-header">Date</th>
                    <th className="table-header">Start</th>
                    <th className="table-header">End</th>
                    <th className="table-header">Status</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map(s => {
                    const start = s.startTime?.toDate ? s.startTime.toDate()
                      : s.startTime?.seconds ? new Date(s.startTime.seconds * 1000) : null;
                    const end   = s.endTime?.toDate   ? s.endTime.toDate()
                      : s.endTime?.seconds   ? new Date(s.endTime.seconds * 1000)   : null;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="table-cell text-white">{getSubjectName(s.subjectId)}</td>
                        <td className="table-cell">{s.date}</td>
                        <td className="table-cell">{start ? format(start, "HH:mm") : "—"}</td>
                        <td className="table-cell">{end   ? format(end,   "HH:mm") : "—"}</td>
                        <td className="table-cell">
                          {s.isActive ? (
                            <span className="badge-present">● Active</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-400">Closed</span>
                          )}
                        </td>
                        <td className="table-cell text-right">
                          {s.isActive && (
                            <button
                              onClick={() => {
                                if (confirm(`Close session for ${getSubjectName(s.subjectId)}?`))
                                  handleClose();
                              }}
                              disabled={closeSession.isPending}
                              className="btn-danger py-1 px-2.5 text-xs"
                            >
                              <Square size={11} /> Close
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
