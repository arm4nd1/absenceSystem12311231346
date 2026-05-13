import { format } from "date-fns";
import { useAuth } from "../context/AuthContext";
import { useRealtimeAttendance } from "../hooks/useAttendance";
import { useSubjects }           from "../hooks/useSubjects";
import PageHeader    from "../components/PageHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge   from "../components/StatusBadge";
import { UserCircle, Fingerprint } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();

  // students view their own attendance via Firestore real-time
  const { records, loading } = useRealtimeAttendance(null, null);
  const { data: subjects = [] } = useSubjects();

  // For student role, filter to only their records
  const myRecords = user?.studentId
    ? records.filter(r => r.studentId === user.studentId)
    : records;

  const getSubjectName = id => subjects.find(s => s.id === id)?.name || id;

  const stats = myRecords.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    { present: 0, late: 0, absent: 0, excused: 0 }
  );

  return (
    <div className="p-8">
      <PageHeader title="My Profile" subtitle="Your attendance overview" />

      {/* Profile card */}
      <div className="card mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600
                        flex items-center justify-center text-2xl font-bold text-white uppercase shrink-0">
          {user?.name?.[0] || user?.email?.[0] || "?"}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{user?.name || "—"}</h2>
          <p className="text-sm text-slate-400">{user?.email}</p>
          <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block
                           bg-slate-500/20 text-slate-400 capitalize">{user?.role}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Present",  value: stats.present,  cls: "text-emerald-400" },
          { label: "Late",     value: stats.late,     cls: "text-amber-400"   },
          { label: "Absent",   value: stats.absent,   cls: "text-red-400"     },
          { label: "Excused",  value: stats.excused,  cls: "text-sky-400"     },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent records */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">Attendance History</h3>
        </div>
        {loading ? (
          <LoadingSpinner className="py-16" />
        ) : myRecords.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <Fingerprint size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No attendance records found.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Subject</th>
                <th className="table-header">Date</th>
                <th className="table-header">Time</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {myRecords.map(r => {
                const ts = r.timestamp?.toDate
                  ? r.timestamp.toDate()
                  : r.timestamp?.seconds
                    ? new Date(r.timestamp.seconds * 1000) : null;
                return (
                  <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="table-cell text-white">{getSubjectName(r.subjectId)}</td>
                    <td className="table-cell">{r.date}</td>
                    <td className="table-cell text-slate-400">{ts ? format(ts, "HH:mm") : "—"}</td>
                    <td className="table-cell"><StatusBadge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
