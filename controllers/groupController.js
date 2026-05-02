const pool = require("../config/db");
const axios = require("axios");
const { sendEmail } = require("../services/emailService");

// Helper: Call Gemini with retry + model fallback
const callGeminiWithRetry = async (prompt, maxRetries = 3) => {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro"
  ];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    for (const model of modelsToTry) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}/${maxRetries + 1} - Using model: ${model}`);

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2500,
              responseMimeType: "application/json",
            },
          },
          {
            timeout: 45000,
            headers: { "Content-Type": "application/json" }
          }
        );

        console.log(`✅ Success with model: ${model}`);
        return response;

      } catch (err) {
        if (err.response?.status === 503) {
          console.log(`⚠️ 503 Overload on ${model} - trying next...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          continue;
        }

        if (err.response?.status === 429) {
          console.log(`⚠️ Rate limit hit - waiting...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }

        console.error(`❌ Error with ${model}:`, err.response?.data || err.message);
        throw err;
      }
    }

    if (attempt < maxRetries) {
      const waitTime = Math.pow(2, attempt) * 2000;
      console.log(`⏳ Retrying after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error("Gemini API failed after multiple retries (overloaded)");
};

// 🚀 CREATE GROUPS FOR EVENT (Final Improved Version)
const createGroups = async (req, res) => {
  try {
    const { eventId } = req.params;

    // 🔹 1. CHECK IF GROUPS ALREADY EXIST
    const existing = await pool.query(
      "SELECT * FROM event_groups WHERE event_id = $1",
      [eventId]
    );

    if (existing.rows.length > 0) {
      console.log("⚡ Returning cached groups (no AI call)");
      return res.json({
        message: "Groups already created",
        groups: existing.rows[0].group_data,
      });
    }

    console.log("🔥 AI GROUP CREATION TRIGGERED");

    // 🔹 2. GET PARTICIPANTS
    const result = await pool.query(
      `SELECT u.* FROM users u
       JOIN event_participants ep ON u.email = ep.user_email
       WHERE ep.event_id = $1`,
      [eventId]
    );

    const users = result.rows;

    if (users.length < 4) {
      return res.json({
        message: "Not enough users (minimum 4 required)",
      });
    }

    // 🔹 3. IMPROVED STRICT PROMPT
    const prompt = `
You are an expert in creating high-quality social groups.

STRICT RULES:
- Each group MUST have 4 to 6 members
- NO group smaller than 4
- NO leftover single users or very small groups
- All users must be placed in a group
- If total users are not perfectly divisible, make some groups of 5 or 6

Users:
${JSON.stringify(users)}

Return ONLY valid JSON (no explanation, no markdown, no extra text):

{
  "groups": [
    {
      "members": ["email1@example.com", "email2@example.com", "email3@example.com", "email4@example.com"],
      "reason": "short one-line reason why this group is good"
    }
  ]
}
`;

    // 🔹 4. CALL GEMINI WITH RETRY + FALLBACK
    const geminiResponse = await callGeminiWithRetry(prompt);

    const text = geminiResponse?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      throw new Error("Empty response from Gemini AI");
    }

    // 🔹 5. SAFE JSON EXTRACTION
    let parsed;
    try {
      let cleanText = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // 🔒 FILTER INVALID GROUPS
    let validGroups = parsed.groups ? 
      parsed.groups.filter((g) => g.members && g.members.length >= 4) : [];

    // If AI fails badly → fallback to one big group
    if (validGroups.length === 0) {
      console.log("⚠️ AI grouping failed, using fallback logic");
      validGroups = [{
        members: users.map(u => u.email),
        reason: "Fallback group - AI failed to create proper groups"
      }];
    }

    // 🔹 6. SAVE TO DB
    await pool.query(
      `INSERT INTO event_groups (event_id, group_data)
       VALUES ($1, $2)`,
      [eventId, JSON.stringify(validGroups)]
    );

    console.log(`✅ ${validGroups.length} valid groups saved to database`);

    // 🔹 7. SEND EMAIL NOTIFICATIONS TO ALL MEMBERS
    console.log("📧 Sending group assignment emails...");
    
    for (const group of validGroups) {
      const memberList = group.members.join(", ");
      
      for (const email of group.members) {
        await sendEmail(
          email,
          "Your Group is Ready 🚀",
          `You have been placed in a group with: ${memberList}\n\nReason: ${group.reason}`
        );
      }
    }

    console.log("✅ All group assignment emails sent successfully");

    // 🔹 8. RETURN RESULT
    res.json({
      message: "Groups created successfully",
      groups: validGroups,
    });

  } catch (error) {
    console.error("❌ Group error:", error.message);

    if (error.message.includes("overloaded") || error.response?.status === 503) {
      return res.status(503).json({
        error: "Service temporarily unavailable",
        message: "AI service is currently overloaded. Please try again in a few minutes."
      });
    }

    res.status(500).json({ error: "Server error" });
  }
};

// 🔥 GET SAVED GROUPS (unchanged)
const getGroups = async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await pool.query(
      "SELECT group_data FROM event_groups WHERE event_id = $1",
      [eventId]
    );

    if (result.rows.length === 0) {
      return res.json({ message: "No groups yet" });
    }

    res.json({
      groups: result.rows[0].group_data,
    });

  } catch (error) {
    console.error("❌ Fetch groups error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { createGroups, getGroups };