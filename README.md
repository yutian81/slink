# 🔗 Slink | 多功能短链系统

在此项目基础上完全重构: https://github.com/crazypeace/Url-Shorten-Worker

## ✨ 项目简介

**Slink** 是一个轻量级、高性能的文件管理服务，基于 **Cloudflare Workers** 的全球分布式网络和 **KV 存储**，具备免费且快速的短链、图床、记事本、剪贴板四个模块。该项目旨在提供一个易于部署、功能完善的自托管文件管理解决方案。

<img width="1877" height="859" alt="image" src="https://github.com/user-attachments/assets/ce186a11-583c-41df-bfd5-7533a5a66ca7" />

## 🚀 核心功能

### 通用功能

   - **KV 数据管理：** 提供管理面板，支持 **查询、删除** 短链接。
   - **访问统计：** 可选开启，对每个短链接记录访问次数。
   - **阅后即焚：** 可选开启，链接被访问后立即从 KV 中删除。
   - **二维码生成：** 在管理列表页，支持即时生成短链接的 **二维码**。
   - **暗黑模式：** 支持手动切换明亮模式或暗黑模式。
   - **响应式设计：** 采用响应式设计，适配手机、平板等设备访问。
   - **反向查询：** 支持根据短链接 Key 或文件名查询原始数据。

### 短链模块

   - **短链接生成：** 支持将任意长网址生成简洁的短链接。
   - **自定义短链 Key：** 用户可以为生成的短链接指定自定义的 Key，支持中文。
   - **唯一链接：** 可选开启，对同一长链接，只生成一个短链接（通过 SHA-512 哈希判断）。

### 图床模块

   - **图片上传：** 支持用户上传图片到图床，返回图片的访问链接。
   - **自定义文件名：** 用户可以为上传的图片指定自定义文件名。
   - **图片管理：** 提供管理面板，支持 **查询、删除** 上传的图片。

### 记事本模块（待实现）

   - **文本存储：** 支持用户在记事本中存储任意文本内容。
   - **自定义文件名：** 用户可以为存储的文本指定自定义文件名。
   - **文本管理：** 提供管理面板，支持 **查询、删除** 存储的文本。

### 剪贴板模块（待实现）

   - **文本复制：** 支持用户将任意文本内容复制到剪贴板。
   - **文本粘贴：** 用户可以从剪贴板中粘贴已复制的文本。

---

## 🧩 部署教程

1. **创建 Worker**
   - 进入 CF 的 Workers 和 Pages 页面，创建一个 worker，名称随意填
   - 复制 [GitHub 仓库](https://github.com/yutian81/slink/) 中的 `_worker-all.js` 内容
   - 粘贴到 Worker 编辑器中，点击"保存并部署"

> `_worker-all.js` 是聚合系统，含四大模块，`_worker.js` 是单系统，部署时可通过 `TYPE` 变量 (当前支持 `link`短链和 `img`图床) 决定启用哪个系统

2. **配置 KV 空间**
   - 创建一个新的 KV 命名空间（如"LINKS"）
   - 在 Worker 设置中找到"KV 命名空间绑定"，变量名称填写`LINKS`（不能是其他名称），绑定刚刚创建的KV空间，保存
   - 若无保存数据的需求，则可不绑定KV空间

3. **配置环境变量**
   - 在 Worker 设置中找到"变量"，添加以下变量（根据需要）：

| **环境变量**        | **默认值**    | **描述**                                        |
| --------------- | ---------- | --------------------------------------------- |
| `PASSWORD`      | `admin`    | 管理面板的访问路径：/密码。用户需访问 `yourdomain.com/admin` |
| `UNIQUE_LINK`   | `true`     | 是否开启唯一链接功能（相同 URL 只生成一个短链）                  |
| `CUSTOM_LINK`   | `true`     | 是否允许用户自定义短链 Key                             |
| `OVERWRITE_KV`  | `true`     | 是否允许覆盖已存在的自定义短链 Key                         |
| `SNAPCHAT_MODE` | `false`    | 是否启用阅后即焚模式（访问一次后删除）                         |
| `VISIT_COUNT`   | `true`     | 是否启用访问计数功能                                |
| `LOAD_KV`       | `true`     | 是否允许从 KV 批量加载数据到本地列表                         |

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

详见 [API说明文档](https://github.com/yutian81/slink/blob/main/API.md)

---

## ⭐ Star 星星走起
[![Star History Chart](https://api.star-history.com/svg?repos=yutian81/slink&type=date&legend=top-left)](https://www.star-history.com/#yutian81/slink&type=date&legend=top-left)
