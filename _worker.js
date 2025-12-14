// 受保护的KEY列表
const protect_keylist = ["password", "link", "img", "note", "paste"];

// 主导出函数
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

const system_base_url = "https://blog2.811520.xyz/slink"; // 基础URL
const main_html = `${system_base_url}/index.html`; // 默认为短链页面
const html_404 = `${system_base_url}/404.html`;

async function get404Html() {
  try {
    const response = await fetch(html_404);
    if (response.status === 200) { return await response.text(); }
  } catch (e) {
    console.error("无法从外部URL获取404 HTML:", e);
  }
  return `
    <!DOCTYPE html>
    <html>
    <head><title>404 Not Found</title></head>
    <body>
      <h1>404 未找到</h1>
      <p>您访问的页面不存在</p>
      <p>访问作者博客获取教程：<a href="https://blog.notett.com" target="_blank">QingYun Blog</a></p>
    </body>
    </html>
  `;
}

// 工具函数
function base64ToBlob(contentType, base64Data) {
  var raw = atob(base64Data); // 直接使用 Base64 数据部分
  var rawLength = raw.length;
  var uInt8Array = new Uint8Array(rawLength);
  for (var i = 0; i < rawLength; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
  return new Blob([uInt8Array], { type: contentType });
}

// 获取图片类型
function getBlobAndContentType(base64String) {
  if (!base64String || !base64String.startsWith("data:image/")) { return null; }
  
  try {
    const parts = base64String.split(';base64,');
    if (parts.length !== 2) return null;
    let contentType = parts[0].split(':')[1];
    if (!contentType) return null;
    const base64Data = parts[1]; // 获取到 Base64 数据主体
  
    // Content-Type 嗅探
    if (base64String.startsWith("data:image/jpeg")) { contentType = "image/jpeg"; }
    else if (base64String.startsWith("data:image/png")) { contentType = "image/png"; }
    else if (base64String.startsWith("data:image/gif")) { contentType = "image/gif"; }
    else if (base64String.startsWith("data:image/webp")) { contentType = "image/webp"; }
    else if (base64String.startsWith("data:image/svg+xml")) { contentType = "image/svg+xml"; }
    else if (base64String.startsWith("data:image/bmp")) { contentType = "image/bmp"; }
    else if (base64String.startsWith("data:image/tiff")) { contentType = "image/tiff"; }
    else if (base64String.startsWith("data:image/x-icon")) { contentType = "image/x-icon"; }
    // 直接传入 Content-Type 和 Base64 数据主体
    const blob = base64ToBlob(contentType, base64Data);
    return { blob, contentType };
  } catch (e) { console.error("Base64解析或Blob创建错误:", e); return null; }
}

async function randomString(len) {
  len = len || 5;
  let chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  let maxPos = chars.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * maxPos));
  }
  return result;
}

async function sha512(url) {
  url = new TextEncoder().encode(url)
  const url_digest = await crypto.subtle.digest( { name: "SHA-512" }, url )
  const hashArray = Array.from(new Uint8Array(url_digest));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex
}

async function checkURL(URL) {
  try {
    const urlObj = new URL(URL);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch (e) { return false; }
}

async function save_url(URL, env) {
  let random_key = await randomString()
  let is_exist = await env.LINKS.get(random_key) 
  if (is_exist == null) {
    await env.LINKS.put(random_key, URL) 
    return random_key
  } else { return save_url(URL, env) }
}

async function is_url_exist(url_sha512, env) {
  let is_exist = await env.LINKS.get(url_sha512)
  if (is_exist == null) { return false } 
  else { return is_exist }
}

// 主请求处理函数
async function handleRequest(request, env, ctx) {
  // 读取环境变量配置
  const config = {
    admin: env.ADMIN || "admin", // 管理密码
    password: env.PASSWORD || "apipass", // API秘钥
    unique_link: env.UNIQUE_LINK === "false" ? false : true,
    custom_link: env.CUSTOM_LINK === "false" ? false : true,
    overwrite_kv: env.OVERWRITE_KV === "false" ? false : true,
    snapchat_mode: env.SNAPCHAT_MODE === "true" ? true : false,
    visit_count: env.VISIT_COUNT === "true" ? true : false,
    load_kv: env.LOAD_KV === "false" ? false : true,
  };

  // 定义响应头
  const base_cors_header = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", // 包含 GET 以确保短链访问正常
    "Access-Control-Allow-Headers": "Content-Type",
  };
  const html_response_header = { ...base_cors_header, "Content-type": "text/html;charset=UTF-8", };
  const json_response_header = { ...base_cors_header, "Content-type": "application/json", };
  const text_response_header = { ...base_cors_header, "Content-type": "text/plain;charset=UTF-8", };

  // 定义常量
  const api_password = config.password.trim();
  const html404 = await get404Html();
  const response404 = () => new Response(html404, { headers: html_response_header, status: 404 });

  // 定义密码和系统类型
  const requestURL = new URL(request.url)
  const pathSegments = requestURL.pathname.split("/").filter(p => p.length > 0)
  const admin_password = pathSegments.length > 0 ? pathSegments[0] : ""; // 管理密码为路径的第一段
  const system_type = pathSegments.length >= 2 ? pathSegments[1] : ""; // 模块类型为路径的第二段
    
  // 处理 OPTIONS 请求
  if (request.method === "OPTIONS") { return new Response(``, { headers: text_response_header }); }

  // -----------------------------------------------------------------
  // 【API 接口处理】 (POST 请求)
  // -----------------------------------------------------------------
  if (request.method === "POST") {
    if (pathSegments.length === 0 || admin_password !== config.admin) {
      return new Response(`{"status":401, "error":"错误: 无效的API端点"}`, { headers: json_response_header, status: 401 });
    }
  
    let req;
    try {
      req = await request.json();
    } catch (e) {
      return new Response(`{"status":400, "error":"错误: 无效的JSON格式"}`, { headers: json_response_header, status: 400 });
    }
      
    const { cmd: req_cmd, url: req_url, key: req_key, type: req_type, password: req_password } = req; // 读取cmd命令参数
    if (config.password !== req_password) { 
      return new Response(`{"status":401, "error":"错误: 无效的API秘钥"}`, { headers: json_response_header, status: 401 });
    }
    
    // 检查 Key 保护和 KV 启用状态
    const isKeyProtected = (key) => protect_keylist.includes(key);
    const kvRequiredCommands = ["add", "del", "qry", "qrycnt"];
    if (kvRequiredCommands.includes(req_cmd) && !config.load_kv) {
      return new Response(
        JSON.stringify({ status: 400, error: "错误: 载入kv功能未启用" }),
        { headers: json_response_header, status: 400 }
      );
    }

    let response_data = { status: 400, error: `错误: 未知的命令 ${req_cmd}` };
    let http_status = 400;

    switch (req_cmd) {
      case "config":
        response_data = { status: 200,
          visit_count: config.visit_count,
          custom_link: config.custom_link
        };
        http_status = 200;
        break;
        
      case "add":
        if (req_type === "link") {
          if (!await checkURL(req_url)) {
            response_data.error = `错误: 长链接类型必须是有效的URL`; http_status = 400;
            break;
          }
        } else if (req_type === "img") {
            if (!req_url || !req_url.startsWith("data:image/")) {
              response_data.error = `错误: 图床类型必须是有效的Base64图片`; http_status = 400;
              break;
            }
        } else if (!["note", "paste"].includes(req_type)) {
          response_data.error = `错误: 未知的内容类型: ${req_type}`; http_status = 400;
          break;
        }
        
        let final_key;
        http_status = 200;
        if (config.custom_link && req_key) {
          if (isKeyProtected(req_key)) {
            response_data = { status: 403, key: req_key, error: "错误: key在保护列表中" }; http_status = 403;
          } else if (!config.overwrite_kv && await env.LINKS.get(req_key) != null) {
            response_data = { status: 409, key: req_key, error: "错误: 已存在的key" }; http_status = 409;
          } else {
            await env.LINKS.put(req_key, req_url);
            final_key = req_key;
          }
        } else if (config.unique_link) {
          const url_sha512 = await sha512(req_url);
          const existing_key = await is_url_exist(url_sha512, env);
          if (existing_key) {
            final_key = existing_key;
          } else {
            final_key = await save_url(req_url, env);
            if (final_key) { await env.LINKS.put(url_sha512, final_key); }
          }
        } else { final_key = await save_url(req_url, env); }
        
        // 统一处理成功或KV写入失败的返回
        if (final_key && http_status === 200) { 
          response_data = { status: 200, key: final_key, error: "" };
        } else if (!final_key && http_status === 200) {
          response_data = { status: 507, key: "", error: "错误: 达到KV写入限制" }; http_status = 507;
        }
        break;
        
      case "del":
        http_status = 200;
        let keysInput = req_key;
        if (typeof req_key === 'string' && req_key.length > 0) {keysInput = [req_key];} // 单 Key 转换为数组
        
        let primaryKeysToProcess = [];  
        let keysToFetchData = [];       
        let deletedCount = 0;           
        
        //确定需要处理的主 Key 列表 (keysToFetchData)
        if (Array.isArray(keysInput) && keysInput.length > 0) {
          keysToFetchData = keysInput.filter(keyName => !isKeyProtected(keyName));
        } else {
          const keyListToDelete = await env.LINKS.list();
          if (keyListToDelete?.keys) { 
            keysToFetchData = keyListToDelete.keys.map(item => item.name)
              .filter(keyName => !( isKeyProtected(keyName) || keyName.endsWith("-count") || keyName.length === 128 ));
          }
        }
        if (keysToFetchData.length === 0) {
          response_data = { status: 200, error: "警告: 没有可删除的key", deleted_count: 0, dellist: [] }; // **字段名修正：使用 dellist**
          break;
        }
    
        // 预读取数据 (构造 dellist) 并收集哈希计算 Promise
        const dataPromises = keysToFetchData.map(keyName => env.LINKS.get(keyName));
        const dataValues = await Promise.all(dataPromises);
        let deletedDellist = [];
        let hashPromises = []; 
        keysToFetchData.forEach((keyName, index) => {
          const value = dataValues[index];
          if (value != null) {
            primaryKeysToProcess.push(keyName);
            deletedDellist.push({ "key": keyName, "value": value });
            if (config.unique_link) { hashPromises.push(sha512(value)); } 
          }
        });
        if (primaryKeysToProcess.length === 0) {
          response_data = { status: 200, error: "警告: 没有可删除的key", deleted_count: 0, dellist: [] };
          break;
        }
    
        // 构建最终删除列表 (主 Key + Count Key + Hash Key)
        let hashKeysToDelete = [];
        if (config.unique_link) { hashKeysToDelete = await Promise.all(hashPromises); }
        let finalKeysToDelete = [...primaryKeysToProcess];
        if (config.visit_count) {
          finalKeysToDelete = [...finalKeysToDelete, ...primaryKeysToProcess.map(k => k + "-count")];
        }
        finalKeysToDelete = [...finalKeysToDelete, ...hashKeysToDelete];
        finalKeysToDelete = [...new Set(finalKeysToDelete)] 
          .filter(keyName => !isKeyProtected(keyName));
    
        // 执行删除并构造响应
        const deletePromises = finalKeysToDelete.map(keyName => env.LINKS.delete(keyName));
        await Promise.all(deletePromises);
        deletedCount = primaryKeysToProcess.length; // 实际成功删除的主 Key 数量
        response_data = { status: 200, error: "", deleted_count: deletedCount, dellist: deletedDellist };
        break;

      case "qry":
        http_status = 200;
        let keysToQuery = []; // 存储要查询的 Key 列表
        let queryInput = req_key;
        if (typeof req_key === 'string' && req_key.length > 0) { queryInput = [req_key]; }
        const isExplicitQuery = Array.isArray(queryInput) && queryInput.length > 0;
        
        if (isExplicitQuery) { // 显式查询模式 (单 Key 或多 Key)
          keysToQuery = queryInput.filter(keyName => !isKeyProtected(keyName));
          if (keysToQuery.length === 0 && queryInput.length > 0) {
            response_data = { status: 403, error: "错误: 所有 Key 都在保护列表中" }; http_status = 403;
            break;
          }
        } else {
          // 查询所有模式
          const keyList = await env.LINKS.list();
          if (!keyList?.keys) {
            response_data = { status: 500, error: "错误: 加载key列表失败" }; http_status = 500;
            break;
          }
          keysToQuery = keyList.keys // 过滤掉受保护的 Key、计数 Key 和 SHA-512 哈希 Key
            .map(item => item.name)
            .filter(keyName => !( isKeyProtected(keyName) || keyName.endsWith("-count") || keyName.length === 128 ));
        }

        // Promise.all 并行执行
        const urlPromises = keysToQuery.map(keyName => env.LINKS.get(keyName));
        const urls = await Promise.all(urlPromises);
        let qrylist = [];
        keysToQuery.forEach((key, index) => {
          if (urls[index] != null) { qrylist.push({ "key": key, "value": urls[index] }); }
        });
        
        if (isExplicitQuery && qrylist.length === 0) {
            response_data = { status: 404, error: "错误: Key 不存在或 Key 已过期" }; http_status = 404;
        } else {
            response_data = { status: 200, error: "", qrylist: qrylist };
        }
        break;
      
      case "qrycnt":
        http_status = 200;
        if (!config.visit_count) {
          response_data = { status: 400, error: "错误: 统计功能未开启" }; http_status = 400;
          break;
        }
        
        let keysToCount = [];
        let countInput = req_key;
        if (typeof req_key === 'string' && req_key.length > 0) { countInput = [req_key]; }
        const isExplicitCountQuery = Array.isArray(countInput) && countInput.length > 0;
        
        if (isExplicitCountQuery) { // 显式查询模式 (单 Key 或多 Key)
          keysToCount = countInput.filter(keyName => !isKeyProtected(keyName));
          if (keysToCount.length === 0) {
            response_data = { status: 403, error: "错误: 所有 Key 都在保护列表中" }; http_status = 403;
            break;
          }
        } else {
          const keyList = await env.LINKS.list(); // 查询所有模式（缺少 Key）
          if (!keyList?.keys) {
            response_data = { status: 500, error: "错误: 加载key列表失败" }; http_status = 500;
            break;
          }
          keysToCount = keyList.keys 
            .map(item => item.name)
            .filter(keyName => !( isKeyProtected(keyName) || keyName.endsWith("-count") || keyName.length === 128 ));
        }
      
        const countKeys = keysToCount.map(keyName => keyName + "-count"); // 筛选出计数 Key
        const countPromises = countKeys.map(keyName => env.LINKS.get(keyName)); // 同时查询计数和原始值
        const valuePromises = keysToCount.map(keyName => env.LINKS.get(keyName)); // 额外查询原始 Value
        const [counts, values] = await Promise.all([
          Promise.all(countPromises),
          Promise.all(valuePromises)
        ]);

        let countlist = [];
        keysToCount.forEach((key, index) => {
          const countValue = counts[index];
          const originalValue = values[index];
          if (originalValue != null) {
            countlist.push({ "key": key, "value": originalValue, "count": countValue ?? "0" });
          }
        });
        
        if (isExplicitCountQuery && countlist.length === 0) {
          response_data = { status: 404, error: "错误: Key 不存在或 Key 已过期" }; http_status = 404;
        } else {
          response_data = { status: 200, error: "", countlist: countlist };
        }
        break;
    }
    return new Response(JSON.stringify(response_data), {
      headers: json_response_header, status: http_status
    });
  }

  // -----------------------------------------------------------------
  // 【前端网页访问】（GET 请求）
  // -----------------------------------------------------------------
  // 处理 / 根路径，返回404
  if (pathSegments.length === 0) { return response404(); }

  // 处理 /管理路径 和 /管理路径/模块类型 路径
  if (admin_password === config.admin) {
    let target_html_url;
    if (pathSegments.length === 1) { target_html_url = main_html; }
    else if (pathSegments.length >= 2) { target_html_url = `${system_base_url}/${system_type}/index.html`; }
    else { return response404(); }
    
    // 统一处理页面加载和替换
    if (target_html_url) {
      let response = await fetch(target_html_url);
      if (response.status !== 200) { return response404(); }
      let index = await response.text();
      index = index.replace(/__PASSWORD__/gm, api_password);
      return new Response(index, { headers: html_response_header, status: 200 })
    }
    return response404();
  }

  // 处理 /短链 或 /图床Key 的访问
  let path = decodeURIComponent(pathSegments[0] || "");
  const params = requestURL.search;
  if (protect_keylist.includes(path)) { return response404(); }
  let value = await env.LINKS.get(path); 
  if (!value) { return response404(); }

  // 计数功能
  if (config.visit_count) {
      let count = await env.LINKS.get(path + "-count"); 
      count = count ? parseInt(count) + 1 : 1;
      ctx.waitUntil(env.LINKS.put(path + "-count", count.toString()));
  }

  // 阅后即焚模式
  if (config.snapchat_mode) { 
      ctx.waitUntil(env.LINKS.delete(path));
      if (config.visit_count) { ctx.waitUntil(env.LINKS.delete(path + "-count")); }
  }
  
  if (params) { value = value + params }

  // 智能判断系统类型返回不同响应
  const imageResult = getBlobAndContentType(value);
  if (imageResult) {
    try {
      return new Response(imageResult.blob, {
        headers: {
          "Content-Type": imageResult.contentType,
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        }, status: 200
      });
    } catch (e) {
      console.error("图片处理错误:", e);
      return new Response(value, { headers: text_response_header, status: 500 });
    }
  }
  else if (await checkURL(value)) { // 判断是否为 URL，是则为短链接)
    return Response.redirect(value, 302);
  } 
  else {
    return new Response(value, { headers: text_response_header, status: 200 });
  }
}
