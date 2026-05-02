const pool = require("../config/db");

// ✅ CHECK USER
const checkUser = async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length > 0) {
      return res.json({
        exists: true,
        user: result.rows[0],
      });
    }

    res.json({ exists: false });

  } catch (error) {
    console.error("Check user error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ CREATE USER
const createUser = async (req, res) => {
  try {
    const { email, name, age, intent, personality_score, ambition_score,
      interests, bio, gender, preference } = req.body;

    // ✅ FIXED: Pass raw array — pg driver handles jsonb serialization automatically
    // ❌ REMOVE: JSON.stringify(interests) — double-serializes and breaks jsonb column
    const interestsValue = Array.isArray(interests) ? interests : [];

    await pool.query(
      `INSERT INTO users 
       (email, name, age, intent, personality_score, ambition_score, interests, bio, gender, preference, profile_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, true)
       ON CONFLICT (email) DO NOTHING`,
      [email, name, age ?? null, intent, personality_score ?? null,
       ambition_score ?? null, JSON.stringify(interestsValue),
       bio ?? null, gender ?? null, preference ?? null]
    );

    res.json({ success: true, message: "User created successfully" });

  } catch (error) {
    console.error("Create user error:", error.message); // ← this tells you EXACTLY what broke
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// ✅ GET USER BY EMAIL
const getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({
      exists: true,
      user: result.rows[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  checkUser,
  createUser,
  getUserByEmail,  // ← updated from getUserProfile
};