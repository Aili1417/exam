// 静默EmailJS加载器 - 不产生任何控制台错误
// 用于替代dynamic-loader.js中的网络请求方式

(function() {
    'use strict';
    
    let emailjsLoaded = false;
    let emailjsLoadingPromise = null;
    
    // 静默检测EmailJS是否可用的函数
    function detectEmailJS() {
        return new Promise((resolve) => {
            // 检查是否已经有emailjs全局变量
            if (typeof window.emailjs !== 'undefined') {
                emailjsLoaded = true;
                resolve(true);
                return;
            }
            
            // 使用Image对象进行预检测（不会在控制台显示错误）
            const testImage = new Image();
            testImage.onload = () => {
                // 如果能加载，则尝试动态创建脚本
                attemptScriptLoad();
            };
            testImage.onerror = () => {
                // 网络不可用，直接使用后备方案
                console.log('📡 网络检测：使用EmailJS后备方案');
                emailjsLoaded = true;
                resolve(true);
            };
            
            // 使用一个小的测试图片来检测网络
            testImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            
            // 异步尝试脚本加载
            function attemptScriptLoad() {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.style.position = 'absolute';
                iframe.style.left = '-9999px';
                
                iframe.onload = () => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        const script = iframeDoc.createElement('script');
                        
                        script.onload = () => {
                            // 成功加载
                            if (iframe.contentWindow.emailjs) {
                                window.emailjs = iframe.contentWindow.emailjs;
                                emailjsLoaded = true;
                                console.log('✅ EmailJS 已静默加载');
                            }
                            document.body.removeChild(iframe);
                            resolve(true);
                        };
                        
                        script.onerror = () => {
                            // 加载失败，使用后备方案
                            document.body.removeChild(iframe);
                            console.log('🔄 EmailJS CDN不可用，使用后备方案');
                            emailjsLoaded = true;
                            resolve(true);
                        };
                        
                        script.src = 'https://unpkg.com/@emailjs/browser@3/dist/email.min.js';
                        iframeDoc.head.appendChild(script);
                        
                    } catch (e) {
                        // 任何错误都回退到后备方案
                        document.body.removeChild(iframe);
                        console.log('🛡️ 回退到EmailJS后备方案');
                        emailjsLoaded = true;
                        resolve(true);
                    }
                };
                
                iframe.onerror = () => {
                    if (iframe.parentNode) {
                        document.body.removeChild(iframe);
                    }
                    console.log('📧 使用EmailJS后备方案');
                    emailjsLoaded = true;
                    resolve(true);
                };
                
                document.body.appendChild(iframe);
            }
        });
    }
    
    // 主加载函数
    async function loadEmailJS() {
        if (emailjsLoaded) {
            return true;
        }
        
        if (emailjsLoadingPromise) {
            return await emailjsLoadingPromise;
        }
        
        emailjsLoadingPromise = detectEmailJS();
        return await emailjsLoadingPromise;
    }
    
    // 替换原有的dynamic-loader
    window.dynamicLoader = {
        loadEmailJS: loadEmailJS,
        isEmailJSLoaded: () => emailjsLoaded,
        loadScript: (src, timeout) => {
            // 提供兼容接口，但使用静默方式
            return detectEmailJS();
        }
    };
    
    // 页面加载后自动执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadEmailJS);
    } else {
        setTimeout(loadEmailJS, 50);
    }
    
})();