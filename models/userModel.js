const pool = require("../config/db");

// ✅ Create or Update User
const createOrUpdateUser = async (phone, profile) => {
  const {
    intent,
    personality_score,
    ambition_score,
    vibe,
    interests,
  } = profile;

  const query = `
    INSERT INTO users (phone, intent, personality_score, ambition_score, vibe, interests)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (phone)
    DO UPDATE SET
      intent = EXCLUDED.intent,
      personality_score = EXCLUDED.personality_score,
      ambition_score = EXCLUDED.ambition_score,
      vibe = EXCLUDED.vibe,
      interests = EXCLUDED.interests
    RETURNING *;
  `;

  const values = [
    phone,
    intent,
    personality_score,
    ambition_score,
    vibe,
    interests,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// ✅ Get User by Phone
const getUserByPhone = async (phone) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE phone = $1",
    [phone]
  );

  return result.rows[0];
};

// ✅ Get All Users (for matching)
const getAllUsers = async () => {
  const result = await pool.query("SELECT * FROM users");
  return result.rows;
};

module.exports = {
  createOrUpdateUser,
  getUserByPhone,
  getAllUsers,
};