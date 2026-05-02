const express = require("express");
const router = express.Router();

const { getMatches, getDatingMatch } = require("../controllers/matchController");

// ✅ Specific FIRST
router.get("/dating/:email", getDatingMatch);

// ✅ Generic LAST
router.get("/:email", getMatches);

module.exports = router;

console.log("✅ matchRoutes file loaded");;