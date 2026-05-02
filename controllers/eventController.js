const pool = require("../config/db");
const { sendEmail } = require("../services/emailService");

// ✅ CREATE EVENT
const createEvent = async (req, res) => {
  try {
    const { title, type, description, event_date } = req.body;

    const result = await pool.query(
      `INSERT INTO events (title, type, description, event_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, type, description, event_date]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ GET ALL EVENTS
const getEvents = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events ORDER BY event_date");

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ JOIN EVENT
const joinEvent = async (req, res) => {
  try {
    const { event_id, email } = req.body;

    await pool.query(
      `INSERT INTO event_participants (event_id, user_email)
       VALUES ($1, $2)`,
      [event_id, email]
    );

    // Send confirmation email
    await sendEmail(
      email,
      "Event Joined 🎉",
      "You have successfully joined the event. Stay tuned for your group!"
    );

    res.json({ message: "Joined event successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
};


module.exports = { createEvent, getEvents, joinEvent };