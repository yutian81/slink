let res;
let apiSrv = window.location.pathname;
let password_value = document.querySelector("#passwordText").value;
// let apiSrv = "https://journal.crazypeace.workers.dev";
// let password_value = "journaljournal";
let buildValueItemFunc = buildValueTxt; // 这是默认行为, 在不同的index.html中可以设置为不同的行为

// 复制短链接
function copyShortUrl(text, btnId) {
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    // 显示成功状态
    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check" style="color:white"></i>'; // 复制后显示白色的 √
    setTimeout(() => {
      btn.innerHTML = originalIcon;
    }, 2000);
  });
}

// 模态框复制短链接
function handleModalCopy(text) {
  const btn = document.getElementById('copyResultBtn');
  const originalHTML = btn.innerHTML;

  navigator.clipboard.writeText(text).then(() => {
    btn.innerHTML = '<i class="fas fa-check me-2"></i>已复制';
    btn.classList.replace('btn-primary', 'btn-success');

    // 自动关闭模态框
    setTimeout(() => {
      const modal = bootstrap.Modal.getInstance(document.getElementById('resultModal'));
      modal.hide();
    }, 800);
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.classList.replace('btn-success', 'btn-primary');
    }, 1000);
  }).catch(() => {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);

    // 状态反馈
    btn.innerHTML = '<i class="fas fa-check me-2"></i>已复制';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
    }, 1000);
  });
}

function shorturl(event) {
  if (event) {
    event.preventDefault();
    if (event.keyCode && event.keyCode !== 13) return;
  }

  if (document.querySelector("#longURL").value == "") {
    alert("URL不能为空!");
    return;
  }

  document.getElementById('keyPhrase').value = document.getElementById('keyPhrase').value.replace(/\s/g, "-");
  document.getElementById("addBtn").disabled = true;
  document.getElementById("addBtn").innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 处理中...';

  fetch(apiSrv, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd: "add",
      url: document.querySelector("#longURL").value,
      key: document.querySelector("#keyPhrase").value,
      password: password_value
    })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById("addBtn").disabled = false;
      document.getElementById("addBtn").innerHTML = '<i class="fas fa-magic me-2"></i>生成';
      if (data.status == 200) {
        const shortUrl = window.location.protocol + "//" + window.location.host + "/" + data.key;
        document.getElementById("result").innerHTML = shortUrl;

        // 绑定模态框复制按钮事件
        document.getElementById("copyResultBtn").onclick = () => {
          handleModalCopy(shortUrl);
        };
        // 生成短链后显示模态框
        const modal = new bootstrap.Modal(document.getElementById('resultModal'));
        modal.show();
        // 添加到本地存储和KV列表
        localStorage.setItem(data.key, document.querySelector("#longURL").value);
        addUrlToList(data.key, document.querySelector("#longURL").value);
      } else {
        alert(data.error || "生成短链失败");
      }
    })
    .catch(err => {
      console.error("Error:", err);
      document.getElementById("addBtn").disabled = false;
      document.getElementById("addBtn").innerHTML = '<i class="fas fa-magic me-2"></i>生成';
      alert("请求失败，请重试");
    });
}

function loadUrlList() {
  let urlList = document.querySelector("#urlList")
  urlList.innerHTML = ''; // 清空列表，移除加载动画

  let longUrl = document.querySelector("#longURL").value.trim()
  let keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    keys.push(localStorage.key(i));
  }

  keys.reverse().forEach(keyShortURL => {
    let valueLongURL = localStorage.getItem(keyShortURL)
    // 如果长链接为空，加载所有的localStorage；否则，加载匹配的localStorage
    if (longUrl === "" || (longUrl === valueLongURL)) {
      addUrlToList(keyShortURL, valueLongURL)
    }
  });

  // 如果列表为空，显示提示
  if (urlList.children.length === 0) {
    urlList.innerHTML = '<div class="text-center py-3 text-muted">暂无短链接记录</div>';
  }
}

function addUrlToList(shortUrl, longUrl) {
  let urlList = document.querySelector("#urlList")
  let child = document.createElement('div')
  child.classList.add("list-group-item")
  let keyItem = document.createElement('div')
  keyItem.classList.add("input-group")

  // 短链接信息
  let keyTxt = document.createElement('span')
  keyTxt.classList.add("form-control")
  keyTxt.innerText = window.location.protocol + "//" + window.location.host + "/" + shortUrl
  keyItem.appendChild(keyTxt)

  // 删除按钮
  let delBtn = document.createElement('button')
  delBtn.setAttribute('type', 'button')
  delBtn.classList.add("btn", "btn-danger")
  delBtn.setAttribute('onclick', 'deleteShortUrl(\"' + shortUrl + '\")')
  delBtn.setAttribute('id', 'delBtn-' + shortUrl)
  delBtn.innerHTML = '<i class="fas fa-trash-alt" title="删除短链接"></i>'
  keyItem.appendChild(delBtn)

  // 只有当 visit_count 为 true 时才显示统计按钮
  if (window.visit_count_enabled !== false) {
    let qryCntBtn = document.createElement('button')
    qryCntBtn.setAttribute('type', 'button')
    qryCntBtn.classList.add("btn", "btn-info")
    qryCntBtn.setAttribute('onclick', 'queryVisitCount(\"' + shortUrl + '\")')
    qryCntBtn.setAttribute('id', 'qryCntBtn-' + shortUrl)
    qryCntBtn.innerHTML = '<i class="fas fa-chart-line" title="访问统计"></i>'
    keyItem.appendChild(qryCntBtn)
  }

  // 复制按钮
  const copyBtn = document.createElement('button');
  copyBtn.setAttribute('type', 'button');
  copyBtn.classList.add('btn', 'btn-success');
  copyBtn.setAttribute('id', `copyBtn-${shortUrl}`);
  copyBtn.innerHTML = '<i class="fas fa-copy" title="复制短链接"></i>';
  copyBtn.onclick = () => copyShortUrl(
    `${window.location.protocol}//${window.location.host}/${shortUrl}`,
    `copyBtn-${shortUrl}`
  );
  keyItem.appendChild(copyBtn);

  // 显示二维码按钮
  let qrcodeBtn = document.createElement('button')
  qrcodeBtn.setAttribute('type', 'button')
  qrcodeBtn.classList.add("btn", "btn-info",)
  qrcodeBtn.setAttribute('onclick', 'toggleQrcode(\"' + shortUrl + '\")')
  qrcodeBtn.setAttribute('id', 'qrcodeBtn-' + shortUrl)
  qrcodeBtn.innerHTML = '<i class="fas fa-qrcode" title="显示二维码"></i>'
  keyItem.appendChild(qrcodeBtn)
  child.appendChild(keyItem)

  // 插入一个二维码占位
  let qrcodeContainer = document.createElement('div');
  qrcodeContainer.setAttribute('id', 'qrcode-' + shortUrl);
  qrcodeContainer.classList.add('qrcode-container'); 
  child.appendChild(qrcodeContainer);
  child.appendChild(buildValueItemFunc(longUrl)) // 长链接信息
  urlList.append(child)
}

// 二维码切换逻辑
function toggleQrcode(shortUrl) {
  const qrcodeContainer = document.getElementById('qrcode-' + shortUrl); 
  const qrcodeBtn = document.getElementById('qrcodeBtn-' + shortUrl);
  const fullUrl = window.location.protocol + "//" + window.location.host + "/" + shortUrl;
  const isVisible = qrcodeContainer.classList.toggle('qrcode-visible');
  
  if (isVisible) {
    // 生成 QR code
    qrcodeContainer.innerHTML = '';
    $(qrcodeContainer).qrcode({
      render: 'canvas',
      minVersion: 1,
      maxVersion: 40,
      ecLevel: 'Q', // 'L', 'M', 'Q' or 'H'
      size: 128,
      text: fullUrl
    });
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

function clearLocalStorage() {
  localStorage.clear()
}

function deleteShortUrl(delKeyPhrase) {
  document.getElementById("delBtn-" + delKeyPhrase).disabled = true;
  document.getElementById("delBtn-" + delKeyPhrase).innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

  // 从KV中删除
  fetch(apiSrv, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: "del", key: delKeyPhrase, password: password_value })
  }).then(function (response) {
    return response.json();
  }).then(function (myJson) {
    res = myJson;

    if (res.status == "200") {
      localStorage.removeItem(delKeyPhrase)
      loadUrlList()
      document.getElementById("result").innerHTML = "已删除"
    } else {
      document.getElementById("result").innerHTML = res.error;
    }
    // 弹出消息窗口
    const modal = new bootstrap.Modal(document.getElementById('resultModal'));
    modal.show();

  }).catch(function (err) {
    alert("Unknow error. Please retry!");
    console.log(err);
  })
}

function queryVisitCount(qryKeyPhrase) {
  const btn = document.getElementById("qryCntBtn-" + qryKeyPhrase);
  const originalIcon = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
  
  // 从KV中查询
  fetch(apiSrv, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: "qrycnt", key: qryKeyPhrase + "-count", password: password_value })
  }).then(function (response) {
    return response.json();
  }).then(function (myJson) {
    res = myJson;

    if (res.status == "200") {
      // 成功：显示统计次数
      btn.innerHTML = res.url;
    } else {
      // 失败：显示错误信息，并恢复按钮图标
      document.getElementById("result").innerHTML = res.error;
      btn.innerHTML = originalIcon; // 恢复图标
      const modal = new bootstrap.Modal(document.getElementById('resultModal'));
      modal.show();
    }
    // 无论成功或失败，都重新启用按钮
    btn.disabled = false;
  })
  .catch(function (err) {
    // 请求失败时恢复按钮状态
    alert("Unknow error. Please retry!");
    console.log(err);
    btn.innerHTML = originalIcon; // 恢复图标
    btn.disabled = false; // 启用按钮
  });
}

function query1KV(event) {
  if (event) {
    event.preventDefault();
    if (event.keyCode && event.keyCode !== 13) return;
  }

  let qryKeyPhrase = document.getElementById("keyForQuery").value;
  if (qryKeyPhrase == "") {
    return
  }

  // 从KV中查询
  fetch(apiSrv, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: "qry", key: qryKeyPhrase, password: password_value })
  }).then(function (response) {
    return response.json();
  }).then(function (myJson) {
    res = myJson;

    if (res.status == "200") {
      document.getElementById("longURL").value = res.url;
      document.getElementById("keyPhrase").value = qryKeyPhrase;
      document.getElementById("longURL").dispatchEvent(new Event('input', {
        bubbles: true,
        cancelable: true,
      }))
    } else {
      document.getElementById("result").innerHTML = res.error;
      // 弹出消息窗口
      const modal = new bootstrap.Modal(document.getElementById('resultModal'));
      modal.show();
    }

  }).catch(function (err) {
    alert("未知错误。请重试!");
    console.log(err);
  })
}

function loadKV() {
  fetch(apiSrv, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: "qryall", password: password_value })
  })
    .then(response => {
      if (!response.ok) throw new Error('加载失败');
      return response.json();
    })
    .then(data => {
      if (data.status == 200) {
        clearLocalStorage();
        data.kvlist.forEach(item => { localStorage.setItem(item.key, item.value); });
        loadUrlList();
        setTimeout(() => { alert(`成功加载 ${data.kvlist.length} 条记录`); }, 300);
      } else {
        alert(data.error || "加载失败");
      }
    })
    .catch(err => {
      console.error("Error:", err);
      alert("请求失败，请重试");
    });
}

function buildValueTxt(longUrl) {
  let valueTxt = document.createElement('div')
  valueTxt.classList.add("form-control")
  valueTxt.innerText = longUrl
  return valueTxt
}

document.addEventListener('DOMContentLoaded', function () {
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // 主题切换逻辑
  const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(theme) {
      const themeToggleBtn = document.getElementById('themeToggleBtn');
      if (!themeToggleBtn) return;
      const isSystemDark = prefersDarkQuery.matches;

      if (theme === 'dark') {
          document.body.classList.add('dark-mode');
          themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>'; // 暗黑模式下显示太阳图标（切换到明亮）
          localStorage.setItem('theme', 'dark');
      } else if (theme === 'light') {
          document.body.classList.remove('dark-mode');
          themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>'; // 明亮模式下显示月亮图标（切换到暗黑）
          localStorage.setItem('theme', 'light');
      } else { 
          document.body.classList.remove('dark-mode');
          if (isSystemDark) {
              themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
          } else {
              themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
          }
          localStorage.removeItem('theme');
      }
  }

  // 初始化主题
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
      applyTheme(storedTheme);
  } else {
      applyTheme(null); 
  }

  // 主题按钮点击事件
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
      let currentManualTheme = localStorage.getItem('theme');
      const isSystemDark = prefersDarkQuery.matches;
      const isCurrentlyDark = (currentManualTheme === 'dark') || (currentManualTheme === null && isSystemDark);
      let newTheme = isCurrentlyDark ? 'light' : 'dark';
      applyTheme(newTheme);
  });

  // 监听系统主题变化
  prefersDarkQuery.addEventListener('change', () => {
      if (!localStorage.getItem('theme')) { applyTheme(null); }
  });

  window.visit_count_enabled = true; // 初始化全局变量
  // 获取后端配置
  function loadConfig() {
    fetch(apiSrv, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd: "config",
        password: password_value
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.status == 200) {
          window.visit_count_enabled = data.visit_count;
          window.enable_qrcode = data.enable_qrcode;
          window.allow_custom_key = data.custom_link;

          const customKeyInput = document.getElementById('keyPhrase');
          if (data.custom_link) {
            // 功能开启：启用输入框，显示默认 placeholder
            customKeyInput.disabled = false;
            customKeyInput.placeholder = customKeyInput.getAttribute('placeholder') || "输入大小写字母和数字";
          } else {
            // 功能关闭：禁用输入框，修改 placeholder
            customKeyInput.disabled = true;
            customKeyInput.placeholder = "功能未开启，随机生成短链Key";
            customKeyInput.value = ""; // 清空可能已有的输入
          }
          // 可以在这里存储其他配置
        }
        loadUrlList();
      })
      .catch(err => {
        console.error("Error loading config:", err);
        loadUrlList();
      });
  }
  document.getElementById("passwordText").readOnly = true;
  loadConfig();
});
