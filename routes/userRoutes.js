const express = require("express");
const router = express.Router();

const {
  checkUser,
  createUser,
  getUserByEmail
} = require("../controllers/userController");

router.get("/:email", getUserByEmail); 
router.get("/check/:email", checkUser);
router.post("/", createUser);
router.get("/profile/:email", getUserByEmail);

module.exports = router;