const { getDb } = require("../config/firebase");
const admin = require("firebase-admin");

const COLLECTION = "users";

async function getAll(req, res, next) {
  try {
    const snap = await getDb().collection(COLLECTION).orderBy("email").get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) { next(err); }
}

async function getMe(req, res, next) {
  try {
    const doc = await getDb().collection(COLLECTION).doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ error: "User profile not found." });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { next(err); }
}

async function updateRole(req, res, next) {
  try {
    const { role, subjectIds, studentId, name } = req.body;
    const validRoles = ["admin", "instructor", "student"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const ref = getDb().collection(COLLECTION).doc(req.params.uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "User not found." });

    const update = { updatedAt: new Date() };
    if (role)        update.role       = role;
    if (subjectIds)  update.subjectIds = subjectIds;
    if (studentId !== undefined) update.studentId = studentId;
    if (name)        update.name       = name;

    await ref.update(update);
    res.json({ ok: true, ...update });
  } catch (err) { next(err); }
}

async function createUser(req, res, next) {
  try {
    const { email, password, name, role = "student", subjectIds = [], studentId = null } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required." });

    const fbUser = await admin.auth().createUser({ email, password, displayName: name || email });

    const profile = {
      uid: fbUser.uid, email, name: name || email,
      role, subjectIds, studentId,
      createdAt: new Date(),
    };
    await getDb().collection(COLLECTION).doc(fbUser.uid).set(profile);
    res.status(201).json({ uid: fbUser.uid, email, role });
  } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
  try {
    const { uid } = req.params;
    if (uid === req.user.uid) {
      return res.status(400).json({ error: "Cannot delete your own account." });
    }
    await Promise.all([
      admin.auth().deleteUser(uid),
      getDb().collection(COLLECTION).doc(uid).delete(),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function sendPasswordReset(req, res, next) {
  try {
    const { uid } = req.params;
    const doc = await getDb().collection(COLLECTION).doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found." });

    const { email } = doc.data();
    // Generate a password-reset link via Firebase Admin SDK
    const link = await admin.auth().generatePasswordResetLink(email);

    // If nodemailer is configured, send the email; otherwise return the link so
    // the admin can forward it manually.
    try {
      const { transporter } = require("../config/email");
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: "Reset your AttendFP password",
        html: `<p>Click the link below to set / reset your password:</p>
               <p><a href="${link}">${link}</a></p>
               <p>This link expires in 1 hour.</p>`,
      });
      res.json({ ok: true, sent: true });
    } catch {
      // Email not configured — return the raw link so the admin can copy it
      res.json({ ok: true, sent: false, resetLink: link });
    }
  } catch (err) { next(err); }
}

module.exports = { getAll, getMe, updateRole, createUser, deleteUser, sendPasswordReset };
