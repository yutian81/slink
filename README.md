# 🔗 Slink | 多功能短链系统

在此项目基础上完全重构: https://github.com/crazypeace/Url-Shorten-Worker

## ✨ 项目简介

**Slink** 是一个轻量级、高性能的多功能文件管理服务，基于 **Cloudflare Workers** 和 **KV 存储**，具备免费且快速的短链、图床、记事本、剪贴板四个模块。该项目旨在提供一个易于部署、功能完善的自托管文件管理解决方案。
<div class="image-container" style="display: flex; justify-content: center; align-items: flex-start; gap: 10px;">
   <img width="480" alt="image" src="https://github.com/user-attachments/assets/ce186a11-583c-41df-bfd5-7533a5a66ca7" />
   <img width="480" alt="image" src="https://b2qq.24811213.xyz/2025-12/1765507366-image.webp" />
   <img width="480" alt="image" src="https://b2qq.24811213.xyz/2025-12/1765507370-image.webp" />
   <img width="480" alt="image" src="https://b2qq.24811213.xyz/2025-12/1765507405-image.webp" />
</div>

## 🚀 核心功能

### 通用功能

- **KV 数据管理：** 提供管理面板，支持 **查询、删除** 链接
- **自定义名：** 所有模块均可自定义名称并支持**中文名**
- **访问统计：** 可选开启，对每个短链接记录**访问次数**
- **阅后即焚：** 可选开启，链接被**访问后**立即从 KV 中**删除**
- **二维码生成：** 在管理列表页，支持即时生成短链接的 **二维码**
- **暗黑模式：** 支持手动切换**明亮**模式或**暗黑**模式
- **响应式设计：** 采用响应式设计，适配**手机**、**平板**等设备访问
- **反向查询：** 支持根据短链接 Key 或文件名**查询原始**数据

### 各模块功能

> [!NOTE]
> `记事本模块` 与 `剪贴板模块` 尚未开发完成，敬请期待！  

| 模块                 | 功能               | 描述                                        |
| ------------------ | ---------------- | ----------------------------------------- |
| **短链模块**           | 短链生成<br>唯一链接     | 支持将任意长网址生成简洁的短链接<br>对同一长链接，只生成一个短链接（默认开启） |
| **图床模块**           | 图片上传<br>直链预览     | 上传图片到图床，返回图片的访问链接<br>可生成预览图与访问直链          |
| **记事本模块**<br>（待实现） | 文本存储<br>Markdown | 可存储任意文本内容<br>计划支持 Markdown 语法             |
| **剪贴板模块**<br>（待实现） | 文本复制<br>文本粘贴     | 将任意文本内容复制到剪贴板<br>从剪贴板中粘贴已复制的文本            |

---

## 🧩 快速部署

### 单模块部署

- 到 CF 创建一个 worker，删除默认的示例代码
- 在本仓库找到 `_worker.js` 文件，复制全部内容粘贴到 worker 中，点击 `保存并部署`
- 创建一个新的 KV 命名空间，名称随意，如 `slink`
- 在 `Worker 设置` 中找到 `KV 命名空间绑定`，变量名称填写 `LINKS`（不能是其他名称），绑定刚刚创建的 KV 空间，保存
- 配置以下环境变量（均为可选，默认管理员密码为 `admin`）

| 环境变量          | 默认值   | 描述                                     |
| ------------- | ----- | -------------------------------------- |
| PASSWORD      | admin | 管理面板的访问路径                              |
| UNIQUE_LINK   | true  | 是否开启唯一链接功能（相同 URL 只生成一个短链）             |
| CUSTOM_LINK   | true  | 是否允许用户自定义短链 Key                        |
| OVERWRITE_KV  | true  | 是否允许覆盖已存在的自定义短链 Key                    |
| SNAPCHAT_MODE | false | 是否启用阅后即焚模式（访问一次后删除）                    |
| VISIT_COUNT   | false | 是否启用访问计数功能                             |
| LOAD_KV       | true  | 是否允许从 KV 加载数据，需要绑定变量名为 `LINKS` 的 KV 空间 |
| TYPE          | link  | 选择部署的模块，默认 `link` 为 `短链`；改为 `img` 则变为 `图床`   |

- 访问 `https://your-worker.your-account.workers.dev/<PASSWORD>` 进入管理页面
- 建议：绑定一个自定义域名

### 多模块部署（推荐）

> [!NOTE]
> 这是作者推荐的部署方式

代码文件为仓库中的 `_worker-all.js`，无需 `TYPE` 变量，部署步骤完全一样

## 💫 进阶部署

> [!NOTE]
> 通过 github action 自动部署，与作者仓库同步，可自动部署最新版本 

- fork 作者仓库
- 依次点击自己仓库的 `action` → `自动同步上游仓库` → `run workflow`

![image.png](https://b2qq.24811213.xyz/2025-12/1765513234-image.webp)

- 只有首次同步需要点击，后续会自动同步
- 设置仓库机密 `setting` → `Secrets and variables` → `action`  

![image.png](https://b2qq.24811213.xyz/2025-12/1765513382-image.webp)

- 切换到 `variables` 选项卡，点击 `New repository variable`，创建如下变量：
	- **CF_ACCOUNT_ID**：CF 账户 ID
	- **CF_API_TOKEN**：CF 个人访问令牌，需要 worker 和 kv 权限
	- **CF_KV_ID**：你所创建的 KV 的 ID
	- **PASSWORD**：管理密码，默认为 admin

![image.png](https://b2qq.24811213.xyz/2025-12/1765513550-image.webp)

- 点击仓库上方的 `action` 选项卡，点击左侧 `自动部署到CF Worker`，点击 `run workflow`
- 等待部署完成，在部署日志中找到项目在 CF 的管理页面，点击进入 CF，绑定一个自定义域名

---

## API 接口说明

| 方法   | API 端点                                | 参数            | cmd命令  | 描述      |
| ---- | ------------------------------------- | ------------- | ------ | ------- |
| POST | `/<password>/<type>`，示例 `/admin/link` | cmd, url, key | add    | 创建短链接   |
| POST | `/<password>`，示例 `/admin`             | cmd, key      | del    | 删除短链接   |
| POST | `/<password>`，示例 `/admin`             | cmd, key      | qry    | 查询短链接   |
| POST | `/<password>`，示例 `/admin`             | cmd, key      | qrycnt | 查询访问计数  |
| POST | `/<password>`，示例 `/admin`             | cmd           | qryall | 查询所有短链接 |

详见 [API 文档](https://github.com/yutian81/slink/blob/main/API.md)

---

## ⭐ Star 星星走起

> [!IMPORTANT]
> 请顺手点个 ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=yutian81/slink&type=date&legend=top-left)](https://www.star-history.com/#yutian81/slink&type=date&legend=top-left)
