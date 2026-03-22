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
                    progressData: this.normalizeProgressCollection(record.get('progressData') || {}),
                    wrongQuestions: this.normalizeQuestionCollection(record.get('wrongQuestions') || {}),
                    favorites: this.normalizeQuestionCollection(record.get('favorites') || {}),
                    userStats: record.get('userStats') || {
                        correct: 0,
                        total: 0,
                        correctRate: 0
                    },
                    examHistory: record.get('examHistory') || {},
                    examQuestionHistory: record.get('examQuestionHistory') || {},
                    practiceWrongQuestions: this.normalizeQuestionCollection(record.get('practiceWrongQuestions') || {}),
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
                const existingProgressData = this.normalizeProgressCollection(record.get('progressData') || {});
                const existingWrongQuestions = this.normalizeQuestionCollection(record.get('wrongQuestions') || {});
                const existingFavorites = this.normalizeQuestionCollection(record.get('favorites') || {});
                const existingUserStats = record.get('userStats') || { correct: 0, total: 0, correctRate: 0 };
                const existingExamHistory = record.get('examHistory') || {};
                const existingExamQuestionHistory = record.get('examQuestionHistory') || {};
                const existingPracticeWrongQuestions = this.normalizeQuestionCollection(record.get('practiceWrongQuestions') || {});
                const existingCurrentSubject = record.get('currentSubject') || null;

                const incomingProgressData = this.normalizeProgressCollection(data.progressData || {});
                const incomingWrongQuestions = this.normalizeQuestionCollection(data.wrongQuestions || {});
                const incomingFavorites = this.normalizeQuestionCollection(data.favorites || {});
                const incomingPracticeWrongQuestions = this.normalizeQuestionCollection(data.practiceWrongQuestions || {});
    
                // 合并progressData
                if (data.progressData) {
                    const mergedProgressData = this.mergeProgressData(existingProgressData, incomingProgressData);
                    record.set('progressData', mergedProgressData);
                }
    
                // 合并wrongQuestions
                if (data.wrongQuestions) {
                    const mergedWrongQuestions = this.mergeWrongQuestions(existingWrongQuestions, incomingWrongQuestions);
                    record.set('wrongQuestions', mergedWrongQuestions);
                }
    
                // 合并favorites
                if (data.favorites) {
                    const mergedFavorites = this.mergeFavorites(existingFavorites, incomingFavorites);
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
                    const mergedPracticeWrongQuestions = this.mergePracticeWrongQuestionsWithLocalPriority(existingPracticeWrongQuestions, incomingPracticeWrongQuestions);
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
     * 判断是否为普通对象
     */
    isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    /**
     * 生成题目或题目状态的唯一标识
     */
    getQuestionIdentity(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        if (item.questionId !== undefined && item.questionId !== null && item.questionId !== '') {
            return `questionId:${item.questionId}`;
        }

        if (item.id !== undefined && item.id !== null && item.id !== '') {
            return `id:${item.id}`;
        }

        if (item.question && typeof item.question === 'object') {
            if (item.question.id !== undefined && item.question.id !== null && item.question.id !== '') {
                return `question.id:${item.question.id}`;
            }

            if (typeof item.question.title === 'string' && item.question.title.trim()) {
                return `question.title:${item.question.title.trim()}`;
            }
        }

        if (typeof item.title === 'string' && item.title.trim()) {
            return `title:${item.title.trim()}`;
        }

        return null;
    }

    /**
     * 判断答案是否为有效值
     */
    isMeaningfulAnswer(value) {
        if (value === null || value === undefined) {
            return false;
        }

        if (typeof value === 'string') {
            return value.trim().length > 0;
        }

        if (Array.isArray(value)) {
            return value.length > 0;
        }

        return true;
    }

    /**
     * 规范化单条进度记录
     */
    normalizeProgressEntry(progress) {
        const source = this.isPlainObject(progress) ? progress : {};
        const normalized = {
            ...source,
            currentIndex: Number.isInteger(source.currentIndex) && source.currentIndex >= 0 ? source.currentIndex : 0,
            userAnswers: Array.isArray(source.userAnswers) ? [...source.userAnswers] : [],
            judgedAnswers: Array.isArray(source.judgedAnswers) ? [...source.judgedAnswers] : [],
            detailedProgress: Array.isArray(source.detailedProgress) ? [...source.detailedProgress] : [],
            timestamp: typeof source.timestamp === 'number' && Number.isFinite(source.timestamp) ? source.timestamp : 0
        };

        if (typeof source.maxAllowedIndex === 'number' && Number.isFinite(source.maxAllowedIndex)) {
            normalized.maxAllowedIndex = source.maxAllowedIndex;
        } else {
            delete normalized.maxAllowedIndex;
        }

        return normalized;
    }

    /**
     * 规范化进度集合
     */
    normalizeProgressCollection(data) {
        const normalized = {};

        if (!this.isPlainObject(data)) {
            return normalized;
        }

        Object.keys(data).forEach(subject => {
            if (!this.isPlainObject(data[subject])) {
                return;
            }

            const subjectProgress = {};
            Object.keys(data[subject]).forEach(type => {
                subjectProgress[type] = this.normalizeProgressEntry(data[subject][type]);
            });

            if (Object.keys(subjectProgress).length > 0) {
                normalized[subject] = subjectProgress;
            }
        });

        return normalized;
    }

    /**
     * 规范化题目列表集合，过滤空值和异常项
     */
    normalizeQuestionCollection(data) {
        const normalized = {};

        if (!this.isPlainObject(data)) {
            return normalized;
        }

        Object.keys(data).forEach(subject => {
            if (!this.isPlainObject(data[subject])) {
                return;
            }

            const subjectQuestions = {};
            Object.keys(data[subject]).forEach(type => {
                const list = Array.isArray(data[subject][type]) ? data[subject][type] : [];
                const validQuestions = list.filter(question => Boolean(this.getQuestionIdentity(question)));

                if (validQuestions.length > 0) {
                    subjectQuestions[type] = validQuestions;
                }
            });

            if (Object.keys(subjectQuestions).length > 0) {
                normalized[subject] = subjectQuestions;
            }
        });

        return normalized;
    }

    /**
     * 按索引合并数组
     */
    mergeIndexedArray(existingArray, incomingArray, chooser) {
        const maxLength = Math.max(existingArray.length, incomingArray.length);
        const merged = [];

        for (let i = 0; i < maxLength; i++) {
            merged[i] = chooser(existingArray[i], incomingArray[i], i);
        }

        return merged;
    }

    /**
     * 按题目标识合并对象数组
     */
    mergeKeyedItems(existingItems, incomingItems) {
        const merged = [];
        const indexMap = new Map();

        const append = (item, shouldReplace) => {
            const identity = this.getQuestionIdentity(item);
            if (!identity) {
                return;
            }

            if (!indexMap.has(identity)) {
                indexMap.set(identity, merged.length);
                merged.push(item);
                return;
            }

            if (shouldReplace) {
                merged[indexMap.get(identity)] = item;
            }
        };

        existingItems.forEach(item => append(item, false));
        incomingItems.forEach(item => append(item, true));

        return merged;
    }

    /**
     * 合并答案数组，兼容按索引和按题目对象两种结构
     */
    mergeAnswerArrays(existingAnswers, incomingAnswers, preferIncoming) {
        const existingArray = Array.isArray(existingAnswers) ? existingAnswers : [];
        const incomingArray = Array.isArray(incomingAnswers) ? incomingAnswers : [];
        const hasKeyedItems =
            existingArray.some(item => Boolean(this.getQuestionIdentity(item))) ||
            incomingArray.some(item => Boolean(this.getQuestionIdentity(item)));

        if (hasKeyedItems) {
            return this.mergeKeyedItems(existingArray, incomingArray);
        }

        return this.mergeIndexedArray(existingArray, incomingArray, (existingValue, incomingValue) => {
            const existingHasValue = this.isMeaningfulAnswer(existingValue);
            const incomingHasValue = this.isMeaningfulAnswer(incomingValue);

            if (!existingHasValue && !incomingHasValue) {
                if (incomingValue !== undefined) {
                    return incomingValue;
                }

                if (existingValue !== undefined) {
                    return existingValue;
                }

                return null;
            }

            if (!existingHasValue) {
                return incomingValue;
            }

            if (!incomingHasValue) {
                return existingValue;
            }

            return preferIncoming ? incomingValue : existingValue;
        });
    }

    /**
     * 合并判题状态数组
     */
    mergeJudgedArrays(existingJudged, incomingJudged) {
        const existingArray = Array.isArray(existingJudged) ? existingJudged : [];
        const incomingArray = Array.isArray(incomingJudged) ? incomingJudged : [];

        return this.mergeIndexedArray(existingArray, incomingArray, (existingValue, incomingValue) => {
            if (existingValue === undefined && incomingValue === undefined) {
                return false;
            }

            return Boolean(existingValue) || Boolean(incomingValue);
        });
    }

    /**
     * 合并详细进度
     */
    mergeDetailedProgress(existingDetails, incomingDetails, preferIncoming) {
        const existingArray = Array.isArray(existingDetails) ? existingDetails : [];
        const incomingArray = Array.isArray(incomingDetails) ? incomingDetails : [];
        const hasKeyedItems =
            existingArray.some(item => Boolean(this.getQuestionIdentity(item))) ||
            incomingArray.some(item => Boolean(this.getQuestionIdentity(item)));

        if (hasKeyedItems) {
            return this.mergeKeyedItems(existingArray, incomingArray);
        }

        return this.mergeIndexedArray(existingArray, incomingArray, (existingValue, incomingValue) => {
            const existingValid = this.isPlainObject(existingValue);
            const incomingValid = this.isPlainObject(incomingValue);

            if (!existingValid && !incomingValid) {
                return null;
            }

            if (!existingValid) {
                return incomingValue;
            }

            if (!incomingValid) {
                return existingValue;
            }

            const mergedQuestion = preferIncoming
                ? { ...(existingValue.question || {}), ...(incomingValue.question || {}) }
                : { ...(incomingValue.question || {}), ...(existingValue.question || {}) };

            return {
                ...(preferIncoming ? existingValue : incomingValue),
                ...(preferIncoming ? incomingValue : existingValue),
                question: mergedQuestion,
                userAnswer: this.isMeaningfulAnswer(incomingValue.userAnswer) ? incomingValue.userAnswer : existingValue.userAnswer,
                isJudged: Boolean(existingValue.isJudged) || Boolean(incomingValue.isJudged),
                isCorrect: incomingValue.isCorrect !== undefined ? incomingValue.isCorrect : existingValue.isCorrect
            };
        });
    }

    /**
     * 合并题目列表并去重
     */
    mergeQuestionLists(existingQuestions, newQuestions) {
        const existingList = Array.isArray(existingQuestions) ? existingQuestions : [];
        const incomingList = Array.isArray(newQuestions) ? newQuestions : [];
        const merged = [];
        const identities = new Set();

        [...existingList, ...incomingList].forEach(question => {
            const identity = this.getQuestionIdentity(question);
            if (!identity || identities.has(identity)) {
                return;
            }

            identities.add(identity);
            merged.push(question);
        });

        return merged;
    }

    /**
     * 合并进度数据
     */
    mergeProgressData(existingData, newData) {
        const merged = this.normalizeProgressCollection(existingData);
        const incomingData = this.normalizeProgressCollection(newData);

        Object.keys(incomingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }

            Object.keys(incomingData[subject]).forEach(type => {
                if (!merged[subject][type]) {
                    merged[subject][type] = this.normalizeProgressEntry(incomingData[subject][type]);
                } else {
                    const existing = this.normalizeProgressEntry(merged[subject][type]);
                    const incoming = this.normalizeProgressEntry(incomingData[subject][type]);
                    const preferIncoming = incoming.timestamp >= existing.timestamp;
                    const mergedEntry = {
                        ...(preferIncoming ? existing : incoming),
                        ...(preferIncoming ? incoming : existing),
                        currentIndex: Math.max(existing.currentIndex || 0, incoming.currentIndex || 0),
                        userAnswers: this.mergeAnswerArrays(existing.userAnswers, incoming.userAnswers, preferIncoming),
                        judgedAnswers: this.mergeJudgedArrays(existing.judgedAnswers, incoming.judgedAnswers),
                        detailedProgress: this.mergeDetailedProgress(existing.detailedProgress, incoming.detailedProgress, preferIncoming),
                        timestamp: Math.max(existing.timestamp || 0, incoming.timestamp || 0)
                    };

                    if (typeof existing.maxAllowedIndex === 'number' || typeof incoming.maxAllowedIndex === 'number') {
                        mergedEntry.maxAllowedIndex = Math.max(
                            typeof existing.maxAllowedIndex === 'number' ? existing.maxAllowedIndex : -1,
                            typeof incoming.maxAllowedIndex === 'number' ? incoming.maxAllowedIndex : -1
                        );
                    }

                    if (mergedEntry.maxAllowedIndex === -1) {
                        delete mergedEntry.maxAllowedIndex;
                    }

                    merged[subject][type] = mergedEntry;
                }
            });
        });

        return merged;
    }

    /**
     * 合并错题本数据
     */
    mergeWrongQuestions(existingData, newData) {
        const merged = this.normalizeQuestionCollection(existingData);
        const incomingData = this.normalizeQuestionCollection(newData);

        Object.keys(incomingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }

            Object.keys(incomingData[subject]).forEach(type => {
                merged[subject][type] = this.mergeQuestionLists(merged[subject][type], incomingData[subject][type]);
            });
        });

        return merged;
    }

    /**
     * 合并收藏数据
     */
    mergeFavorites(existingData, newData) {
        const merged = this.normalizeQuestionCollection(existingData);
        const incomingData = this.normalizeQuestionCollection(newData);

        Object.keys(incomingData).forEach(subject => {
            if (!merged[subject]) {
                merged[subject] = {};
            }

            Object.keys(incomingData[subject]).forEach(type => {
                merged[subject][type] = this.mergeQuestionLists(merged[subject][type], incomingData[subject][type]);
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
        localData.progressData = this.filterEmptySubjects(this.normalizeProgressCollection(localData.progressData));
        localData.wrongQuestions = this.normalizeQuestionCollection(this.filterEmptySubjects(localData.wrongQuestions));
        localData.favorites = this.normalizeQuestionCollection(this.filterEmptySubjects(localData.favorites));
        localData.examHistory = this.filterEmptySubjects(localData.examHistory);
        localData.examQuestionHistory = this.filterEmptySubjects(localData.examQuestionHistory);
        localData.practiceWrongQuestions = this.normalizeQuestionCollection(this.filterEmptySubjects(localData.practiceWrongQuestions));
        
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
