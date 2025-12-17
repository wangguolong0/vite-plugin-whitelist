// src/index.ts
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
function normalizeIp(ip) {
  if (!ip)
    return "";
  const host = String(ip).split(",")[0].trim();
  const withoutPrefix = host.replace(/^::ffff:/, "");
  return withoutPrefix.replace(/^\[|\]$/g, "");
}
function loadIpsFromEnvFiles(files, envVar = "VITE_WEB_SERVER") {
  const ips = [];
  for (const f of files) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p))
      continue;
    try {
      const parsed = dotenv.parse(fs.readFileSync(p));
      if (parsed[envVar]) {
        const raw = parsed[envVar];
        const parts = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
        for (const part of parts) {
          const host = part.split(":")[0];
          const n = normalizeIp(host);
          if (n)
            ips.push(n);
        }
      }
    } catch (e) {
    }
  }
  return ips;
}
function allowlistPlugin(options = {}) {
  const {
    allowlist = [],
    envFiles = [".env", `.env.${process.env.NODE_ENV || "development"}`],
    envVar = "VITE_WEB_SERVER",
    allowLocalhost = true
  } = options;
  const allowed = /* @__PURE__ */ new Set();
  for (const ip of allowlist || []) {
    if (ip)
      allowed.add(normalizeIp(ip));
  }
  const fromEnv = loadIpsFromEnvFiles(envFiles, envVar);
  for (const ip of fromEnv)
    allowed.add(ip);
  return {
    name: "vite-plugin-allowlist",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          if (req.url && (req.url.startsWith("/__vite") || req.url.startsWith("/@fs") || req.url.startsWith("/__hmr"))) {
            return next();
          }
          const headers = req.headers || {};
          const xff = headers["x-forwarded-for"];
          const remote = req.socket && req.socket.remoteAddress;
          const candidate = xff ? String(xff).split(",")[0].trim() : remote;
          const ip = normalizeIp(candidate);
          if (allowLocalhost && (ip === "127.0.0.1" || ip === "::1")) {
            return next();
          }
          if (allowed.size === 0) {
            return next();
          }
          if (allowed.has(ip))
            return next();
          res.statusCode = 403;
          res.end("Forbidden");
        } catch (e) {
          next();
        }
      });
    }
  };
}
export {
  allowlistPlugin as default
};
