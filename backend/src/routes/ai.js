const { Router } = require("express");
const c = require("../controllers/aiController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.post("/chat",    requireRole("admin", "instructor"), c.chat);
router.get ("/insights", requireRole("admin", "instructor"), c.insights);

module.exports = router;
