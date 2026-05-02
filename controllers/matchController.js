const pool = require("../config/db");
const { getAIMatches } = require("../services/geminiMatchService");

// 🧠 Score calculator — used for pre-filtering before AI
const calculateScore = (userA, userB) => {
  let score = 0;

  const personalityDiff = Math.abs((userA.personality_score || 0) - (userB.personality_score || 0));
  score += Math.max(0, 30 - personalityDiff * 5);

  const ambitionDiff = Math.abs((userA.ambition_score || 0) - (userB.ambition_score || 0));
  score += Math.max(0, 20 - ambitionDiff * 4);

  const interestsA = Array.isArray(userA.interests) ? userA.interests : [];
  const interestsB = Array.isArray(userB.interests) ? userB.interests : [];
  const common = interestsA.filter(i => interestsB.includes(i));
  score += common.length * 5;

  return score;
};

// ✅ Gender compatibility check — handles nulls gracefully
// If either side has no gender data, allow the match (don't block)
const isGenderCompatible = (currentUser, candidate) => {
  const myGender = currentUser.gender;
  const myPref = currentUser.preference;        // ← was interested_in
  const theirGender = candidate.gender;
  const theirPref = candidate.preference;       // ← was interested_in

  if (!myGender || !theirGender) return true;

  const iWantThem =
    !myPref || myPref === 'everyone' ||
    (myPref === 'men' && (theirGender === 'male' || theirGender === 'nonbinary')) ||
    (myPref === 'women' && (theirGender === 'female' || theirGender === 'nonbinary'));

  const theyWantMe =
    !theirPref || theirPref === 'everyone' ||
    (theirPref === 'men' && (myGender === 'male' || myGender === 'nonbinary')) ||
    (theirPref === 'women' && (myGender === 'female' || myGender === 'nonbinary'));

  return iWantThem && theyWantMe;
};
// ✅ Build fallback matches (used when Gemini quota is exceeded)
const buildFallback = (topCandidates, limit = 5) =>
  topCandidates.slice(0, limit).map((c, i) => ({
    name: c.name,
    email: c.email,
    score: Math.max(60, c.score),
    reason: "Strong compatibility based on shared interests, personality and ambition.",
    interests: c.interests || [],
  }));

// 🚀 GET GENERAL MATCHES (Networking)
const getMatches = async (req, res) => {
  try {
    console.log("🔥 getMatches triggered for:", req.params.email);
    const { email } = req.params;

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const currentUser = userResult.rows[0];

    // Networking: all users regardless of intent
    const othersResult = await pool.query("SELECT * FROM users WHERE email != $1", [email]);

    const scored = othersResult.rows
      .map(user => ({ ...user, _score: calculateScore(currentUser, user) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);

    const topCandidates = scored.map(u => ({
      name: u.name, email: u.email, score: u._score,
      interests: u.interests, personality_score: u.personality_score,
      ambition_score: u.ambition_score, intent: u.intent,
      gender: u.gender,
      preference: u.preference,    // ← was interested_in
    }));

    console.log("Top Networking Candidates:", topCandidates.map(c => `${c.name} (${c.score})`));

    const aiResult = await getAIMatches(currentUser, topCandidates, "networking");

    // ✅ Gemini quota hit or failed → use full fallback immediately
    if (!aiResult || !aiResult.matches || aiResult.matches.length === 0) {
      console.log("⚠️ AI unavailable, using score-based fallback");
      return res.json({ matches: buildFallback(topCandidates) });
    }

    // Merge AI results with any missing candidates (in case AI returned partial)
    const aiEmailSet = new Set(aiResult.matches.map(m => m.email));
    const aiFormatted = aiResult.matches.map(aiMatch => {
      const user = topCandidates.find(c => c.email === aiMatch.email);
      return {
        name: user?.name || "Unknown", email: aiMatch.email,
        score: aiMatch.score, reason: aiMatch.reason,
        interests: user?.interests || [],
      };
    });
    const remaining = topCandidates
      .filter(c => !aiEmailSet.has(c.email))
      .map(c => ({
        name: c.name, email: c.email, score: Math.max(60, c.score),
        reason: "Good match based on shared interests and scores.", interests: c.interests
      }));

    res.json({ matches: [...aiFormatted, ...remaining] });

  } catch (error) {
    console.error("Match error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// 💘 GET DATING MATCH (1:1)
const getDatingMatch = async (req, res) => {
  try {
    const { email } = req.params;

    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ message: "User not found" });
    const currentUser = userResult.rows[0];

    console.log(`💘 Dating match for: ${currentUser.name} | gender: ${currentUser.gender} | preference: ${currentUser.preference}`);

    // Fetch all other dating users
    const othersResult = await pool.query(
      `SELECT * FROM users WHERE email != $1 AND intent = 'dating'`,
      [email]
    );

    if (othersResult.rows.length === 0) {
      return res.json({ match: null, message: "No dating users found yet." });
    }

    // ✅ Apply gender compatibility filter IN JS (handles nulls for old accounts)
    const compatible = othersResult.rows.filter(u => isGenderCompatible(currentUser, u));
    console.log(`Found ${othersResult.rows.length} dating users, ${compatible.length} gender-compatible`);

    if (compatible.length === 0) {
      return res.json({ match: null, message: "No compatible matches yet. Check back as more people join!" });
    }

    const scored = compatible
      .map(user => ({ ...user, _score: calculateScore(currentUser, user) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);

    const topCandidates = scored.map(u => ({
      name: u.name, email: u.email, score: u._score,
      interests: u.interests, personality_score: u.personality_score,
      ambition_score: u.ambition_score, intent: u.intent,
      gender: u.gender,
      preference: u.preference,   // ← was: interested_in: u.interested_in
    }));

    console.log("Top Dating Candidates:", topCandidates.map(c => `${c.name}/${c.gender} (${c.score})`));

    const aiResult = await getAIMatches(currentUser, topCandidates, "dating");

    // ✅ Quota hit → use top score-based match with a reason
    if (!aiResult || !aiResult.matches?.[0]) {
      console.log("⚠️ AI unavailable, using score-based dating fallback");
      return res.json({
        match: {
          ...topCandidates[0],
          reason: "Top compatibility based on personality, ambition, and shared interests.",
        }
      });
    }

    const bestMatch = aiResult.matches[0];
    const matchedUser = topCandidates.find(u => u.email === bestMatch.email) || topCandidates[0];

    res.json({
      match: {
        name: matchedUser.name, email: matchedUser.email,
        score: bestMatch.score ?? matchedUser.score,
        reason: bestMatch.reason,
        interests: matchedUser.interests,
      }
    });

  } catch (error) {
    console.error("Dating match error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getMatches, getDatingMatch };