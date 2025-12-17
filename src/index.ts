import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import type { Plugin, ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

interface Options {
  allowlist?: string[];
  envFiles?: string[] | string;
  envVar?: string;
  allowLocalhost?: boolean;
}

function normalizeIp(ip?: string | null): string {
  if (!ip) return "";
  const host = String(ip).split(",")[0].trim();
  const withoutPrefix = host.replace(/^::ffff:/, "");
  return withoutPrefix.replace(/^\[|\]$/g, "");
}

/**
 * Load IPs from .env files
 */
function loadIpsFromEnvFiles(
  files: string[] | string,
  envVar = "VITE_WEB_SERVER"
): string[] {
  const ips: string[] = [];
  if (Array.isArray(files)) {
    for (const f of files) {
      const p = path.resolve(process.cwd(), f);
      if (!fs.existsSync(p)) continue;
      try {
        const parsed = dotenv.parse(fs.readFileSync(p));
        if (parsed[envVar]) {
          const raw = parsed[envVar];
          const parts = String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          for (const part of parts) {
            const host = part.split(":")[0];
            const n = normalizeIp(host);
            if (n) ips.push(n);
          }
        }
        // 调试日志：显示从env文件加载的IP
        console.log(`[vite-plugin-allowlist] Loaded IPs from ${f}:`, ips);
      } catch (e) {
        // 调试日志：显示env文件解析错误
        console.warn(`[vite-plugin-allowlist] Failed to parse ${f}:`, e);
      }
    }
  } else if (typeof files === "string") {
    ips.push(...loadIpsFromEnvFiles([files], envVar));
  }
  return ips;
}

/**
 * Vite plugin to allowlist IPs
 */
export default function allowlistPlugin(options: Options = {}): Plugin {
  const {
    allowlist = [],
    envFiles = [".env", `.env.${process.env.NODE_ENV || "development"}`],
    envVar = "VITE_WEB_SERVER",
    allowLocalhost = true,
  } = options;

  const allowed = new Set<string>();
  for (const ip of allowlist || []) {
    if (ip) {
      const normalizedIp = normalizeIp(ip);
      allowed.add(normalizedIp);
      // 调试日志：显示添加到允许列表的IP
      console.log(
        `[vite-plugin-allowlist] Added IP from allowlist: ${normalizedIp}`
      );
    }
  }

  const fromEnv = loadIpsFromEnvFiles(envFiles, envVar);
  for (const ip of fromEnv) {
    allowed.add(ip);
    // 调试日志：显示从env文件添加的IP
    console.log(`[vite-plugin-allowlist] Added IP from env: ${ip}`);
  }

  // 调试日志：显示最终的允许列表
  console.log(
    `[vite-plugin-allowlist] Final allowed IPs:`,
    Array.from(allowed)
  );

  return {
    name: "vite-plugin-allowlist",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        (
          req: IncomingMessage & { url?: string },
          res: ServerResponse,
          next: (err?: any) => void
        ) => {
          try {
            if (
              req.url &&
              (req.url.startsWith("/__vite") ||
                req.url.startsWith("/@fs") ||
                req.url.startsWith("/__hmr"))
            ) {
              // 调试日志：显示跳过的内部请求
              console.log(
                `[vite-plugin-allowlist] Skipping internal request: ${req.url}`
              );
              return next();
            }

            const headers = (req as any).headers || {};
            const xff = headers["x-forwarded-for"];
            const remote =
              (req as any).socket && (req as any).socket.remoteAddress;
            const candidate = xff ? String(xff).split(",")[0].trim() : remote;
            const ip = normalizeIp(candidate);

            // 调试日志：显示请求来源IP
            console.log(`[vite-plugin-allowlist] Request from IP: ${ip}`);

            if (allowLocalhost && (ip === "127.0.0.1" || ip === "::1")) {
              // 调试日志：显示本地请求被允许
              console.log(
                `[vite-plugin-allowlist] Allowing localhost IP: ${ip}`
              );
              return next();
            }

            if (allowed.size === 0) {
              // 调试日志：显示空的允许列表
              console.log(
                `[vite-plugin-allowlist] No IPs in allowlist, allowing all requests`
              );
              return next();
            }

            if (allowed.has(ip)) {
              // 调试日志：显示匹配成功的IP
              console.log(
                `[vite-plugin-allowlist] IP ${ip} is in allowlist, access granted`
              );
              return next();
            }

            // 调试日志：显示被拒绝的IP
            console.log(
              `[vite-plugin-allowlist] IP ${ip} not in allowlist, access denied`
            );
            res.statusCode = 403;
            res.end("Forbidden");
          } catch (e) {
            // 调试日志：显示中间件中的错误
            console.error(`[vite-plugin-allowlist] Error in middleware:`, e);
            next();
          }
        }
      );
    },
  };
}
