// 受保护的KEY列表
const protect_keylist = ["password", "link", "note"];

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
  const defaultHtml = `
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
  return defaultHtml;
}

// 工具函数
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

async function is_url_exist(url_sha512, env) {
  let is_exist = await env.LINKS.get(url_sha512)
  if (is_exist == null) { return false } 
  else { return is_exist }
}

// 检查 load_kv 配置
function handleKvCheck(config, headers, commandType = "执行操作") {
    if (!config.load_kv) {
        const errorMsg = commandType === "查询操作" 
            ? "错误: 载入kv功能未启用" 
            : `错误: 载入kv功能未启用, 无法执行${commandType}`;
        const response_data = { status: 400, error: errorMsg };
        return new Response(JSON.stringify(response_data), {
            headers: headers,
            status: 400
        });
    }
    return null;
}

// 处理所有 POST 请求的 API 命令
async function handleApiCommand(req, env, config, json_response_header, ctx) {
    const { cmd: req_cmd, url: req_url, key: req_key, password: req_password, type: req_type } = req;
    
    let response_data = { status: 400, error: `错误: 未知的命令 ${req_cmd}` };
    const isKeyProtected = (key) => protect_keylist.includes(key);
    let http_status = 400;

    switch (req_cmd) {
      case "config":
        response_data = {
            status: 200,
            visit_count: config.visit_count,
            custom_link: config.custom_link
        };
        http_status = 200;
        break;
        
      case "add":
        if (req_type === "link") {
          if (!checkURL(req_url)) { 
            response_data.error = `错误: 链接类型必须是有效的URL`; http_status = 400; 
            break;
          }
        } else if (!["note"].includes(req_type)) {
          response_data.error = `错误: 未知的内容类型: ${req_type}`; http_status = 400;
          break;
        }
        
        let final_key;
        http_status = 200;

        // 检查自定义 Key 的冲突和保护，并立即返回响应
        if (config.custom_link && req_key) {
          if (isKeyProtected(req_key)) {
            const response_data_403 = { status: 403, key: req_key, error: "错误: key在保护列表中" };
            return new Response(JSON.stringify(response_data_403), { headers: json_response_header, status: 403 }); // 👈 立即返回
          } else if (!config.overwrite_kv && await env.LINKS.get(req_key) != null) {
            const response_data_409 = { status: 409, key: req_key, error: "错误: 已存在的key" };
            return new Response(JSON.stringify(response_data_409), { headers: json_response_header, status: 409 }); // 👈 立即返回
          } else {
            await env.LINKS.put(req_key, req_url);
            final_key = req_key;
          }
        }
        
        // 如果是随机 Key 或唯一链接模式，且未通过自定义 Key 逻辑处理，则根据配置生成 Key
        if (!final_key) {
          if (config.unique_link) {
            const url_sha512 = await sha512(req_url);
            const existing_key = await is_url_exist(url_sha512, env);
            if (existing_key) {
              final_key = existing_key;
            } else {
              final_key = await save_url(req_url, env);
              if (final_key) { await env.LINKS.put(url_sha512, final_key); }
            }
          } else { 
            final_key = await save_url(req_url, env); 
          }
        }
        
        // 统一处理成功或KV写入失败的返回
        if (final_key) { 
          response_data = { status: 200, key: final_key, error: "" }; http_status = 200;
        } else {
            response_data = { status: 507, key: "", error: "错误: 达到KV写入限制" }; http_status = 507;
        }
        break;
        
      case "del":
        const delCheck = handleKvCheck(config, json_response_header, "删除操作");
        if (delCheck) return delCheck;

        http_status = 200;

        if (isKeyProtected(req_key)) {
          response_data = { status: 403, key: req_key, error: "错误: key在保护列表中" }; http_status = 403;
          break;
        }
        
        let hash_key_to_delete = null;
        if (config.unique_link) {
          const original_url = await env.LINKS.get(req_key);
          if (original_url) { hash_key_to_delete = await sha512(original_url); }
        }
        
        await env.LINKS.delete(req_key);
        if (config.visit_count) { ctx.waitUntil(env.LINKS.delete(req_key + "-count")); }
        if (hash_key_to_delete) { ctx.waitUntil(env.LINKS.delete(hash_key_to_delete)); }
        response_data = { status: 200, key: req_key, error: "" };
        break;

      case "delall":
        const delAllCheck = handleKvCheck(config, json_response_header, "删除操作");
        if (delAllCheck) return delAllCheck;

        http_status = 200;
        
        let keysToProcess = [];
        let deletedCount = 0;
        
        if (Array.isArray(req_key) && req_key.length > 0) {
          keysToProcess = req_key;
          if (config.visit_count) {
            keysToProcess = [...keysToProcess, ...req_key.map(k => k + "-count")];
          }
        } else {
          const keyListToDelete = await env.LINKS.list();
          if (keyListToDelete?.keys) { keysToProcess = keyListToDelete.keys.map(item => item.name); }
        }
        
        if (keysToProcess.length > 0) {
          const keysToDelete = keysToProcess
            .filter(keyName => {
              if (isKeyProtected(keyName)) { return false; }
              deletedCount++;
              return true;
            });
          
          const deletePromises = keysToDelete.map(keyName => env.LINKS.delete(keyName));
          await Promise.all(deletePromises);
          response_data = {
            status: 200,
            error: "",
            deleted_count: deletedCount,
          };
        } else {
          response_data = { status: 200, error: "警告: 没有可删除的key", deleted_count: 0 };
        }
        break;

      case "qry":
        const qryCheck = handleKvCheck(config, json_response_header, "查询操作");
        if (qryCheck) return qryCheck;

        http_status = 200;

        if (isKeyProtected(req_key)) {
          response_data = { status: 403, key: req_key, error: "错误: key在保护列表中" }; http_status = 403;
        } else {
          const value = await env.LINKS.get(req_key);
          if (value != null) {
            response_data = { status: 200, error: "", key: req_key, url: value };
          } else {
            response_data = { status: 404, key: req_key, error: "错误: key不存在" }; http_status = 404;
          }
        }
        break;
        
      case "qryall":
        const qryAllCheck = handleKvCheck(config, json_response_header, "查询操作");
        if (qryAllCheck) return qryAllCheck;

        http_status = 200;
        const keyList = await env.LINKS.list();
        let kvlist = [];
        if (keyList?.keys) {
          const filterKeys = (item) => !(
            isKeyProtected(item.name) || item.name.endsWith("-count") || item.name.length === 128
          );
          const filteredKeys = keyList.keys.filter(filterKeys);
          const urlPromises = filteredKeys.map(item => env.LINKS.get(item.name));
          const urls = await Promise.all(urlPromises);
          kvlist = filteredKeys.map((item, index) => ({ "key": item.name, "value": urls[index] }));
          response_data = { status: 200, error: "", kvlist: kvlist };
        } else {
          response_data = { status: 500, error: "错误: 加载key列表失败" }; http_status = 500;
        }
        break;
      
      case "qrycnt":
        const qrycntCheck = handleKvCheck(config, json_response_header, "查询计数操作");
        if (qrycntCheck) return qrycntCheck;
        
        http_status = 200;
        if (!config.visit_count) {
          response_data = { status: 400, key: req_key, error: "错误: 统计功能未开启" }; http_status = 400;
        } else if (isKeyProtected(req_key)) {
          response_data = { status: 403, key: req_key, error: "错误: key在保护列表中" }; http_status = 403;
        } else {
          const value = await env.LINKS.get(req_key + "-count");
          const final_count = value ?? "0";
          response_data = { status: 200, error: "", key: req_key, count: final_count };
        }
        break;
    }
    
    return new Response(JSON.stringify(response_data), {
      headers: json_response_header, status: http_status
    });
}

// 主请求处理函数
async function handleRequest(request, env, ctx) {
  // 读取环境变量配置
  const config = {
    admin: env.ADMIN || "admin", // 管理密码
    password: env.PASSWORD || "apipass", // API秘钥
    unique_link: env.UNIQUE_LINK !== "false",
    custom_link: env.CUSTOM_LINK !== "false",
    overwrite_kv: env.OVERWRITE_KV !== "false",
    snapchat_mode: env.SNAPCHAT_MODE === "true",
    visit_count: env.VISIT_COUNT === "true",
    load_kv: env.LOAD_KV !== "false",
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

  // 定义密码和系统类型
  const requestURL = new URL(request.url)
  const pathSegments = requestURL.pathname.split("/").filter(p => p.length > 0)
  const admin_password = pathSegments[0] || "";
  const system_type = pathSegments[1] || "";
    
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
    
    if (req.password !== config.password) {
      return new Response(`{"status":401, "error":"错误: 无效的API秘钥"}`, { headers: json_response_header, status: 401 });
    }
    // 将处理转发给api函数
    return handleApiCommand(req, env, config, json_response_header, ctx);
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

  // 处理 /短链 的访问
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
  if (checkURL(value)) {
    return Response.redirect(value, 302);
  } else {
    return new Response(value, { headers: html_response_header, status: 200 });
  }
}
