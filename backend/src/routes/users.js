const { Router } = require("express");
const c = require("../controllers/usersController");
const { authenticate, requireRole } = require("../middleware/auth");

const router = Router();
router.use(authenticate);

router.get   ("/me",                    c.getMe);
router.get   ("/",                      requireRole("admin"), c.getAll);
router.post  ("/",                      requireRole("admin"), c.createUser);
router.patch ("/:uid/role",             requireRole("admin"), c.updateRole);
router.post  ("/:uid/send-reset-email", requireRole("admin"), c.sendPasswordReset);
router.delete("/:uid",                  requireRole("admin"), c.deleteUser);

module.exports = router;
