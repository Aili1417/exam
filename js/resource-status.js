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
                mail: document.getElementById('mail-status'),
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
            const statusBar = statusPanel.closest('.status-bar');
            if (statusBar) {
                statusBar.classList.remove('has-resource-status');
            }
        }
    }

    // 监听资源加载事件
    function setupResourceMonitoring() {
        const originalConsoleLog = console.log;
        const originalConsoleWarn = console.warn;
        const originalConsoleError = console.error;

        console.log = function(...args) {
            const message = args.join(' ');

            // LeanCloud 相关日志
            if (message.includes('LeanCloud初始化成功')) {
                updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
            }

            // 系统初始化相关日志
            if (message.includes('系统初始化成功')) {
                setTimeout(() => {
                    if (window.leanCloudClient && window.leanCloudClient.isInitialized) {
                        updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
                    }
                }, 500);
            }

            originalConsoleLog.apply(console, args);
        };

        console.warn = function(...args) {
            originalConsoleWarn.apply(console, args);
        };

        console.error = function(...args) {
            const message = args.join(' ');

            if (message.includes('LeanCloud')) {
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

    // 检查邮件服务状态
    function checkMailStatus() {
        const mailURL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://localhost:3874/health'
            : 'https://mail.aili.site/health';

        fetch(mailURL)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ok') {
                    updateResourceStatus('mail', 'success', '邮件服务正常');
                } else {
                    updateResourceStatus('mail', 'error', '邮件服务异常');
                }
            })
            .catch(() => {
                updateResourceStatus('mail', 'error', '邮件服务连接失败');
            });
    }

    // 检查LeanCloud状态
    function checkLeanCloudStatus() {
        let checkCount = 0;
        const maxChecks = 10;

        function performCheck() {
            checkCount++;

            if (typeof AV !== 'undefined') {
                if (window.leanCloudClient && window.leanCloudClient.isInitialized) {
                    updateResourceStatus('leancloud', 'success', 'LeanCloud 连接正常');
                    return;
                }
            }

            if (checkCount < maxChecks) {
                updateResourceStatus('leancloud', 'loading', 'LeanCloud 初始化中...');
                setTimeout(performCheck, 1000);
            } else {
                if (typeof AV === 'undefined') {
                    updateResourceStatus('leancloud', 'error', 'LeanCloud SDK 未加载');
                } else {
                    updateResourceStatus('leancloud', 'error', 'LeanCloud 初始化失败');
                }
            }
        }

        performCheck();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initStatusPanel();
            setupResourceMonitoring();
            showStatusPanel();
            checkMailStatus();
            checkParticlesStatus();
            checkLeanCloudStatus();

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
        checkMailStatus();
        checkParticlesStatus();
        checkLeanCloudStatus();
    }

    // 导出到全局
    window.resourceStatusManager = {
        updateStatus: updateResourceStatus,
        showPanel: showStatusPanel,
        hidePanel: hideStatusPanel
    };

})();