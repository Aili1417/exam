/**
 * 访问量统计功能
 * 每次页面访问时自动增加访问量计数
 * 支持今日访问量和总访问量统计
 */

class VisitStats {
    constructor() {
        this.isInitialized = false;
        this.VisitCounter = null;
        this.isUpdating = false;
        this.today = this.getTodayDate();
    }

    /**
     * 获取今天的日期字符串 (YYYY-MM-DD)
     */
    getTodayDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 获取今天的日期对象 (本地时间)
     */
    getTodayDateObject() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
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

            // 查询今天是否已有访问量记录
            const todayQuery = new window.AV.Query(this.VisitCounter);
            const startOfToday = this.getTodayDateObject();
            const endOfToday = new Date(startOfToday);
            endOfToday.setDate(endOfToday.getDate() + 1);
            
            todayQuery.greaterThanOrEqualTo('date', startOfToday);
            todayQuery.lessThan('date', endOfToday);
            
            const todayResults = await todayQuery.find();
            
            let visitCounter;
            
            if (todayResults.length > 0) {
                // 如果今天已有记录，更新今日访问量
                visitCounter = todayResults[0];
                
                // 兼容新旧数据结构
                const currentTodayCount = visitCounter.get('todayCount') || visitCounter.get('visitCount') || 0;
                const newTodayCount = currentTodayCount + 1;
                
                // 更新数据（使用todayCount字段，确保数据结构一致性）
                visitCounter.set('todayCount', newTodayCount);
                
                // 如果原来使用的是visitCount字段，清除它避免混淆
                if (visitCounter.has('visitCount') && !visitCounter.has('todayCount')) {
                    visitCounter.unset('visitCount');
                }
            } else {
                // 如果今天没有记录，创建新的访问量记录
                visitCounter = new this.VisitCounter();
                visitCounter.set('date', this.getTodayDateObject());
                visitCounter.set('todayCount', 1);
            }

            // 保存到数据库
            await visitCounter.save();

            // 获取最新的统计数据
            const stats = await this.getVisitStats();
            
            this.isUpdating = false;
            
            return { 
                success: true, 
                message: '访问量更新成功',
                stats: stats
            };
        } catch (error) {
            this.isUpdating = false;
            console.error('访问量更新失败:', error);
            return { success: false, message: `访问量更新失败: ${error.message}` };
        }
    }

    /**
     * 获取访问量统计（今日和总访问量）
     */
    async getVisitStats() {
        try {
            if (!this.isInitialized) {
                throw new Error('访问量统计未初始化');
            }

            // 获取所有访问量记录
            const query = new window.AV.Query(this.VisitCounter);
            const results = await query.find();

            
            let totalVisitCount = 0;
            let todayVisitCount = 0;
            
            // 计算总访问量和今日访问量
            for (const record of results) {
                const recordDate = record.get('date');
                
                // 兼容新旧数据结构：优先使用todayCount，如果没有则使用visitCount
                const todayCount = record.get('todayCount') || record.get('visitCount') || 0;
                
                // 计算总访问量
                totalVisitCount += todayCount;
                
                // 检查是否是今天的记录
                if (recordDate && this.isSameDate(recordDate, new Date())) {
                    todayVisitCount = todayCount;
                }
            }

            // 如果没有今天的记录，尝试从总的visitCount中获取（向后兼容）
            if (todayVisitCount === 0 && results.length > 0) {
                // 检查是否有包含今天日期的记录，如果没有则说明是第一天
                let hasTodayRecord = false;
                for (const record of results) {
                    const recordDate = record.get('date');
                    if (recordDate && this.isSameDate(recordDate, new Date())) {
                        hasTodayRecord = true;
                        break;
                    }
                }
                
                if (!hasTodayRecord) {
                    // 今天是第一次访问
                    todayVisitCount = 1;
                }
            }

           

            return { 
                success: true, 
                totalVisitCount: totalVisitCount,
                todayVisitCount: todayVisitCount
            };
        } catch (error) {
            console.error('获取访问量统计失败:', error);
            return { success: false, message: `获取访问量统计失败: ${error.message}` };
        }
    }

    /**
     * 检查两个日期是否是同一天
     */
    isSameDate(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    /**
     * 获取当前总访问量（向后兼容）
     */
    async getVisitCount() {
        const stats = await this.getVisitStats();
        if (stats.success) {
            return {
                success: true,
                visitCount: stats.totalVisitCount
            };
        }
        return stats;
    }

    /**
     * 在页面中显示访问量
     */
    async displayVisitCount() {
        try {
            const result = await this.getVisitStats();
            if (result.success) {
                this.updateVisitDisplay(result.totalVisitCount, result.todayVisitCount);
            }
        } catch (error) {
            console.error('显示访问量失败:', error);
        }
    }

    /**
     * 更新页面中的访问量显示
     */
    updateVisitDisplay(totalCount, todayCount) {
        // 创建或更新访问量显示元素
        let visitCountElement = document.getElementById('visit-count');
        if (!visitCountElement) {
            visitCountElement = document.createElement('div');
            visitCountElement.id = 'visit-count';
            visitCountElement.className = 'visit-count-display';
            visitCountElement.innerHTML = `
               <div class="visit-count-stats">
                    <i class="fas fa-eye"></i>
                    <div class="visit-count-content">
            
                        <div class="visit-count-item">
                            <span>总访问量: <span id="total-visit-number">${totalCount}次</span></span>
                        </div>
                    </div>
                </div>
                <div class="visit-count-stats">
                    <i class="fas fa-eye"></i>
                    <div class="visit-count-content">
                        <div class="visit-count-item">
                            <span>今日访问量: <span id="today-visit-number">${todayCount}次</span></span>
                        </div>
                       
                    </div>
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
            const todayVisitNumber = visitCountElement.querySelector('#today-visit-number');
            const totalVisitNumber = visitCountElement.querySelector('#total-visit-number');
            
            if (todayVisitNumber) {
                todayVisitNumber.textContent = todayCount;
            }
            if (totalVisitNumber) {
                totalVisitNumber.textContent = totalCount;
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