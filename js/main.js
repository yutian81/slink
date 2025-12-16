// --- 全局变量和初始化 ---
let apiSrv = window.location.pathname;
let buildValueItemFunc = buildValueTxt;
let longUrlElement;
let urlListElement;
let keyPhraseElement;
let keyForQueryElement;
let api_password;

// 路径解析和模式确定
const pathnameSegments = window.location.pathname.split('/').filter((p) => p.length > 0);
const modeFromPath = pathnameSegments.length >= 2 ? pathnameSegments[1] : pathnameSegments.length === 1 ? 'link' : '';
window.adminPath = pathnameSegments.length > 0 ? '/' + pathnameSegments[0] : '';
window.current_mode = ['note'].includes(modeFromPath) ? modeFromPath : 'link';
window.visit_count_enabled = false;

// --- 实用工具函数 ---
function clearModeLocalStorage() {
  const currentPrefix = `${window.current_mode}:`;
  let keysToDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(currentPrefix)) keysToDelete.push(key);
  }
  keysToDelete.forEach((key) => {
    localStorage.removeItem(key);
  });
}

// 定义模式
function buildValueTxt(longUrl) {
  let valueTxt = document.createElement('div');
  valueTxt.classList.add('form-control', 'text-muted', 'small');
  valueTxt.innerText = longUrl;
  return valueTxt;
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
  document.getElementById('result').innerHTML = message;
  const modal = new bootstrap.Modal(document.getElementById('resultModal'));
  modal.show();
}

// 模态框复制短链接
function handleModalCopy(text) {
  const btn = document.getElementById('copyResultBtn');
  const originalHTML = btn.innerHTML;
  const modalElement = document.getElementById('resultModal');
  const modal = bootstrap.Modal.getInstance(modalElement);

  const onSuccess = (delay = 1000) => {
    btn.innerHTML = '<i class="fas fa-check me-2"></i>已复制';
    btn.classList.replace('btn-primary', 'btn-success');
    setTimeout(() => {
      if (modal) modal.hide();
    }, delay);
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.replace('btn-success', 'btn-primary');
    }, delay);
  };

  const onFailure = () => {
    console.error('复制失败：无法执行复制操作');
    btn.innerHTML = '<i class="fas fa-times me-2"></i>失败';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 1000);
  };

  navigator.clipboard
    .writeText(text)
    .then(onSuccess)
    .catch(() => {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      document.body.removeChild(input);
      success ? onSuccess(500) : onFailure(); // 缩短回退方案的延迟
    });
}

// 复制短链接
function copyShortUrl(text, btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const originalIcon = btn.innerHTML;
  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<i class="fas fa-check" style="color:white"></i>';
    setTimeout(() => {
      btn.innerHTML = originalIcon;
    }, 2000);
  });
}

// 定义所有模式及其属性
function getModeName(mode) {
  const MODE_NAMES = { link: '短链', note: '笔记' };
  return MODE_NAMES[mode] || '数据';
}

// 清除所有输入框内容
function clearInputFields() {
  if (longUrlElement) longUrlElement.value = '';
  if (keyPhraseElement) keyPhraseElement.value = '';
  if (keyForQueryElement) keyForQueryElement.value = '';
}

// --- 列表管理函数 ---

// 不同模式下，在列表中加载不同数据
function loadUrlList() {
  clearInputFields();
  const urlList = urlListElement;
  urlList.innerHTML = '';
  const currentMode = window.current_mode;
  const longUrl = longUrlElement.value.trim();

  const targetPrefix = `${currentMode}:`;
  let keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== 'theme' && key.startsWith(targetPrefix)) keys.push(key);
  }

  keys.reverse().forEach((keyWithPrefix) => {
    let valueLongURL = localStorage.getItem(keyWithPrefix);
    const keyShortURL = keyWithPrefix.substring(targetPrefix.length); // 提取主 Key
    const isMatchingSearch = longUrl === '' || longUrl === valueLongURL;
    if (isMatchingSearch) addUrlToList(keyShortURL, valueLongURL);
  });

  if (urlList.children.length === 0) {
    const modeName = getModeName(currentMode);
    urlList.innerHTML = `<div class="result-tip text-center py-3">暂无${modeName}记录</div>`;
  }
}

function addUrlToList(shortUrl, longUrl) {
  const urlList = urlListElement;
  const child = document.createElement('div');
  child.classList.add('list-group-item'); // 短链接区域 (input-group)
  const keyItem = document.createElement('div');
  keyItem.classList.add('input-group'); // 短链接文本

  const keyTxt = document.createElement('span');
  keyTxt.classList.add('form-control', 'text-truncate'); // 使用 text-truncate 避免溢出
  keyTxt.innerText = window.location.protocol + '//' + window.location.host + '/' + shortUrl;
  keyItem.appendChild(keyTxt); // 按钮组

  const buttonsConfig = [
    { title: '删除短链接', icon: 'trash-alt', color: 'danger', id: `delBtn-${shortUrl}`, action: () => deleteShortUrl(shortUrl) },
    ...(window.visit_count_enabled ? [{ title: '访问统计', icon: 'chart-line', color: 'info', id: `qryCntBtn-${shortUrl}`, action: () => queryVisitCount(shortUrl) }] : []),
    { title: '复制短链接', icon: 'copy', color: 'success', id: `copyBtn-${shortUrl}`, action: () => copyShortUrl(`${window.location.protocol}//${window.location.host}/${shortUrl}`, `copyBtn-${shortUrl}`) },
    { title: '显示二维码', icon: 'qrcode', color: 'info', id: `qrcodeBtn-${shortUrl}`, action: () => toggleQrcode(shortUrl) },
  ];
  buttonsConfig.forEach((config) => {
    const btn = document.createElement('button');
    btn.setAttribute('type', 'button');
    btn.classList.add('btn', `btn-${config.color}`);
    btn.setAttribute('id', config.id);
    btn.setAttribute('title', config.title);
    btn.innerHTML = `<i class="fas fa-${config.icon}"></i>`;
    btn.onclick = config.action;
    keyItem.appendChild(btn);
  });
  child.appendChild(keyItem); // 二维码占位

  const qrcodeContainer = document.createElement('div');
  qrcodeContainer.setAttribute('id', 'qrcode-' + shortUrl);
  qrcodeContainer.classList.add('qrcode-container');
  child.appendChild(qrcodeContainer); // 长链接信息 (使用 buildValueItemFunc)
  child.appendChild(buildValueItemFunc(longUrl));
  urlList.append(child);
}

// 二维码切换逻辑
function toggleQrcode(shortUrl) {
  const qrcodeContainer = document.getElementById('qrcode-' + shortUrl);
  const qrcodeBtn = document.getElementById('qrcodeBtn-' + shortUrl);
  const fullUrl = window.location.protocol + '//' + window.location.host + '/' + shortUrl;
  const isVisible = qrcodeContainer.classList.toggle('qrcode-visible');
  if (isVisible) {
    qrcodeContainer.innerHTML = ''; // 依赖 JQuery qrcode 库
    $(qrcodeContainer).qrcode({ render: 'canvas', minVersion: 1, maxVersion: 40, ecLevel: 'Q', size: 128, text: fullUrl });
    qrcodeBtn.classList.replace('btn-info', 'btn-warning');
    qrcodeBtn.innerHTML = '<i class="fas fa-qrcode" title="隐藏二维码"></i>';
  } else {
    setTimeout(() => {
      qrcodeContainer.innerHTML = '';
    }, 500);
    qrcodeBtn.classList.replace('btn-warning', 'btn-info');
    qrcodeBtn.innerHTML = '<i class="fas fa-qrcode" title="显示二维码"></i>';
  }
}

// --- API 调用函数 ---

// 生成短链
async function shorturl() {
  const longUrl = longUrlElement.value.trim();
  if (longUrl == '') {
    showResultModal('URL不能为空!');
    return;
  }
  const keyPhrase = keyPhraseElement.value.replace(/[\s#*|]/g, '-'); // 替换非法字符
  keyPhraseElement.value = keyPhrase;
  setButtonState('addBtn', 'loading');

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'add',
        url: longUrl,
        key: keyPhrase,
        password: api_password,
        type: window.current_mode,
      }),
    });
    const data = await response.json();

    if (data.status == 200) {
      const shortUrl = window.location.protocol + '//' + window.location.host + '/' + data.key;
      document.getElementById('copyResultBtn').onclick = () => {
        handleModalCopy(shortUrl);
      };
      showResultModal(shortUrl);
      const localStorageKey = `${window.current_mode}:${data.key}`;
      localStorage.setItem(localStorageKey, longUrl);
      addUrlToList(data.key, longUrl);
    } else {
      showResultModal(data.error || '生成失败');
    }
  } catch (err) {
    console.error('Error:', err);
    showResultModal('请求失败，请重试');
  } finally {
    setButtonState('addBtn', 'reset');
  }
}

async function deleteShortUrl(delKeyPhrase) {
  const btnId = `delBtn-${delKeyPhrase}`;
  setButtonState(btnId, 'loading');

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'del',
        key: delKeyPhrase,
        password: api_password,
        type: window.current_mode,
      }),
    });
    const myJson = await response.json();

    if (myJson.status == '200') {
      const localStorageKey = `${window.current_mode}:${delKeyPhrase}`;
      localStorage.removeItem(localStorageKey);
      loadUrlList();
      showResultModal('已删除');
    } else {
      showResultModal(myJson.error || '删除失败');
    }
  } catch (err) {
    showResultModal('删除请求失败，请重试!');
    console.error(err);
  } finally {
    setButtonState(btnId, 'reset');
  }
}

async function queryVisitCount(qryKeyPhrase) {
  const btnId = `qryCntBtn-${qryKeyPhrase}`;
  setButtonState(btnId, 'loading');

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'qrycnt',
        key: qryKeyPhrase,
        password: api_password,
      }),
    });
    const myJson = await response.json();

    if (myJson.status == '200') {
      setButtonState(btnId, 'query-success', myJson.count);
    } else {
      showResultModal(myJson.error || '查询访问计数失败');
      setButtonState(btnId, 'reset');
    }
  } catch (err) {
    showResultModal('查询统计请求失败，请重试');
    console.error(err);
    setButtonState(btnId, 'reset');
  }
}

async function query1KV() {
  let qryKeyPhrase = document.getElementById('keyForQuery').value;
  if (qryKeyPhrase == '') return;
  setButtonState('queryBtn', 'loading');

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'qry',
        key: qryKeyPhrase,
        password: api_password,
      }),
    });
    const myJson = await response.json();

    if (myJson.status == '200') {
      longUrlElement.value = myJson.url;
      document.getElementById('keyPhrase').value = qryKeyPhrase;
      longUrlElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    } else {
      showResultModal(myJson.error || '查询失败');
    }
  } catch (err) {
    showResultModal('未知错误, 请重试!');
    console.error(err);
  } finally {
    setButtonState('queryBtn', 'reset');
  }
}

// 从KV加载记录
async function loadKV() {
  const currentMode = window.current_mode;
  setButtonState('loadKvBtn', 'loading');

  try {
    const response = await fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: 'qryall',
        type: currentMode,
        password: api_password,
      }),
    });
    if (!response.ok) throw new Error('网络请求失败');
    const data = await response.json();

    if (data.status == 200) {
      clearModeLocalStorage();
      let loadedCount = 0;
      clearInputFields();
      for (const item of data.qrylist) {
        const key = item.key;
        const value = item.value;
        if (value) {
          const localStorageKey = `${window.current_mode}:${key}`;
          localStorage.setItem(localStorageKey, value);
          loadedCount++;
        }
      }
      loadUrlList();
      const modeName = getModeName(currentMode);
      showResultModal(`成功加载 ${loadedCount} 条${modeName}记录`);
    } else {
      showResultModal(data.error || '加载失败');
    }
  } catch (err) {
    console.error('Error:', err);
    showResultModal('请求失败，请重试');
  } finally {
    setButtonState('loadKvBtn', 'reset');
  }
}

// 事件绑定：DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function () {
  // 初始化 Popover
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
  longUrlElement = document.querySelector('#longURL');
  urlListElement = document.querySelector('#urlList');
  keyPhraseElement = document.getElementById('keyPhrase');
  keyForQueryElement = document.getElementById('keyForQuery');
  api_password = document.querySelector('#passwordText').value;
  document.getElementById('passwordText').readOnly = true; // 获取后端配置

  async function loadConfig() {
    try {
      const response = await fetch(apiSrv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'config', password: api_password }),
      });
      const data = await response.json();

      if (data.status == 200) {
        window.visit_count_enabled = data.visit_count;
        window.allow_custom_key = data.custom_link;
        if (data.custom_link) {
          keyPhraseElement.disabled = false;
          keyPhraseElement.placeholder = keyPhraseElement.getAttribute('placeholder');
        } else {
          keyPhraseElement.disabled = true;
          keyPhraseElement.placeholder = '功能未开启, 随机生成短链Key';
          keyPhraseElement.value = '';
        }
      }
    } catch (err) {
      console.error('加载配置时出错:', err);
    } finally {
      loadUrlList();
    }
  }
  loadConfig();
});
