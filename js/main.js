// let apiSrv = window.location.pathname;
let buildValueItemFunc = buildValueTxt; // 这是默认行为, 在不同的模式中可以设置为不同的行为
let api_password;
let longUrlElement;
let urlListElement;

// 解析路径以确定当前模式
const pathnameSegments = window.location.pathname.split('/').filter(Boolean);
const modeFromPath = pathnameSegments[1];
window.adminPath = pathnameSegments[0] ? '/' + pathnameSegments[0] : '';
let apiSrv = window.adminPath;
window.current_mode = ['link', 'img', 'note', 'paste'].includes(modeFromPath) ? modeFromPath : 'link';
window.visit_count_enabled = false;

function buildValueTxt(longUrl) {
  let valueTxt = document.createElement('div')
  valueTxt.classList.add("form-control")
  valueTxt.innerText = longUrl
  return valueTxt
}

function clearLocalStorage() {
  localStorage.clear()
}

// 按钮状态管理
function setButtonState(btnId, state, value = null) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  if (state === 'loading') {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML; 
      btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
  } else if (state === 'query-success' && value !== null) {
      btn.innerHTML = value;
      btn.disabled = false;
  } else if (state === 'reset') {
      btn.innerHTML = btn.dataset.originalHtml || value; 
      btn.disabled = false;
  }
}

// 显示结果模态框
function showResultModal(message) {
    document.getElementById("result").innerHTML = message;
    const modal = new bootstrap.Modal(document.getElementById('resultModal'));
    modal.show();
}

// 模态框复制短链接
function handleModalCopy(text) {
  const btn = document.getElementById('copyResultBtn');
  const originalHTML = btn.innerHTML;
  const modalElement = document.getElementById('resultModal');
  const modal = bootstrap.Modal.getInstance(modalElement);

  // 处理复制成功后的视觉反馈和恢复
  const onSuccess = (delay = 1000) => {
    btn.innerHTML = '<i class="fas fa-check me-2"></i>已复制';
    btn.classList.replace('btn-primary', 'btn-success'); 
    setTimeout(() => { if (modal) { modal.hide(); } }, delay);
    setTimeout(() => { btn.innerHTML = originalHTML; btn.classList.replace('btn-success', 'btn-primary'); }, delay);
  };

  // 处理复制失败后的视觉反馈和恢复
  const onFailure = (delay = 1000) => {
    console.error('复制失败：无法执行复制操作');
    btn.innerHTML = '<i class="fas fa-times me-2"></i>失败';
    setTimeout(() => { btn.innerHTML = originalHTML; }, delay);
  };

  navigator.clipboard.writeText(text).then(() => {
      onSuccess(); // 现代 API 成功
  }).catch(() => { // 回退方案
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      document.body.removeChild(input);
      success ? onSuccess() : onFailure();
  });
}

// 短链接复制按钮
function copyShortUrl(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check" style="color:white"></i>'; // 复制后显示白色的 √
    setTimeout(() => { btn.innerHTML = originalIcon; }, 2000);
  });
}

// 定义模式及其属性
const APP_MODES = {
  'link': { name: '短链', check: (value) => value.startsWith('http') },
  'img': { name: '图床', check: (value) => value.startsWith('data:image/') },
  'note': { name: '记事本', check: (value, isUrl, isImage) => !isUrl && !isImage },
  'paste': { name: '剪贴板', check: (value, isUrl, isImage) => !isUrl && !isImage }
};
function getModeName(mode) {
  return APP_MODES[mode]?.name || '数据';
}
function isDataMode(value, mode) {
  if (!value) return false;
  const modeConfig = APP_MODES[mode];
  if (!modeConfig) return true;
  const isUrl = value.startsWith('http');
  const isImage = value.startsWith('data:image/');
  if (mode === 'note' || mode === 'paste') {
    return modeConfig.check(value, isUrl, isImage);
  }
  return modeConfig.check(value);
}

// 不同模式下，在列表中加载不同数据
function loadUrlList() {
  const urlList = urlListElement;
  urlList.innerHTML = '';
  const currentMode = window.current_mode;
  const longUrl = longUrlElement.value.trim();
  
  let keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== 'theme') { keys.push(key); }
  }
  
  keys.reverse().forEach(keyShortURL => {
    let valueLongURL = localStorage.getItem(keyShortURL);
    // 过滤模式和搜索条件
    const isMatchingMode = isDataMode(valueLongURL, currentMode);
    const isMatchingSearch = (longUrl === "" || longUrl === valueLongURL);
    if (isMatchingMode && isMatchingSearch) { 
      addUrlToList(keyShortURL, valueLongURL); 
    }
  });
  
  // 如果列表为空，显示提示
  if (urlList.children.length === 0) {
    const modeName = getModeName(currentMode);
    urlList.innerHTML = `<div class="result-tip text-center py-3">暂无${modeName}记录</div>`;
  }
}

// 加载短链接列表
function addUrlToList(shortUrl, longUrl) {
  const urlList = urlListElement;
  const child = document.createElement('div');
  child.classList.add("list-group-item");
  
  // 短链接区域 (input-group)
  const keyItem = document.createElement('div');
  keyItem.classList.add("input-group");

  // 短链接文本
  const keyTxt = document.createElement('span');
  keyTxt.classList.add("form-control", "text-truncate"); // 使用 text-truncate 避免溢出
  keyTxt.innerText = window.location.protocol + "//" + window.location.host + "/" + shortUrl;
  keyItem.appendChild(keyTxt);

  // 按钮组
  const buttonsConfig = [
    { title: "删除短链接", icon: "trash-alt", color: "danger", id: `delBtn-${shortUrl}`, action: () => deleteShortUrl(shortUrl) },
    ...(window.visit_count_enabled ? [{ title: "访问统计", icon: "chart-line", color: "info", id: `qryCntBtn-${shortUrl}`, action: () => queryVisitCount(shortUrl) }] : []),
    { title: "复制短链接", icon: "copy", color: "success", id: `copyBtn-${shortUrl}`, action: () => copyShortUrl(`${window.location.protocol}//${window.location.host}/${shortUrl}`, `copyBtn-${shortUrl}`) },
    { title: "显示二维码", icon: "qrcode", color: "info", id: `qrcodeBtn-${shortUrl}`, action: () => toggleQrcode(shortUrl) },
  ];
  buttonsConfig.forEach(config => {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.classList.add("btn", `btn-${config.color}`);
    btn.setAttribute('id', config.id);
    btn.setAttribute('title', config.title);
    btn.innerHTML = `<i class="fas fa-${config.icon}"></i>`;
    btn.onclick = config.action;
    keyItem.appendChild(btn);
  });
  child.appendChild(keyItem);

  // 二维码占位
  const qrcodeContainer = document.createElement('div');
  qrcodeContainer.setAttribute('id', 'qrcode-' + shortUrl);
  qrcodeContainer.classList.add('qrcode-container');
  child.appendChild(qrcodeContainer);
  
  // 长链接信息 (使用 buildValueItemFunc)
  child.appendChild(buildValueItemFunc(longUrl));
  urlList.append(child);
}

// 二维码切换逻辑
function toggleQrcode(shortUrl) {
  const qrcodeContainer = document.getElementById('qrcode-' + shortUrl);
  const qrcodeBtn = document.getElementById('qrcodeBtn-' + shortUrl);
  const fullUrl = window.location.protocol + "//" + window.location.host + "/" + shortUrl;
  const isVisible = qrcodeContainer.classList.toggle('qrcode-visible');
  
  if (isVisible) {
    qrcodeContainer.innerHTML = '';
    $(qrcodeContainer).qrcode({
      render: 'canvas',
      minVersion: 1,
      maxVersion: 40,
      ecLevel: 'Q',
      size: 128,
      text: fullUrl
    }); // 依赖 JQuery qrcode 库
    qrcodeBtn.classList.replace('btn-info', 'btn-warning');
    qrcodeBtn.innerHTML = '<i class="fas fa-qrcode" title="隐藏二维码"></i>';
  } else {
    setTimeout(() => { qrcodeContainer.innerHTML = ''; }, 500);
    qrcodeBtn.classList.replace('btn-warning', 'btn-info');
    qrcodeBtn.innerHTML = '<i class="fas fa-qrcode" title="显示二维码"></i>';
  }
}


// 生成短链
async function shorturl(event) {
  if (event) {
    if (event.key === "Enter") {
      event.preventDefault();
    } else {
      return;
    }
  }
  if (longUrlElement.value == "") { showResultModal("URL不能为空!"); return; }

  const longUrl = longUrlElement.value.trim();
  const keyPhrase = document.getElementById('keyPhrase').value
    .replace(/[\s#*|]/g, "-"); // 替换非法字符为连字符
  document.getElementById('keyPhrase').value = keyPhrase;
  setButtonState("addBtn", "loading");
  
  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "add",
        url: longUrl,
        key: keyPhrase,
        password: api_password,
        type: window.current_mode
      })
    });

    const data = await response.json();
    if (data.status == 200) {
      const shortUrl = window.location.protocol + "//" + window.location.host + "/" + data.key;
      document.getElementById("copyResultBtn").onclick = () => { handleModalCopy(shortUrl); };
      showResultModal(shortUrl);
      localStorage.setItem(data.key, longUrlElement.value);
      longUrlElement.value = "";
      document.getElementById('keyPhrase').value = "";
      loadUrlList();
    } else {
      showResultModal(data.error || "生成失败");
    }
  } catch (err) {
    console.error("Error:", err);
    showResultModal("请求失败，请重试");
  } finally {
    setButtonState("addBtn", "reset"); 
  }
}

// 删除短链
async function deleteShortUrl(delKeyPhrase) {
  const btnId = `delBtn-${delKeyPhrase}`;
  setButtonState(btnId, "loading"); 

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "del",
        key: delKeyPhrase,
        password: api_password
      })
    });

    const data = await response.json();
    if (data.status == 200) {
      localStorage.removeItem(delKeyPhrase);
      loadUrlList();
      showResultModal("已删除");
    } else {
      showResultModal(data.error || "删除失败");
    }
  } catch (err) {
    showResultModal("删除请求失败，请重试!");
    console.error(err);
  } finally {
    setButtonState(btnId, "reset"); 
  }
}

// 查询短链访问计数
async function queryVisitCount(qryKeyPhrase) {
  const btnId = `qryCntBtn-${qryKeyPhrase}`;
  setButtonState(btnId, "loading"); 
  
  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "qrycnt",
        key: qryKeyPhrase,
        password: api_password
      })
    });
    
    const data = await response.json();
    if (data.status == 200 && data.countlist && data.countlist.length > 0) {
      const visitCount = data.countlist[0].count;
      setButtonState(btnId, "query-success", visitCount); 
    } else {
      showResultModal(data.error || "查询访问计数失败");
      setButtonState(btnId, "reset"); 
    }
  } catch (err) {
    showResultModal("查询统计请求失败，请重试");
    console.error(err);
    setButtonState(btnId, "reset"); 
  }
}

// 查询短链
async function query1KV(event) {
  if (event) {
    if (event.key === "Enter") {
      event.preventDefault();
    } else {
      return;
    }
  }

  let qryKeyPhrase = document.getElementById("keyForQuery").value;
  if (qryKeyPhrase == "") { return }
  setButtonState("queryBtn", "loading");

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "qry",
        key: qryKeyPhrase,
        password: api_password
      })
    });
    const data = await response.json();

    if (data.status == 200) {
      longUrlElement.value = data.qrylist[0].value;
      document.getElementById("keyPhrase").value = qryKeyPhrase;
      longUrlElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else {
      showResultModal(data.error || "查询失败");
    }
  } catch (err) {
    showResultModal("未知错误, 请重试!");
    console.error(err);
  } finally {
    setButtonState("queryBtn", "reset");
  }
}

// 从KV加载记录
async function loadKV() {
  const currentMode = window.current_mode;
  setButtonState("loadKvBtn", "loading"); 
  
  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "qry",
        password: api_password
      })
    });
    
    if (!response.ok) { throw new Error(`网络请求失败, http_status: ${response.status}`); }
    const data = await response.json();
    if (data.status == 200) {
      clearLocalStorage();
      let loadedCount = 0;
      longUrlElement.value = "";

      for (const item of data.qrylist) {
        const key = item.key;
        let value = item.value;
          if (window.current_mode === 'img' && value.length > 500000) {
          value = "Base64数据过大, 未在本地存储"; 
        }

        if (isDataMode(value, currentMode)) { 
            // 如果 value 是原始的大 Base64 字符串，此处仍需使用原始的 item.value
            // 确保本地存储的是原始值，如果之前被替换为提示，那么就存储提示
            localStorage.setItem(key, item.value); 
            loadedCount++; 
        }
    }

      loadUrlList();
      const modeName = getModeName(currentMode);
      showResultModal(`成功加载 ${loadedCount} 条${modeName}记录`);
    } else { showResultModal(data.error || "加载失败"); }
  } catch (err) { 
    console.error("Error:", err); 
    showResultModal("请求失败，请重试"); 
  } finally {
    setButtonState("loadKvBtn", "reset"); 
  }
}

// 事件绑定：DOM加载完成后初始化 Popover
document.addEventListener('DOMContentLoaded', function () {
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  longUrlElement = document.querySelector("#longURL");
  urlListElement = document.querySelector("#urlList");
  api_password = document.getElementById("passwordText").value;
  // document.getElementById("passwordText").readOnly = true;

  // 获取后端配置
  async function loadConfig() {
    try {
      const response = await fetch(apiSrv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: "config", password: api_password })
      });
      
      if (!response.ok) { throw new Error(`网络请求失败, http_status: ${response.status}`); }
      const data = await response.json();
      if (data.status == 200) {
        window.visit_count_enabled = data.visit_count;
        window.allow_custom_key = data.custom_link;
        const customKeyInput = document.getElementById('keyPhrase');
        if (data.custom_link) {
          customKeyInput.disabled = false;
          customKeyInput.placeholder = customKeyInput.getAttribute('placeholder') || "输入大小写字母和数字";
        } else {
          customKeyInput.disabled = true;
          customKeyInput.placeholder = "功能未开启, 随机生成短链Key";
          customKeyInput.value = "";
        }
      }
    } catch (err) {
      console.error("加载配置时出错:", err);
    } finally {
      loadUrlList();
    }
  }
  loadConfig();
});
