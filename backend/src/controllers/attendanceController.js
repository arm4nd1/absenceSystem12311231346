const { getDb }            = require("../config/firebase");
const { sendAbsenceEmail } = require("../config/email");

const COLLECTION = "attendance";

// Helper: sort records by timestamp descending (client-side, avoids composite indexes)
function sortByTimestamp(docs) {
  return docs.sort((a, b) => {
    const ta = a.timestamp?.seconds ?? (a.timestamp?._seconds ?? 0);
    const tb = b.timestamp?.seconds ?? (b.timestamp?._seconds ?? 0);
    return tb - ta;
  });
}

async function getAll(req, res, next) {
  try {
    const { subjectId, studentId, date, startDate, endDate, status } = req.query;

    // Build the simplest possible query to avoid composite index requirements.
    // Use at most ONE inequality filter + fetch remaining client-side.
    let q = getDb().collection(COLLECTION);
    let clientFilters = [];

    // Pick the best single server-side filter
    if (req.user.role === "student" && req.user.studentId) {
      q = q.where("studentId", "==", req.user.studentId);
    } else if (subjectId) {
      // Instructor check
      if (req.user.role === "instructor") {
        const allowed = req.user.subjectIds || [];
        if (!allowed.includes(subjectId)) return res.status(403).json({ error: "Not your subject." });
      }
      q = q.where("subjectId", "==", subjectId);
    } else if (studentId) {
      q = q.where("studentId", "==", studentId);
    } else if (date) {
      q = q.where("date", "==", date);
    }

    // All remaining filters applied client-side
    if (subjectId && req.user.role !== "student") clientFilters.push(r => r.subjectId === subjectId);
    if (studentId)  clientFilters.push(r => r.studentId === studentId);
    if (status)     clientFilters.push(r => r.status === status);
    if (date)       clientFilters.push(r => r.date === date);
    if (startDate)  clientFilters.push(r => r.date >= startDate);
    if (endDate)    clientFilters.push(r => r.date <= endDate);

    q = q.limit(500);
    const snap = await q.get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const fn of clientFilters) docs = docs.filter(fn);
    sortByTimestamp(docs);

    res.json(docs);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Record not found." });
    const data = doc.data();
    if (req.user.role === "student" && data.studentId !== req.user.studentId) {
      return res.status(403).json({ error: "Forbidden." });
    }
    res.json({ id: doc.id, ...data });
  } catch (err) { next(err); }
}

async function createManual(req, res, next) {
  try {
    const { studentId, subjectId, date, status = "present" } = req.body;
    if (!studentId || !subjectId || !date)
      return res.status(400).json({ error: "studentId, subjectId, date required." });

    if (req.user.role === "instructor" && !(req.user.subjectIds || []).includes(subjectId))
      return res.status(403).json({ error: "Not your subject." });

    const [stuDoc, subDoc] = await Promise.all([
      getDb().collection("students").doc(studentId).get(),
      getDb().collection("subjects").doc(subjectId).get(),
    ]);
    if (!stuDoc.exists) return res.status(404).json({ error: "Student not found." });
    if (!subDoc.exists) return res.status(404).json({ error: "Subject not found." });

    const stuData = stuDoc.data();
    const subData = subDoc.data();
    const ref     = getDb().collection(COLLECTION).doc();

    await ref.set({
      studentId, studentName: stuData.name, studentNumber: stuData.studentNumber,
      subjectId, fingerprintId: null, score: null,
      timestamp: new Date(), date, status, manual: true,
    });

    if (status === "absent" && stuData.email) {
      sendAbsenceEmail({ to: stuData.email, studentName: stuData.name, subjectName: subData.name, date });
    }

    res.status(201).json({ id: ref.id });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ["present", "late", "absent", "excused"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });

    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Record not found." });
    const data = doc.data();

    if (req.user.role === "instructor" && !(req.user.subjectIds || []).includes(data.subjectId))
      return res.status(403).json({ error: "Not your subject." });

    await ref.update({ status, updatedAt: new Date() });

    if (status === "absent" && data.status !== "absent") {
      const [stuDoc, subDoc] = await Promise.all([
        getDb().collection("students").doc(data.studentId).get(),
        getDb().collection("subjects").doc(data.subjectId).get(),
      ]);
      if (stuDoc.exists && stuDoc.data().email) {
        sendAbsenceEmail({
          to: stuDoc.data().email, studentName: data.studentName,
          subjectName: subDoc.exists ? subDoc.data().name : data.subjectId,
          date: data.date,
        });
      }
    }

    res.json({ ok: true, status });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Record not found." });
    if (req.user.role === "instructor" && !(req.user.subjectIds || []).includes(doc.data().subjectId))
      return res.status(403).json({ error: "Not your subject." });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getReport(req, res, next) {
  try {
    const { subjectId, startDate, endDate } = req.query;
    if (!subjectId) return res.status(400).json({ error: "subjectId required." });

    if (req.user.role === "instructor" && !(req.user.subjectIds || []).includes(subjectId))
      return res.status(403).json({ error: "Not your subject." });

    // Single where clause only — range filters applied client-side to avoid composite indexes
    let snap = await getDb().collection(COLLECTION)
      .where("subjectId", "==", subjectId)
      .limit(1000)
      .get();

    let records = snap.docs.map(d => d.data());
    if (startDate) records = records.filter(r => r.date >= startDate);
    if (endDate)   records = records.filter(r => r.date <= endDate);
    records.sort((a, b) => a.date.localeCompare(b.date));

    const byStudent = {};
    records.forEach(r => {
      if (!byStudent[r.studentId]) {
        byStudent[r.studentId] = {
          studentId: r.studentId, studentName: r.studentName,
          studentNumber: r.studentNumber,
          present: 0, late: 0, absent: 0, excused: 0, total: 0,
        };
      }
      const s = byStudent[r.studentId];
      s[r.status] = (s[r.status] || 0) + 1;
      s.total++;
    });

    const byDate = {};
    records.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { date: r.date, present: 0, late: 0, absent: 0, excused: 0 };
      byDate[r.date][r.status] = (byDate[r.date][r.status] || 0) + 1;
    });

    res.json({
      subjectId, totalRecords: records.length,
      byStudent: Object.values(byStudent),
      byDate:    Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) { next(err); }
}

async function getSummary(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [totalStudents, totalSubjects, todaySnap, sessionsSnap] = await Promise.all([
      getDb().collection("students").count().get(),
      getDb().collection("subjects").count().get(),
      getDb().collection(COLLECTION).where("date", "==", today).get(),
      getDb().collection("sessions").where("isActive", "==", true).get(),
    ]);

    const statusCounts = { present: 0, late: 0, absent: 0, excused: 0 };
    todaySnap.docs.forEach(d => {
      const s = d.data().status;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    res.json({
      totalStudents:  totalStudents.data().count,
      totalSubjects:  totalSubjects.data().count,
      todayScans:     todaySnap.size,
      activeSessions: sessionsSnap.size,
      statusToday:    statusCounts,
    });
  } catch (err) { next(err); }
}

module.exports = { getAll, getOne, createManual, updateStatus, remove, getReport, getSummary };
