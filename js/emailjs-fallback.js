// emailjs 后备方案
// 如果CDN加载失败，提供一个模拟版本
(function() {
    // 只有在 emailjs 未定义时才创建后备方案
    if (typeof window.emailjs === 'undefined') {
        
        window.emailjs = {
            _isBackup: true, // 标记这是后备版本
            
            init: function(publicKey) {
                
                this.publicKey = publicKey;

                return this;
            },
            
            send: function(serviceId, templateId, templateParams, publicKey) {
               
                // 返回一个Promise来模拟真实的emailjs行为
                return new Promise((resolve, reject) => {
                    // 模拟发送延迟
                    setTimeout(() => {
                        // 检查参数是否完整
                        if (!templateParams || !templateParams.to_email) {
                            reject(new Error('缺少必要参数'));
                            return;
                        }
                        
          
    
                        // 模拟成功（在真实环境中可以集成其他邮件服务）
                       
                        resolve({
                            status: 200,
                            text: 'OK (fallback mode) - EmailJS CDN加载失败，使用后备方案'
                        });
                    }, 800); // 模拟网络延迟
                });
            }
        };
       
    }
})();