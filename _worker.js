// 受保护的KEY列表
const protect_keylist = ["password",]

// 主导出函数
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request, env);
    }
};

// 404页面HTML
const html404 = `<!DOCTYPE html>
<html>
  <body>
    <h1>404 未找到</h1>
    <p>您访问的页面不存在</p>
    <p>需要在域名后加入 "/你设置的密码" 访问管理页面</p>
    <p>项目开源地址：<a href="https://github.com/yutian81/slink" target="_blank">访问 GitHub 项目</a></p>
  </body>
</html>`

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
  const url_digest = await crypto.subtle.digest(
    { name: "SHA-512" },
    url
  )
  const hashArray = Array.from(new Uint8Array(url_digest));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex
}

async function checkURL(URL) {
  let str = URL;
  let Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
  let objExp = new RegExp(Expression);
  if (objExp.test(str) == true) {
    if (str[0] == 'h')
      return true;
    else
      return false;
  } else {
    return false;
  }
}

// 核心函数——KV操作
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
    // 读取环境变量
    const config = {
        password: env.PASSWORD || "link", // 访问路径，默认 /link
        result_page: env.RESULT_PAGE === "false" || true, // 跳转页面，默认不启用
        theme: env.THEME || "default", // 主题，可选 theme/urlcool
        cors: true, // 允许跨域
        unique_link: true, // 唯一链接
        custom_link: env.CUSTOM_LINK === "true" || true, // 自定义短链，默认启用
        overwrite_kv: env.OVERWRITE_KV === "true" || false, // 覆盖已存在的短链，默认启用
        snapchat_mode: env.SNAPCHAT_MODE === "false" || true, // 阅后即焚模式，默认关闭
        visit_count: env.VISIT_COUNT === "true" || false, // 访问计数，默认启用
        load_kv: env.LOAD_KV === "true" || false, // KV存储，默认启用，需要绑定KV变量 LINKS
        system_type: env.TYPE || "shorturl", // 访问模式，默认为短链, 可选 imghost（图床）
    };

    // 根据 config 定义 HTML 模板路径
    const index_html = "https://yutian81.github.io/slink/" + config.theme + "/index.html";
    const result_html = "https://yutian81.github.io/slink/" + config.theme + "/result.html";
    
    // 定义响应头
    let response_header = {
        "Content-type": "text/html;charset=UTF-8;application/json",
    }
    if (config.cors) {
        response_header = {
            "Content-type": "text/html;charset=UTF-8;application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
        }
    }

    // 获取系统密码，传入 env 和 config
    const password_value = await system_password(env, config); 
  
    // 以下是API接口的处理
    if (request.method === "POST") {
        let req = await request.json()
        let req_cmd = req["cmd"]
        let req_url = req["url"]
        let req_key = req["key"]
        let req_password = req["password"]
        
        if (req_password != password_value) {
            return new Response(`{"status":500,"key": "", "error":"错误: 无效的密码"}`, {
                headers: response_header,
            })
        }

        if (req_cmd == "config") {
            return new Response(JSON.stringify({
                status: 200,
                visit_count: config.visit_count,
                result_page: config.result_page,
                custom_link: config.custom_link
            }), {
                headers: response_header,
            })
        }

        if (req_cmd == "add") {
            if ((config.system_type == "shorturl") && !await checkURL(req_url)) {
                return new Response(`{"status":500, "url": "` + req_url + `", "error":"错误: 无效的URL"}`, {
                    headers: response_header,
                })
            }

            let stat, random_key
            if (config.custom_link && (req_key != "")) {
                if (protect_keylist.includes(req_key)) {
                    return new Response(`{"status":500,"key": "` + req_key + `", "error":"错误: key在保护列表中"}`, {
                        headers: response_header,
                    })
                }

                let is_exist = await is_url_exist(req_key, env) 
                if ((!config.overwrite_kv) && (is_exist)) {
                    return new Response(`{"status":500,"key": "` + req_key + `", "error":"错误: 已存在的key"}`, {
                        headers: response_header,
                    })
                } else {
                    random_key = req_key
                    await env.LINKS.put(req_key, req_url) 
                }
            } else if (config.unique_link) {
                let url_sha512 = await sha512(req_url)
                let url_key = await is_url_exist(url_sha512, env) 
                if (url_key) {
                    random_key = url_key
                } else {
                    random_key = await save_url(req_url, env) 
                    if (random_key) {
                        await env.LINKS.put(url_sha512, random_key) 
                    }
                }
            } else {
                random_key = await save_url(req_url, env) 
            }
          
            if (random_key) {
              return new Response(`{"status":200, "key":"` + random_key + `", "error": ""}`, {
                  headers: response_header,
              })
            } else {
              return new Response(`{"status":500, "key": "", "error":"错误: 达到KV写入限制"}`, {
                  headers: response_header,
              })
            }
        } else if (req_cmd == "del") {
            // Refuse to delete 'password' entry
            if (protect_keylist.includes(req_key)) {
                return new Response(`{"status":500, "key": "` + req_key + `", "error":"错误: key在保护列表中""}`, {
                    headers: response_header,
                })
            }
            
            await env.LINKS.delete(req_key) 
          
            // 计数功能打开的话, 要把计数的那条KV也删掉
            if (config.visit_count) {
                await env.LINKS.delete(req_key + "-count") 
            }

            return new Response(`{"status":200, "key": "` + req_key + `", "error": ""}`, {
                headers: response_header,
            })
        } else if (req_cmd == "qry") {
            if (protect_keylist.includes(req_key)) {
                return new Response(`{"status":500,"key": "` + req_key + `", "error":"错误: key在保护列表中"}`, {
                    headers: response_header,
                })
            }

            let value = await env.LINKS.get(req_key) 
            if (value != null) {
                let jsonObjectRetrun = JSON.parse(`{"status":200, "error":"", "key":"", "url":""}`);
                jsonObjectRetrun.key = req_key;
                jsonObjectRetrun.url = value;
                return new Response(JSON.stringify(jsonObjectRetrun), {
                    headers: response_header,
                })
            } else {
                return new Response(`{"status":500, "key": "` + req_key + `", "error":"错误: key不存在或统计功能未开启"}`, {
                    headers: response_header,
                })
            }
        } else if (req_cmd == "qryall") {
            if (!config.load_kv) {
                return new Response(`{"status":500, "error":"错误: 载入kv功能未启用"}`, {
                    headers: response_header,
                })
            }

            let keyList = await env.LINKS.list() 
            if (keyList != null) {
                let jsonObjectRetrun = JSON.parse(`{"status":200, "error":"", "kvlist": []}`);
                for (let i = 0; i < keyList.keys.length; i++) {
                    let item = keyList.keys[i];
                    if (protect_keylist.includes(item.name)) {
                        continue;
                    }
                    if (item.name.endsWith("-count")) {
                        continue;
                    }

                    let url = await env.LINKS.get(item.name); 
                    let newElement = { "key": item.name, "value": url };
                    jsonObjectRetrun.kvlist.push(newElement);
                }

                return new Response(JSON.stringify(jsonObjectRetrun), {
                    headers: response_header,
                })
            } else {
                return new Response(`{"status":500, "error":"错误: 加载key列表失败"}`, {
                    headers: response_header,
                })
            }
        }
    } else if (request.method === "OPTIONS") {
        return new Response(``, {
            headers: response_header,
        })
    }

    // 以下是浏览器直接访问worker页面的处理
    const requestURL = new URL(request.url)
    let path = requestURL.pathname.split("/")[1]
    path = decodeURIComponent(path);
    const params = requestURL.search;

    // 如果path为空, 返回404
    if (!path) {
        return new Response(html404, {
          headers: response_header,
          status: 404
        }) 
    }

    // 如果path符合password 返回管理页面
    if (path == password_value) {
        let index = await fetch(index_html)
        index = await index.text()
        index = index.replace(/{__PASSWORD__}/gm, password_value)
        return new Response(index, {
          headers: response_header,
        })
    }

    // 在KV中查询 短链接 对应的原链接
    let value = await env.LINKS.get(path); 
    // 如果path是'password', 让查询结果为空
    if (protect_keylist.includes(path)) {
        value = ""
    }
    // KV中没有数据, 返回404
    if (!value) {
        return new Response(html404, {
          headers: response_header,
          status: 404
        })
    }

    // 计数功能
    if (config.visit_count) {
        let count = await env.LINKS.get(path + "-count"); 
        if (count === null) {
          await env.LINKS.put(path + "-count", "1"); 
        } else {
          count = parseInt(count) + 1;
          await env.LINKS.put(path + "-count", count.toString()); 
        }
    }

    // 如果阅后即焚模式
    if (config.snapchat_mode) {
        await env.LINKS.delete(path) 
    }

    // 带上参数部分, 拼装要跳转的最终网址
    if (params) {
        value = value + params
    }

    // 如果启用了结果页面
    if (config.result_page) {
        let result_page_html = await fetch(result_html)
        let result_page_html_text = await result_page_html.text()      
        result_page_html_text = result_page_html_text.replace(/{__FINAL_LINK__}/gm, value)
        return new Response(result_page_html_text, {
          headers: response_header,
        })
    } 

    // 根据系统类型返回不同响应
    if (config.system_type == "shorturl") {
        return Response.redirect(value, 302);
    } else if (config.system_type == "imghost") {
        try {
          const blob = base64ToBlob(value);
          let contentType = "image/jpeg";
          if (value.startsWith("data:image/png")) {
            contentType = "image/png";
          } else if (value.startsWith("data:image/gif")) {
            contentType = "image/gif";
          } else if (value.startsWith("data:image/webp")) {
            contentType = "image/webp";
          } 
          return new Response(blob, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400" // 1天缓存
            }
          });
        } catch (e) {
          console.error("图片处理错误:", e);
          return new Response(value, {
            headers: {
              "Content-type": "text/plain;charset=UTF-8;",
            },
          });
        }
    } else {
        return new Response(value, {
          headers: {
            "Content-type": "text/plain;charset=UTF-8;",
          },
        });
    }
}
