const express = require("express");
const cors = require("cors");
require("dotenv").config();

const issuesRouter = require("./routes/issues");
const chatRouter = require("./routes/chat");
const queueRouter = require("./routes/queue");
const config = require("../config");

const app = express();

app.use(cors({ origin: config.frontend.origin }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    message: "Backend is running",
  });
});

app.use("/api/issues", issuesRouter);
app.use("/api/chat", chatRouter);
app.use("/api/queues", queueRouter);


app.listen(config.server.port, () => {
  console.log(`Backend running on ${config.server.port}`);
});