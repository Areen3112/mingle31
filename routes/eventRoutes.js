const express = require("express");
const router = express.Router();

const {
  createEvent,
  getEvents,
  joinEvent
} = require("../controllers/eventController");

router.post("/", createEvent);
router.get("/", getEvents);
router.post("/join", joinEvent);

module.exports = router;