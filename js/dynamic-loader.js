// 动态资源加载器
// 用于智能加载CDN资源，失败时自动使用后备方案

(function() {
    'use strict';
    
    // 防止重复加载的标记
    let emailjsLoadingPromise = null;
    let emailjsLoaded = false;
    
    // EmailJS CDN 资源列表（按优先级排序）
    const emailjsCDNs = [
        'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js',
        'https://unpkg.com/@emailjs/browser@3/dist/email.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/emailjs/3.2.0/email.min.js'
    ];
    
    // 静默加载脚本函数（不显示控制台错误）
    function loadScript(src, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            
            // 使用静默方式，不在控制台显示错误
            script.style.display = 'none';
            
            const timer = setTimeout(() => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                reject(new Error(`静默加载超时: ${src}`));
            }, timeout);
            
            script.onload = () => {
                clearTimeout(timer);
                resolve(script);
            };
            
            script.onerror = () => {
                clearTimeout(timer);
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                // 静默处理错误，不输出到控制台
                reject(new Error(`静默加载失败: ${src}`));
            };
            
            // 静默添加到头部
            try {
                document.head.appendChild(script);
            } catch (e) {
                clearTimeout(timer);
                reject(new Error(`无法添加脚本: ${src}`));
            }
        });
    }
    
    // 尝试加载 EmailJS
    async function loadEmailJS() {
        
        // 开始新的加载过程
        emailjsLoadingPromise = performEmailJSLoad();
        return await emailjsLoadingPromise;
    }
    
    async function performEmailJSLoad() {
        
        
        for (let i = 0; i < emailjsCDNs.length; i++) {
            const cdn = emailjsCDNs[i];
            try {
                
                await loadScript(cdn, 3000); // 3秒超时
                
                // 验证是否真正加载成功
                if (typeof emailjs !== 'undefined' && emailjs.init) {
                   
                    emailjsLoaded = true;
                    return true;
                }
            } catch (error) {
               
                continue;
            }
        }
        
        // 所有CDN都失败，检查后备方案
        if (typeof emailjs !== 'undefined') {
          
            emailjsLoaded = true;
            return true;
        }
        
        
        return false;
    }
    
    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadEmailJS);
    } else {
        // 延迟执行，等待其他脚本加载
        setTimeout(loadEmailJS, 100);
    }
    
    // 将加载器暴露到全局，供其他脚本使用
    window.dynamicLoader = {
        loadEmailJS: loadEmailJS,
        loadScript: loadScript,
        isEmailJSLoaded: () => emailjsLoaded
    };
    
})();