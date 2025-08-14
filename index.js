// 版本号校验和会话清理功能

// 当前版本号 - 更新此值以触发会话清理
const CURRENT_VERSION = "1.85.521";

/**
 * 检查本地存储的版本号与当前版本号是否一致
 * @returns {boolean} 版本号是否一致
 */
function checkVersion() {
    try {
        // 获取本地存储的版本号
        const localVersion = localStorage.getItem('appVersion');
        
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
        showStatus(`会话已清理，版本号已更新为: ${CURRENT_VERSION},请耐心等待...`);
        
        // 延迟一下让用户看到状态信息
        setTimeout(() => {
            // 跳转到主页
            window.location.href = 'index.html';
        }, 100);
    } catch (error) {
        console.error('清理会话过程中发生错误:', error);
        // 即使发生错误，也跳转到主页
        window.location.href = 'index.html';
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
    // 如果在begin.html页面，初始化清理功能
    if (window.location.pathname.includes('begin.html')) {
        initBeginPage();
        return;
    }
    
    // 只有在非begin.html页面才检查版本号
    if (!window.location.pathname.includes('begin.html')) {
        // 延迟一点执行版本检查，确保页面完全加载
        setTimeout(() => {
            const isVersionMatch = checkVersion();
            if (!isVersionMatch) {
                // 版本号不一致，跳转到begin.html
                window.location.href = 'begin.html';
            }
        }, 100);
    }
});

// 为了确保在begin.html页面能正确绑定事件，也直接执行一次检查
if (window.location.pathname.includes('begin.html')) {
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