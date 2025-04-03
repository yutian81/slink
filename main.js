// 全局变量和配置
const config = {
  apiSrv: window.location.pathname,
  password_value: '', // 由后端验证
  buildValueItemFunc: buildValueTxt
};

// 通用工具函数
const utils = {
  // 设置按钮加载状态
  setButtonLoading(button, isLoading, loadingText = '处理中...') {
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>${loadingText}`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
  },

  // 显示模态框
  showModal(message, isSuccess = true) {
    const resultEl = document.getElementById("result");
    resultEl.innerHTML = message;
    resultEl.className = `alert ${isSuccess ? 'alert-info' : 'alert-danger'}`;
    new bootstrap.Modal(document.getElementById('resultModal')).show();
  },

  // 构建完整URL
  buildFullUrl(shortKey) {
    return `${window.location.protocol}//${window.location.host}/${shortKey}`;
  },

  // 通用复制函数
  async copyToClipboard(text, targetElement = null) {
    try {
      await navigator.clipboard.writeText(text);
      if (targetElement) {
        const originalHtml = targetElement.innerHTML;
        targetElement.innerHTML = '<i class="fas fa-check me-1"></i><span class="d-none d-md-inline">已复制</span>';
        targetElement.classList.replace('btn-info', 'btn-success');
        setTimeout(() => {
          targetElement.innerHTML = originalHtml;
          targetElement.classList.replace('btn-success', 'btn-info');
        }, 2000);
      }
      return true;
    } catch (err) {
      console.error('复制失败:', err);
      if (targetElement) {
        targetElement.innerHTML = '<i class="fas fa-times me-1"></i><span class="d-none d-md-inline">失败</span>';
        targetElement.classList.replace('btn-info', 'btn-danger');
        setTimeout(() => {
          targetElement.innerHTML = originalHtml;
          targetElement.classList.replace('btn-danger', 'btn-info');
        }, 2000);
      }
      return false;
    }
  }
};

// 主功能函数
const shortUrlApp = {
  // 生成短链接
  async generate() {
    const longURL = document.querySelector("#longURL").value;
    if (!longURL) {
      alert("URL不能为空！");
      return;
    }

    const addBtn = document.getElementById("addBtn");
    utils.setButtonLoading(addBtn, true);

    try {
      const keyPhrase = document.getElementById('keyPhrase').value.replace(/\s/g, "-");
      const response = await fetch(config.apiSrv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cmd: "add", 
          url: longURL, 
          key: keyPhrase, 
          password: document.querySelector("#passwordText").value 
        })
      });

      const res = await response.json();
      if (res.status === "200") {
        const shortUrl = utils.buildFullUrl(res.key);
        localStorage.setItem(res.key, longURL);
        this.addUrlToList(res.key, longURL);
        document.getElementById("result").innerHTML = shortUrl;
        utils.copyToClipboard(shortUrl);
      } else {
        utils.showModal(res.error, false);
      }
    } catch (err) {
      console.error(err);
      utils.showModal("未知错误，请重试！", false);
    } finally {
      utils.setButtonLoading(addBtn, false, '生成短链');
    }
  },

  // 加载URL列表
  loadUrlList() {
    const urlList = document.querySelector("#urlList");
    urlList.innerHTML = '';
    const longUrl = document.querySelector("#longURL").value;

    Array.from({ length: localStorage.length }, (_, i) => localStorage.length - 1 - i)
      .map(i => ({
        key: localStorage.key(i),
        value: localStorage.getItem(localStorage.key(i))
      }))
      .filter(({ value }) => !longUrl || value === longUrl)
      .forEach(({ key, value }) => this.addUrlToList(key, value));
  },

  // 添加URL到列表
  addUrlToList(shortUrl, longUrl) {
    const urlList = document.querySelector("#urlList");
    const item = document.createElement('div');
    item.className = "mb-3 list-group-item d-flex align-items-center p-2"; // 添加flex布局和居中对齐
  
    // 操作按钮容器 - 修改为更紧凑的布局
    const buttonGroup = document.createElement('div');
    buttonGroup.className = "d-flex align-items-center me-2"; // 使用flex布局并添加右边距
    
    // 按钮配置 - 添加更小的尺寸类
    const buttons = [
      { 
        icon: 'trash', text: '删除', 
        className: 'btn-danger btn-xs', // 添加btn-xs类
        onClick: () => this.deleteShortUrl(shortUrl) 
      },
      { 
        id: `qryCntBtn-${shortUrl}`, 
        icon: 'chart-line', text: '统计', 
        className: 'btn-info btn-xs', // 添加btn-xs类
        onClick: () => this.queryVisitCount(shortUrl) 
      },
      { 
        icon: 'qrcode', text: '扫码', 
        className: 'btn-secondary btn-xs', // 添加btn-xs类
        onClick: () => this.buildQrcode(shortUrl) 
      }
    ];
  
    // 创建按钮
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.innerHTML = `<i class="fas fa-${btn.icon} me-1"></i><span class="d-none d-md-inline">${btn.text}</span>`;
      button.className = `btn ${btn.className} btn-sm me-1`; // 保持btn-sm但添加紧凑样式
      button.style.padding = "0.25rem 0.5rem"; // 更紧凑的内边距
      button.style.minWidth = "60px"; // 固定最小宽度
      button.onclick = btn.onClick;
      if (btn.id) button.id = btn.id;
      buttonGroup.appendChild(button);
    });
  
    // 短链接容器 - 添加边框和居中对齐
    const urlContainer = document.createElement('div');
    urlContainer.className = "flex-grow-1 d-flex border rounded px-2 text-wrap align-items-center";
    urlContainer.style.minHeight = "36px"; // 与按钮高度匹配
  
    // 短链接文本
    const urlText = document.createElement('span');
    urlText.textContent = utils.buildFullUrl(shortUrl);
    urlText.className = "text-primary text-truncate w-100 text-center"; // 添加text-center
    urlText.style.cursor = "pointer";
    urlText.onclick = (e) => this.copyFromList(e, shortUrl);
  
    urlContainer.appendChild(urlText);
    item.appendChild(buttonGroup);
    item.appendChild(urlContainer);
    item.appendChild(document.createElement('div')).id = `qrcode-${shortUrl}`;
    
    // 长URL显示（在下方）
    const longUrlText = buildValueTxt(longUrl);
    longUrlText.className = "form-control rounded-top-0 mt-2 small";
    item.appendChild(longUrlText);
    
    urlList.appendChild(item);
  },

  // 从列表复制
  copyFromList(event, shortUrl) {
    const url = utils.buildFullUrl(shortUrl);
    const qryBtn = event.target.closest('.list-group-item').querySelector('[id^="qryCntBtn-"]');
    utils.copyToClipboard(url, qryBtn);
  },

  // 删除短链接
  async deleteShortUrl(key) {
    const delBtn = document.getElementById(`delBtn-${key}`);
    if (!delBtn) return;

    utils.setButtonLoading(delBtn, true);

    try {
      const response = await fetch(config.apiSrv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: "del", key, password: config.password_value })
      });

      const res = await response.json();
      if (res.status === "200") {
        localStorage.removeItem(key);
        this.loadUrlList();
        utils.showModal("删除成功");
      } else {
        utils.showModal(res.error, false);
      }
    } catch (err) {
      console.error(err);
      utils.showModal("未知错误，请重试！", false);
    } finally {
      utils.setButtonLoading(delBtn, false);
    }
  },

  // 查询访问计数
  async queryVisitCount(key) {
    const btn = document.getElementById(`qryCntBtn-${key}`);
    if (!btn) return;
  
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
  
    try {
      const response = await fetch(config.apiSrv, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cmd: "qry",
          key: `${key}-count`,
          password: config.password_value
        })
      });
  
      const data = await response.json();
      if (data.status === 200) {
        // 修改这里：直接显示访问次数，不再自动恢复
        btn.innerHTML = `<i class="fas fa-eye me-1"></i><span>${data.url || '0'}次</span>`;
        btn.disabled = false;
        
        // 添加点击事件，点击后可手动恢复原始状态
        btn.onclick = () => {
          btn.innerHTML = originalHtml;
          btn.onclick = () => this.queryVisitCount(key);
        };
      } else {
        throw new Error(data.error || "查询失败");
      }
    } catch (error) {
      btn.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>';
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }, 2000);
    }
  },

  // 生成二维码
  buildQrcode(shortUrl) {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const container = $(`#qrcode-${shortUrl.replace(/([:.#[\]|=@])/g, "\\$1")}`);
    
    try {
      container.empty().addClass('qrcode-container');    
      container.qrcode({
        render: 'canvas',
        size: 192,
        minVersion: 5,
        maxVersion: 20,
        ecLevel: 'H',
        fill: darkModeMediaQuery.matches ? '#FFF' : '#2A2B2C',
        background: null,
        text: utils.buildFullUrl(shortUrl),
        radius: 4,
        quiet: 2
      });

      darkModeMediaQuery.addEventListener('change', (e) => {
        container.find('canvas').css('fill', e.matches ? '#FFF' : '#2A2B2C');
      });
    } catch (e) {
      container.html('<div class="alert alert-warning">二维码生成失败</div>');
      console.error("QR Code Error:", e);
    }
  }
};

// 辅助函数
function buildValueTxt(longUrl) {
  const valueTxt = document.createElement('div');
  valueTxt.className = "form-control rounded-top-0";
  valueTxt.textContent = longUrl;
  return valueTxt;
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
  // 初始化弹出框
  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    new bootstrap.Popover(el);
  });

  // 绑定事件
  document.getElementById("addBtn").addEventListener('click', () => shortUrlApp.generate());
  document.getElementById("loadListBtn").addEventListener('click', () => shortUrlApp.loadUrlList());
  document.getElementById("clearlocalStgBtn").addEventListener('click', () => {
    localStorage.clear();
    document.querySelector("#longURL").value = "";
    shortUrlApp.loadUrlList();
  });

  // 初始加载
  shortUrlApp.loadUrlList();
});
