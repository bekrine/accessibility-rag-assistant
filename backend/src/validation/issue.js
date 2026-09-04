const { z } = require("zod");

const updateIssueSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    wcag: z.string().min(1).max(200).optional(),
    severity: z.enum(["Low", "Medium", "High"]).optional(),
    status: z.enum(["Open", "In Progress", "Resolved"]).optional(),
    page: z.string().min(1).max(200).optional(),
    url: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional(),
    remediation: z.string().max(5000).optional(),
  })
  .strict();

module.exports = {
  updateIssueSchema,
};
