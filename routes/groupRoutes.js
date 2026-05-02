const express = require("express");
const router = express.Router();

const {
  createGroups,
  getGroups
} = require("../controllers/groupController");

// 🔥 ROUTES
router.post("/create/:eventId", createGroups); // create & save
router.get("/:eventId", getGroups);            // fetch saved

module.exports = router;