// Node.js 18+ has fetch built-in globally — no import needed
const { getDb } = require("../config/firebase");

// ── Bridge resolution ─────────────────────────────────────────────────────────
// Supports multiple simultaneous Pico bridges.
// Each bridge registers itself in Firestore under "bridges/{bridgeId}"
// when it opens a session. The admin can also pre-register bridges.
//
// Request may include { bridgeUrl } to target a specific bridge.
// Falls back to BRIDGE_URL env var if not specified.

function resolveBridgeUrl(body = {}) {
  return (body.bridgeUrl || process.env.BRIDGE_URL || "http://localhost:5050").replace(/\/$/, "");
}

async function openSession(req, res, next) {
  try {
    const { subjectId, bridgeUrl: rawUrl, room = "" } = req.body;
    if (!subjectId) return res.status(400).json({ error: "subjectId required." });

    // Instructors can only open sessions for their subjects
    if (req.user.role === "instructor") {
      const ownSubjects = req.user.subjectIds || [];
      if (!ownSubjects.includes(subjectId)) {
        return res.status(403).json({ error: "Not your subject." });
      }
    }

    const subDoc = await getDb().collection("subjects").doc(subjectId).get();
    if (!subDoc.exists) return res.status(404).json({ error: "Subject not found." });

    const bridgeUrl = resolveBridgeUrl(req.body);

    const r    = await fetch(`${bridgeUrl}/session/open`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subjectId }),
    });
    const body = await r.json();
    if (r.ok) {
      // Register / update bridge in Firestore
      const bridgeId = rawUrl ? btoa(rawUrl) : "default";
      await getDb().collection("bridges").doc(bridgeId).set({
        bridgeUrl, room, lastSeen: new Date(), activeSubjectId: subjectId,
      }, { merge: true });
    }
    res.status(r.status).json(body);
  } catch (err) { next(err); }
}

async function closeSession(req, res, next) {
  try {
    const db = getDb();
    const activeSnap = await db.collection("sessions").where("isActive", "==", true).get();

    if (req.user.role === "instructor") {
      const ownSubjects = req.user.subjectIds || [];
      const mine = activeSnap.docs.find(d => ownSubjects.includes(d.data().subjectId));
      if (!mine) return res.status(403).json({ error: "No active session for your subjects." });
    }

    // Always close active sessions directly in Firestore (source of truth).
    // This handles stale sessions left over after a bridge restart.
    if (!activeSnap.empty) {
      const now = new Date();
      await Promise.all(
        activeSnap.docs.map(d => d.ref.update({ isActive: false, endTime: now }))
      );
    }

    // Also tell the bridge to reset its in-memory state (best-effort — ignore errors).
    try {
      const bridgeUrl = resolveBridgeUrl(req.body);
      await fetch(`${bridgeUrl}/session/close`, { method: "POST", signal: AbortSignal.timeout(3000) });
    } catch { /* bridge offline or already reset — Firestore is already closed */ }

    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getActiveSessions(req, res, next) {
  try {
    // No orderBy — avoids requiring a composite index
    const snap = await getDb().collection("sessions")
      .where("isActive", "==", true).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) { next(err); }
}

async function getSessionHistory(req, res, next) {
  try {
    const { subjectId, limit = 50 } = req.query;

    // Avoid composite indexes: no orderBy when a where clause is present.
    // Sort client-side instead.
    let q = getDb().collection("sessions");

    if (subjectId) {
      q = q.where("subjectId", "==", subjectId);
    } else if (req.user.role === "instructor") {
      const ownSubjects = req.user.subjectIds || [];
      if (ownSubjects.length === 0) return res.json([]);
      q = q.where("subjectId", "in", ownSubjects.slice(0, 10));
    } else {
      // Admin: just get recent sessions — limit then sort
      q = q.orderBy("startTime", "desc").limit(Number(limit));
      const snap = await q.get();
      return res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    const snap = await q.limit(Number(limit)).get();
    const docs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.startTime?.seconds ?? (a.startTime?._seconds ?? 0);
        const tb = b.startTime?.seconds ?? (b.startTime?._seconds ?? 0);
        return tb - ta;
      });
    res.json(docs);
  } catch (err) { next(err); }
}

async function getBridges(req, res, next) {
  try {
    const snap = await getDb().collection("bridges").get();
    const bridges = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ping each bridge for live status
    const withStatus = await Promise.all(bridges.map(async b => {
      try {
        const r    = await fetch(`${b.bridgeUrl}/status`, { signal: AbortSignal.timeout(2000) });
        const data = await r.json();
        return { ...b, online: true, sessionOpen: data.sessionOpen, activeSubjectId: data.activeSubjectId };
      } catch {
        return { ...b, online: false };
      }
    }));

    res.json(withStatus);
  } catch (err) { next(err); }
}

async function bridgeStatus(req, res, next) {
  try {
    const bridgeUrl = resolveBridgeUrl(req.query);
    const r    = await fetch(`${bridgeUrl}/status`, { signal: AbortSignal.timeout(3000) });
    const body = await r.json();
    res.json({ ...body, bridgeUrl });
  } catch (err) {
    res.status(503).json({ error: "Bridge unreachable", detail: err.message });
  }
}

async function enrollFingerprint(req, res, next) {
  try {
    const { fp_id, bridgeUrl: rawUrl } = req.body;
    if (fp_id === undefined) return res.status(400).json({ error: "fp_id required." });
    const bridgeUrl = resolveBridgeUrl(req.body);
    const r = await fetch(`${bridgeUrl}/enroll`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ fp_id }),
    });
    res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
}

async function deleteFingerprint(req, res, next) {
  try {
    const { fp_id } = req.body;
    if (fp_id === undefined) return res.status(400).json({ error: "fp_id required." });
    const bridgeUrl = resolveBridgeUrl(req.body);
    const r = await fetch(`${bridgeUrl}/delete`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ fp_id }),
    });
    res.status(r.status).json(await r.json());
  } catch (err) { next(err); }
}

module.exports = {
  openSession, closeSession, getActiveSessions, getSessionHistory,
  getBridges, bridgeStatus, enrollFingerprint, deleteFingerprint,
};
