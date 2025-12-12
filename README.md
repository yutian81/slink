# 🔗 Slink | 多功能短链系统

在此项目基础上完全重构: https://github.com/crazypeace/Url-Shorten-Worker

## ✨ 项目简介

**Slink** 是一个轻量级、高性能的多功能文件管理服务，基于 **Cloudflare Workers** 和 **KV 存储**，具备免费且快速的短链、图床、记事本、剪贴板四个模块。该项目旨在提供一个易于部署、功能完善的自托管文件管理解决方案。

<table>
  <tr>
    <td ><img src="https://github.com/user-attachments/assets/ce186a11-583c-41df-bfd5-7533a5a66ca7" alt="主页明亮模式" style="max-width:100%;"></td>
    <td><img src="https://b2qq.24811213.xyz/2025-12/1765507366-image.webp" alt="主页暗黑模式" style="max-width:100%;"></td>
  </tr>
  <tr>
    <td><img src="https://b2qq.24811213.xyz/2025-12/1765507370-image.webp" alt="短链管理页" style="max-width:100%;"></td>
    <td><img src="https://b2qq.24811213.xyz/2025-12/1765507405-image.webp" alt="图床管理页" style="max-width:100%;"></td>
  </tr>
</table>

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

## 🧩 部署方式

详见 [博客教程](https://blog.notett.com/post/2025/12/251212-slink/)

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
