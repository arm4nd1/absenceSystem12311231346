const { Router } = require("express");
const c = require("../controllers/marksController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get   ("/summary",                  requireRole("admin", "instructor"), c.getSummary);
router.get   ("/",                         requireRole("admin", "instructor"), c.getBySubject);
router.put   ("/:studentId/:subjectId",    requireRole("admin", "instructor"), c.upsert);
router.delete("/:id",                      requireRole("admin"),               c.remove);

module.exports = router;
