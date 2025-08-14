// 版本号校验和会话清理功能

// 当前版本号 - 更新此值以触发会话清理
const CURRENT_VERSION = "1.85.521";

// 重定向计数器，防止无限循环
const REDIRECT_COUNT_KEY = "version_check_redirect_count";
const MAX_REDIRECTS = 3;

// 检查是否在服务器环境运行
function isServerEnvironment() {
    // 检查协议是否为http或https（而不是file）
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

/**
 * 检查本地存储的版本号与当前版本号是否一致
 * @returns {boolean} 版本号是否一致
 */
function checkVersion() {
    try {
        // 获取本地存储的版本号
        const localVersion = localStorage.getItem('appVersion');
        
        console.log('版本检查:', {
            current: CURRENT_VERSION,
            local: localVersion,
            match: localVersion === CURRENT_VERSION
        });
        
        // 如果没有本地版本号，认为是新用户，设置一个错误的版本号强制更新
        if (!localVersion) {
            console.log('新用户，设置初始错误版本号');
            localStorage.setItem('appVersion', '0.0.0');
            return false; // 强制跳转到更新页面
        }
        
        // 比较版本号
        const isMatch = localVersion === CURRENT_VERSION;

        
        return isMatch;
    } catch (error) {
        console.error('版本检查过程中发生错误:', error);
        // 如果检查过程中发生错误，默认返回true，避免用户无法使用
        return true;
    }
}

/**
 * 清理所有会话存储并保存当前版本号
 */
function clearAllSessions() {
    try {
        console.log('开始清理会话...');
        
        // 显示状态消息的函数
        function showStatus(message, isError = false) {
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = message;
                statusElement.classList.remove('hidden', 'error', 'success');
                
                if (isError) {
                    statusElement.classList.add('error');
                } else {
                    statusElement.classList.add('success');
                }
                
                // 确保元素可见
                setTimeout(() => {
                    statusElement.classList.remove('hidden');
                }, 10);
            }
        }
        
        // 显示清理状态
        showStatus('正在清理会话...');
        
        // 清理所有可能的本地存储
        localStorage.clear();
        sessionStorage.clear();
        
        // 保存当前版本号到本地存储
        localStorage.setItem('appVersion', CURRENT_VERSION);
        console.log('版本号已设置为:', CURRENT_VERSION);
        
        // 验证版本号是否正确设置
        const verifyVersion = localStorage.getItem('appVersion');
        console.log('验证版本号:', verifyVersion);
        
        showStatus(`会话已清理，版本号已更新为: ${CURRENT_VERSION},请耐心等待...`);
        
        // 重置重定向计数器
        sessionStorage.removeItem(REDIRECT_COUNT_KEY);
        
        // 使用更可靠的方式确保localStorage被正确持久化
        function waitForStoragePersistence(callback) {
            // 立即检查一次
            const immediateCheck = localStorage.getItem('appVersion');
            if (immediateCheck === CURRENT_VERSION) {
                callback();
                return;
            }
            
            // 如果立即检查失败，使用短轮询
            let attempts = 0;
            const maxAttempts = 10;
            const interval = setInterval(() => {
                attempts++;
                const check = localStorage.getItem('appVersion');
                console.log(`存储验证尝试 ${attempts}:`, check);
                
                if (check === CURRENT_VERSION) {
                    clearInterval(interval);
                    callback();
                } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.warn('存储验证超时，继续执行跳转');
                    callback();
                }
            }, 100);
        }
        
        // 延迟一下让用户看到状态信息，然后确保存储已持久化后再跳转
        setTimeout(() => {
            waitForStoragePersistence(() => {
                // 再次验证版本号
                const finalVerify = localStorage.getItem('appVersion');
                console.log('最终验证版本号:', finalVerify);
                
                // 跳转到主页
                console.log('跳转到index.html');
                window.location.href = './index.html';
            });
        }, 2000);
    } catch (error) {
        console.error('清理会话过程中发生错误:', error);
        // 即使发生错误，也跳转到主页
        window.location.href = './index.html';
    }
}

/**
 * 初始化begin.html页面
 */
function initBeginPage() {
    // 直接查找并绑定按钮事件，不依赖DOMContentLoaded
    const clearButton = document.getElementById('clearSession');
    if (clearButton) {
        clearButton.addEventListener('click', clearAllSessions);
    }
}

// 页面加载时检查版本号
document.addEventListener('DOMContentLoaded', function() {
    console.log('页面加载检查:', {
        href: window.location.href,
        pathname: window.location.pathname,
        origin: window.location.origin,
        protocol: window.location.protocol
    });
    
    // 检查是否在begin.html页面（更可靠的方法）
    const currentPage = window.location.href.toLowerCase();
    const isBeginPage = currentPage.includes('begin.html');
    
    console.log('页面类型检查:', {currentPage, isBeginPage});
    
    // 如果在begin.html页面，初始化清理功能
    if (isBeginPage) {
        console.log('在begin.html页面，初始化清理功能');
        initBeginPage();
        return;
    }
    
    // 只有在非begin.html页面才检查版本号
    if (!isBeginPage) {
        // 在服务器环境下增加额外的安全检查
        if (isServerEnvironment()) {
            // 检查重定向计数，防止无限循环
            let redirectCount = parseInt(sessionStorage.getItem(REDIRECT_COUNT_KEY) || '0');
            redirectCount++;
            sessionStorage.setItem(REDIRECT_COUNT_KEY, redirectCount.toString());
            
            console.log('重定向计数 (服务器环境):', redirectCount);
            
            // 如果重定向次数超过限制，停止检查并显示错误
            if (redirectCount > MAX_REDIRECTS) {
                console.error('检测到可能的重定向循环，停止版本检查');
                sessionStorage.removeItem(REDIRECT_COUNT_KEY);
                
                // 显示错误信息给用户
                const container = document.querySelector('.container') || document.body;
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
                    <strong>检测到页面重定向问题</strong><br>
                    请尝试以下操作：<br>
                    1. 清除浏览器缓存和Cookie<br>
                    2. 使用无痕/隐私模式访问<br>
                    3. 联系网站管理员
                `;
                container.insertBefore(errorDiv, container.firstChild);
                
                return;
            }
        }
        
        // 延迟一点执行版本检查，确保页面完全加载
        setTimeout(() => {
            const isVersionMatch = checkVersion();
            console.log('版本匹配结果:', isVersionMatch);
            if (!isVersionMatch) {
                // 版本号不一致，跳转到begin.html
                console.log('版本不匹配，跳转到begin.html');
                window.location.href = './begin.html';
            } else {
                // 版本匹配，重置计数器（仅在服务器环境下）
                if (isServerEnvironment()) {
                    sessionStorage.removeItem(REDIRECT_COUNT_KEY);
                }
            }
        }, 100);
    }
});

// 为了确保在begin.html页面能正确绑定事件，也直接执行一次检查
const currentHref = window.location.href.toLowerCase();
const isBeginPageDirect = currentHref.includes('begin.html');

console.log('直接检查页面类型:', {currentHref, isBeginPageDirect});

if (isBeginPageDirect) {
    // 如果DOM已经加载完成，直接初始化
    if (document.readyState === 'loading') {
        // DOM仍在加载中，等待DOMContentLoaded
        document.addEventListener('DOMContentLoaded', initBeginPage);
    } else {
        // DOM已经加载完成，直接执行
        initBeginPage();
    }
}

// 导出函数供其他页面使用
window.checkVersion = checkVersion;
window.clearAllSessions = clearAllSessions;