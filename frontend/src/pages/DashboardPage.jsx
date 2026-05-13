import { format } from "date-fns";
import {
  Users, BookOpen, CheckCircle2, Clock3,
  XCircle, Activity, Fingerprint, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend,
} from "recharts";
import PageHeader       from "../components/PageHeader";
import LoadingSpinner   from "../components/LoadingSpinner";
import StatusBadge      from "../components/StatusBadge";
import { useAttendanceSummary, useRealtimeAttendance } from "../hooks/useAttendance";
import { useActiveSessions, useBridgeStatus }          from "../hooks/useSessions";
import { useSubjects } from "../hooks/useSubjects";

const STATUS_COLORS = {
  present: "#10b981",
  late:    "#f59e0b",
  absent:  "#ef4444",
  excused: "#38bdf8",
};

function StatCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colors = {
    blue:    "bg-blue-500/10   text-blue-400",
    green:   "bg-emerald-500/10 text-emerald-400",
    yellow:  "bg-amber-500/10  text-amber-400",
    red:     "bg-red-500/10    text-red-400",
    indigo:  "bg-indigo-500/10 text-indigo-400",
  };
  return (
    <div className="stat-card">
      <div className={`inline-flex p-2.5 rounded-xl ${colors[color]} w-fit`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-3xl font-bold text-white">{value ?? "—"}</p>
        <p className="text-sm text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: summary, isLoading: sumLoading } = useAttendanceSummary();
  const { data: sessions = [] }                  = useActiveSessions();
  const { data: subjects = [] }                  = useSubjects();
  const { data: bridge }                         = useBridgeStatus();
  const { records, loading: recLoading }         = useRealtimeAttendance(null, today);

  const pieData = summary
    ? Object.entries(summary.statusToday || {})
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  const getSubjectName = (id) =>
    subjects.find(s => s.id === id)?.name || id;

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${format(new Date(), "EEEE, MMMM d yyyy")}`}
      />

      {sumLoading ? (
        <LoadingSpinner className="mt-20" />
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users}      label="Total Students"  value={summary?.totalStudents}  color="blue"   />
            <StatCard icon={BookOpen}   label="Total Subjects"  value={summary?.totalSubjects}  color="indigo" />
            <StatCard icon={CheckCircle2} label="Today's Scans" value={summary?.todayScans}     color="green"  />
            <StatCard icon={Activity}   label="Active Sessions" value={summary?.activeSessions} color="yellow"
                      sub={summary?.activeSessions > 0 ? "● scanning now" : "no active session"} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {/* Attendance breakdown bar */}
            <div className="card lg:col-span-2">
              <h3 className="text-base font-semibold text-white mb-4">
                Today's Status Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[summary?.statusToday || {}].map(s => ({
                  present: s.present || 0,
                  late:    s.late    || 0,
                  absent:  s.absent  || 0,
                  excused: s.excused || 0,
                }))}>
                  <XAxis hide />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155",
                                    borderRadius: 12, fontSize: 13 }}
                    cursor={{ fill: "#ffffff08" }}
                  />
                  <Bar dataKey="present" fill={STATUS_COLORS.present} radius={[6,6,0,0]} name="Present" />
                  <Bar dataKey="late"    fill={STATUS_COLORS.late}    radius={[6,6,0,0]} name="Late"    />
                  <Bar dataKey="absent"  fill={STATUS_COLORS.absent}  radius={[6,6,0,0]} name="Absent"  />
                  <Bar dataKey="excused" fill={STATUS_COLORS.excused} radius={[6,6,0,0]} name="Excused" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div className="card flex flex-col">
              <h3 className="text-base font-semibold text-white mb-4">Distribution</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#64748b"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155",
                                      borderRadius: 12, fontSize: 13 }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
                  No data for today
                </div>
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Active sessions */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${sessions.length > 0 ? "bg-emerald-400 animate-pulse-dot" : "bg-slate-600"}`} />
                Active Sessions
              </h3>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  <Fingerprint size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active sessions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id}
                         className="flex items-center justify-between p-3 rounded-xl
                                    bg-emerald-500/10 border border-emerald-500/20">
                      <div>
                        <p className="text-sm font-medium text-emerald-300">
                          {getSubjectName(s.subjectId)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Started {s.startTime?.toDate
                            ? format(s.startTime.toDate(), "HH:mm")
                            : "—"}
                        </p>
                      </div>
                      <span className="text-xs text-emerald-400 font-semibold">● LIVE</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent scans */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Clock3 size={16} className="text-slate-400" />
                Recent Scans Today
              </h3>
              {recLoading ? (
                <LoadingSpinner size="sm" className="py-8" />
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  <Activity size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No scans yet today</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {records.slice(0, 10).map(r => (
                    <div key={r.id}
                         className="flex items-center justify-between py-2 border-b
                                    border-slate-800/60 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-200">{r.studentName}</p>
                        <p className="text-xs text-slate-500">
                          {r.timestamp?.toDate
                            ? format(r.timestamp.toDate(), "HH:mm:ss")
                            : r.date}
                          {" · "}{getSubjectName(r.subjectId)}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
