const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();



const cors = require("cors");

app.use(cors({
  origin: [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://areen3112.github.io/mingel-frontend/"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Middleware

app.use(express.json());

// Make sure this path points to YOUR UPDATED file

// NOT require('./gemini-match.js') or the old file
const userController = require('./controllers/userController');
const matchController = require('./controllers/matchController');
const eventController = require('./controllers/eventController');

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/matches", require("./routes/matchRoutes"));
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));

// Test route
app.get("/", (req, res) => {
  res.send("Mingle Backend Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});