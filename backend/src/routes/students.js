const { Router } = require("express");
const c = require("../controllers/studentsController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get   ("/",                requireRole("admin", "instructor"), c.getAll);
router.get   ("/:id",             requireRole("admin", "instructor"), c.getOne);
router.post  ("/",                requireRole("admin"),               c.create);
router.put   ("/:id",             requireRole("admin"),               c.update);
router.delete("/:id",             requireRole("admin"),               c.remove);
router.patch ("/:id/fingerprint", requireRole("admin"),               c.assignFingerprint);

module.exports = router;
