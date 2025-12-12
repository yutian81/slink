/**
 * footer.js
 * 负责在 DOM 加载完成后，将页脚的 HTML 代码插入到主容器 .container 元素之后
 */

document.addEventListener('DOMContentLoaded', function () {
    // 获取当前年份和起始年份
    const currentYear = new Date().getFullYear();
    const startYear = 2025;
    const yearText = currentYear === startYear 
        ? `Copyright © ${startYear}`
        : `Copyright © ${startYear}-${currentYear}`;
    
    const htmlToInsert = `
        <div class="card-footer text-center">
            <p class="mb-0 copyright">
                <span class="item">${yearText} Yutian81</span>
                <span class="separator">|</span>
                <a href="https://github.com/yutian81/slink/" class="item footer-link" target="_blank">
                    <i class="fa-brands fa-github me-1"></i>Github
                </a>
                <span class="separator">|</span>
                <a href="https://blog.notett.com/post/2025/12/251212-slink" class="item footer-link" target="_blank">
                    <i class="fa-solid fa-blog me-1"></i>QingYun Blog
                </a>
            </p>
        </div>
    `;

    const mainContentContainer = document.querySelector('.container');
    if (mainContentContainer) {
        mainContentContainer.insertAdjacentHTML('afterend', htmlToInsert);
    }
});

