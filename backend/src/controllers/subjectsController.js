const { getDb } = require("../config/firebase");

const COLLECTION = "subjects";

async function getAll(req, res, next) {
  try {
    const snap = await getDb().collection(COLLECTION).orderBy("name").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Subject not found." });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, code, instructor = "", schedule = "", students = [] } = req.body;
    if (!name || !code) return res.status(400).json({ error: "name and code required." });

    const dup = await getDb().collection(COLLECTION).where("code", "==", code).limit(1).get();
    if (!dup.empty) return res.status(409).json({ error: "Subject code already exists." });

    const ref = getDb().collection(COLLECTION).doc();
    const now = new Date();
    await ref.set({ name, code, instructor, schedule, students, createdAt: now, updatedAt: now });
    res.status(201).json({ id: ref.id, name, code });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Subject not found." });

    const allowed = ["name", "code", "instructor", "schedule", "students"];
    const data    = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.updatedAt = new Date();
    await ref.update(data);
    res.json({ id: req.params.id, ...data });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Subject not found." });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function enrollStudent(req, res, next) {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ error: "studentId required." });

    const subRef  = getDb().collection(COLLECTION).doc(req.params.id);
    const stuRef  = getDb().collection("students").doc(studentId);
    const [sub, stu] = await Promise.all([subRef.get(), stuRef.get()]);

    if (!sub.exists) return res.status(404).json({ error: "Subject not found." });
    if (!stu.exists) return res.status(404).json({ error: "Student not found." });

    const { FieldValue } = require("firebase-admin/firestore");
    await Promise.all([
      subRef.update({ students:  FieldValue.arrayUnion(studentId),  updatedAt: new Date() }),
      stuRef.update({ subjects:  FieldValue.arrayUnion(req.params.id), updatedAt: new Date() }),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function unenrollStudent(req, res, next) {
  try {
    const { studentId } = req.body;
    const subRef = getDb().collection(COLLECTION).doc(req.params.id);
    const stuRef = getDb().collection("students").doc(studentId);
    const { FieldValue } = require("firebase-admin/firestore");
    await Promise.all([
      subRef.update({ students: FieldValue.arrayRemove(studentId), updatedAt: new Date() }),
      stuRef.update({ subjects: FieldValue.arrayRemove(req.params.id), updatedAt: new Date() }),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { getAll, getOne, create, update, remove, enrollStudent, unenrollStudent };
