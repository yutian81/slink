// 受保护的KEY列表
const protect_keylist = ['password', 'link', 'note'];

// 主导出函数
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

const system_base_url = 'https://blog2.811520.xyz/slink'; // 基础URL
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
    if (response.status === 200) return await response.text();
  } catch (e) {
    console.error('无法从外部URL获取404 HTML:', e);
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
  url = new TextEncoder().encode(url);
  const url_digest = await crypto.subtle.digest({ name: 'SHA-512' }, url);
  const hashArray = Array.from(new Uint8Array(url_digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function checkURL(URL) {
  let str = URL;
  let Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  let objExp = new RegExp(Expression);
  if (objExp.test(str)) {
    return true;
  } else {
    return false;
  }
}

async function save_url(URL, env) {
  let random_key = await randomString();
  let is_exist = await env.LINKS.get(random_key);
  if (is_exist == null) {
    await env.LINKS.put(random_key, URL);
    return random_key;
  } else {
    return save_url(URL, env);
  }
}

async function is_url_exist(url_sha512, env) {
  let is_exist = await env.LINKS.get(url_sha512);
  if (is_exist == null) {
    return false;
  } else {
    return is_exist;
  }
}

// 检查 load_kv 配置
function handleKvCheck(config, headers, commandType = '执行操作') {
  if (!config.load_kv) {
    const errorMsg = commandType === '查询操作' ? '错误: 载入kv功能未启用' : `错误: 载入kv功能未启用, 无法执行${commandType}`;
    const response_data = { status: 400, error: errorMsg };
    return new Response(JSON.stringify(response_data), { headers: headers, status: 400 });
  }
  return null;
}

// 处理所有 POST 请求的 API 命令
async function handleApiCommand(req, env, config, json_response_header, ctx) {
  const { cmd: req_cmd, url: req_url, key: req_key, password: req_password, type: req_type } = req;
  let response_data = { status: 400, error: `错误: 未知的命令 ${req_cmd}` };
  const isKeyProtected = (key) => protect_keylist.includes(key);
  let http_status = 400; // 统一处理 API Key 保护逻辑 (针对需要 key 的命令)

  if (req_key && req_cmd !== 'config' && req_cmd !== 'qryall' && isKeyProtected(req_key)) {
    response_data = { status: 403, key: req_key, error: '错误: key在保护列表中' };
    return new Response(JSON.stringify(response_data), { headers: json_response_header, status: 403 });
  }

  switch (req_cmd) {
    case 'config':
      response_data = {
        status: 200,
        visit_count: config.visit_count,
        custom_link: config.custom_link,
      };
      http_status = 200;
      break;

    case 'add':
      if (req_type === 'link') {
        if (!checkURL(req_url)) {
          response_data.error = `错误: 链接类型必须是有效的URL`;
          http_status = 400;
          break;
        }
      } else if (!['note'].includes(req_type)) {
        response_data.error = `错误: 未知的内容类型: ${req_type}`;
        http_status = 400;
        break;
      }

      let final_key = null;
      let final_type = req_type;
      http_status = 200;

      // 1. 处理自定义 Key (如果请求中提供了 key)
      if (config.custom_link && req_key) {
        const existing_value = await env.LINKS.get(req_key);
        if (!config.overwrite_kv && existing_value != null) {
          const response_data_409 = { status: 409, key: req_key, error: '错误: 已存在的key' };
          return new Response(JSON.stringify(response_data_409), { headers: json_response_header, status: 409 });
        } else {
          await env.LINKS.put(req_key, req_url);
          final_key = req_key;
        }
      }

      // 2. 处理随机 Key 或唯一链接模式 (如果 final_key 仍未确定)
      if (!final_key) {
        if (config.unique_link) {
          const url_sha512 = await sha512(req_url);
          const existing_key = await is_url_exist(url_sha512, env);
          if (existing_key) {
            final_key = existing_key; // Key 已经存在
          } else {
            final_key = await save_url(req_url, env);
            if (final_key) await env.LINKS.put(url_sha512, final_key);
          }
        } else {
          final_key = await save_url(req_url, env);
        }
      }

      // 3. 统一处理：如果确定了 final_key，写入/更新模式 Key
      if (final_key) await env.LINKS.put(final_type + ':' + final_key, final_key);

      // 4. 统一处理成功或KV写入失败的返回
      if (final_key) {
        response_data = { status: 200, key: final_key, error: '' };
        http_status = 200;
      } else {
        response_data = { status: 507, key: '', error: '错误: 达到KV写入限制' };
        http_status = 507;
      }
      break;

    case 'del':
      const delCheck = handleKvCheck(config, json_response_header, '删除操作');
      if (delCheck) return delCheck;

      http_status = 200;
      let hash_key_to_delete = null;
      let original_url = null;

      if (config.unique_link) {
        original_url = await env.LINKS.get(req_key);
        if (original_url) hash_key_to_delete = await sha512(original_url);
      }
      if (req_type) ctx.waitUntil(env.LINKS.delete(req_type + ':' + req_key));

      await env.LINKS.delete(req_key);
      if (config.visit_count) ctx.waitUntil(env.LINKS.delete(req_key + '-count'));
      if (hash_key_to_delete) ctx.waitUntil(env.LINKS.delete(hash_key_to_delete));
      response_data = { status: 200, key: req_key, error: '' };
      break;

    case 'delall':
      const delAllCheck = handleKvCheck(config, json_response_header, '删除操作');
      if (delAllCheck) return delAllCheck;

      http_status = 200;
      const has_key_array = Array.isArray(req_key) && req_key.length > 0;
      const has_type = !!req_type; // req_type 应该由 handleRequest 注入
      let targetKeys = []; // 最终确认要删除的主短链 Key 列表
      let keysToDelete = []; // 所有要删除的 KV Key (主, 模式, 计数, 哈希)
      let deletedCount = 0;

      // 1. 传入了 key数组 + type, 删除 type 模式下 key数组 相关的所有数据
      if (has_key_array && has_type) {
        const candidateKeys = req_key.filter((key) => !isKeyProtected(key));
        const checkPromises = candidateKeys.map((key) => env.LINKS.get(req_type + ':' + key));
        const results = await Promise.all(checkPromises);
        targetKeys = candidateKeys.filter((_, index) => results[index] !== null);
      }

      // 2. 传入了 type 但没有 key数组, 删除 type 模式下所有数据
      else if (!has_key_array && has_type) {
        const listOptions = { prefix: req_type + ':' };
        const keyList = await env.LINKS.list(listOptions);
        if (keyList?.keys) targetKeys = keyList.keys.map((item) => item.value).filter((key) => !isKeyProtected(key));
      }

      // 3. key数组 + type 均没有传入, 删除所有数据
      else if (!has_key_array && !has_type) {
        const keyList = await env.LINKS.list();
        if (keyList?.keys) {
          targetKeys = keyList.keys.map((item) => item.name).filter((key) => !(isKeyProtected(key) || key.endsWith('-count') || key.length === 128 || key.includes(':')));
        }
      }

      // 统一处理 targetKeys 的删除和计数
      deletedCount = targetKeys.length;
      for (const key of targetKeys) {
        keysToDelete.push(key);
        if (has_type) {
          keysToDelete.push(req_type + ':' + key);
        } else {
          keysToDelete.push('link:' + key);
          keysToDelete.push('note:' + key); // 还可添加其他要删除的 Key 类型
        }
        if (config.visit_count) keysToDelete.push(key + '-count');
        if (config.unique_link) {
          const original_url = await env.LINKS.get(key);
          if (original_url) {
            const hash_key = await sha512(original_url);
            keysToDelete.push(hash_key);
          }
        }
      }

      if (keysToDelete.length > 0) {
        const uniqueKeysToDelete = Array.from(new Set(keysToDelete));
        const deletePromises = uniqueKeysToDelete.map((keyName) => env.LINKS.delete(keyName));
        await Promise.all(deletePromises);
        response_data = { status: 200, error: '', deleted_count: deletedCount };
      } else {
        response_data = { status: 200, error: '警告: 没有可删除的key', deleted_count: 0 };
      }
      break;

    case 'qry':
      const qryCheck = handleKvCheck(config, json_response_header, '查询操作');
      if (qryCheck) return qryCheck;
      http_status = 200;
      const value = await env.LINKS.get(req_key);

      if (value != null) {
        response_data = { status: 200, error: '', key: req_key, url: value };
      } else {
        response_data = { status: 404, key: req_key, error: '错误: key不存在' };
        http_status = 404;
      }
      break;

    case 'qryall':
      const qryAllCheck = handleKvCheck(config, json_response_header, '查询操作');
      if (qryAllCheck) return qryAllCheck;

      http_status = 200;
      let qrylist = []; // 存储查询结果响应体
      const req_type_filter = req_type || ''; // 如果 req_type 为空，则查询所有模式
      let listOptions = { limit: 1000, include_value: true };
      if (req_type_filter) listOptions.prefix = req_type_filter + ':';
      const keyList = await env.LINKS.list(listOptions);

      if (keyList?.keys) {
        const urlPromises = [];
        const finalResults = []; // 用于存储最终 {key, value, type} 结构
        for (const item of keyList.keys) {
          let originalKey;
          let currentType;
          if (req_type_filter) {
            // 1. 传入了 type
            originalKey = item.value;
            currentType = req_type_filter;
          } else {
            //2. 未传入 type
            originalKey = item.name;
            if (isKeyProtected(originalKey) || originalKey.endsWith('-count') || originalKey.length === 128 || originalKey.includes(':')) {
              continue;
            }
            currentType = 'unknown';
          }
          urlPromises.push(env.LINKS.get(originalKey, { type: 'text' }));
          finalResults.push({ key: originalKey, type: currentType });
        }
        const urls = await Promise.all(urlPromises);
        // 🚨 强制诊断：使用一个确定的、已知的 Key 进行查询
        const diagnosticKey = 'baozhen'; // <--- 替换为你 KV 截图中的一个 Key
        const diagnosticValue = await env.LINKS.get(diagnosticKey, { type: 'text' });
        console.log(`--- DIAGNOSTIC ---`);
        console.log(`Key used for testing: ${diagnosticKey}`);
        console.log(`Value from test query: ${diagnosticValue}`);
        console.log(`Total URLs fetched (should not be null):`, urls);
        console.log(`------------------`);
        // --- 强制诊断结束 ---
        qrylist = finalResults.map((result, index) => ({
          key: result.key,
          value: urls[index],
          type: result.type,
        })); // 构造最终响应结构
        response_data = { status: 200, error: '', qrylist: qrylist };
      } else {
        response_data = { status: 500, error: '错误: 加载key列表失败' };
        http_status = 500;
      }
      break;

    case 'qrycnt':
      const qrycntCheck = handleKvCheck(config, json_response_header, '查询计数操作');
      if (qrycntCheck) return qrycntCheck;

      http_status = 200;
      if (!config.visit_count) {
        response_data = { status: 400, key: req_key, error: '错误: 统计功能未开启' };
        http_status = 400;
      } else {
        const value = await env.LINKS.get(req_key + '-count');
        const final_count = value ?? '0';
        response_data = { status: 200, error: '', key: req_key, count: final_count };
      }
      break;
  }

  return new Response(JSON.stringify(response_data), {
    headers: json_response_header,
    status: http_status,
  });
}

// 主请求处理函数
async function handleRequest(request, env, ctx) {
  // 读取环境变量配置
  const config = {
    admin: env.ADMIN || 'admin', // 管理密码
    password: env.PASSWORD || 'apipass', // API秘钥
    unique_link: env.UNIQUE_LINK !== 'false',
    custom_link: env.CUSTOM_LINK !== 'false',
    overwrite_kv: env.OVERWRITE_KV !== 'false',
    snapchat_mode: env.SNAPCHAT_MODE === 'true',
    visit_count: env.VISIT_COUNT === 'true',
    load_kv: env.LOAD_KV !== 'false',
  };

  // 定义响应头
  const base_cors_header = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const html_response_header = {
    ...base_cors_header,
    'Content-type': 'text/html;charset=UTF-8',
  };
  const json_response_header = {
    ...base_cors_header,
    'Content-type': 'application/json',
  };
  const text_response_header = {
    ...base_cors_header,
    'Content-type': 'text/plain;charset=UTF-8',
  };

  // 定义常量
  const api_password = config.password.trim();
  const html404 = await get404Html();
  const response404 = () => new Response(html404, { headers: html_response_header, status: 404 });

  // 定义密码和系统类型
  const requestURL = new URL(request.url);
  const pathSegments = requestURL.pathname.split('/').filter((p) => p.length > 0);
  const admin_password = pathSegments[0] || '';
  const system_type = pathSegments[1] || 'link';

  // 处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(``, { headers: text_response_header });
  }

  // -----------------------------------------------------------------
  // 【API 接口处理】 (POST 请求)
  // -----------------------------------------------------------------
  if (request.method === 'POST') {
    if (pathSegments.length === 0 || admin_password !== config.admin) {
      return new Response(`{"status":401, "error":"错误: 无效的API端点"}`, {
        headers: json_response_header,
        status: 401,
      });
    }

    let req;
    try {
      req = await request.json();
    } catch (e) {
      return new Response(`{"status":400, "error":"错误: 无效的JSON格式"}`, {
        headers: json_response_header,
        status: 400,
      });
    }

    if (req.password !== config.password) {
      return new Response(`{"status":401, "error":"错误: 无效的API秘钥"}`, {
        headers: json_response_header,
        status: 401,
      });
    }

    req.type = req.type || system_type;
    return handleApiCommand(req, env, config, json_response_header, ctx);
  }

  // -----------------------------------------------------------------
  // 【前端网页访问】（GET 请求）
  // -----------------------------------------------------------------
  // 处理 / 根路径，返回404
  if (pathSegments.length === 0) return response404();

  // 处理 /管理路径 和 /管理路径/模块类型 路径
  if (admin_password === config.admin) {
    let target_html_url;
    if (pathSegments.length === 1) {
      target_html_url = main_html;
    } else if (pathSegments.length >= 2) {
      if (['link', 'note'].includes(system_type)) {
        target_html_url = `${system_base_url}/${system_type}/index.html`;
      } else {
        return response404();
      }
    } else {
      return response404();
    }

    // 统一处理页面加载和替换
    if (target_html_url) {
      let response = await fetch(target_html_url);
      if (response.status !== 200) return response404();
      let index = await response.text();
      index = index.replace(/__PASSWORD__/gm, api_password);
      return new Response(index, { headers: html_response_header, status: 200 });
    }
    return response404();
  }

  // 处理 /短链 的访问
  let path = decodeURIComponent(pathSegments[0] || '');
  const params = requestURL.search;
  if (protect_keylist.includes(path)) return response404();
  let value = await env.LINKS.get(path);
  if (!value) return response404();

  // 计数功能
  if (config.visit_count) {
    let count = await env.LINKS.get(path + '-count');
    count = count ? parseInt(count) + 1 : 1;
    ctx.waitUntil(env.LINKS.put(path + '-count', count.toString()));
  }

  // 阅后即焚模式
  if (config.snapchat_mode) {
    ctx.waitUntil(env.LINKS.delete(path));
    if (config.visit_count) ctx.waitUntil(env.LINKS.delete(path + '-count'));
  }

  if (params) value = value + params;

  // 智能判断系统类型返回不同响应
  if (checkURL(value)) {
    return Response.redirect(value, 302);
  } else {
    return new Response(value, { headers: html_response_header, status: 200 });
  }
}
