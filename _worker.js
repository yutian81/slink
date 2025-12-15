// 受保护的KEY列表
const protect_keylist = ["password", "link", "img", "note"];

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
  const default404 = `
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
  try {
    const response = await fetch(html_404);
    if (response.status === 200) { return await response.text(); }
  } catch (e) {
    console.error("无法从外部URL获取404 HTML:", e);
  }
  return default404;
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
    const contentType = parts[0].split(':')[1]; // 从 Data URL 的第一部分提取 Content-Type
    if (!contentType) return null;
    const base64Data = parts[1]; 
    const blob = base64ToBlob(contentType, base64Data); // 传入 Content-Type 和 Base64 数据主体
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

function checkURL(URL) {
  let str = URL;
  let Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  let objExp = new RegExp(Expression);
  if (objExp.test(str)) { return true; } 
  else { return false; }
}

async function save_url(URL, env) {
  let random_key = await randomString()
  let is_exist = await env.LINKS.get(random_key) 
  if (is_exist == null) {
    await env.LINKS.put(random_key, URL) 
    return random_key
  } else { return save_url(URL, env) }
}

async function existing_short_key(url_sha512, env) {
  let is_exist = await env.LINKS.get(url_sha512)
  if (is_exist == null) { return false } 
  else { return is_exist }
}

async function handleApiCommand(req, env, ctx, config, isKeyProtected, json_response_header) {
  const { cmd: req_cmd, url: req_url, key: req_key, type: req_type, password: req_password } = req;
  
  // API 秘钥检查
  if (config.password !== req_password) { 
    return new Response(`{"status":401, "error":"错误: 无效的API秘钥"}`, { headers: json_response_header, status: 401 });
  }

  // KV 启用状态检查
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
    // 查询配置
    case "config":
      response_data = { status: 200,
        visit_count: config.visit_count,
        custom_link: config.custom_link
      };
      http_status = 200;
      break;
    
    // 添加短链
    case "add":
      if (req_type === "link") {
        if (!checkURL(req_url)) {
          response_data.error = `错误: 链接类型必须是有效的URL`; http_status = 400;
          break;
        }
      } else if (req_type === "img") {
          if (!req_url || !req_url.startsWith("data:image/")) {
            response_data.error = `错误: 图床类型必须是有效的Base64`; http_status = 400;
            break;
          }
      } else if (!["note"].includes(req_type)) {
        response_data.error = `错误: 未知的内容类型: ${req_type}`; http_status = 400;
        break;
      }
      
      let final_key;
      let url_sha512;
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
        url_sha512 = await sha512(req_url);
        const existing_key = await existing_short_key(url_sha512, env);
        if (existing_key) {
          final_key = existing_key;
        } else {
          final_key = await save_url(req_url, env);
          if (final_key) { await env.LINKS.put(url_sha512, final_key); }
        }
      } else { final_key = await save_url(req_url, env); }
      
      // 统一处理成功或KV写入失败的返回
      if (final_key && http_status === 200) {
        if (config.unique_link) {
          ctx.waitUntil(env.LINKS.put(final_key + "-hash", url_sha512));
        } 
        response_data = { status: 200, key: final_key, error: "" };
      } else if (!final_key && http_status === 200) {
        response_data = { status: 507, key: "", error: "错误: 达到KV写入限制" }; http_status = 507;
      }
      break;
    
    // 删除短链
    case "del":
      http_status = 200;
      let keysInput = req_key;
      if (typeof req_key === 'string' && req_key.length > 0) {keysInput = [req_key];} 
      
      let primaryKeysToProcess = []; 
      let keysToFetchData = [];
      let deletedCount = 0;
      
      if (Array.isArray(keysInput) && keysInput.length > 0) {
        keysToFetchData = keysInput.filter(keyName => !isKeyProtected(keyName));
      } else {
        const keyListToDelete = await env.LINKS.list();
        if (keyListToDelete?.keys) { 
          keysToFetchData = keyListToDelete.keys.map(item => item.name)
            .filter(keyName => !(
              isKeyProtected(keyName) ||
              keyName.endsWith("-count") ||
              keyName.endsWith("-hash") ||
              keyName.length === 128
            ));
        }
      }
      if (keysToFetchData.length === 0) {
        response_data = { status: 200, error: "警告: 没有可删除的key", deleted_count: 0, dellist: [] };
        break;
      }
  
      const dataPromises = keysToFetchData.map(keyName => env.LINKS.get(keyName));
      const dataValues = await Promise.all(dataPromises);
      let deletedDellist = [];
      let hashMapKeysToFetch = []; 

      keysToFetchData.forEach((keyName, index) => {
        const value = dataValues[index];
        if (value != null) {
          primaryKeysToProcess.push(keyName);
          deletedDellist.push({ "key": keyName, "value": value });
          if (config.unique_link) { hashMapKeysToFetch.push(keyName + "-hash"); }
        }
      });
      
      if (primaryKeysToProcess.length === 0) {
        response_data = { status: 200, error: "警告: 没有可删除的key", deleted_count: 0, dellist: [] };
        break;
      }

      const keysToDeleteSet = new Set(primaryKeysToProcess);
      // 添加访问计数 Key
      if (config.visit_count) {
        primaryKeysToProcess.map(k => k + "-count").forEach(key => keysToDeleteSet.add(key));
      } 
      // 添加 SHA-512 Hash Key 和映射 Key
      if (config.unique_link && hashMapKeysToFetch.length > 0) {
        const hashKeyPromises = hashMapKeysToFetch.map(keyName => env.LINKS.get(keyName));
        const hashKeys = await Promise.all(hashKeyPromises);
        hashKeys.filter(h => h != null).forEach(key => keysToDeleteSet.add(h)); // 注意：这里是添加 hash key 本身
        hashMapKeysToFetch.forEach(key => keysToDeleteSet.add(key));
      } 
      
      const finalKeysToDelete = Array.from(keysToDeleteSet)
        .filter(keyName => !isKeyProtected(keyName));
      
      const deletePromises = finalKeysToDelete.map(keyName => env.LINKS.delete(keyName));
      await Promise.all(deletePromises);
      deletedCount = primaryKeysToProcess.length;
      response_data = { status: 200, error: "", deleted_count: deletedCount, dellist: deletedDellist };
      break;

    // 查询短链
    case "qry":
      http_status = 200;
      let keysToQuery = [];
      let queryInput = req_key;
      if (typeof req_key === 'string' && req_key.length > 0) { queryInput = [req_key]; }
      const isExplicitQuery = Array.isArray(queryInput) && queryInput.length > 0;
      
      if (isExplicitQuery) {
        keysToQuery = queryInput.filter(keyName => !isKeyProtected(keyName));
        if (keysToQuery.length === 0 && queryInput.length > 0) {
          response_data = { status: 403, error: "错误: 所有 Key 都在保护列表中" }; http_status = 403;
          break;
        }
      } else {
        const keyList = await env.LINKS.list();
        if (!keyList?.keys) {
          response_data = { status: 500, error: "错误: 加载key列表失败" }; http_status = 500;
          break;
        }
        keysToQuery = keyList.keys 
          .map(item => item.name)
          .filter(keyName => !(
            isKeyProtected(keyName) ||
            keyName.endsWith("-count") ||
            keyName.endsWith("-hash") ||
            keyName.length === 128
          ));
      }

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
    
    // 查询访问计数
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
      
      if (isExplicitCountQuery) { 
        keysToCount = countInput.filter(keyName => !isKeyProtected(keyName));
        if (keysToCount.length === 0) {
          response_data = { status: 403, error: "错误: 所有 Key 都在保护列表中" }; http_status = 403;
          break;
        }
      } else {
        const keyList = await env.LINKS.list(); 
        if (!keyList?.keys) {
          response_data = { status: 500, error: "错误: 加载key列表失败" }; http_status = 500;
          break;
        }
        keysToCount = keyList.keys 
          .map(item => item.name)
          .filter(keyName => !(
            isKeyProtected(keyName) ||
            keyName.endsWith("-count") ||
            keyName.endsWith("-hash") ||
            keyName.length === 128
          ));
      }
      
      const countKeys = keysToCount.map(keyName => keyName + "-count");
      const allKeysToFetch = [...keysToCount, ...countKeys];
      const allPromises = allKeysToFetch.map(keyName => env.LINKS.get(keyName));
      const allValues = await Promise.all(allPromises);
      const values = allValues.slice(0, keysToCount.length);
      const counts = allValues.slice(keysToCount.length);

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

// ---------------------------------
// 【主请求处理函数】
// ---------------------------------
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", 
    "Access-Control-Allow-Headers": "Content-Type",
  };
  const html_response_header = { ...base_cors_header, "Content-type": "text/html;charset=UTF-8", };
  const json_response_header = { ...base_cors_header, "Content-type": "application/json", };
  const text_response_header = { ...base_cors_header, "Content-type": "text/plain;charset=UTF-8", };

  // 定义常量
  const api_password = config.password.trim();
  const html404 = await get404Html();
  const response404 = () => new Response(html404, { headers: html_response_header, status: 404 });
  const isKeyProtected = (key) => protect_keylist.includes(key);

  // 定义密码和系统类型
  const requestURL = new URL(request.url)
  const pathSegments = requestURL.pathname.split("/").filter(p => p.length > 0)
  const admin_password = pathSegments.length > 0 ? pathSegments[0] : ""; 
  const system_type = pathSegments.length >= 2 ? pathSegments[1] : ""; 
    
  // 处理 OPTIONS 请求
  if (request.method === "OPTIONS") { return new Response(``, { headers: text_response_header }); }

  // 【API 接口处理】 (POST 请求)
  if (request.method === "POST") {
    if (pathSegments.length === 0 || admin_password !== config.admin) {
      return new Response(`{"status":401, "error":"错误: 无效的API端点"}`, {
        headers: json_response_header, status: 401
      });
    }
  
    let req;
    try {
      req = await request.json();
    } catch (e) {
      return new Response(`{"status":400, "error":"错误: 无效的JSON格式"}`, {
        headers: json_response_header, status: 400
      });
    }
      
    // 调用处理 API 命令的函数
    return handleApiCommand(req, env, ctx, config, isKeyProtected, json_response_header);
  }

  // 【前端网页访问】（GET 请求）
  if (pathSegments.length === 0) { return response404(); } // 处理 / 根路径，返回404

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
      return new Response(value, {
        headers: text_response_header, status: 500
      });
    }
  }
  else if (checkURL(value)) {
    return Response.redirect(value, 302);
  } 
  else {
    return new Response(value, {
      headers: text_response_header, status: 200
    });
  }
}
