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
        this.TOTAL_VISIT_RECORD_ID = '69774967d606e2613f1ce12c';
        this.VISIT_TIME_ZONE = 'Asia/Shanghai';
        this.VISIT_TIME_OFFSET = '+08:00';
    }

    /**
     * 获取指定时间在访问量统计时区中的日期字符串
     */
    formatDateInVisitTimeZone(date) {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.VISIT_TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(new Date(date));
        const year = parts.find(part => part.type === 'year')?.value;
        const month = parts.find(part => part.type === 'month')?.value;
        const day = parts.find(part => part.type === 'day')?.value;

        return `${year}-${month}-${day}`;
    }

    /**
     * 获取今天的日期字符串 (YYYY-MM-DD)
     */
    getTodayDate() {
        return this.formatDateInVisitTimeZone(new Date());
    }

    /**
     * 获取今天零点的日期对象（与小程序保持一致）
     */
    getTodayDateObject() {
        return new Date(`${this.getTodayDate()}T00:00:00${this.VISIT_TIME_OFFSET}`);
    }

    /**
     * 在结果集中查找今天的访问量记录，优先使用标准零点时间的记录
     */
    findTodayVisitRecord(records) {
        const today = new Date();
        const todayStartTime = this.getTodayDateObject().getTime();
        let fallbackRecord = null;

        for (const record of records) {
            if (record.id === this.TOTAL_VISIT_RECORD_ID) {
                continue;
            }

            const recordDate = record.get('date');
            if (!recordDate || !this.isSameDate(recordDate, today)) {
                continue;
            }

            if (new Date(recordDate).getTime() === todayStartTime) {
                return record;
            }

            if (!fallbackRecord) {
                fallbackRecord = record;
            }
        }

        return fallbackRecord;
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

            // 1. 更新总访问量记录（与小程序保持一致）
            const totalQuery = new window.AV.Query(this.VisitCounter);
            const totalRecord = await totalQuery.get(this.TOTAL_VISIT_RECORD_ID);
            const currentTotal = totalRecord.get('visitCount') || 0;
            const totalVisitCount = currentTotal + 1;
            const totalRecordUpdater = window.AV.Object.createWithoutData('VisitCounter', this.TOTAL_VISIT_RECORD_ID);
            totalRecordUpdater.set('visitCount', totalVisitCount);
            await totalRecordUpdater.save();

            // 2. 获取所有记录，按小程序相同逻辑找到今天的记录
            const query = new window.AV.Query(this.VisitCounter);
            query.limit(1000);
            const results = await query.find();

            const todayStart = this.getTodayDateObject();
            const todayRecord = this.findTodayVisitRecord(results);
            let todayVisitCount = 0;

            if (todayRecord) {
                // 今天已有记录，更新 +1，并把日期归一到小程序相同的零点时间
                todayVisitCount = (todayRecord.get('todayCount') || 0) + 1;
                todayRecord.set('date', todayStart);
                todayRecord.set('todayCount', todayVisitCount);
                await todayRecord.save();
            } else {
                // 如果今天没有记录，创建新的访问量记录
                const visitCounter = new this.VisitCounter();
                visitCounter.set('date', todayStart);
                visitCounter.set('todayCount', 1);
                await visitCounter.save();
                todayVisitCount = 1;
            }
            
            return { 
                success: true, 
                message: '访问量更新成功',
                totalVisitCount,
                todayVisitCount
            };
        } catch (error) {
            console.error('访问量更新失败:', error);
            return { success: false, message: `访问量更新失败: ${error.message}` };
        } finally {
            this.isUpdating = false;
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
            query.limit(1000);
            const results = await query.find();

            
            let totalVisitCount = 0;
            let todayVisitCount = 0;

            // 与小程序保持一致：
            // 1. 固定 objectId 的记录存总访问量 visitCount
            // 2. 每日记录存 todayCount + date
            for (const record of results) {
                if (record.id === this.TOTAL_VISIT_RECORD_ID) {
                    totalVisitCount = record.get('visitCount') || 0;
                    continue;
                }
            }

            const todayRecord = this.findTodayVisitRecord(results);
            if (todayRecord) {
                todayVisitCount = todayRecord.get('todayCount') || 0;
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
        return this.formatDateInVisitTimeZone(date1) === this.formatDateInVisitTimeZone(date2);
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
