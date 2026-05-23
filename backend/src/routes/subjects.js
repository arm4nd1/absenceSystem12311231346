const { Router } = require("express");
const c = require("../controllers/subjectsController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get   ("/",                requireRole("admin", "instructor"), c.getAll);
router.get   ("/:id",             requireRole("admin", "instructor"), c.getOne);
router.post  ("/",                requireRole("admin"),               c.create);
router.put   ("/:id",             requireRole("admin"),               c.update);
router.delete("/:id",             requireRole("admin"),               c.remove);
router.post  ("/:id/enroll",            requireRole("admin"),               c.enrollStudent);
router.post  ("/:id/unenroll",          requireRole("admin"),               c.unenrollStudent);
router.patch ("/:id/grade-components",  requireRole("admin", "instructor"),  c.updateGradeComponents);

module.exports = router;
