// 资源状态管理器
// 用于更新页面上的资源加载状态显示

(function() {
    'use strict';
    
    let statusPanel = null;
    let statusItems = {};
    
    // 初始化状态面板
    function initStatusPanel() {
        statusPanel = document.getElementById('resource-status');
        if (statusPanel) {
            statusItems = {
                emailjs: document.getElementById('emailjs-status'),
                particles: document.getElementById('particles-status'),
                leancloud: document.getElementById('leancloud-status')
            };
        }
    }
    
    // 更新单个资源状态
    function updateResourceStatus(resource, status, message) {
        if (!statusItems[resource]) return;
        
        const statusBadge = statusItems[resource].querySelector('.status-badge');
        if (!statusBadge) return;
        
        // 移除所有状态类
        statusBadge.classList.remove('loading', 'success', 'fallback', 'error');
        
        // 添加新状态类和文本
        switch (status) {
            case 'loading':
                statusBadge.classList.add('loading');
                statusBadge.textContent = '加载中';
                break;
            case 'success':
                statusBadge.classList.add('success');
                statusBadge.textContent = '正常';
                break;
            case 'fallback':
                statusBadge.classList.add('fallback');
                statusBadge.textContent = '后备';
                break;
            case 'error':
                statusBadge.classList.add('error');
                statusBadge.textContent = '失败';
                break;
        }
        
        if (message) {
            statusBadge.title = message;
        }
    }
    
    // 显示状态面板
    function showStatusPanel() {
        if (statusPanel) {
            statusPanel.classList.remove('hidden');
            // 为状态栏添加样式类，表示有资源状态面板
            const statusBar = statusPanel.closest('.status-bar');
            if (statusBar) {
                statusBar.classList.add('has-resource-status');
            }
        }
    }
    
    // 隐藏状态面板
    function hideStatusPanel() {
        if (statusPanel) {
            statusPanel.classList.add('hidden');
            // 移除状态栏的样式类，恢复居中显示
            const statusBar = statusPanel.closest('.status-bar');
            if (statusBar) {
                statusBar.classList.remove('has-resource-status');
            }
        }
    }
    
    // 监听资源加载事件
    function setupResourceMonitoring() {
        // 监听EmailJS状态
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;
        
        console.log = function(...args) {
            const message = args.join(' ');
            
            // EmailJS 相关日志
            if (message.includes('EmailJS 成功')) {
                updateResourceStatus('emailjs', 'success', 'EmailJS 已从CDN加载');
            } else if (message.includes('EmailJS 后备方案已激活')) {
                updateResourceStatus('emailjs', 'fallback', '使用本地后备方案');
            } else if (message.includes('EmailJS初始化成功')) {
                updateResourceStatus('emailjs', 'success', 'EmailJS 初始化完成');
            }
            
            // LeanCloud 相关日志
            if (message.includes('LeanCloud初始化成功')) {
                updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
            }
            
            // 系统初始化相关日志
            if (message.includes('系统初始化成功')) {
                // 系统初始化成功时，再次确认LeanCloud状态
                setTimeout(() => {
                    if (window.leanCloudClient && window.leanCloudClient.isInitialized) {
                        updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
                    }
                }, 500);
            }
            
            originalConsoleLog.apply(console, args);
        };
        
        console.warn = function(...args) {
            const message = args.join(' ');
            
            if (message.includes('EmailJS') && message.includes('后备方案')) {
                updateResourceStatus('emailjs', 'fallback', '正在使用后备方案');
            }
            
            originalConsoleWarn.apply(console, args);
        };
        
        console.error = function(...args) {
            const message = args.join(' ');
            
            if (message.includes('EmailJS')) {
                updateResourceStatus('emailjs', 'error', 'EmailJS 加载失败');
            } else if (message.includes('LeanCloud')) {
                updateResourceStatus('leancloud', 'error', 'LeanCloud 连接失败');
            }
            
            originalConsoleError.apply(console, args);
        };
    }
    
    // 检查粒子背景状态
    function checkParticlesStatus() {
        setTimeout(() => {
            if (typeof particlesJS !== 'undefined') {
                updateResourceStatus('particles', 'success', 'particles.js 已加载');
            } else {
                updateResourceStatus('particles', 'fallback', '使用简化背景');
            }
        }, 500);
    }
    
    // 检查LeanCloud状态
    function checkLeanCloudStatus() {
        let checkCount = 0;
        const maxChecks = 10; // 最多检查10次
        
        function performCheck() {
            checkCount++;
            
            if (typeof AV !== 'undefined') {
                // 检查LeanCloud是否已初始化
                if (window.leanCloudClient && window.leanCloudClient.isInitialized) {
                    updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
             
                    return;
                }
            }
            
            // 如果还没初始化且检查次数没超限，继续检查
            if (checkCount < maxChecks) {
                updateResourceStatus('leancloud', 'loading', 'LeanCloud 初始化中...');
                setTimeout(performCheck, 1000); // 每秒检查一次
            } else {
                // 超过最大检查次数，判断为连接失败
                if (typeof AV === 'undefined') {
                    updateResourceStatus('leancloud', 'error', 'LeanCloud SDK 未加载');
                } else {
                    updateResourceStatus('leancloud', 'error', 'LeanCloud 初始化失败');
                }

            }
        }
        
        // 立即开始第一次检查
        performCheck();
    }
    
    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initStatusPanel();
            setupResourceMonitoring();
            showStatusPanel();
            checkParticlesStatus();
            checkLeanCloudStatus(); // 添加LeanCloud状态检查
            
            // 5秒后自动隐藏状态面板（如果所有资源都正常）
            setTimeout(() => {
                const allSuccess = Object.keys(statusItems).every(key => {
                    const badge = statusItems[key].querySelector('.status-badge');
                    return badge && (badge.classList.contains('success') || badge.classList.contains('fallback'));
                });
                
                if (allSuccess) {
                    setTimeout(hideStatusPanel, 2000);
                }
            }, 5000);
        });
    } else {
        initStatusPanel();
        setupResourceMonitoring();
        showStatusPanel();
        checkParticlesStatus();
        checkLeanCloudStatus(); // 添加LeanCloud状态检查
    }
    
    // 导出到全局
    window.resourceStatusManager = {
        updateStatus: updateResourceStatus,
        showPanel: showStatusPanel,
        hidePanel: hideStatusPanel
    };
    
})();