console.log("🚀 Gemini Match Service Loaded");

const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-lite";

if (!GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not set in .env file!");
}

const extractJSON = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    let jsonString = match[0].replace(/\n/g, " ").replace(/\r/g, " ");
    return JSON.parse(jsonString);
  } catch (err) {
    console.log("❌ JSON Parse Failed. Raw response:", text.substring(0, 300));
    return { matches: [] };
  }
};

// ✅ mode: 'networking' → return ALL ranked matches | 'dating' → return only the BEST 1
const getAIMatches = async (currentUser, candidates, mode = "dating") => {
  console.log(`📡 Sending request to Gemini (${MODEL})... [mode: ${mode}]`);

  if (!candidates || candidates.length === 0) {
    throw new Error("No candidates provided");
  }

  const topCandidates = candidates.slice(0, 8);
  const isNetworking = mode === "networking";

  const prompt = isNetworking
    ? `
You are a professional networking matchmaking AI.

Rank ALL of the following candidates by compatibility with the current user.
Return ALL of them ranked best to worst.

Rules:
- High similarity in personality_score → better match
- High similarity in ambition_score → better match
- Shared interests are VERY important
- Give each a score from 60–100
- Write a short reason for each

Current user:
${JSON.stringify({ name: currentUser.name, personality_score: currentUser.personality_score, ambition_score: currentUser.ambition_score, interests: currentUser.interests, intent: currentUser.intent })}

Candidates:
${JSON.stringify(topCandidates)}

Return ONLY valid JSON, no extra text:
{
  "matches": [
    { "email": "...", "score": number, "reason": "..." },
    { "email": "...", "score": number, "reason": "..." }
  ]
}
`
    : `
You are a dating matchmaking AI.

Pick ONLY the single BEST compatible match for the current user from these pre-filtered candidates.
All candidates have already been verified as gender-compatible and have dating intent.

Rules:
- Prioritize high personality_score similarity
- Prioritize high ambition_score similarity  
- Shared interests are very important
- Score between 50–100 based on actual compatibility (don't penalize for low absolute scores)
- Always return the best available match even if compatibility is moderate

Current user:
${JSON.stringify({ name: currentUser.name, personality_score: currentUser.personality_score, ambition_score: currentUser.ambition_score, interests: currentUser.interests })}

Candidates:
${JSON.stringify(topCandidates)}

Return ONLY valid JSON, no extra text:
{
  "matches": [
    { "email": "best_match_email", "score": number, "reason": "short reason" }
  ]
}
`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
          responseMimeType: "application/json",
        },
      },
      { timeout: 35000 }
    );

    const text = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) throw new Error("Empty response from Gemini");

    const result = extractJSON(text);

    // ✅ Quota / rate limit guard — return null so caller uses fallback
    if (!result.matches || result.matches.length === 0) {
      console.log("⚠️ AI returned no matches, falling back");
      return null;
    }

    // For dating: reject weak single match
    if (!isNetworking) {
      const best = result.matches[0];
      if (!best || best.score < 50) {
        console.log("⚠️ AI gave weak dating match, using fallback");
        return null;
      }
    }

    console.log("✅ Gemini AI analysis completed successfully");
    return result;

  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ Gemini Error: ${errMsg}`);

    // ✅ Quota exceeded → return null so controller uses topCandidates fallback
    if (errMsg.includes("quota") || errMsg.includes("rate") || error.response?.status === 429) {
      console.log("⚠️ Gemini quota hit — returning null for fallback");
      return null;
    }

    // Other errors → also return null, don't crash the request
    return null;
  }
};

module.exports = { getAIMatches };