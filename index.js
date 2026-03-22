// 版本号校验和会话清理功能

// 当前版本号 - 更新此值以触发会话清理
const CURRENT_VERSION = "3.2.7";
const APP_VERSION_KEY = "appVersion";
const VERSION_RESET_ANIMATION_DURATION = 1400;

let versionResetTriggered = false;

function isBeginPage() {
    const pathname = window.location.pathname.toLowerCase();
    return pathname.includes('begin.html') ||
        pathname.endsWith('/begin.html') ||
        pathname === '/begin' ||
        pathname === '/begin/';
}

function showStorageError() {
    const renderError = () => {
        const container = document.querySelector('.container') || document.body;
        if (!container) {
            return;
        }

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f8d7da;
            color: #721c24;
            padding: 15px;
            text-align: center;
            z-index: 9999;
            border: 1px solid #f5c6cb;
        `;
        errorDiv.innerHTML = `
            <strong>本地存储不可用</strong><br>
            无法完成版本更新后的自动清理，请检查浏览器是否禁用了本地存储。
        `;

        container.insertBefore(errorDiv, container.firstChild);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderError, { once: true });
    } else {
        renderError();
    }
}

/**
 * 检查本地存储的版本号与当前版本号是否一致
 * @returns {boolean} 版本号是否一致
 */
function checkVersion() {
    try {
        return localStorage.getItem(APP_VERSION_KEY) === CURRENT_VERSION;
    } catch (error) {
        console.error('版本检查过程中发生错误:', error);
        return true;
    }
}

/**
 * 清理所有本地会话并保存当前版本号
 * @returns {boolean} 是否清理成功
 */
function clearAllSessions() {
    try {
        console.log('检测到版本变化，开始自动清理本地会话...');

        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(APP_VERSION_KEY, CURRENT_VERSION);

        versionResetTriggered = true;
        console.log('版本号已更新为:', CURRENT_VERSION);
        return true;
    } catch (error) {
        console.error('清理会话过程中发生错误:', error);
        showStorageError();
        return false;
    }
}

function showVersionResetAnimation() {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    const icon = document.querySelector('#loading-overlay .loading-icon');
    const resetMessage = '检测到网站更新，正在清理本地会话...';

    if (!overlay || !text) {
        return;
    }

    if (icon) {
        icon.textContent = '↻';
    }

    text.textContent = resetMessage;
    overlay.classList.add('version-reset-mode');
    overlay.style.display = 'flex';

    window.setTimeout(() => {
        overlay.classList.remove('version-reset-mode');

        if (icon && icon.textContent === '↻') {
            icon.textContent = '⚡';
        }

        if (text.textContent === resetMessage) {
            overlay.style.display = 'none';
        }
    }, VERSION_RESET_ANIMATION_DURATION);
}

function bootstrapVersionCheck() {
    if (isBeginPage()) {
        window.location.replace('./index.html');
        return;
    }

    if (!checkVersion()) {
        clearAllSessions();
    }
}

bootstrapVersionCheck();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (versionResetTriggered) {
            showVersionResetAnimation();
        }
    }, { once: true });
} else if (versionResetTriggered) {
    showVersionResetAnimation();
}

// 导出函数供其他页面使用
window.checkVersion = checkVersion;
window.clearAllSessions = clearAllSessions;
