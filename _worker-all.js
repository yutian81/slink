// 受保护的KEY列表
const protect_keylist = ["password", "link", "img", "note", "paste", "admin"];

// 主导出函数
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};

const system_base_url = "https://blog2.811520.xyz/slink"; // 基础URL
const main_html = `${system_base_url}/index.html`; // 根目录聚合页面模板
const html_404 = `${system_base_url}/404.html`;

async function get404Html() {
    try {
        const response = await fetch(html_404);
        if (response.status === 200) { return await response.text(); }
    } catch (e) {
        console.error("无法从外部URL获取404 HTML:", e);
    }
    return `<!DOCTYPE html>
<html>
 <head><title>404 Not Found</title></head>
 <body>
   <h1>404 未找到</h1>
   <p>您访问的页面不存在</p>
   <p>访问作者博客获取教程：<a href="https://blog.notett.com" target="_blank">QingYun Blog</a></p>
 </body>
</html>`;
}

// 工具函数
function base64ToBlob(base64String) {
  var parts = base64String.split(';base64,');
  var contentType = parts[0].split(':')[1];
  var raw = atob(parts[1]);
  var rawLength = raw.length;
  var uInt8Array = new Uint8Array(rawLength);
  for (var i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

// 获取图片类型
function getBlobAndContentType(base64String) {
    if (!base64String || !base64String.startsWith("data:image/")) {
        return null; // 不是图片 Base64 格式
    }

    try {
        const parts = base64String.split(';base64,');
        if (parts.length !== 2) return null;
        let contentType = parts[0].split(':')[1];
        if (!contentType) return null;
        const base64Data = parts[1];
        
        // Content-Type 嗅探
        if (base64String.startsWith("data:image/jpeg")) {
            contentType = "image/jpeg";
        } else if (base64String.startsWith("data:image/png")) {
            contentType = "image/png";
        } else if (base64String.startsWith("data:image/gif")) {
            contentType = "image/gif";
        } else if (base64String.startsWith("data:image/webp")) {
            contentType = "image/webp";
        } else if (base64String.startsWith("data:image/svg+xml")) {
            contentType = "image/svg+xml";
        } else if (base64String.startsWith("data:image/bmp")) {
             contentType = "image/bmp";
        } else if (base64String.startsWith("data:image/tiff")) {
             contentType = "image/tiff";
        } else if (base64String.startsWith("data:image/x-icon")) {
             contentType = "image/x-icon";
        }

        const optimizedBase64String = `data:${contentType};base64,${base64Data}`;
        const blob = base64ToBlob(optimizedBase64String);
        return { blob, contentType };
    } catch (e) {
        console.error("Base64解析或Blob创建错误:", e);
        return null;
    }
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
  let str = URL;
  let Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  let objExp = new RegExp(Expression);
  // 如果通过正则表达式，直接返回 true
  if (objExp.test(str)) { return true; } 
  else { return false; }
}

async function save_url(URL, env) {
  let random_key = await randomString()
  let is_exist = await env.LINKS.get(random_key) 
  if (is_exist == null) {
    await env.LINKS.put(random_key, URL) 
    return random_key
  } else {
    return save_url(URL, env) 
  }
}

async function is_url_exist(url_sha512, env) {
  let is_exist = await env.LINKS.get(url_sha512)
  if (is_exist == null) {
    return false
  } else {
    return is_exist
  }
}

async function system_password(env, config) {
  if (config.password.trim().length === 0) {
    return await env.LINKS.get("password");
  } else {
    return config.password.trim();
  }
}

// 主请求处理函数
async function handleRequest(request, env) {
  // 读取环境变量配置
  const config = {
    password: env.PASSWORD || "admin",
    unique_link: env.UNIQUE_LINK === "false" ? false : true,
    custom_link: env.CUSTOM_LINK === "false" ? false : true,
    overwrite_kv: env.OVERWRITE_KV === "false" ? false : true,
    snapchat_mode: env.SNAPCHAT_MODE === "true" ? true : false,
    visit_count: env.VISIT_COUNT === "true" ? true : false,
    load_kv: env.LOAD_KV === "false" ? false : true,
  };

  const password_value = await system_password(env, config); // 获取系统密码
  
  // 定义全局默认响应头 (包含CORS) 
  let response_header = {
    "Content-type": "text/html;charset=UTF-8;application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  // --- 统一处理 OPTIONS 请求 ---
  if (request.method === "OPTIONS") { return new Response(``, { headers: response_header }); }

  // -----------------------------------------------------------------
  // 【API 接口处理】 (POST)
  // -----------------------------------------------------------------
  if (request.method === "POST") {
      const requestURL = new URL(request.url);
      const pathSegments = requestURL.pathname.split("/").filter(p => p.length > 0);
      
      // 从请求路径中提取管理密码
      if (pathSegments.length === 0) {
        return new Response(`{"status":500, "error":"错误: URL中未提供密码"}`, { headers: response_header });
      }
      const path_password = pathSegments[0];
      if (path_password !== password_value) {
        return new Response(`{"status":500,"key": "", "error":"错误: 无效的密码"}`, { headers: response_header });
      }

      // 从请求路径中判断当前系统模式
      const current_system_type = pathSegments[1] || "link";
      
      let req;
      try {
          req = await request.json();
      } catch (e) {
          return new Response(`{"status":500, "error":"错误: 无效的JSON格式"}`, { headers: response_header });
      }
      
      const { cmd: req_cmd, url: req_url, key: req_key } = req;
      
      // 受保护 Key 检查
      const isKeyProtected = (key) => protect_keylist.includes(key);
      let response_data = { status: 500, error: `错误: 未知的命令 ${req_cmd}` };

      switch (req_cmd) {
          case "config":
              response_data = {
                status: 200,
                visit_count: config.visit_count,
                custom_link: config.custom_link
              };
              break;
          
          case "add":
              if (current_system_type === "link" && !await checkURL(req_url)) {
                  response_data.error = `错误: 无效的URL`;
                  break;
              }
              
              let final_key;
              
              if (config.custom_link && req_key) {
                  if (isKeyProtected(req_key)) {
                      response_data = { status: 500, key: req_key, error: "错误: key在保护列表中" };
                  } else if (!config.overwrite_kv && await is_url_exist(req_key, env)) {
                      response_data = { status: 500, key: req_key, error: "错误: 已存在的key" };
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
              } else {
                  final_key = await save_url(req_url, env);
              }
              
              // 统一处理成功或KV写入失败的返回
              if (final_key && response_data.status === 500) { 
                  response_data = { status: 200, key: final_key, error: "" };
              } else if (!final_key && response_data.status === 500) {
                  response_data = { status: 500, key: "", error: "错误: 达到KV写入限制" };
              }
              break;
          
          case "del":
              if (isKeyProtected(req_key)) {
                  response_data = { status: 500, key: req_key, error: "错误: key在保护列表中" };
              } else {
                  await env.LINKS.delete(req_key);
                  if (config.visit_count) { await env.LINKS.delete(req_key + "-count"); }
                  response_data = { status: 200, key: req_key, error: "" };
              }
              break;

          case "qry":
              if (isKeyProtected(req_key)) {
                  response_data = { status: 500, key: req_key, error: "错误: key在保护列表中" };
              } else {
                  const value = await env.LINKS.get(req_key);
                  response_data = value != null // 使用三元表达式
                      ? { status: 200, error: "", key: req_key, url: value }
                      : { status: 500, key: req_key, error: "错误: key不存在" };
              }
              break;

          case "qrycnt":
              if (!config.visit_count) {
                  response_data = { status: 500, key: req_key, error: "错误: 统计功能未开启" };
              } else if (isKeyProtected(req_key)) {
                  response_data = { status: 500, key: req_key, error: "错误: key在保护列表中" };
              } else {
                  const value = await env.LINKS.get(req_key + "-count");
                  const final_count = value ?? "0"; // 默认为0
                  response_data = { status: 200, error: "", key: req_key, count: final_count };
              }
              break;

          case "qryall":
              if (!config.load_kv) {
                  response_data = { status: 500, error: "错误: 载入kv功能未启用" };
                  break;
              }
              
              const keyList = await env.LINKS.list();
              let kvlist = [];
              
              if (keyList?.keys) {
                  // 使用 filter 明确过滤条件
                  const filterKeys = (item) => !(
                      isKeyProtected(item.name) || 
                      item.name.endsWith("-count") || 
                      item.name.length === 128 // 过滤 SHA-512 key
                  );
                  
                  for (const item of keyList.keys.filter(filterKeys)) {
                      const url = await env.LINKS.get(item.name);
                      kvlist.push({ "key": item.name, "value": url });
                  }
                  response_data = { status: 200, error: "", kvlist: kvlist };
              } else {
                  response_data = { status: 500, error: "错误: 加载key列表失败" };
              }
              break;
      }

      // 返回 JSON 响应
      return new Response(JSON.stringify(response_data), { headers: response_header });
  }

  // -----------------------------------------------------------------
  // 浏览器直接访问 worker 页面
  // -----------------------------------------------------------------
  const requestURL = new URL(request.url)
  const pathSegments = requestURL.pathname.split("/").filter(p => p.length > 0)
  const html404 = await get404Html();
  
  // 处理 / 根路径
  if (pathSegments.length === 0) {
    return new Response(html404, { headers: response_header, status: 404 }); 
  }
  
  // 处理管理员路径 /密码 或 /密码/系统类型
  if (pathSegments[0] === password_value) {
    
    // 情况 A: /密码/系统类型 (例如: /yutian81/link)
    if (pathSegments.length >= 2) {
      let system_type = pathSegments[1];
      const system_index_html = `${system_base_url}/${system_type}/index.html`; 
      let index = await fetch(system_index_html);
      if (index.status !== 200) {
        return new Response(html404, { headers: response_header, status: 404 });
      }
      index = await index.text();
      index = index.replace(/__PASSWORD__/gm, password_value);
      return new Response(index, { headers: response_header });
    } 
    
    // 情况 B: /密码 (例如: /yutian81) - 加载聚合页面 main_html
    if (pathSegments.length === 1) {
      let index = await fetch(main_html);
      index = await index.text();
      index = index.replace(/__PASSWORD__/gm, password_value);
      return new Response(index, { headers: response_header });
    }
  }

  // 处理 /短链 或 /图床Key 的访问
  let path = decodeURIComponent(pathSegments[0] || "");
  const params = requestURL.search;
  let value = await env.LINKS.get(path); 
  if (protect_keylist.includes(path)) { value = "" }
  if (!value) { return new Response(html404, { headers: response_header, status: 404 }) }

  // 计数功能
  if (config.visit_count) {
      let count = await env.LINKS.get(path + "-count"); 
      count = count ? parseInt(count) + 1 : 1;
      await env.LINKS.put(path + "-count", count.toString()); 
  }

  // 阅后即焚模式
  if (config.snapchat_mode) { 
      await env.LINKS.delete(path);
      if (config.visit_count) { await env.LINKS.delete(path + "-count"); } // 确保计数也被删除
  }
  
  if (params) { value = value + params }

  // 智能判断系统类型返回不同响应
  const imageResult = getBlobAndContentType(value);
  if (imageResult) {
    try {
        return new Response(imageResult.blob, {
            headers: { "Content-Type": imageResult.contentType, "Cache-Control": "public, max-age=86400" }
        });
    } catch (e) {
      console.error("图片处理错误:", e);
      return new Response(value, {
          headers: { "Content-type": "text/plain;charset=UTF-8;" },
      });
    }
  }
  else if (checkURL(value)) { // 判断是否为 URL，是则为短链接)
    return Response.redirect(value, 302);
  } 
  else {
    return new Response(value, { // 否则，视为纯文本/记事本 (note/paste)
        headers: { "Content-type": "text/plain;charset=UTF-8;" },
    });
  }
}
