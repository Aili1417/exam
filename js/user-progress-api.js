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
                        },
                        examHistory: {},
                        examQuestionHistory: {},
                        practiceWrongQuestions: {},
                        currentSubject: null
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
                    examHistory: record.get('examHistory') || {},
                    examQuestionHistory: record.get('examQuestionHistory') || {},
                    practiceWrongQuestions: record.get('practiceWrongQuestions') || {},
                    currentSubject: record.get('currentSubject') || null,
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
         * 同步用户学习进度到云端（支持数据合并）
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
                }
    
                // 获取现有数据
                const existingProgressData = record.get('progressData') || {};
                const existingWrongQuestions = record.get('wrongQuestions') || {};
                const existingFavorites = record.get('favorites') || {};
                const existingUserStats = record.get('userStats') || { correct: 0, total: 0, correctRate: 0 };
                const existingExamHistory = record.get('examHistory') || {};
                const existingExamQuestionHistory = record.get('examQuestionHistory') || {};
                const existingPracticeWrongQuestions = record.get('practiceWrongQuestions') || {};
                const existingCurrentSubject = record.get('currentSubject') || null;
    
                // 合并progressData
                if (data.progressData) {
                    const mergedProgressData = this.mergeProgressData(existingProgressData, data.progressData);
                    record.set('progressData', mergedProgressData);
                }
    
                // 合并wrongQuestions
                if (data.wrongQuestions) {
                    const mergedWrongQuestions = this.mergeWrongQuestions(existingWrongQuestions, data.wrongQuestions);
                    record.set('wrongQuestions', mergedWrongQuestions);
                }
    
                // 合并favorites
                if (data.favorites) {
                    const mergedFavorites = this.mergeFavorites(existingFavorites, data.favorites);
                    record.set('favorites', mergedFavorites);
                }
    
                // 合并用户统计
                if (data.userStats) {
                    record.set('userStats', data.userStats);
                }
    
                // 合并考试历史数据（本地数据为准）
                if (data.examHistory) {
                    const mergedExamHistory = this.mergeExamHistoryWithLocalPriority(existingExamHistory, data.examHistory);
                    record.set('examHistory', mergedExamHistory);
                }
    
                // 合并考试题目历史数据（本地数据为准）
                if (data.examQuestionHistory) {
                    const mergedExamQuestionHistory = this.mergeExamQuestionHistoryWithLocalPriority(existingExamQuestionHistory, data.examQuestionHistory);
                    record.set('examQuestionHistory', mergedExamQuestionHistory);
                }
    
                // 合并练习错题本数据（本地数据为准）
                if (data.practiceWrongQuestions) {
                    const mergedPracticeWrongQuestions = this.mergePracticeWrongQuestionsWithLocalPriority(existingPracticeWrongQuestions, data.practiceWrongQuestions);
                    record.set('practiceWrongQuestions', mergedPracticeWrongQuestions);
                }
    
                // 当前科目设置（以本地为准，覆盖云端）
                if (data.currentSubject) {
                    record.set('currentSubject', data.currentSubject);
                }
    
                // 更新同步时间
                record.set('lastSyncTime', new Date());
                record.set('lastUpdated', new Date());
    
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

    /**
     * 合并进度数据
     */
    mergeProgressData(existingData, newData) {
        const merged = { ...existingData };
        
        Object.keys(newData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }
            
            Object.keys(newData[subject]).forEach(type => {
                if (!merged[subject][type]) {
                    merged[subject][type] = newData[subject][type];
                } else {
                    // 合并进度数据，优先使用最新的数据
                    const existing = merged[subject][type];
                    const incoming = newData[subject][type];
                    
                    merged[subject][type] = {
                        ...existing,
                        ...incoming,
                        // 如果有新答案，添加到数组中
                        userAnswers: [...(existing.userAnswers || []), ...(incoming.userAnswers || [])].filter((answer, index, self) => 
                            self.findIndex(a => a.questionId === answer.questionId) === index
                        ),
                        judgedAnswers: [...(existing.judgedAnswers || []), ...(incoming.judgedAnswers || [])].filter((answer, index, self) => 
                            self.findIndex(a => a.questionId === answer.questionId) === index
                        )
                    };
                }
            });
        });
        
        return merged;
    }

    /**
     * 合并错题本数据
     */
    mergeWrongQuestions(existingData, newData) {
        const merged = { ...existingData };
        
        Object.keys(newData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }
            
            Object.keys(newData[subject]).forEach(type => {
                if (!merged[subject][type]) {
                    merged[subject][type] = [];
                }
                
                // 合并题目，避免重复
                const existingQuestions = merged[subject][type];
                const newQuestions = newData[subject][type] || [];
                
                newQuestions.forEach(newQuestion => {
                    const exists = existingQuestions.some(q => q.title === newQuestion.title);
                    if (!exists) {
                        existingQuestions.push(newQuestion);
                    }
                });
            });
        });
        
        return merged;
    }

    /**
     * 合并收藏数据
     */
    mergeFavorites(existingData, newData) {
        const merged = { ...existingData };
        
        Object.keys(newData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }
            
            Object.keys(newData[subject]).forEach(type => {
                if (!merged[subject][type]) {
                    merged[subject][type] = [];
                }
                
                // 合并题目，避免重复
                const existingQuestions = merged[subject][type];
                const newQuestions = newData[subject][type] || [];
                
                newQuestions.forEach(newQuestion => {
                    const exists = existingQuestions.some(q => q.title === newQuestion.title);
                    if (!exists) {
                        existingQuestions.push(newQuestion);
                    }
                });
            });
        });
        
        return merged;
    }

    /**
     * 合并考试历史数据（本地数据为准）
     */
    mergeExamHistoryWithLocalPriority(existingData, newData) {
        const merged = {};
        
        // 首先处理本地数据
        Object.keys(newData).forEach(subject => {
            if (newData[subject] && Object.keys(newData[subject]).length > 0) {
                merged[subject] = newData[subject];
            }
        });
        
        // 然后处理云端独有的数据（仅当本地没有时）
        Object.keys(existingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = existingData[subject];
            }
        });
        
        return merged;
    }

    /**
     * 合并考试题目历史数据（本地数据为准）
     */
    mergeExamQuestionHistoryWithLocalPriority(existingData, newData) {
        const merged = {};
        
        // 首先处理本地数据
        Object.keys(newData).forEach(subject => {
            if (newData[subject] && Object.keys(newData[subject]).length > 0) {
                merged[subject] = {};
                
                Object.keys(newData[subject]).forEach(type => {
                    if (newData[subject][type] && Object.keys(newData[subject][type]).length > 0) {
                        merged[subject][type] = newData[subject][type];
                    }
                });
                
                // 如果该科目下没有任何题型数据，则不保留该科目
                if (Object.keys(merged[subject]).length === 0) {
                    delete merged[subject];
                }
            }
        });
        
        // 然后处理云端独有的数据（仅当本地没有时）
        Object.keys(existingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
                let hasValidType = false;
                
                Object.keys(existingData[subject]).forEach(type => {
                    if (existingData[subject][type] && Object.keys(existingData[subject][type]).length > 0) {
                        merged[subject][type] = existingData[subject][type];
                        hasValidType = true;
                    }
                });
                
                // 如果该科目下没有任何题型数据，则不保留该科目
                if (!hasValidType) {
                    delete merged[subject];
                }
            }
        });
        
        return merged;
    }

    /**
     * 合并练习错题本数据（本地数据为准）
     */
    mergePracticeWrongQuestionsWithLocalPriority(existingData, newData) {
        const merged = {};
        
        // 首先处理本地数据
        Object.keys(newData).forEach(subject => {
            if (newData[subject] && Object.keys(newData[subject]).length > 0) {
                merged[subject] = {};
                
                Object.keys(newData[subject]).forEach(type => {
                    if (newData[subject][type] && Object.keys(newData[subject][type]).length > 0) {
                        merged[subject][type] = newData[subject][type];
                    }
                });
                
                // 如果该科目下没有任何题型数据，则不保留该科目
                if (Object.keys(merged[subject]).length === 0) {
                    delete merged[subject];
                }
            }
        });
        
        // 然后处理云端独有的数据（仅当本地没有时）
        Object.keys(existingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
                let hasValidType = false;
                
                Object.keys(existingData[subject]).forEach(type => {
                    if (existingData[subject][type] && Object.keys(existingData[subject][type]).length > 0) {
                        merged[subject][type] = existingData[subject][type];
                        hasValidType = true;
                    }
                });
                
                // 如果该科目下没有任何题型数据，则不保留该科目
                if (!hasValidType) {
                    delete merged[subject];
                }
            }
        });
        
        return merged;
    }

    /**
     * 收集所有本地数据用于云同步
     */
    collectLocalDataForSync() {
        console.log('开始收集本地数据用于云同步...');
        
        const localData = {
            progressData: this.getProgressData(),
            wrongQuestions: this.getAllWrongQuestions(),
            favorites: this.getAllFavorites(),
            userStats: this.getUserStats(),
            examHistory: this.getExamHistory(),
            examQuestionHistory: this.getExamQuestionHistory(),
            practiceWrongQuestions: this.getPracticeWrongQuestions(),
            currentSubject: this.getCurrentSubject()
        };
        
        // 过滤掉空的科目数据
        localData.progressData = this.filterEmptySubjects(localData.progressData);
        localData.wrongQuestions = this.filterEmptySubjects(localData.wrongQuestions);
        localData.favorites = this.filterEmptySubjects(localData.favorites);
        localData.examHistory = this.filterEmptySubjects(localData.examHistory);
        localData.examQuestionHistory = this.filterEmptySubjects(localData.examQuestionHistory);
        localData.practiceWrongQuestions = this.filterEmptySubjects(localData.practiceWrongQuestions);
        
        console.log('收集到的本地数据（过滤后）:', localData);
        
        return localData;
    }

    /**
     * 过滤掉空的科目数据
     */
    filterEmptySubjects(data) {
        const filtered = {};
        
        Object.keys(data).forEach(subject => {
            if (data[subject] && Object.keys(data[subject]).length > 0) {
                filtered[subject] = data[subject];
            }
        });
        
        return filtered;
    }

    /**
     * 获取当前选择的科目
     */
    getCurrentSubject() {
        try {
            const savedSubject = localStorage.getItem('currentSubject');
            if (savedSubject) {
                try {
                    return JSON.parse(savedSubject);
                } catch (e) {
                    // 如果JSON解析失败，返回原始字符串（向后兼容）
                    return savedSubject;
                }
            }
            return null;
        } catch (error) {
            console.error('获取当前科目失败:', error);
            return null;
        }
    }

    /**
     * 获取考试历史数据
     */
    getExamHistory() {
        const examHistory = {};
        const examHistoryPrefix = 'exam_history_';
        
        // 扫描localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(examHistoryPrefix)) {
                const subject = key.substring(examHistoryPrefix.length);
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        examHistory[subject] = JSON.parse(data);
                    } catch (e) {
                        console.warn(`解析${subject}考试历史数据失败:`, e);
                        examHistory[subject] = {};
                    }
                }
            }
        }
        
        return examHistory;
    }

    /**
     * 获取考试题目历史数据
     */
    getExamQuestionHistory() {
        const examQuestionHistory = {};
        const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        const examQuestionHistoryPrefix = 'exam_question_history_';
        
        // 扫描localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(examQuestionHistoryPrefix)) {
                const suffix = key.substring(examQuestionHistoryPrefix.length);
                
                // 尝试匹配每个题型后缀
                for (const type of questionTypes) {
                    if (suffix.endsWith('_' + type)) {
                        const subject = suffix.substring(0, suffix.length - type.length - 1);
                        const data = localStorage.getItem(key);
                        
                        if (data) {
                            try {
                                if (!examQuestionHistory[subject]) {
                                    examQuestionHistory[subject] = {};
                                }
                                examQuestionHistory[subject][type] = JSON.parse(data);
                            } catch (e) {
                                console.warn(`解析${subject}_${type}考试题目历史数据失败:`, e);
                                if (!examQuestionHistory[subject]) {
                                    examQuestionHistory[subject] = {};
                                }
                                examQuestionHistory[subject][type] = {};
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        return examQuestionHistory;
    }

    /**
     * 获取练习错题本数据
     */
    getPracticeWrongQuestions() {
        const practiceWrongQuestions = {};
        const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        const practiceWrongPrefix = 'practice_wrong_';
        
        // 扫描localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(practiceWrongPrefix)) {
                const suffix = key.substring(practiceWrongPrefix.length);
                
                // 尝试匹配每个题型后缀
                for (const type of questionTypes) {
                    if (suffix.endsWith('_' + type)) {
                        const subject = suffix.substring(0, suffix.length - type.length - 1);
                        const data = localStorage.getItem(key);
                        
                        if (data) {
                            try {
                                if (!practiceWrongQuestions[subject]) {
                                    practiceWrongQuestions[subject] = {};
                                }
                                practiceWrongQuestions[subject][type] = JSON.parse(data);
                            } catch (e) {
                                console.warn(`解析${subject}_${type}练习错题数据失败:`, e);
                                if (!practiceWrongQuestions[subject]) {
                                    practiceWrongQuestions[subject] = {};
                                }
                                practiceWrongQuestions[subject][type] = {};
                            }
                        }
                        break;
                    }
                }
            }
        }
        
        return practiceWrongQuestions;
    }

    /**
     * 获取所有科目的进度数据（扫描本地存储）
     */
    getProgressData() {
        const progressData = {};
        const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        
        try {
            // 扫描localStorage，找出所有科目的进度数据
            const subjects = new Set();
            
            // 遍历localStorage，提取所有科目名称
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('exam_progress_')) {
                    const suffix = key.substring('exam_progress_'.length);
                    
                    // 尝试匹配每个题型后缀
                    for (const type of questionTypes) {
                        if (suffix.endsWith('_' + type)) {
                            // 提取科目名（去掉题型后缀）
                            const subject = suffix.substring(0, suffix.length - type.length - 1);
                            subjects.add(subject);
                            break;
                        }
                    }
                }
            }
            
            // 为每个科目读取进度数据
            subjects.forEach(subject => {
                if (!progressData[subject]) {
                    progressData[subject] = {};
                }
                
                questionTypes.forEach(type => {
                    const key = `exam_progress_${subject}_${type}`;
                    const progress = localStorage.getItem(key);
                    if (progress) {
                        try {
                            progressData[subject][type] = JSON.parse(progress);
                        } catch (e) {
                            console.warn(`解析${subject}_${type}进度数据失败:`, e);
                            progressData[subject][type] = {
                                currentIndex: 0,
                                userAnswers: [],
                                judgedAnswers: [],
                                detailedProgress: [],
                                timestamp: Date.now()
                            };
                        }
                    } else {
                        progressData[subject][type] = {
                            currentIndex: 0,
                            userAnswers: [],
                            judgedAnswers: [],
                            detailedProgress: [],
                            timestamp: Date.now()
                        };
                    }
                });
            });
        } catch (error) {
            console.error('获取进度数据失败:', error);
        }
        
        return progressData;
    }

    /**
     * 获取所有科目的错题本（扫描localStorage）
     */
    getAllWrongQuestions() {
        const allWrongQuestions = {};
        const wrongPrefix = 'exam_wrong_questions_';
        
        try {
            // 扫描localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(wrongPrefix)) {
                    const subject = key.substring(wrongPrefix.length);
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            allWrongQuestions[subject] = JSON.parse(data);
                        } catch (e) {
                            console.warn(`解析${subject}错题数据失败:`, e);
                            allWrongQuestions[subject] = {};
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取错题本数据失败:', error);
        }
        
        return allWrongQuestions;
    }

    /**
     * 获取所有科目的收藏（扫描localStorage）
     */
    getAllFavorites() {
        const allFavorites = {};
        const favPrefix = 'exam_favorites_';
        
        try {
            // 扫描localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(favPrefix)) {
                    const subject = key.substring(favPrefix.length);
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            allFavorites[subject] = JSON.parse(data);
                        } catch (e) {
                            console.warn(`解析${subject}收藏数据失败:`, e);
                            allFavorites[subject] = {};
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取收藏数据失败:', error);
        }
        
        return allFavorites;
    }

    /**
     * 获取用户统计信息
     */
    getUserStats() {
        try {
            const userStats = localStorage.getItem('exam_user_stats');
            return userStats ? JSON.parse(userStats) : {
                correct: 0,
                total: 0,
                correctRate: 0
            };
        } catch (error) {
            console.error('获取用户统计失败:', error);
            return {
                correct: 0,
                total: 0,
                correctRate: 0
            };
        }
    }

    /**
     * 获取考试历史数据
     */
    getExamHistory() {
        const examHistory = {};
        const historyPrefix = 'exam_history_';
        
        try {
            // 扫描localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(historyPrefix)) {
                    const subject = key.substring(historyPrefix.length);
                    const data = localStorage.getItem(key);
                    if (data) {
                        try {
                            examHistory[subject] = JSON.parse(data);
                        } catch (e) {
                            console.warn(`解析${subject}考试历史数据失败:`, e);
                            examHistory[subject] = {};
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取考试历史数据失败:', error);
        }
        
        return examHistory;
    }

    /**
     * 获取考试题目历史数据
     */
    getExamQuestionHistory() {
        const examQuestionHistory = {};
        const historyPrefix = 'exam_question_history_';
        const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        
        try {
            // 扫描localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(historyPrefix)) {
                    const suffix = key.substring(historyPrefix.length);
                    
                    // 尝试匹配每个题型后缀
                    for (const type of questionTypes) {
                        if (suffix.endsWith('_' + type)) {
                            // 提取科目名（去掉题型后缀）
                            const subject = suffix.substring(0, suffix.length - type.length - 1);
                            
                            if (!examQuestionHistory[subject]) {
                                examQuestionHistory[subject] = {};
                            }
                            
                            const data = localStorage.getItem(key);
                            if (data) {
                                try {
                                    examQuestionHistory[subject][type] = JSON.parse(data);
                                } catch (e) {
                                    console.warn(`解析${subject}_${type}考试题目历史数据失败:`, e);
                                    examQuestionHistory[subject][type] = {};
                                }
                            }
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取考试题目历史数据失败:', error);
        }
        
        return examQuestionHistory;
    }

    /**
     * 获取练习错题本数据
     */
    getPracticeWrongQuestions() {
        const practiceWrongQuestions = {};
        const prefix = 'practice_wrong_';
        const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
        
        try {
            // 扫描localStorage
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const suffix = key.substring(prefix.length);
                    
                    // 尝试匹配每个题型后缀
                    for (const type of questionTypes) {
                        if (suffix.endsWith('_' + type)) {
                            // 提取科目名（去掉题型后缀）
                            const subject = suffix.substring(0, suffix.length - type.length - 1);
                            
                            if (!practiceWrongQuestions[subject]) {
                                practiceWrongQuestions[subject] = {};
                            }
                            
                            const data = localStorage.getItem(key);
                            if (data) {
                                try {
                                    practiceWrongQuestions[subject][type] = JSON.parse(data);
                                } catch (e) {
                                    console.warn(`解析${subject}_${type}练习错题数据失败:`, e);
                                    practiceWrongQuestions[subject][type] = [];
                                }
                            }
                            break;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('获取练习错题本数据失败:', error);
        }
        
        return practiceWrongQuestions;
    }

    /**
     * 检查本地数据是否有变化需要同步
     */
    checkLocalDataForSync() {
        try {
            const localData = this.collectLocalDataForSync();
            const hasCurrentSubject = localData.currentSubject && 
                                   (typeof localData.currentSubject === 'object' || 
                                    (typeof localData.currentSubject === 'string' && localData.currentSubject.length > 0));
            
            const hasData = hasCurrentSubject ||
                           Object.keys(localData.progressData).length > 0 ||
                           Object.keys(localData.wrongQuestions).length > 0 ||
                           Object.keys(localData.favorites).length > 0 ||
                           Object.keys(localData.examHistory).length > 0 ||
                           Object.keys(localData.examQuestionHistory).length > 0 ||
                           Object.keys(localData.practiceWrongQuestions).length > 0;
            
            return {
                hasData: hasData,
                details: {
                    hasCurrentSubject: hasCurrentSubject,
                    hasProgressData: Object.keys(localData.progressData).length > 0,
                    hasWrongQuestions: Object.keys(localData.wrongQuestions).length > 0,
                    hasFavorites: Object.keys(localData.favorites).length > 0,
                    hasExamHistory: Object.keys(localData.examHistory).length > 0,
                    hasExamQuestionHistory: Object.keys(localData.examQuestionHistory).length > 0,
                    hasPracticeWrongQuestions: Object.keys(localData.practiceWrongQuestions).length > 0
                }
            };
        } catch (error) {
            console.error('检查本地数据同步失败:', error);
            return { hasData: false, details: {} };
        }
    }
}

// 导出为全局变量
window.userProgressAPI = new UserProgressAPI();
