const express = require("express");
const router = express.Router();

const { getMatches, getDatingMatch } = require("../controllers/matchController");

router.get("/:email", getMatches);
router.get("/dating/:email", getDatingMatch);

module.exports = router;

console.log("✅ matchRoutes file loaded");