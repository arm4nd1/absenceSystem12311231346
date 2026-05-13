const jwt   = require("jsonwebtoken");
const admin = require("firebase-admin");
const { getDb } = require("../config/firebase");

/**
 * POST /api/auth/login
 * Verifies Firebase ID token and returns a backend JWT with role info.
 * Creates a default 'admin' user doc if this is the very first user.
 */
async function login(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required." });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid     = decoded.uid;
    const db      = getDb();

    // Fetch or create user profile
    const userRef  = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    let userProfile;
    if (!userSnap.exists) {
      // Check if any users exist — first user becomes admin
      const existing = await db.collection("users").limit(1).get();
      const role = existing.empty ? "admin" : "student";

      userProfile = {
        uid,
        email:      decoded.email || "",
        name:       decoded.name  || decoded.email || "",
        role,
        subjectIds: [],
        studentId:  null,
        createdAt:  new Date(),
      };
      await userRef.set(userProfile);
    } else {
      userProfile = userSnap.data();
    }

    const token = jwt.sign(
      { uid, email: decoded.email, role: userProfile.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      uid,
      email:      userProfile.email,
      name:       userProfile.name,
      role:       userProfile.role,
      subjectIds: userProfile.subjectIds || [],
      studentId:  userProfile.studentId  || null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
