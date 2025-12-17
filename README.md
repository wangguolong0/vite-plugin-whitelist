# vite-plugin-allowlist

一个用于 Vite 的简单中间件插件，通过 IP 白名单限制访问。支持直接在 `options.allowlist` 中提供 IP，也支持从项目根目录的 `.env`、`.env.development` 等文件读取指定环境变量。

使用示例：

在 `vite.config.ts` 中：

```ts
import { defineConfig } from 'vite'
import allowlist from 'vite-plugin-allowlist'

export default defineConfig({
  plugins: [
    allowlist({
      allowlist: ['172.24.108.76'],
      envFiles: ['.env', '.env.development'],
      envVar: 'VITE_WEB_SERVER'
    })
  ]
})
```

在 `.env.development` 中示例：

```
VITE_WEB_SERVER="172.24.108.76:8080"
```

选项说明：

- `allowlist`: 可选，数组，直接写入允许的 IP 地址（字符串）。
- `envFiles`: 可选，数组，默认 `['.env', '.env.development']`，用于从这些文件读取 `envVar` 指定的环境变量。
- `envVar`: 可选，默认 `'VITE_WEB_SERVER'`，从 env 文件中读取该变量并解析出地址部分（支持 `host:port` 和逗号分隔的多个地址）。
- `allowLocalhost`: 可选，布尔，默认 `true`，允许 `127.0.0.1` 和 `::1`。

中间件行为说明：

- 若未配置任何 allowlist（即 `allowlist` 为空且 `envFiles` 中未找到变量），则默认不限制访问（允许所有）。
- 匹配时会对来自 `X-Forwarded-For` 的值或 socket 的 `remoteAddress` 进行检测，并做基础的 IPv6 -> IPv4 映射处理（比如 `::ffff:172.24.0.1` 将被识别为 `172.24.0.1`）。
