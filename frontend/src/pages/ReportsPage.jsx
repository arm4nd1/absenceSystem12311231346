import { useState } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart2, Download, FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";
import PageHeader     from "../components/PageHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import StatusBadge    from "../components/StatusBadge";
import { useAttendanceReport } from "../hooks/useAttendance";
import { useSubjects }         from "../hooks/useSubjects";

const STATUS_COLORS = {
  present: "#10b981",
  late:    "#f59e0b",
  absent:  "#ef4444",
  excused: "#38bdf8",
};

function downloadCSV(data, filename) {
  const headers = ["Student","Student No.","Present","Late","Absent","Excused","Total","Rate%"];
  const rows = data.map(d => [
    d.studentName, d.studentNumber,
    d.present, d.late, d.absent, d.excused, d.total,
    d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0,
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function downloadPDF(report, subjectName, startDate, endDate) {
  const doc = new jsPDF({ orientation: "landscape" });

  // Header
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("Attendance Report", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Subject: ${subjectName}`, 14, 26);
  doc.text(`Period:  ${startDate} → ${endDate}`, 14, 32);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 14, 38);

  // Summary row
  const totalPresent = report.byStudent.reduce((s, r) => s + r.present, 0);
  const totalLate    = report.byStudent.reduce((s, r) => s + r.late,    0);
  const totalAbsent  = report.byStudent.reduce((s, r) => s + r.absent,  0);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Students: ${report.byStudent.length}   Records: ${report.totalRecords}   ` +
    `Present: ${totalPresent}   Late: ${totalLate}   Absent: ${totalAbsent}`,
    14, 46
  );

  // Table
  autoTable(doc, {
    startY: 52,
    head: [["Student", "No.", "Present", "Late", "Absent", "Excused", "Total", "Rate %"]],
    body: report.byStudent.map(s => {
      const rate = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : 0;
      return [s.studentName, s.studentNumber, s.present, s.late, s.absent, s.excused, s.total, `${rate}%`];
    }),
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 60 },
      7: { halign: "right" },
    },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`attendance_${subjectName}_${startDate}_${endDate}.pdf`);
}

export default function ReportsPage() {
  const today      = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [subjectId,  setSubjectId]  = useState("");
  const [startDate,  setStartDate]  = useState(monthStart);
  const [endDate,    setEndDate]    = useState(today);
  const [activeTab,  setActiveTab]  = useState("students");

  const { data: subjects = [] } = useSubjects();
  const { data: report, isLoading, isError } = useAttendanceReport(subjectId, startDate, endDate);

  const selectedSubject = subjects.find(s => s.id === subjectId);

  return (
    <div className="p-8">
      <PageHeader
        title="Reports"
        subtitle="Attendance analytics and export"
        actions={
          report && (
            <div className="flex gap-2">
              <button
                onClick={() => downloadCSV(report.byStudent,
                  `attendance_${subjectId}_${startDate}_${endDate}.csv`)}
                className="btn-secondary"
              >
                <Download size={16} /> CSV
              </button>
              <button
                onClick={() => downloadPDF(
                  report,
                  selectedSubject?.name || subjectId,
                  startDate, endDate
                )}
                className="btn-secondary"
              >
                <FileText size={16} /> PDF
              </button>
            </div>
          )
        }
      />

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Subject *</label>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">Select a subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={startDate}
                   onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={endDate}
                   onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {!subjectId ? (
        <div className="text-center py-20 text-slate-600">
          <BarChart2 size={48} className="mx-auto mb-4 opacity-20" />
          <p>Select a subject to generate the report.</p>
        </div>
      ) : isLoading ? (
        <LoadingSpinner className="py-20" />
      ) : isError ? (
        <div className="text-center py-20 text-red-400">Failed to load report data.</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Records", value: report.totalRecords, color: "text-blue-400" },
              { label: "Students",      value: report.byStudent.length, color: "text-indigo-400" },
              { label: "Session Days",  value: report.byDate.length, color: "text-amber-400" },
              {
                label: "Avg Attendance Rate",
                value: report.byStudent.length > 0
                  ? Math.round(
                      report.byStudent.reduce((acc, s) =>
                        acc + (s.total > 0 ? ((s.present + s.late) / s.total) * 100 : 0), 0
                      ) / report.byStudent.length
                    ) + "%"
                  : "—",
                color: "text-emerald-400"
              },
            ].map(c => (
              <div key={c.label} className="stat-card">
                <p className={`text-3xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-sm text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
            {["students", "trend"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                        ${activeTab === tab
                          ? "bg-blue-600 text-white"
                          : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "students" ? "By Student" : "Trend"}
              </button>
            ))}
          </div>

          {activeTab === "students" ? (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/40 border-b border-slate-800">
                  <tr>
                    <th className="table-header">Student</th>
                    <th className="table-header">No.</th>
                    <th className="table-header text-center text-emerald-400">Present</th>
                    <th className="table-header text-center text-amber-400">Late</th>
                    <th className="table-header text-center text-red-400">Absent</th>
                    <th className="table-header text-center text-sky-400">Excused</th>
                    <th className="table-header text-center">Total</th>
                    <th className="table-header text-center">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.byStudent.map(s => {
                    const rate = s.total > 0
                      ? Math.round(((s.present + s.late) / s.total) * 100)
                      : 0;
                    return (
                      <tr key={s.studentId} className="hover:bg-slate-800/20 transition-colors">
                        <td className="table-cell font-medium text-white">{s.studentName}</td>
                        <td className="table-cell font-mono text-slate-400">{s.studentNumber}</td>
                        <td className="table-cell text-center text-emerald-400">{s.present}</td>
                        <td className="table-cell text-center text-amber-400">{s.late}</td>
                        <td className="table-cell text-center text-red-400">{s.absent}</td>
                        <td className="table-cell text-center text-sky-400">{s.excused}</td>
                        <td className="table-cell text-center">{s.total}</td>
                        <td className="table-cell text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                              <div className="h-1.5 rounded-full bg-blue-500"
                                   style={{ width: `${rate}%` }} />
                            </div>
                            <span className={`text-xs font-semibold min-w-10 text-right
                              ${rate >= 80 ? "text-emerald-400"
                                : rate >= 60 ? "text-amber-400"
                                : "text-red-400"}`}>
                              {rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Daily Attendance Trend</h3>
              {report.byDate.length === 0 ? (
                <div className="text-center py-12 text-slate-600">No date data available.</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={report.byDate}
                            margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }}
                           axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }}
                           axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155",
                                      borderRadius: 12, fontSize: 13 }}
                      cursor={{ fill: "#ffffff05" }}
                    />
                    <Legend iconType="circle" iconSize={8}
                            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                    <Bar dataKey="present" stackId="a" fill={STATUS_COLORS.present}
                         name="Present" radius={[0,0,0,0]} />
                    <Bar dataKey="late"    stackId="a" fill={STATUS_COLORS.late}
                         name="Late" />
                    <Bar dataKey="absent"  stackId="a" fill={STATUS_COLORS.absent}
                         name="Absent" />
                    <Bar dataKey="excused" stackId="a" fill={STATUS_COLORS.excused}
                         name="Excused" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
