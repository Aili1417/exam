/**
 * 访问量统计功能
 * 每次页面访问时自动增加访问量计数
 */

class VisitStats {
    constructor() {
        this.isInitialized = false;
        this.VisitCounter = null;
        this.isUpdating = false;
    }

    /**
     * 初始化访问量统计
     */
    async init() {
        try {
            if (!window.LeanCloudConfig) {
                throw new Error('LeanCloud配置未找到');
            }

            // 等待LeanCloud初始化
            if (!window.AV) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (!window.AV) {
                throw new Error('LeanCloud SDK未加载');
            }

            // 初始化LeanCloud
            const { appId, appKey, serverURL } = window.LeanCloudConfig;
            if (!window.AV.applicationId) {
                window.AV.init({
                    appId: appId,
                    appKey: appKey,
                    serverURL: serverURL
                });
            }

            // 定义访问量计数器类
            this.VisitCounter = window.AV.Object.extend('VisitCounter');
            
            this.isInitialized = true;
            
            // 增加访问量
            await this.incrementVisitCount();
            
            return { success: true, message: '访问量统计初始化成功' };
        } catch (error) {
            console.error('访问量统计初始化失败:', error);
            return { success: false, message: `访问量统计初始化失败: ${error.message}` };
        }
    }

    /**
     * 增加访问量计数
     */
    async incrementVisitCount() {
        try {
            if (!this.isInitialized) {
                throw new Error('访问量统计未初始化');
            }

            if (this.isUpdating) {
                return { success: false, message: '正在更新中，跳过本次访问' };
            }

            this.isUpdating = true;

            // 查询现有的访问量记录
            const query = new window.AV.Query(this.VisitCounter);
            const results = await query.find();

            let visitCounter;
            
            if (results.length > 0) {
                // 如果已存在记录，更新访问量
                visitCounter = results[0];
                const currentCount = visitCounter.get('visitCount') || 0;
                visitCounter.set('visitCount', currentCount + 1);
            } else {
                // 如果不存在记录，创建新的访问量记录
                visitCounter = new this.VisitCounter();
                visitCounter.set('visitCount', 1);
                visitCounter.set('date', new Date());
            }

            // 保存到数据库
            await visitCounter.save();

            // 获取最新的访问量
            const latestQuery = new window.AV.Query(this.VisitCounter);
            const latestResults = await latestQuery.find();
            const visitCount = latestResults.length > 0 ? latestResults[0].get('visitCount') : 1;

            this.isUpdating = false;
            
            return { 
                success: true, 
                message: '访问量更新成功',
                visitCount: visitCount
            };
        } catch (error) {
            this.isUpdating = false;
            console.error('访问量更新失败:', error);
            return { success: false, message: `访问量更新失败: ${error.message}` };
        }
    }

    /**
     * 获取当前访问量
     */
    async getVisitCount() {
        try {
            if (!this.isInitialized) {
                throw new Error('访问量统计未初始化');
            }

            const query = new window.AV.Query(this.VisitCounter);
            const results = await query.find();

            if (results.length > 0) {
                const visitCount = results[0].get('visitCount') || 0;
                return { success: true, visitCount: visitCount };
            } else {
                return { success: true, visitCount: 0 };
            }
        } catch (error) {
            console.error('获取访问量失败:', error);
            return { success: false, message: `获取访问量失败: ${error.message}` };
        }
    }

    /**
     * 在页面中显示访问量
     */
    async displayVisitCount() {
        try {
            const result = await this.getVisitCount();
            if (result.success) {
                this.updateVisitDisplay(result.visitCount);
            }
        } catch (error) {
            console.error('显示访问量失败:', error);
        }
    }

    /**
     * 更新页面中的访问量显示
     */
    updateVisitDisplay(count) {
        // 创建或更新访问量显示元素
        let visitCountElement = document.getElementById('visit-count');
        if (!visitCountElement) {
            visitCountElement = document.createElement('div');
            visitCountElement.id = 'visit-count';
            visitCountElement.className = 'visit-count-display';
            visitCountElement.innerHTML = `
                <div class="visit-count-stats">
                    <i class="fas fa-eye"></i>
                    <span>网站访问量: <span id="visit-number">${count}次</span></span>
                </div>
            `;
            
            // 插入到指定位置：在包含"往上滑动开始练习"文字的p标签下面
            const allParagraphs = document.querySelectorAll('p');
            let welcomeText = null;
            
            for (let p of allParagraphs) {
                if (p.textContent.includes('往上滑动开始练习')) {
                    welcomeText = p;
                    break;
                }
            }
            
            if (welcomeText && welcomeText.parentNode) {
                welcomeText.parentNode.insertBefore(visitCountElement, welcomeText.nextSibling);
            } else {
                // 如果找不到指定位置，就插入到导航栏中
                const nav = document.querySelector('.nav');
                if (nav) {
                    nav.appendChild(visitCountElement);
                }
            }
        } else {
            // 更新访问量数字
            const visitNumber = visitCountElement.querySelector('#visit-number');
            if (visitNumber) {
                visitNumber.textContent = count;
            }
        }
    }
}

// 创建全局访问量统计实例
window.visitStats = new VisitStats();

// 页面加载完成后自动初始化访问量统计
document.addEventListener('DOMContentLoaded', async function() {
    // 等待一小段时间让其他初始化完成
    setTimeout(async () => {
        try {
            await window.visitStats.init();
            await window.visitStats.displayVisitCount();
        } catch (error) {
            console.error('访问量统计启动失败:', error);
        }
    }, 500);
});