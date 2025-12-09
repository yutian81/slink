# 🔗 Slink 短链接生成器

在此项目基础上完全重构: https://github.com/crazypeace/Url-Shorten-Worker

## ✨ 项目简介

**slink** 是一个轻量级、高性能的短链接服务，它利用 **Cloudflare Workers** 的全球分布式网络和 **KV 存储** 的键值数据库，提供了免费且快速的短链接生成和重定向服务。该项目旨在提供一个易于部署、功能完善的自托管短链接解决方案。

<img width="1885" height="859" alt="image" src="https://github.com/user-attachments/assets/436f3b9c-7b0a-4591-9574-e187721b7d93" />

## 🚀 核心功能

- **短链接生成：** 支持将任意长网址生成简洁的短链接。
- **自定义短链 Key：** 用户可以为生成的短链接指定自定义的 Key（需后端配置允许）。
- **唯一链接判断：** 可选开启，对同一长链接，只生成一个短链接（通过 SHA-512 哈希判断）。
- **KV 数据管理：** 提供管理面板，支持 **查询、删除** 短链接。
- **访问统计：** 可选开启，对每个短链接记录访问次数。
- **阅后即焚模式：** 可选开启，链接被访问后立即从 KV 中删除。
- **二维码生成：** 在管理列表页，支持即时生成短链接的 **二维码**。
- **多模式支持：** 默认支持短链接重定向 (`shorturl`)，**可扩展** 支持图床 (`imghost`) 等访问模式。
- **暗黑模式：** 自动匹配系统主题，支持手动切换明亮模式或暗黑模式。
- **响应式设计：** 采用响应式设计，适配手机、平板等设备访问。

## 🧩 前端界面与用户体验

项目提供了一个直观的管理界面，用户无需进入 Cloudflare 控制台即可进行短链接管理操作。

- **生成面板：** 位于左侧卡片，用于输入长链接和可选的自定义 Key。
- **链接管理列表：** 位于右侧卡片，列出本地浏览器存储的短链接记录，支持：
	- **一键复制** 短链接。
	- **删除** 短链接（同时删除 KV 数据）。
	- **查询访问次数**（如果功能开启）。
	- **显示/隐藏二维码**。
- **主题切换：** 支持手动切换 **明亮/暗黑模式**，并跟随系统主题。

## ⚠️ 关键代码说明

### 1. 安全性

- **密码保护：** 管理面板通过 `PASSWORD` 环境变量进行保护。访问路径必须匹配该密码 (`/密码`)。
- **Key 保护列表：** 内部维护了 `protect_keylist = ["password",]`，防止用户删除或覆盖关键系统 Key。

### 2. KV 操作

所有短链接和配置数据都存储在绑定的 **`LINKS`** KV 命名空间中。
- 短链接以 Key-Value 形式存储，如 `randomKey -> longURL`。
- 访问计数以 `key-count -> countValue` 形式存储。
- 唯一链接功能通过存储 `SHA512(longURL) -> randomKey` 来实现反向查找。

---

## 部署教程

1. **创建 Worker**
   - 进入 CF 的 Workers 和 Pages 页面，创建一个 worker，名称随意填
   - 复制 [GitHub 仓库](https://github.com/yutian81/slink/) 中的 `_worker.js` 内容
   - 粘贴到 Worker 编辑器中，点击"保存并部署"

2. **配置 KV 空间**
   - 创建一个新的 KV 命名空间（如"LINKS"）
- 在 Worker 设置中找到"KV 命名空间绑定"，变量名称填写`LINKS`（不能是其他名称），绑定刚刚创建的KV空间，保存
- 若无保存数据的需求，则可不绑定KV空间

3. **配置环境变量**
   - 在 Worker 设置中找到"变量"，添加以下变量（根据需要）：

| **环境变量**        | **默认值**    | **描述**                                        |
| --------------- | ---------- | --------------------------------------------- |
| `PASSWORD`      | `link`     | **管理面板的访问路径/密码**。用户需访问 `yourdomain.com/link` |
| `THEME`         | `default`  | 界面主题，可扩展不同功能。目前支持图床：`imghost`，需同步设置 `TYPE` 变量 |
| `CORS`          | `true`     | 是否开启跨域访问 (CORS)                              |
| `UNIQUE_LINK`   | `true`     | 是否开启唯一链接功能（相同 URL 只生成一个短链）                  |
| `CUSTOM_LINK`   | `true`     | 是否允许用户自定义短链 Key                             |
| `OVERWRITE_KV`  | `true`     | 是否允许覆盖已存在的自定义短链 Key                         |
| `SNAPCHAT_MODE` | `false`    | 是否启用阅后即焚模式（访问一次后删除）                         |
| `VISIT_COUNT`   | `true`     | 是否启用访问计数功能                                |
| `LOAD_KV`       | `true`     | 是否允许从 KV 批量加载数据到本地列表                         |
| `TYPE`          | `shorturl` | 访问模式。`shorturl` 为短链接；`imghost` 为图床模式        |

4. **访问项目管理页面**

访问 `https://your-worker.your-account.workers.dev/<PASSWORD>` 使用管理界面

## 注意事项

1. **密码安全**：确保设置强密码并定期更换
2. **KV 限制**：Cloudflare KV 有写入次数限制，频繁操作可能导致超额
3. **自定义域名**：如需使用自定义域名，需在 Cloudflare 中配置 DNS 和 Workers 路由
4. **备份**：定期导出 KV 数据作为备份

---

## API 调用

| 命令 | 方法 | 参数 | 描述 |
|------|------|------|------|
| add  | POST | url, password, key | 创建短链接 |
| del  | POST | key, password | 删除短链接 |
| qry  | POST | key, password | 查询短链接 |
| qrycnt  | POST | key, password | 查询访问计数 |
| qryall | POST | password | 查询所有短链接 |
| config | POST | password | 获取设置详情 |

详见 [API说明文档](https://github.com/yutian81/slink/blob/main/API.md)

---

## ⭐ Star 星星走起
[![Star History Chart](https://api.star-history.com/svg?repos=yutian81/slink&type=date&legend=top-left)](https://www.star-history.com/#yutian81/slink&type=date&legend=top-left)
