const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../../config");
const { answerCountQuestion } = require("../services/countIntent");
const { extractIntent } = require("../services/intentExtractor");

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many chat requests. Please wait a few minutes and try again.",
  },
});

router.post("/", chatLimiter, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const intent = await extractIntent(message);

    if (intent.intent === "count") {
      const countAnswer = await answerCountQuestion({
        severity: intent.severity,
        status: intent.status,
      });

      return res.json(countAnswer);
    }

    const ragResponse = await fetch(
      `${config.rag.serviceUrl}/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          history: history || [],
          severity: intent.severity,
          status: intent.status,
          issueId: intent.issueId,
        }),
      }
    );

    if (!ragResponse.ok) {
      throw new Error(
        `RAG service failed: ${ragResponse.status}`
      );
    }

    const ragData = await ragResponse.json();

    res.json(ragData);

  } catch (error) {

    console.error("Chat error:", error);

    res.status(500).json({
      message: "Failed to generate response",
    });
  }
});

module.exports = router;
