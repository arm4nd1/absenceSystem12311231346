const { Router } = require("express");
const c = require("../controllers/attendanceController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get   ("/",              c.getAll);            // admin, instructor (own), student (own)
router.get   ("/summary",       requireRole("admin", "instructor"), c.getSummary);
router.get   ("/report",        requireRole("admin", "instructor"), c.getReport);
router.get   ("/:id",           c.getOne);
router.post  ("/",              requireRole("admin", "instructor"), c.createManual);
router.patch ("/:id/status",    requireRole("admin", "instructor"), c.updateStatus);
router.delete("/:id",           requireRole("admin", "instructor"), c.remove);

module.exports = router;
