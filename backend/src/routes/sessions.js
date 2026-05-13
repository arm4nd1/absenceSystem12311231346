const { Router } = require("express");
const c = require("../controllers/sessionsController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.post("/open",       requireRole("admin", "instructor"), c.openSession);
router.post("/close",      requireRole("admin", "instructor"), c.closeSession);
router.get ("/active",     c.getActiveSessions);
router.get ("/history",    c.getSessionHistory);
router.get ("/bridges",    requireRole("admin"),               c.getBridges);
router.get ("/bridge",     c.bridgeStatus);
router.post("/enroll",     requireRole("admin"),               c.enrollFingerprint);
router.post("/delete-fp",  requireRole("admin"),               c.deleteFingerprint);

module.exports = router;
