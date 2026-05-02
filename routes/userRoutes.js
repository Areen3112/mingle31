const express = require("express");
const router = express.Router();

const {
  checkUser,
  createUser,
  getUserByEmail
} = require("../controllers/userController");

// ✅ Specific routes FIRST
router.get("/check/:email", checkUser);
router.get("/profile/:email", getUserByEmail);

// ✅ Generic LAST
router.get("/:email", getUserByEmail);

router.post("/", createUser);

module.exports = router;