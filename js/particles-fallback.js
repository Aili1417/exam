// particles.js 后备方案
// 如果CDN加载失败，提供一个简化版本
if (typeof particlesJS === 'undefined') {
   
    
    window.particlesJS = function(elementId, config) {
 
        
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // 创建简单的动画背景
        element.style.background = 'linear-gradient(45deg, #1e3c72 0%, #2a5298 100%)';
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        
        // 添加简单的动画点
        for (let i = 0; i < 20; i++) {
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.width = '3px';
            dot.style.height = '3px';
            dot.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            dot.style.borderRadius = '50%';
            dot.style.left = Math.random() * 100 + '%';
            dot.style.top = Math.random() * 100 + '%';
            dot.style.animation = `float ${3 + Math.random() * 4}s ease-in-out infinite`;
            element.appendChild(dot);
        }
        
        // 添加动画CSS
        if (!document.getElementById('particles-animation')) {
            const style = document.createElement('style');
            style.id = 'particles-animation';
            style.textContent = `
                @keyframes float {
                    0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
                    50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
                }
            `;
            document.head.appendChild(style);
        }
    };
}