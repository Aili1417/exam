/**
 * UserProgress API - 用户学习进度数据管理
 * 独立于用户表，支持动态科目
 */

class UserProgressAPI {
    constructor() {
        this.className = 'UserProgress';
        this.UserProgress = null;
        this.isInitialized = false;
    }

    /**
     * 初始化
     */
    init() {
        if (typeof AV === 'undefined') {

            return { success: false, message: 'LeanCloud SDK未加载' };
        }

        try {
            this.UserProgress = AV.Object.extend(this.className);
            this.isInitialized = true;

            return { success: true };
        } catch (error) {
 
            return { success: false, message: error.message };
        }
    }

    /**
     * 获取用户的学习进度记录
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 进度数据
     */
    async getUserProgress(userId) {
        try {
            if (!this.isInitialized) {
                throw new Error('UserProgressAPI未初始化');
            }

            const query = new AV.Query(this.UserProgress);
            query.equalTo('userId', userId);
            
            const record = await query.first();
            
            if (!record) {
                // 没有记录，返回空数据结构
                return {
                    success: true,
                    data: {
                        progressData: {},
                        wrongQuestions: {},
                        favorites: {},
                        userStats: {
                            correct: 0,
                            total: 0,
                            correctRate: 0
                        }
                    }
                };
            }

            return {
                success: true,
                data: {
                    objectId: record.id,
                    progressData: record.get('progressData') || {},
                    wrongQuestions: record.get('wrongQuestions') || {},
                    favorites: record.get('favorites') || {},
                    userStats: record.get('userStats') || {
                        correct: 0,
                        total: 0,
                        correctRate: 0
                    },
                    lastSyncTime: record.get('lastSyncTime') || null
                }
            };
        } catch (error) {

            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * 同步用户学习进度到云端
     * @param {string} userId - 用户ID
     * @param {Object} data - 要同步的数据
     * @returns {Promise<Object>}
     */
    async syncUserProgress(userId, data) {
        try {
            if (!this.isInitialized) {
                throw new Error('UserProgressAPI未初始化');
            }

          
            // 查询是否已有记录
            const query = new AV.Query(this.UserProgress);
            query.equalTo('userId', userId);
            let record = await query.first();

            if (!record) {
                // 创建新记录
                record = new this.UserProgress();
                record.set('userId', userId);
        
            } else {

            }

            // 合并数据而不是覆盖
            const existingProgressData = record.get('progressData') || {};
            const existingWrongQuestions = record.get('wrongQuestions') || {};
            const existingFavorites = record.get('favorites') || {};

            // 合并progressData
            if (data.progressData) {
                Object.keys(data.progressData).forEach(subject => {
                  
                    existingProgressData[subject] = {
                        ...(existingProgressData[subject] || {}),
                        ...data.progressData[subject]
                    };
                });
                record.set('progressData', existingProgressData);
            }

            // 合并wrongQuestions
            if (data.wrongQuestions) {
                Object.keys(data.wrongQuestions).forEach(subject => {
                    if (!existingWrongQuestions[subject]) {
                        existingWrongQuestions[subject] = {};
                    }
                    
                    Object.keys(data.wrongQuestions[subject]).forEach(type => {
                        if (!existingWrongQuestions[subject][type]) {
                            existingWrongQuestions[subject][type] = [];
                        }
                        
                        // 合并题目，避免重复
                        const localQuestions = data.wrongQuestions[subject][type] || [];
                        localQuestions.forEach(localQuestion => {
                            const existingIndex = existingWrongQuestions[subject][type].findIndex(
                                q => q.title === localQuestion.title
                            );
                            if (existingIndex >= 0) {
                                // 更新已存在的题目
                                existingWrongQuestions[subject][type][existingIndex] = localQuestion;
                            } else {
                                // 添加新题目
                                existingWrongQuestions[subject][type].push(localQuestion);
                            }
                        });
                    });
                });
                record.set('wrongQuestions', existingWrongQuestions);
            }

            // 合并favorites
            if (data.favorites) {
                Object.keys(data.favorites).forEach(subject => {
                 
                    if (!existingFavorites[subject]) {
                        existingFavorites[subject] = {};
                    }
                    
                    Object.keys(data.favorites[subject]).forEach(type => {
                        if (!existingFavorites[subject][type]) {
                            existingFavorites[subject][type] = [];
                        }
                        
                        // 合并题目，避免重复
                        const localQuestions = data.favorites[subject][type] || [];
                        localQuestions.forEach(localQuestion => {
                            const exists = existingFavorites[subject][type].some(
                                q => q.title === localQuestion.title
                            );
                            if (!exists) {
                                existingFavorites[subject][type].push(localQuestion);
                            }
                        });
                    });
                });
                record.set('favorites', existingFavorites);
            }

            // 更新userStats
            if (data.userStats) {
                record.set('userStats', data.userStats);
            }

            // 更新同步时间
            record.set('lastSyncTime', new Date());

    
            await record.save();


            return {
                success: true,
                message: '数据同步成功',
                data: {
                    objectId: record.id,
                    lastSyncTime: record.get('lastSyncTime')
                }
            };
        } catch (error) {
           
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * 从云端导入数据到本地
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>}
     */
    async importUserProgress(userId) {
        try {
            const result = await this.getUserProgress(userId);
            
            if (!result.success) {
                throw new Error(result.message);
            }

            return {
                success: true,
                message: '数据导入成功',
                data: result.data
            };
        } catch (error) {
  
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * 清除用户的所有学习数据
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>}
     */
    async clearUserProgress(userId) {
        try {
            if (!this.isInitialized) {
                throw new Error('UserProgressAPI未初始化');
            }

            const query = new AV.Query(this.UserProgress);
            query.equalTo('userId', userId);
            const record = await query.first();

            if (record) {
                await record.destroy();
            }

            return {
                success: true,
                message: '用户数据已清除'
            };
        } catch (error) {
        
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * 删除指定科目的数据
     * @param {string} userId - 用户ID
     * @param {string} subject - 科目名称
     * @returns {Promise<Object>}
     */
    async deleteSubjectData(userId, subject) {
        try {
            if (!this.isInitialized) {
                throw new Error('UserProgressAPI未初始化');
            }

            const query = new AV.Query(this.UserProgress);
            query.equalTo('userId', userId);
            const record = await query.first();

            if (!record) {
                return { success: true, message: '无数据需要删除' };
            }

            // 删除指定科目的数据
            const progressData = record.get('progressData') || {};
            const wrongQuestions = record.get('wrongQuestions') || {};
            const favorites = record.get('favorites') || {};

            delete progressData[subject];
            delete wrongQuestions[subject];
            delete favorites[subject];

            record.set('progressData', progressData);
            record.set('wrongQuestions', wrongQuestions);
            record.set('favorites', favorites);
            record.set('lastSyncTime', new Date());

            await record.save();

            return {
                success: true,
                message: `科目"${subject}"的数据已删除`
            };
        } catch (error) {

            return {
                success: false,
                message: error.message
            };
        }
    }
}

// 导出为全局变量
window.userProgressAPI = new UserProgressAPI();
