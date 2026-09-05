const { z } = require("zod");

const scanRequestSchema = z
  .object({
    url: z.string().url().max(2000),
  })
  .strict();

module.exports = {
  scanRequestSchema,
};
