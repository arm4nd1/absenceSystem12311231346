import { useState } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart2, Download, FileText, GraduationCap, AlertTriangle,
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
import { useMarks }            from "../hooks/useMarks";
import clsx from "clsx";

const ATTENDANCE_THRESHOLD = 90;

const DEFAULT_COMPONENTS = [
  { id: "midterm", name: "Midterm",    maxMark: 30 },
  { id: "final",   name: "Final Exam", maxMark: 50 },
  { id: "other",   name: "Coursework", maxMark: 20 },
];

function buildSemesters() {
  const year = new Date().getFullYear();
  const out  = [];
  for (let y = year + 1; y >= year - 3; y--) {
    out.push(`2nd Semester ${y - 1}-${y}`);
    out.push(`1st Semester ${y - 1}-${y}`);
  }
  return out;
}

// UoS grading scale
function gradeLabel(pct) {
  if (pct >= 90) return "Excellent";
  if (pct >= 80) return "Very Good";
  if (pct >= 70) return "Good";
  if (pct >= 60) return "Medium";
  if (pct >= 50) return "Pass";
  return "Fail";
}

function downloadAcademicCSV(rows, components, subject, semester) {
  const maxTotal = components.reduce((s, c) => s + c.maxMark, 0);
  const headers = [
    "Student", "Student No.",
    ...components.map(c => `${c.name} (/${c.maxMark})`),
    "Total", "Attendance %", "Grade", "Att. Status", "Final Status",
  ];
  const data = rows.map(r => [
    r.studentName, r.studentNumber,
    ...components.map(c => r.scores?.[c.id] ?? ""),
    r.total ?? "",
    r.attPct !== null ? `${r.attPct}%` : "N/A",
    r.total !== null && !r.attFail
      ? gradeLabel(maxTotal > 0 ? (r.total / maxTotal) * 100 : 0) : "—",
    r.attFail ? "FAIL (Att.)" : "OK",
    r.finalStatus,
  ]);
  const csv  = [headers, ...data].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `academic_report_${subject?.code || ""}_${semester}.csv`;
  a.click();
}

function downloadAcademicPDF(rows, components, subject, semester) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("Academic Report", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`Subject: ${subject?.name || ""}  (${subject?.code || ""})`, 14, 26);
  doc.text(`Semester: ${semester}`, 14, 32);
  doc.text(`Generated: ${format(new Date(), "yyyy-MM-dd HH:mm")}`, 14, 38);

  const maxTotal = components.reduce((s, c) => s + c.maxMark, 0);
  autoTable(doc, {
    startY: 46,
    head: [[
      "Student", "No.",
      ...components.map(c => `${c.name}\n/${c.maxMark}`),
      `Total\n/${maxTotal}`, "Attend.", "Grade", "Status",
    ]],
    body: rows.map(r => [
      r.studentName, r.studentNumber,
      ...components.map(c => r.scores?.[c.id] ?? "—"),
      r.total ?? "—",
      r.attPct !== null ? `${r.attPct}%` : "—",
      r.total !== null && !r.attFail
        ? gradeLabel(maxTotal > 0 ? (r.total / maxTotal) * 100 : 0) : "—",
      r.finalStatus,
    ]),
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell(data) {
      if (data.section === "body") {
        const row = rows[data.row.index];
        if (row?.finalStatus === "PASS") data.cell.styles.textColor = [16, 185, 129];
        else if (row?.finalStatus?.startsWith("FAIL")) data.cell.styles.textColor = [239, 68, 68];
      }
    },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });
  doc.save(`academic_report_${subject?.code || ""}_${semester}.pdf`);
}

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
  const semesters  = buildSemesters();

  const [subjectId,  setSubjectId]  = useState("");
  const [startDate,  setStartDate]  = useState(monthStart);
  const [endDate,    setEndDate]    = useState(today);
  const [activeTab,  setActiveTab]  = useState("students");
  const [semester,   setSemester]   = useState(semesters[0]);

  const { data: subjects = [] } = useSubjects();
  const { data: report, isLoading, isError } = useAttendanceReport(subjectId, startDate, endDate);
  const { data: marks = [], isLoading: marksLoading } = useMarks(
    activeTab === "academic" ? subjectId : null,
    semester,
  );

  const selectedSubject = subjects.find(s => s.id === subjectId);
  const components = selectedSubject?.gradeComponents || DEFAULT_COMPONENTS;

  // Build merged academic rows from attendance report + marks
  const academicRows = (() => {
    if (!report) return [];
    return report.byStudent.map(s => {
      const mark    = marks.find(m => m.studentId === s.studentId);
      const attPct  = s.total > 0 ? Math.round(((s.present + s.late) / s.total) * 100) : null;
      const attFail = attPct !== null && attPct < ATTENDANCE_THRESHOLD;
      const total   = mark?.total ?? null;
      const maxTotal = components.reduce((acc, c) => acc + c.maxMark, 0);
      let finalStatus;
      if (attFail)          finalStatus = "FAIL (Att.)";
      else if (mark?.isResit) finalStatus = "RE-SIT";
      else if (total === null) finalStatus = "—";
      else if (total >= Math.round(maxTotal * 0.5)) finalStatus = "PASS";
      else finalStatus = "FAIL";

      return {
        studentId:     s.studentId,
        studentName:   s.studentName,
        studentNumber: s.studentNumber,
        scores:        mark?.scores || {},
        total,
        attPct,
        attFail,
        finalStatus,
        present: s.present, late: s.late, absent: s.absent,
      };
    });
  })();

  return (
    <div className="p-8">
      <PageHeader
        title="Reports"
        subtitle="Attendance analytics and export"
        actions={
          report && (
            <div className="flex gap-2">
              {activeTab !== "academic" ? (
                <>
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
                </>
              ) : (
                <>
                  <button
                    onClick={() => downloadAcademicCSV(academicRows, components, selectedSubject, semester)}
                    className="btn-secondary"
                  >
                    <Download size={16} /> CSV
                  </button>
                  <button
                    onClick={() => downloadAcademicPDF(academicRows, components, selectedSubject, semester)}
                    className="btn-secondary"
                  >
                    <FileText size={16} /> PDF
                  </button>
                </>
              )}
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
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
              {[
                { id: "students", label: "By Student" },
                { id: "trend",    label: "Trend" },
                { id: "academic", label: "Academic Report" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                          ${activeTab === tab.id
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:text-slate-200"}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Semester selector only shown for Academic tab */}
            {activeTab === "academic" && (
              <select
                className="input text-sm"
                value={semester}
                onChange={e => setSemester(e.target.value)}
              >
                {semesters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {activeTab === "academic" ? (
            marksLoading ? <LoadingSpinner className="py-20" /> : (
            <div className="card p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/40 border-b border-slate-800">
                  <tr>
                    <th className="table-header">Student</th>
                    <th className="table-header">No.</th>
                    {components.map(c => (
                      <th key={c.id} className="table-header text-center">
                        {c.name}
                        <span className="block text-xs text-slate-600 font-normal">/ {c.maxMark}</span>
                      </th>
                    ))}
                    <th className="table-header text-center">Total</th>
                    <th className="table-header text-center">Attend.</th>
                    <th className="table-header text-center">Grade</th>
                    <th className="table-header text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {academicRows.map(row => (
                    <tr key={row.studentId}
                        className={clsx(
                          "transition-colors",
                          row.attFail ? "bg-red-950/20" : "hover:bg-slate-800/20"
                        )}>
                      <td className="table-cell font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          {row.attFail && <AlertTriangle size={12} className="text-red-400 shrink-0" />}
                          {row.studentName}
                        </div>
                      </td>
                      <td className="table-cell font-mono text-slate-400 text-sm">{row.studentNumber}</td>
                      {components.map(c => (
                        <td key={c.id} className="table-cell text-center text-slate-300">
                          {row.scores?.[c.id] ?? <span className="text-slate-700">—</span>}
                        </td>
                      ))}
                      <td className="table-cell text-center">
                        {row.total !== null ? (
                          <span className={clsx("font-semibold text-sm",
                            row.attFail ? "text-slate-500"
                            : row.total >= components.reduce((s,c)=>s+c.maxMark,0)*0.6 ? "text-emerald-400"
                            : row.total >= components.reduce((s,c)=>s+c.maxMark,0)*0.5 ? "text-amber-400"
                            : "text-red-400"
                          )}>
                            {row.total}
                          </span>
                        ) : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        {row.attPct !== null ? (
                          <span className={clsx(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            row.attPct >= ATTENDANCE_THRESHOLD ? "bg-emerald-500/15 text-emerald-400"
                              : row.attPct >= 75 ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400"
                          )}>
                            {row.attPct}%
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        {row.total !== null && !row.attFail ? (
                          <span className="text-xs text-slate-300">
                            {gradeLabel(components.reduce((s,c)=>s+c.maxMark,0) > 0
                              ? (row.total / components.reduce((s,c)=>s+c.maxMark,0)) * 100 : 0)}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="table-cell text-center">
                        <span className={clsx(
                          "text-xs font-bold px-2.5 py-1 rounded-full border",
                          row.finalStatus === "PASS"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : row.finalStatus === "RE-SIT"
                            ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                          : row.finalStatus === "—"
                            ? "bg-slate-800 text-slate-600 border-slate-700"
                          : "bg-red-500/15 text-red-400 border-red-500/30"
                        )}>
                          {row.finalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )
          ) : activeTab === "students" ? (
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
              <h3 className="text-base font-semibold text-white mb-4">Daily Attendance Trend — {startDate} to {endDate}</h3>
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
