/**
 * 科目管理API（前端版）
 * 前端只需要获取启用的科目列表
 */

class SubjectAPI {
    constructor() {
        this.initialized = false;
        this.Subject = null;
        this.cachedSubjects = null;
        this.cacheTimestamp = 0;
        this.cacheDuration = 5 * 60 * 1000; // 5分钟缓存
    }

    /**
     * 初始化 LeanCloud
     */
    async init() {
        try {
            if (typeof AV === 'undefined') {
                throw new Error('LeanCloud SDK未加载');
            }

            // 前端配置
            const config = window.LeanCloudConfig;
            if (!config) {
                throw new Error('LeanCloud配置未找到');
            }

            // 如果已经初始化过AV，则不需要重复初始化
            if (!this.Subject) {
                const { appId, appKey, serverURL } = config;
                
                // 检查AV是否已经初始化
                if (!AV._config.applicationId) {
                    AV.init({
                        appId: appId,
                        appKey: appKey,
                        serverURL: serverURL
                    });
                }

                this.Subject = AV.Object.extend('Subject');
            }

            this.initialized = true;
            return { success: true };
        } catch (error) {
         
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取所有启用的科目（前端使用）
     */
    async getEnabledSubjects() {
        try {
            if (!this.initialized) {
                await this.init();
            }

            // 检查缓存
            const now = Date.now();
            if (this.cachedSubjects && (now - this.cacheTimestamp) < this.cacheDuration) {
                return { 
                    success: true, 
                    data: this.cachedSubjects.filter(s => s.isEnabled) 
                };
            }

            const query = new AV.Query(this.Subject);
            query.equalTo('isEnabled', true);
            query.ascending('order');
            
            const results = await query.find();
            
            const subjects = results.map(result => ({
                id: result.id,
                name: result.get('name'),
                displayName: result.get('displayName'),
                icon: result.get('icon'),
                isEnabled: result.get('isEnabled'),
                isDefault: result.get('isDefault'),
                order: result.get('order'),
                questionCollection: result.get('questionCollection'),
                description: result.get('description'),
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            }));

            // 如果数据库为空，返回默认科目
            if (subjects.length === 0) {
                return { 
                    success: true, 
                    data: this.getDefaultSubjects() 
                };
            }

            // 更新缓存
            this.cachedSubjects = subjects;
            this.cacheTimestamp = now;

            return { success: true, data: subjects };
        } catch (error) {
        
            
            // 降级方案：返回默认科目
            return { 
                success: true, 
                data: this.getDefaultSubjects(),
                warning: '使用默认科目，请检查数据库连接'
            };
        }
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cachedSubjects = null;
        this.cacheTimestamp = 0;
    }

    /**
     * 获取默认科目（降级方案）
     */
    getDefaultSubjects() {
        return [
            {
                name: '毛概',
                displayName: '毛泽东思想和中国特色社会主义理论体系概论',
                icon: '🏛️',
                isEnabled: true,
                isDefault: true,
                order: 1,
                questionCollection: 'Question_MaoGai',
                description: ''
            },
            {
                name: '思修',
                displayName: '思想道德修养与法律基础',
                icon: '💭',
                isEnabled: true,
                isDefault: true,
                order: 2,
                questionCollection: 'Question_SiXiu',
                description: ''
            },
            {
                name: '近代史',
                displayName: '中国近现代史纲要',
                icon: '📜',
                isEnabled: true,
                isDefault: true,
                order: 3,
                questionCollection: 'Question_JinDaiShi',
                description: ''
            },
            {
                name: '马原',
                displayName: '马克思主义基本原理',
                icon: '⚡',
                isEnabled: true,
                isDefault: true,
                order: 4,
                questionCollection: 'Question_MaYuan',
                description: ''
            }
        ];
    }
}

// 创建全局实例
window.subjectAPI = new SubjectAPI();
