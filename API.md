## 🚀 Slink API 文档

### ℹ️ 基本信息

- **API 端点:** `/<ADMIN>`
- **请求方法:** `POST`
- **请求头:** `Content-Type: application/json`
- **API 秘钥:** `password` 字段，必须包含环境变量 `PASSWORD` 的值（默认 `apipass`）
- **受保护 Key:** `["password", "link", "img", "note"]` 列表中的 Key 无法被 API 操作（添加、删除、查询）

---

### 参数说明

|**参数**|**必需**|**描述**|**适用命令**|**格式**|
|---|---|---|---|---|
|**cmd**|是|操作命令。支持 `add`, `qry`, `del`, `delall`, `qrycnt`, `qryall`。|所有|字符串|
|**password**|是|API 秘钥，用于权限验证。|所有|字符串|
|**type**|`add` 必需|链接模式：`link`（短链）、`img`（图床）、`note`（记事本）。|`add`|字符串|
|**url**|`add` 必需|源内容：长链 URL、Base64 图片码或文本内容。|`add`|字符串|
|**key**|否|Key 名称。用于自定义 Key (`add`) 或指定操作目标 (`qry`, `del` 等)。|`add`, `qry`, `del`, `delall`, `qrycnt`|字符串 (单个) 或 字符串数组 (批量)|

---

## 1. 添加短链 (`cmd: "add"`)

此命令不支持数组形式的 `key` 参数。

### 💻 `curl` 示例 (自定义 Key)

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "add",
	"url": "https://www.google.com/search?q=custom+key+example",
	"key": "mykey",
	"type": "link",
	"password": "apipass"
}'
```

### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"key": "随机或自定义的短链Key",
	"error": ""
}
```

---

## 2. 查询短链

### 2.1 查询单个 Key (`cmd: "qry"`)

**Worker 逻辑：** 仅支持单个 Key 查询，返回 Key 和 URL/Value。

#### 💻 `curl` 示例

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "qry",
	"key": "link1",
	"password": "apipass"
}'
```

#### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"error": "",
	"key": "link1",
	"url": "https://example.com/long/url/one"
}
```
### 2.2 查询所有 Key (`cmd: "qryall"`)

**Worker 逻辑：** 返回所有非辅助 Key（非 `-count`、非 SHA-512 Hash Key）的列表。

#### 💻 `curl` 示例

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "qryall",
	"password": "apipass"
}'
```

#### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"error": "",
	"kvlist": [
		{ "key": "link1", "value": "https://example.com/long/url/one" },
		{ "key": "mykey", "value": "data:image/png;base64,iVBORw0KG..." }
	]
}
```

---

## 3. 删除链接

### 3.1 删除单个 Key (`cmd: "del"`)

**Worker 逻辑：** 仅删除单个 Key 及其关联的辅助 Key（`-count`、SHA-512 Hash Key）。

#### 💻 `curl` 示例

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "del",
	"key": "link1",
	"password": "apipass"
}'
```

#### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"error": "",
	"key": "link1"
}
```

### 3.2 删除多个 Key 或全部 Key (`cmd: "delall"`)

**Worker 逻辑：** 用于删除 Key 数组，或者当 `key` 为空时执行全量删除（不包含受保护 Key）。

#### 💻 `curl` 示例 1: 删除多个 Key

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "delall",
	"key": ["link1","link2"],
	"password": "apipass"
}'
```

#### 💻 `curl` 示例 2: 删除全部 Key

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "delall",
	"key": [],
	"password": "apipass"
}'
# Key 为空数组，或直接省略 "key" 字段
```

#### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"error": "",
	"deleted_count": 2 // 成功删除的主 Key 数量
}
```

---

## 4. 查询访问计数

### 4.1 查询单个 Key 计数 (`cmd: "qrycnt"`)

**Worker 逻辑：** 仅查询单个 Key 的访问计数。

#### 💻 `curl` 示例

```bash
curl -X POST https://<worker_domain>/<ADMIN>
-H "Content-Type: application/json"
-d '{
	"cmd": "qrycnt",
	"key": "link1",
	"password": "apipass"
}'
```

#### 响应示例 (`status: 200`)

```json
{
	"status": 200,
	"error": "",
	"key": "link1",
	"count": "42" // 访问计数，字符串格式
}
```

---

## 5. 直接访问 / 重定向 (非 API)

当用户通过浏览器访问 Worker URL 时触发的功能。

| **访问路径**                                 | **行为**                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| `https://<YOUR_WORKER_URL>/`             | 返回 `404` 页面                                                |
| `https://<YOUR_WORKER_URL>/<ADMIN>`      | 返回短链管理页面                                                   |
| `https://<YOUR_WORKER_URL>/<ADMIN>/img`  | 返回图床管理页面                                                   |
| `https://<YOUR_WORKER_URL>/<ADMIN>/note` | 返回笔记页面（取决于前端文件）                                            |
| `https://<YOUR_WORKER_URL>/短链key`        | 如果 Key 对应的值是 URL，则 302 重定向；如果是 Base64 图片，则直接显示图片；否则返回文本内容。 |
