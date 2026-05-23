const { getDb } = require("../config/firebase");

const MODEL = "gemini-2.5-flash";
const BASE  = "https://generativelanguage.googleapis.com/v1/models";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set in .env");
  return key;
}

async function callGemini(contents) {
  const res = await fetch(
    `${BASE}/${MODEL}:generateContent?key=${apiKey()}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contents }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || res.statusText;
    const e   = new Error(msg);
    e.status  = res.status;
    throw e;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── Build system context from live Firestore data ─────────────────────────

async function buildContext() {
  const db = getDb();

  const [studentsSnap, subjectsSnap, attendanceSnap, marksSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("subjects").get(),
    db.collection("attendance").orderBy("timestamp", "desc").limit(200).get(),
    db.collection("marks").get(),
  ]);

  const students  = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const subjects  = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allAttendance = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const allMarks   = marksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Only consider data for students that currently exist
  const activeStudentIds = new Set(students.map(s => s.id));
  const attendance = allAttendance.filter(r => activeStudentIds.has(r.studentId));
  const marks      = allMarks.filter(m => activeStudentIds.has(m.studentId));

  // Attendance stats per student
  const attByStudent = {};
  for (const rec of attendance) {
    if (!attByStudent[rec.studentId]) {
      attByStudent[rec.studentId] = { present: 0, late: 0, absent: 0, total: 0, name: rec.studentName };
    }
    attByStudent[rec.studentId].total++;
    if (rec.status === "present") attByStudent[rec.studentId].present++;
    else if (rec.status === "late") attByStudent[rec.studentId].late++;
    else if (rec.status === "absent") attByStudent[rec.studentId].absent++;
  }

  // At-risk students (below 90%)
  const atRisk = Object.entries(attByStudent)
    .filter(([, s]) => s.total > 0 && ((s.present + s.late) / s.total) * 100 < 90)
    .map(([id, s]) => ({
      id,
      name:    s.name,
      attPct:  Math.round(((s.present + s.late) / s.total) * 100),
      absent:  s.absent,
      total:   s.total,
    }));

  // Marks summary
  const marksByStudent = {};
  for (const m of marks) {
    if (!marksByStudent[m.studentId]) marksByStudent[m.studentId] = [];
    marksByStudent[m.studentId].push({ subject: m.subjectName, total: m.total, semester: m.semester, isResit: m.isResit });
  }

  // Build compact subject list with enrolled counts
  const subjectList = subjects.map(s => ({
    name:     s.name,
    code:     s.code,
    enrolled: (s.students || []).length,
  }));

  return {
    totalStudents:  students.length,
    totalSubjects:  subjects.length,
    totalAttendanceRecords: attendance.length,
    subjects: subjectList,
    atRiskStudents: atRisk,
    recentAttendance: attendance.slice(0, 20).map(r => ({
      student: r.studentName,
      subject: subjects.find(s => s.id === r.subjectId)?.name || r.subjectId,
      status:  r.status,
      date:    r.date,
    })),
    marksOverview: marks.slice(0, 50).map(m => ({
      student:  m.studentName,
      subject:  m.subjectName,
      total:    m.total,
      semester: m.semester,
      isResit:  m.isResit,
    })),
  };
}

function buildSystemPrompt(ctx) {
  return `You are an intelligent academic assistant integrated into AttendFP — the official 
Fingerprint-Based Attendance Management System of the University of Sulaimani (UoS), 
College of Science, Department of Computer Science.

You have access to live data from the system. Here is the current data snapshot:

OVERVIEW:
- Total students: ${ctx.totalStudents}
- Total subjects: ${ctx.totalSubjects}
- Total attendance records: ${ctx.totalAttendanceRecords}

SUBJECTS:
${ctx.subjects.map(s => `  • ${s.code} – ${s.name} (${s.enrolled} enrolled)`).join("\n")}

AT-RISK STUDENTS (attendance < 90% — automatic fail per UoS policy):
${ctx.atRiskStudents.length === 0
  ? "  None — all students are above 90% attendance."
  : ctx.atRiskStudents.map(s =>
      `  • ${s.name}: ${s.attPct}% attendance (${s.absent} absences out of ${s.total} sessions)`
    ).join("\n")}

RECENT ATTENDANCE (last 20 records):
${ctx.recentAttendance.map(r =>
  `  • ${r.student} – ${r.subject} – ${r.status} on ${r.date}`
).join("\n")}

MARKS (latest 50):
${ctx.marksOverview.map(m =>
  `  • ${m.student} – ${m.subject} – ${m.semester} – Total: ${m.total ?? "not entered"}${m.isResit ? " [RE-SIT]" : ""}`
).join("\n")}

UoS GRADING SCALE:
  90-100: Excellent | 80-89: Very Good | 70-79: Good | 60-69: Medium | 50-59: Pass | <50: Fail
  Students below 90% attendance FAIL regardless of marks.

INSTRUCTIONS:
- Answer questions concisely and helpfully based on the data above.
- If asked for a list of at-risk students, give names and percentages.
- If asked about a specific student, find them in the data and summarise their status.
- If data is not available, say so honestly.
- Keep responses under 200 words unless more detail is specifically requested.
- You may give recommendations (e.g. "Student X should attend all remaining sessions to reach 90%").
- Respond in the same language as the user's question (English or Kurdish).`;
}

// ── Controllers ───────────────────────────────────────────────────────────

async function chat(req, res, next) {
  try {
    const { message, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message is required." });

    const ctx       = await buildContext();
    const systemMsg = buildSystemPrompt(ctx);

    // Build contents array: system context first, then history, then current message
    const contents = [
      { role: "user",  parts: [{ text: systemMsg }] },
      { role: "model", parts: [{ text: "Understood. I'm ready to assist with the AttendFP system. How can I help you?" }] },
      ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user",  parts: [{ text: message }] },
    ];

    const response = await callGemini(contents);
    res.json({ response });
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY")) {
      return res.status(503).json({ error: "AI not configured. Add GEMINI_API_KEY to backend/.env." });
    }
    next(err);
  }
}

async function insights(req, res, next) {
  try {
    const ctx    = await buildContext();
    const prompt = `${buildSystemPrompt(ctx)}

Based on the data above, generate a concise academic insights report with 3-5 bullet points.
Focus on:
1. Overall attendance health
2. Students at risk of failing due to attendance
3. Grade performance summary
4. Any patterns or concerns worth highlighting

Format each point starting with an emoji and keep it brief (1-2 sentences each).`;

    const text = await callGemini([{ role: "user", parts: [{ text: prompt }] }]);
    res.json({ insights: text });
  } catch (err) {
    if (err.message?.includes("GEMINI_API_KEY")) {
      return res.status(503).json({ error: "AI not configured. Add GEMINI_API_KEY to backend/.env." });
    }
    next(err);
  }
}

module.exports = { chat, insights };
