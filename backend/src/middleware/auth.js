const jwt     = require("jsonwebtoken");
const { getDb } = require("../config/firebase");

/**
 * Verify JWT and attach `req.user` (with uid, email, role, subjectIds).
 */
async function authenticate(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "No token provided." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Refresh role from Firestore on every request (so role changes take effect immediately)
    const snap = await getDb().collection("users").doc(payload.uid).get();
    if (snap.exists) {
      req.user = { ...payload, ...snap.data(), uid: payload.uid };
    } else {
      req.user = payload;
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Factory: only allow users whose role is in the provided list.
 * Usage: requireRole("admin", "instructor")
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions." });
    }
    next();
  };
}

/**
 * Instructors may only access resources for subjects they own.
 * Admins bypass this check entirely.
 */
function ownSubjectOnly(subjectIdParam = "id") {
  return (req, res, next) => {
    const { role, subjectIds = [] } = req.user || {};
    if (role === "admin") return next();

    const subjectId = req.params[subjectIdParam] || req.body.subjectId || req.query.subjectId;
    if (!subjectId || !subjectIds.includes(subjectId)) {
      return res.status(403).json({ error: "You do not own this subject." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole, ownSubjectOnly };
