const { extractUserProfile } = require("../services/geminiService");

const processChat = async (req, res, next) => {
  try {
    console.log("🔥 processChat API hit");
    const { chatHistory } = req.body;

    if (!chatHistory || !Array.isArray(chatHistory)) {
      return res.status(400).json({ message: "Invalid chat history" });
    }

    const profile = await extractUserProfile(chatHistory);

    res.json({
      success: true,
      profile,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { processChat };