import { useState, useCallback } from "react";
import { GraduationCap, Save, ChevronDown, AlertTriangle, Download, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import PageHeader     from "../components/PageHeader";
import LoadingSpinner from "../components/LoadingSpinner";
import { useSubjects }  from "../hooks/useSubjects";
import { useStudents }  from "../hooks/useStudents";
import { useAttendance } from "../hooks/useAttendance";
import { useMarks, useUpsertMark } from "../hooks/useMarks";

const ATTENDANCE_THRESHOLD = 90; // below this % = fail regardless of marks

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
  if (pct >= 90) return { label: "Excellent",  cls: "text-emerald-300" };
  if (pct >= 80) return { label: "Very Good",  cls: "text-emerald-400" };
  if (pct >= 70) return { label: "Good",       cls: "text-blue-400"    };
  if (pct >= 60) return { label: "Medium",     cls: "text-amber-400"   };
  if (pct >= 50) return { label: "Pass",       cls: "text-yellow-500"  };
  return           { label: "Fail",        cls: "text-red-400"     };
}

function totalColor(total, maxTotal) {
  const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  if (pct >= 70) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

function attColor(pct) {
  if (pct >= ATTENDANCE_THRESHOLD) return "bg-emerald-500/15 text-emerald-400";
  if (pct >= 75) return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
}

function ScoreCell({ value, maxMark, onChange, saving }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState("");

  const display = value !== undefined && value !== null && value !== "" ? value : "—";

  function startEdit() {
    setDraft(value !== undefined && value !== null && value !== "" ? String(value) : "");
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const n = draft === "" ? null : Number(draft);
    if (draft !== "" && (isNaN(n) || n < 0 || n > maxMark)) {
      toast.error(`Value must be between 0 and ${maxMark}`);
      return;
    }
    onChange(n);
  }

  if (editing) {
    return (
      <input
        type="number"
        min={0}
        max={maxMark}
        className="w-16 text-center bg-slate-700 border border-blue-500 rounded-lg
                   text-white text-sm px-2 py-1 outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      disabled={saving}
      className={clsx(
        "w-16 text-center rounded-lg px-2 py-1 text-sm transition-all",
        "hover:bg-slate-700 hover:text-white",
        value !== undefined && value !== null && value !== ""
          ? "text-slate-200"
          : "text-slate-600",
      )}
    >
      {display}
    </button>
  );
}

export default function MarksPage() {
  const semesters = buildSemesters();

  const [subjectId, setSubjectId] = useState("");
  const [semester,  setSemester]  = useState(semesters[0]);
  const [pending,   setPending]   = useState({});  // { studentId: { compId: value } }

  const { data: subjects = [], isLoading: loadingSubs } = useSubjects();
  const { data: students = [] }                         = useStudents();
  const { data: marks    = [], isLoading: loadingMarks } = useMarks(subjectId, semester);
  const { data: attData  = [] } = useAttendance(subjectId ? { subjectId } : {});
  const upsert = useUpsertMark();

  const subject    = subjects.find(s => s.id === subjectId);
  const components = subject?.gradeComponents || DEFAULT_COMPONENTS;
  const maxTotal   = components.reduce((s, c) => s + Number(c.maxMark), 0);

  const enrolledIds = subject?.students || [];
  const enrolled    = students.filter(s => enrolledIds.includes(s.id));

  // attendance % per student
  const attByStudent = {};
  for (const rec of attData) {
    if (!attByStudent[rec.studentId]) attByStudent[rec.studentId] = { present: 0, total: 0 };
    attByStudent[rec.studentId].total++;
    if (rec.status === "present" || rec.status === "late") attByStudent[rec.studentId].present++;
  }

  function getStoredMark(studentId) {
    return marks.find(m => m.studentId === studentId);
  }

  function getScore(studentId, compId) {
    if (pending[studentId]?.[compId] !== undefined) return pending[studentId][compId];
    const stored = getStoredMark(studentId);
    return stored?.scores?.[compId] ?? "";
  }

  function handleScoreChange(studentId, compId, value) {
    setPending(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), [compId]: value },
    }));
  }

  const saveStudent = useCallback(async (studentId) => {
    if (!subjectId || !semester) return;

    const stored  = getStoredMark(studentId);
    const base    = stored?.scores || {};
    const changes = pending[studentId] || {};
    const scores  = { ...base };
    let isResit   = stored?.isResit || false;

    for (const [k, v] of Object.entries(changes)) {
      if (k === "isResit") { isResit = v; continue; }
      scores[k] = v === null || v === "" ? null : Number(v);
    }

    try {
      await upsert.mutateAsync({ studentId, subjectId, scores, semester, isResit });
      setPending(prev => { const n = { ...prev }; delete n[studentId]; return n; });
      toast.success("Marks saved.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save.");
    }
  }, [subjectId, semester, pending, marks, upsert]);

  function calcRowTotal(studentId) {
    return components.reduce((sum, comp) => {
      const v = getScore(studentId, comp.id);
      return sum + (v !== "" && v !== null && v !== undefined ? Number(v) : 0);
    }, 0);
  }

  const hasPending = (studentId) =>
    pending[studentId] && Object.keys(pending[studentId]).length > 0;

  function exportCSV() {
    const headers = [
      "Student", "Student No.",
      ...components.map(c => `${c.name} (/${c.maxMark})`),
      `Total (/${maxTotal})`, "Attendance %", "Grade", "Status",
    ];
    const rows = enrolled.map(student => {
      const att     = attByStudent[student.id];
      const attPct  = att ? Math.round((att.present / att.total) * 100) : null;
      const attFail = attPct !== null && attPct < ATTENDANCE_THRESHOLD;
      const total   = calcRowTotal(student.id);
      const stored  = getStoredMark(student.id);
      const isResit = stored?.isResit || false;
      const status  = attFail ? "FAIL (Attendance)" : isResit ? "RE-SIT" : total >= 50 ? "PASS" : "FAIL";
      return [
        student.name,
        student.studentNumber,
        ...components.map(c => getScore(student.id, c.id) ?? ""),
        total,
        attPct !== null ? `${attPct}%` : "N/A",
        attFail ? "—" : gradeLabel(maxTotal > 0 ? (total / maxTotal) * 100 : 0).label,
        status,
      ];
    });
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `marks_${subject?.code || subjectId}_${semester}.csv`;
    a.click();
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Marks"
        subtitle="Enter and manage student grades per subject"
        icon={<GraduationCap size={22} />}
        actions={
          subjectId && enrolled.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary">
              <Download size={15} /> Export CSV
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Subject */}
        <div className="relative">
          <select
            className="input pr-10 appearance-none min-w-[220px]"
            value={subjectId}
            onChange={e => { setSubjectId(e.target.value); setPending({}); }}
            disabled={loadingSubs}
          >
            <option value="">-- Select Subject --</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.code} – {s.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        {/* Semester */}
        <div className="relative">
          <select
            className="input pr-10 appearance-none min-w-[200px]"
            value={semester}
            onChange={e => { setSemester(e.target.value); setPending({}); }}
          >
            {semesters.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Grade component legend */}
      {subject && (
        <div className="flex flex-wrap gap-2 mb-5">
          {components.map(c => (
            <span key={c.id}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {c.name} <span className="text-slate-500">/ {c.maxMark}</span>
            </span>
          ))}
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-600 font-medium">
            Total / {maxTotal}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-900/30 text-red-400 border border-red-800/40 flex items-center gap-1">
            <AlertTriangle size={11} /> Below {ATTENDANCE_THRESHOLD}% attendance = FAIL
          </span>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {!subjectId ? (
          <div className="text-center py-20 text-slate-600">
            <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a subject to view and enter marks.</p>
          </div>
        ) : loadingMarks ? (
          <LoadingSpinner className="py-20" />
        ) : enrolled.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <p className="text-sm">No students enrolled in this subject.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-800/40 border-b border-slate-800">
              <tr>
                <th className="table-header">Student</th>
                <th className="table-header">Number</th>
                {components.map(c => (
                  <th key={c.id} className="table-header text-center">
                    {c.name}
                    <span className="block text-xs text-slate-600 font-normal">/ {c.maxMark}</span>
                  </th>
                ))}
                <th className="table-header text-center">
                  Total
                  <span className="block text-xs text-slate-600 font-normal">/ {maxTotal}</span>
                </th>
                <th className="table-header text-center">Attend.</th>
                <th className="table-header text-center">Grade</th>
                <th className="table-header text-center">Re-sit</th>
                <th className="table-header text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {enrolled.map(student => {
                const rowTotal    = calcRowTotal(student.id);
                const att         = attByStudent[student.id];
                const attPct      = att ? Math.round((att.present / att.total) * 100) : null;
                const attFail     = attPct !== null && attPct < ATTENDANCE_THRESHOLD;
                const dirty       = hasPending(student.id);
                const stored      = getStoredMark(student.id);
                const isResit     = pending[student.id]?.isResit !== undefined
                  ? pending[student.id].isResit
                  : (stored?.isResit || false);

                return (
                  <tr key={student.id}
                      className={clsx(
                        "transition-colors",
                        attFail  ? "bg-red-950/20"
                        : dirty  ? "bg-blue-950/30"
                        : "hover:bg-slate-800/20"
                      )}>
                    <td className="table-cell font-medium text-white">
                      <div className="flex items-center gap-2">
                        {attFail && (
                          <AlertTriangle size={13} className="text-red-400 shrink-0" title="Below 90% attendance — FAIL" />
                        )}
                        {student.name}
                      </div>
                    </td>
                    <td className="table-cell font-mono text-slate-400 text-sm">{student.studentNumber}</td>
                    {components.map(comp => (
                      <td key={comp.id} className="table-cell text-center">
                        <ScoreCell
                          value={getScore(student.id, comp.id)}
                          maxMark={comp.maxMark}
                          onChange={v => handleScoreChange(student.id, comp.id, v)}
                          saving={upsert.isPending}
                        />
                      </td>
                    ))}
                    <td className="table-cell text-center">
                      {attFail ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                          FAIL (Att.)
                        </span>
                      ) : (
                        <span className={clsx("font-semibold text-sm", totalColor(rowTotal, maxTotal))}>
                          {rowTotal}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      {attPct !== null ? (
                        <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", attColor(attPct))}>
                          {attPct}%
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      {(() => {
                        if (attFail) return <span className="text-xs text-red-400">—</span>;
                        const pct = maxTotal > 0 ? (rowTotal / maxTotal) * 100 : 0;
                        const g   = gradeLabel(pct);
                        return <span className={`text-xs font-medium ${g.cls}`}>{g.label}</span>;
                      })()}
                    </td>
                    <td className="table-cell text-center">
                      <button
                        onClick={() => handleScoreChange(student.id, "isResit", !isResit)}
                        title="Mark as re-sit"
                        className={clsx(
                          "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all",
                          isResit
                            ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                            : "bg-slate-800 text-slate-600 border-slate-700 hover:text-orange-400"
                        )}
                      >
                        <RotateCcw size={10} />
                        {isResit ? "Yes" : "No"}
                      </button>
                    </td>
                    <td className="table-cell text-right">
                      {dirty && (
                        <button
                          onClick={() => saveStudent(student.id)}
                          disabled={upsert.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                     bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium
                                     transition-colors disabled:opacity-50"
                        >
                          <Save size={12} /> Save
                        </button>
                      )}
                    </td>
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
