const { getDb } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");

const COLLECTION = "students";

async function getAll(req, res, next) {
  try {
    const snap = await getDb().collection(COLLECTION).orderBy("name").get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(data);
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Student not found." });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { name, studentNumber, email, subjects = [], fingerprintId } = req.body;
    if (!name || !studentNumber) {
      return res.status(400).json({ error: "name and studentNumber are required." });
    }

    // Check for duplicate student number
    const existing = await getDb().collection(COLLECTION)
      .where("studentNumber", "==", studentNumber).limit(1).get();
    if (!existing.empty) {
      return res.status(409).json({ error: "Student number already exists." });
    }

    const docRef = getDb().collection(COLLECTION).doc();
    const now    = new Date();
    await docRef.set({
      name, studentNumber, email: email || "",
      subjects, fingerprintId: fingerprintId ?? null,
      enrolledAt:  now,
      createdAt:   now,
      updatedAt:   now,
    });
    res.status(201).json({ id: docRef.id, name, studentNumber });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Student not found." });

    const allowed = ["name", "studentNumber", "email", "subjects", "fingerprintId"];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    update.updatedAt = new Date();

    await ref.update(update);
    res.json({ id: req.params.id, ...update });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Student not found." });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function assignFingerprint(req, res, next) {
  try {
    const { fingerprintId } = req.body;
    if (fingerprintId === undefined) {
      return res.status(400).json({ error: "fingerprintId required." });
    }

    const ref = getDb().collection(COLLECTION).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Student not found." });

    await ref.update({ fingerprintId, updatedAt: new Date() });
    res.json({ ok: true, fingerprintId });
  } catch (err) { next(err); }
}

module.exports = { getAll, getOne, create, update, remove, assignFingerprint };
