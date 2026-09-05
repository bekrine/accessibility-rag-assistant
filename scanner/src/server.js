const express = require("express");
const puppeteer = require("puppeteer");
const { AxePuppeteer } = require("@axe-core/puppeteer");

const { assertScanTargetIsSafe } = require("./urlGuard");

const app = express();

const MAX_NODES_PER_VIOLATION = 10;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ message: "Scanner is running" });
});

function flattenViolations(violations) {
  const issues = [];

  for (const violation of violations) {
    const nodes = violation.nodes.slice(0, MAX_NODES_PER_VIOLATION);

    for (const node of nodes) {
      issues.push({
        code: violation.id,
        message: violation.help,
        context: node.html,
        selector: (node.target || []).join(" "),
        runner: "axe",
        runnerExtras: {
          description: violation.description,
          impact: violation.impact,
          help: violation.help,
          helpUrl: violation.helpUrl,
          tags: violation.tags,
        },
      });
    }
  }

  return issues;
}

app.post("/scan", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ message: "url is required" });
  }

  let safeUrl;

  try {
    safeUrl = await assertScanTargetIsSafe(url);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(safeUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const results = await new AxePuppeteer(page).analyze();

    res.json({
      url: safeUrl,
      issues: flattenViolations(results.violations),
    });
  } catch (error) {
    console.error("Scan failed:", error);

    res.status(502).json({
      message: "Failed to scan the target URL",
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 9000;

app.listen(PORT, () => {
  console.log(`Scanner running on ${PORT}`);
});
