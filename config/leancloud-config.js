/**
 * LeanCloud 配置文件
 * 用于配置LeanCloud应用的连接参数
 */

// 开发环境配置
const DEV_CONFIG = {
    appId: 'uDleyTUN8JXyqt1nEzQhWyCP-gzGzoHsz',                    // 替换为你的AppId
    appKey: 'NNqP0meHQ1CpOsp8JHc22OXC',                  // 替换为你的AppKey  
    serverURL: 'https://udleytun.lc-cn-n1-shared.com'
};

// 生产环境配置
const PROD_CONFIG = {
    appId: 'uDleyTUN8JXyqt1nEzQhWyCP-gzGzoHsz',                    // 替换为你的AppId
    appKey: 'NNqP0meHQ1CpOsp8JHc22OXC',                  // 替换为你的AppKey  
    serverURL: 'https://udleytun.lc-cn-n1-shared.com'
};

// 根据环境选择配置
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('192.168');

const LEANCLOUD_CONFIG = isDevelopment ? DEV_CONFIG : PROD_CONFIG;

// 导出配置到全局
window.LeanCloudConfig = LEANCLOUD_CONFIG;

