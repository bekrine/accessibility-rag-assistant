const dns = require("dns/promises");

function ipToLong(ip) {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const long = ipToLong(ip);
  const ranges = [
    ["0.0.0.0", "0.255.255.255"],
    ["10.0.0.0", "10.255.255.255"],
    ["100.64.0.0", "100.127.255.255"],
    ["127.0.0.0", "127.255.255.255"],
    ["169.254.0.0", "169.254.255.255"],
    ["172.16.0.0", "172.31.255.255"],
    ["192.0.0.0", "192.0.0.255"],
    ["192.168.0.0", "192.168.255.255"],
    ["198.18.0.0", "198.19.255.255"],
  ];

  return ranges.some(
    ([start, end]) => long >= ipToLong(start) && long <= ipToLong(end)
  );
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("::ffff:")
  );
}

async function assertScanTargetIsSafe(rawUrl) {
  let parsed;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http/https URLs are allowed");
  }

  let addresses;

  try {
    addresses = await dns.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error("Could not resolve hostname");
  }

  for (const { address, family } of addresses) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new Error("Scanning private/internal network addresses is not allowed");
    }

    if (family === 6 && isPrivateIPv6(address)) {
      throw new Error("Scanning private/internal network addresses is not allowed");
    }
  }

  return parsed.toString();
}

module.exports = {
  assertScanTargetIsSafe,
};
