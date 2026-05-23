const { getDb } = require("../config/firebase");

const COLLECTION = "marks";

const DEFAULT_COMPONENTS = [
  { id: "midterm", name: "Midterm",    maxMark: 30 },
  { id: "final",   name: "Final Exam", maxMark: 50 },
  { id: "other",   name: "Coursework", maxMark: 20 },
];

async function getBySubject(req, res, next) {
  try {
    const { subjectId, semester } = req.query;
    if (!subjectId) return res.status(400).json({ error: "subjectId is required." });

    let q = getDb().collection(COLLECTION).where("subjectId", "==", subjectId);
    if (semester) q = q.where("semester", "==", semester);

    const snap = await q.get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) { next(err); }
}

async function upsert(req, res, next) {
  try {
    const { studentId, subjectId } = req.params;
    const { scores = {}, semester, isResit = false } = req.body;

    if (!semester) return res.status(400).json({ error: "semester is required." });

    // Validate student and subject exist
    const [stuDoc, subDoc] = await Promise.all([
      getDb().collection("students").doc(studentId).get(),
      getDb().collection("subjects").doc(subjectId).get(),
    ]);
    if (!stuDoc.exists) return res.status(404).json({ error: "Student not found." });
    if (!subDoc.exists) return res.status(404).json({ error: "Subject not found." });

    const student  = stuDoc.data();
    const subject  = subDoc.data();
    const components = subject.gradeComponents || DEFAULT_COMPONENTS;

    // Validate scores against maxMark
    for (const comp of components) {
      const val = scores[comp.id];
      if (val !== undefined && val !== null && val !== "") {
        const n = Number(val);
        if (isNaN(n) || n < 0 || n > comp.maxMark) {
          return res.status(400).json({
            error: `${comp.name} must be between 0 and ${comp.maxMark}.`,
          });
        }
      }
    }

    // Calculate total from entered scores
    const total = components.reduce((sum, comp) => {
      const val = scores[comp.id];
      return sum + (val !== undefined && val !== null && val !== "" ? Number(val) : 0);
    }, 0);

    // Find existing record for this student+subject+semester
    const existing = await getDb().collection(COLLECTION)
      .where("studentId",  "==", studentId)
      .where("subjectId",  "==", subjectId)
      .where("semester",   "==", semester)
      .limit(1).get();

    const now  = new Date();
    const data = {
      studentId,
      studentName:   student.name   || "",
      studentNumber: student.studentNumber || "",
      subjectId,
      subjectName:   subject.name   || "",
      subjectCode:   subject.code   || "",
      semester,
      scores,
      total,
      isResit:   !!isResit,
      updatedAt: now,
      updatedBy: req.user?.uid || "",
    };

    let docId;
    if (existing.empty) {
      data.createdAt = now;
      data.createdBy = req.user?.uid || "";
      const ref = getDb().collection(COLLECTION).doc();
      await ref.set(data);
      docId = ref.id;
    } else {
      docId = existing.docs[0].id;
      await getDb().collection(COLLECTION).doc(docId).update(data);
    }

    res.json({ id: docId, ...data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Mark record not found." });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getSummary(req, res, next) {
  try {
    const { semester } = req.query;
    if (!semester) return res.status(400).json({ error: "semester is required." });

    const snap = await getDb().collection(COLLECTION).where("semester", "==", semester).get();
    const allMarks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const subjectsSnap = await getDb().collection("subjects").get();
    const subjectMap   = {};
    subjectsSnap.docs.forEach(d => { subjectMap[d.id] = d.data(); });

    // Group by subject
    const bySubject = {};
    for (const m of allMarks) {
      if (!bySubject[m.subjectId]) {
        bySubject[m.subjectId] = {
          subjectId:   m.subjectId,
          subjectName: m.subjectName || subjectMap[m.subjectId]?.name || m.subjectId,
          subjectCode: m.subjectCode || subjectMap[m.subjectId]?.code || "",
          records:     [],
        };
      }
      bySubject[m.subjectId].records.push(m);
    }

    const subjectStats = Object.values(bySubject).map(sub => {
      const totals  = sub.records.map(r => r.total || 0);
      const passed  = totals.filter(t => t >= 50).length;
      const failed  = totals.length - passed;
      const avg     = totals.length
        ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
        : 0;
      return {
        subjectId:   sub.subjectId,
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        total:       sub.records.length,
        passed,
        failed,
        classAverage: avg,
      };
    });

    const allTotals     = allMarks.map(m => m.total || 0);
    const totalPassed   = allTotals.filter(t => t >= 50).length;
    const totalFailed   = allTotals.length - totalPassed;
    const overallAvg    = allTotals.length
      ? Math.round(allTotals.reduce((a, b) => a + b, 0) / allTotals.length)
      : 0;

    res.json({
      semester,
      totalRecords:  allMarks.length,
      totalPassed,
      totalFailed,
      classAverage:  overallAvg,
      passRate:      allTotals.length
        ? Math.round((totalPassed / allTotals.length) * 100)
        : 0,
      bySubject: subjectStats,
    });
  } catch (err) { next(err); }
}

module.exports = { getBySubject, upsert, remove, getSummary };
