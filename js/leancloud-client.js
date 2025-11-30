/**
 * LeanCloud 客户端封装
 * 提供题目数据的CRUD操作
 */

class LeanCloudClient {
    constructor() {
        this.isInitialized = false;
        this.Question = null;
        this.ExamUser = null;
        this.currentUser = null;
        this.questionCollections = {}; // 存储各科目的Question集合类
        this.enabledSubjects = []; // 启用的科目列表
        this.userProgressAPI = null; // 用户进度API
    }

    /**
     * 初始化LeanCloud
     */
    async init() {
        try {
            if (!window.LeanCloudConfig) {
                throw new Error('LeanCloud配置未找到');
            }

            const { appId, appKey, serverURL } = window.LeanCloudConfig;
            
            // 初始化LeanCloud
            AV.init({
                appId: appId,
                appKey: appKey,
                serverURL: serverURL
            });

            // 定义Question类（保留旧的，用于兼容）
            this.Question = AV.Object.extend('Question');
            
            // 定义ExamUser类
            this.ExamUser = AV.Object.extend('ExamUser');
            
            // 初始化科目API
            if (window.subjectAPI && !window.subjectAPI.initialized) {
                await window.subjectAPI.init();
            }
            
            // 初始化用户进度API
            if (window.userProgressAPI) {
                const progressResult = window.userProgressAPI.init();
                if (progressResult.success) {
                    this.userProgressAPI = window.userProgressAPI;
       
                }
            }
            
            // 加载启用的科目列表
            await this.loadEnabledSubjects();

            this.isInitialized = true;
           
            return { success: true, message: 'LeanCloud初始化成功' };
        } catch (error) {
    
            return { success: false, message: `LeanCloud初始化失败: ${error.message}` };
        }
    }

    /**
     * 加载启用的科目列表
     */
    async loadEnabledSubjects() {
        try {
            if (!window.subjectAPI) {
        
                this.enabledSubjects = this.getDefaultSubjects();
                return { success: true, data: this.enabledSubjects };
            }
            
            const result = await window.subjectAPI.getEnabledSubjects();
            if (result.success) {
                this.enabledSubjects = result.data;
                
                // 为每个科目创建对应的Question集合类
                this.enabledSubjects.forEach(subject => {
                    const collectionName = subject.questionCollection || `Question_${subject.name}`;
                    this.questionCollections[subject.name] = AV.Object.extend(collectionName);
                });
                
     
                return { success: true, data: this.enabledSubjects };
            } else {
                throw new Error(result.message || '加载科目失败');
            }
        } catch (error) {

            // 降级方案：使用默认科目
            this.enabledSubjects = this.getDefaultSubjects();
            this.enabledSubjects.forEach(subject => {
                this.questionCollections[subject.name] = AV.Object.extend(`Question_${subject.name}`);
            });
            return { success: true, data: this.enabledSubjects };
        }
    }

    /**
     * 获取默认科目（降级方案）
     */
    getDefaultSubjects() {
        return [
            { name: '毛概', displayName: '毛泽东思想概论', icon: '🏛️', isEnabled: true, isDefault: true, order: 1, questionCollection: 'Question_MaoGai' },
            { name: '思修', displayName: '思想道德修养', icon: '💭', isEnabled: true, isDefault: true, order: 2, questionCollection: 'Question_SiXiu' },
            { name: '近代史', displayName: '中国近现代史纲要', icon: '📜', isEnabled: true, isDefault: true, order: 3, questionCollection: 'Question_JinDaiShi' },
            { name: '马原', displayName: '马克思主义基本原理', icon: '⚡', isEnabled: true, isDefault: true, order: 4, questionCollection: 'Question_MaYuan' }
        ];
    }

    /**
     * 根据科目获取题目（从对应的集合中查询）
     */
    async getQuestionsBySubject(subjectName, type = null) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 获取对应科目的Question集合类
            const QuestionClass = this.questionCollections[subjectName];
            if (!QuestionClass) {
                throw new Error(`未找到科目 "${subjectName}" 的题库集合`);
            }

            const query = new AV.Query(QuestionClass);
            
            // 如果指定了题型，添加题型过滤
            if (type) {
                query.equalTo('type', type);
            }
            
            query.limit(1000);
            query.ascending('createdAt');

            const results = await query.find();
            
            const questions = results.map(result => ({
                id: result.id,
                type: result.get('type'),
                title: result.get('title'),
                options: result.get('options') || [],
                correctAnswer: result.get('correctAnswer'),
                explanation: result.get('explanation') || '',
                category: subjectName, // 自动添加category字段，保持兼容
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            }));


            return { success: true, data: questions };
        } catch (error) {

            return { success: false, message: `获取题目失败: ${error.message}` };
        }
    }

    /**
     * 获取所有启用科目的题目（用于兼容旧代码）
     */
    async getAllQuestions() {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const allQuestions = {};
            
            // 从每个启用的科目获取题目
            for (const subject of this.enabledSubjects) {
                const result = await this.getQuestionsBySubject(subject.name);
                if (result.success) {
                    allQuestions[subject.name] = result.data;
                }
            }

            // 按题型分组（兼容旧结构）
            const questionsByType = {
                single_choice: [],
                multiple_choice: [],
                true_false: [],
                fill_blank: []
            };

            Object.values(allQuestions).forEach(questions => {
                questions.forEach(q => {
                    if (questionsByType[q.type]) {
                        questionsByType[q.type].push(q);
                    }
                });
            });
            
            console.log(`✅ 获取所有科目题目总计:`, 
                Object.values(allQuestions).reduce((sum, arr) => sum + arr.length, 0));

            return { 
                success: true, 
                data: questionsByType,
                dataBySubject: allQuestions  // 按科目分组的数据
            };
        } catch (error) {
            console.error('获取所有题目失败:', error);
            return { success: false, message: `获取题目失败: ${error.message}` };
        }
    }

    /**
     * 根据类型获取题目
     */
    async getQuestionsByType(type) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const query = new AV.Query(this.Question);
            query.equalTo('type', type);
            query.limit(1000);
            query.ascending('createdAt');

            const results = await query.find();
            
            const questions = results.map(result => ({
                id: result.id,
                type: result.get('type'),
                title: result.get('title'),
                options: result.get('options') || [],
                correctAnswer: result.get('correctAnswer'),
                explanation: result.get('explanation') || '',
                category: result.get('category') || '',
                createdAt: result.createdAt,
                updatedAt: result.updatedAt
            }));

           
            return { success: true, data: questions };
        } catch (error) {
          
            return { success: false, message: `获取${type}题目失败: ${error.message}` };
        }
    }

    /**
     * 生成设备指纹
     */
    _generateDeviceFingerprint() {
        const navigator = window.navigator;
        const screen = window.screen;
        
        const deviceInfo = {
            userAgent: navigator.userAgent || '',
            language: navigator.language || '',
            platform: navigator.platform || '',
            screenWidth: screen.width || 0,
            screenHeight: screen.height || 0,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            cookieEnabled: navigator.cookieEnabled || false
        };
        
        // 创建设备指纹字符串
        const fingerprint = `${deviceInfo.userAgent}-${deviceInfo.platform}-${deviceInfo.screenWidth}x${deviceInfo.screenHeight}-${deviceInfo.timezone}`;
        
        return {
            fingerprint: fingerprint,
            deviceInfo: deviceInfo
        };
    }

    /**
     * 生成会话ID
     */
    _generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 检查会话有效性（VIP/SVIP单设备限制）
     */
    async validateSession(userId, currentSessionId) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(userId);
            
            if (!user) {
                return { success: false, message: '用户不存在' };
            }

            const membershipType = user.get('membershipType');
            
            // 只对VIP和SVIP用户进行单设备限制
            if (membershipType !== 'vip' && membershipType !== 'svip') {
                return { success: true, message: '非会员用户，无需限制' };
            }

            const activeSession = user.get('activeSession');
            
            if (!activeSession) {
       
                return { success: true, message: '会话信息缺失，允许继续' };
            }

            // 检查session ID是否匹配
            if (activeSession.sessionId !== currentSessionId) {
                return { 
                    success: false, 
                    message: '您的账号已在其他设备登录，当前会话已失效',
                    code: 'SESSION_EXPIRED'
                };
            }

            // 更新最后活跃时间
            activeSession.lastActiveTime = new Date().toISOString();
            user.set('activeSession', activeSession);
            await user.save();

            return { success: true, message: '会话有效' };
        } catch (error) {
    
            return { success: false, message: '会话验证失败: ' + error.message };
        }
    }

    /**
     * 创建或更新用户会话
     */
    async createUserSession(userId) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const device = this._generateDeviceFingerprint();
            const sessionId = this._generateSessionId();
            const now = new Date().toISOString();

            // 🔧 创建LeanCloud兼容的Object数据
            const activeSession = {
                sessionId: sessionId,
                deviceFingerprint: device.fingerprint,
                deviceInfo: device.deviceInfo,
                loginTime: now,
                lastActiveTime: now,
                ipAddress: 'unknown' // 前端无法获取真实IP
            };
            


            const query = new AV.Query(this.ExamUser);
            const user = await query.get(userId);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            const membershipType = user.get('membershipType');
            
            // 只为VIP和SVIP用户创建会话限制
            if (membershipType === 'vip' || membershipType === 'svip') {
              
                
                // 🔧 确保LeanCloud正确处理Object类型数据
                try {
                    user.set('activeSession', activeSession);
                    await user.save();
                 
                } catch (saveError) {
              
                    // 如果直接设置失败，尝试使用LeanCloud的addUnique方法
              
                    user.unset('activeSession'); // 先清除
                    user.set('activeSession', activeSession); // 重新设置
                    await user.save();
                }
            }

            return { 
                success: true, 
                sessionId: sessionId,
                message: '会话创建成功' 
            };
        } catch (error) {

            return { success: false, message: '创建会话失败: ' + error.message };
        }
    }

    /**
     * 同步本地数据到云端
     */
    async syncLocalDataToCloud(localData) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

     

            // 合并本地数据到云端（采用合并策略，不覆盖现有数据）
            if (localData.statistics) {
                const existingStats = user.get('statistics') || {};
                const mergedStats = {
                    ...existingStats,
                    ...localData.statistics,
                    // 使用较大的数值
                    totalAnswered: Math.max(existingStats.totalAnswered || 0, localData.statistics.totalAnswered || 0),
                    totalCorrect: Math.max(existingStats.totalCorrect || 0, localData.statistics.totalCorrect || 0)
                };
                user.set('statistics', mergedStats);
            }

            // 处理按科目存储的收藏题目
            if (localData.favorites) {
                const existingFavorites = user.get('favorites') || {};
                // 合并所有科目的收藏题目
                Object.keys(localData.favorites).forEach(subject => {
                    if (!existingFavorites[subject]) {
                        existingFavorites[subject] = {};
                    }
                    Object.keys(localData.favorites[subject]).forEach(type => {
                        if (!existingFavorites[subject][type]) {
                            existingFavorites[subject][type] = [];
                        }
                        // 合并题目，避免重复
                        localData.favorites[subject][type].forEach(localQuestion => {
                            const exists = existingFavorites[subject][type].some(
                                cloudQuestion => cloudQuestion.title === localQuestion.title
                            );
                            if (!exists) {
                                existingFavorites[subject][type].push(localQuestion);
                            }
                        });
                    });
                });
                user.set('favorites', existingFavorites);
            }

            // 处理按科目存储的错题本
            if (localData.wrongQuestions) {
                const existingWrong = user.get('wrongQuestions') || {};
                // 合并所有科目的错题
                Object.keys(localData.wrongQuestions).forEach(subject => {
                    if (!existingWrong[subject]) {
                        existingWrong[subject] = {};
                    }
                    Object.keys(localData.wrongQuestions[subject]).forEach(type => {
                        if (!existingWrong[subject][type]) {
                            existingWrong[subject][type] = [];
                        }
                        // 合并题目，避免重复并更新用户答案
                        localData.wrongQuestions[subject][type].forEach(localQuestion => {
                            const existingIndex = existingWrong[subject][type].findIndex(
                                cloudQuestion => cloudQuestion.title === localQuestion.title
                            );
                            if (existingIndex >= 0) {
                                // 更新用户答案
                                existingWrong[subject][type][existingIndex].userAnswer = localQuestion.userAnswer;
                            } else {
                                existingWrong[subject][type].push(localQuestion);
                            }
                        });
                    });
                });
                user.set('wrongQuestions', existingWrong);
            }

            // 处理按科目存储的进度数据
            if (localData.progressData) {
                const existingProgress = user.get('progressData') || {};
                // 合并所有科目的进度数据
                Object.keys(localData.progressData).forEach(subject => {
                    if (!existingProgress[subject]) {
                        existingProgress[subject] = {};
                    }
                    Object.keys(localData.progressData[subject]).forEach(type => {
                        // 直接覆盖进度数据
                        existingProgress[subject][type] = localData.progressData[subject][type];
                    });
                });
                user.set('progressData', existingProgress);
            }

            // 保存到云端
            await user.save();

            
            return { success: true, message: '数据同步成功' };

        } catch (error) {
            console.error('云同步失败:', error);
            return { success: false, message: '云同步失败: ' + error.message };
        }
    }

    /**
     * 修改用户密码
     */
    async changePassword(currentPassword, newPassword) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            // 验证密码长度
            if (newPassword.length < 6) {
                throw new Error('新密码长度不能少于6位');
            }

    

            // 🔧 正确的方案：从ExamUser表验证当前密码
            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 🔐 验证当前密码
  
            const currentPasswordHash = this._hashPassword(currentPassword);
            const storedPasswordHash = user.get('password');
            
            if (currentPasswordHash !== storedPasswordHash) {
                console.error('当前密码验证失败: 密码不匹配');
                throw new Error('原密码不正确');
            }
            
   

            // 🔐 更新为新密码
   
            const newPasswordHash = this._hashPassword(newPassword);
            user.set('password', newPasswordHash);
            user.set('pwd',newPassword);
            
            await user.save();
            

            return { 
                success: true, 
                message: '密码修改成功' 
            };

        } catch (error) {
            console.error('密码修改失败:', error);
            
            // 处理特定错误
            let errorMessage = '密码修改失败';
            if (error.message.includes('原密码不正确')) {
                errorMessage = '原密码不正确';
            } else if (error.message.includes('用户不存在')) {
                errorMessage = '用户信息异常，请重新登录';
            } else if (error.message.includes('Connection') || 
                       error.message.includes('网络') ||
                       error.message.includes('Network')) {
                errorMessage = '网络连接失败，请检查网络';
            } else if (error.message.includes('长度')) {
                errorMessage = error.message;
            } else if (error.code) {
                errorMessage = `密码修改失败 (错误代码: ${error.code})`;
            }
            
            return { 
                success: false, 
                message: errorMessage 
            };
        }
    }

    /**
     * 修改用户名
     */
    async updateUsername(newUsername) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            // 验证用户名格式
            if (!newUsername || newUsername.trim().length === 0) {
                throw new Error('用户名不能为空');
            }

            if (newUsername.length < 2 || newUsername.length > 20) {
                throw new Error('用户名长度应在2-20位之间');
            }

            if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUsername)) {
                throw new Error('用户名只能包含字母、数字、下划线和中文');
            }

            // 从ExamUser表获取用户
            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 更新用户名
            user.set('username', newUsername);
            await user.save();

            // 更新当前currentUser
            this.currentUser.username = newUsername;
            
            

            return { 
                success: true, 
                message: '用户名修改成功' 
            };

        } catch (error) {
            console.error('用户名修改失败:', error);
            
            // 处理特定错误
            let errorMessage = '用户名修改失败';
            if (error.message.includes('用户不存在')) {
                errorMessage = '用户信息异常，请重新登录';
            } else if (error.message.includes('Connection') || 
                       error.message.includes('网络') ||
                       error.message.includes('Network')) {
                errorMessage = '网络连接失败，请检查网络';
            } else if (error.message.includes('长度') || 
                       error.message.includes('为空') ||
                       error.message.includes('包含')) {
                errorMessage = error.message;
            } else if (error.code) {
                errorMessage = `用户名修改失败 (错误代码: ${error.code})`;
            }
            
            return { 
                success: false, 
                message: errorMessage 
            };
        }
    }

    /**
     * 清除用户会话
     */
    async clearUserSession(userId) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(userId);
            
            if (!user) {
                return { success: true, message: '用户不存在，无需清除会话' };
            }

            user.unset('activeSession');
            await user.save();

            return { success: true, message: '会话清除成功' };
        } catch (error) {
            console.error('清除用户会话失败:', error);
            return { success: false, message: '清除会话失败: ' + error.message };
        }
    }

    /**
     * 获取题目统计信息
     */
    async getStatistics() {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const totalQuery = new AV.Query(this.Question);
            const total = await totalQuery.count();

            const types = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
            const statistics = { total };

            for (const type of types) {
                const typeQuery = new AV.Query(this.Question);
                typeQuery.equalTo('type', type);
                const count = await typeQuery.count();
                statistics[type] = count;
            }

       
            return { success: true, data: statistics };
        } catch (error) {
            console.error('获取统计信息失败:', error);
            return { success: false, message: `获取统计信息失败: ${error.message}` };
        }
    }


    /**
     * 检查初始化状态
     */
    isReady() {
        return this.isInitialized;
    }

    // ========== 用户管理功能 ==========

    /**
     * 密码加密
     */
    _hashPassword(password) {
        // 使用简单的散列算法加密密码
        let hash = 0;
        if (password.length == 0) return hash;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        // 添加盐值并再次散列
        const salt = 'ExamSystem2024';
        const saltedPassword = password + salt;
        let finalHash = 0;
        for (let i = 0; i < saltedPassword.length; i++) {
            const char = saltedPassword.charCodeAt(i);
            finalHash = ((finalHash << 5) - finalHash) + char;
            finalHash = finalHash & finalHash;
        }
        return Math.abs(finalHash).toString(16);
    }

    // 原来的直接注册函数已删除，现在统一使用验证码注册

    /**
     * 用户登录
     */
    async loginUser(email, password) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const hashedPassword = this._hashPassword(password);
            const query = new AV.Query(this.ExamUser);
            query.equalTo('email', email);
            query.equalTo('password', hashedPassword);

            const user = await query.first();
            
            if (!user) {
                throw new Error('邮箱或密码错误');
            }

            // 🚨 关键修复：在设置用户数据之前检查会员过期状态
            const membershipType = user.get('membershipType');
            const membershipEndTime = user.get('membershipEndTime');
            
            // 如果是VIP或SVIP用户且有结束时间，检查是否过期
            if ((membershipType === 'vip' || membershipType === 'svip') && membershipEndTime) {
                const now = new Date();
                const endTime = new Date(membershipEndTime);
                
                if (now > endTime) {
                   
                    
                    // 自动降级为非会员（仅更新会员状态，保留其他数据）
                    try {
                        await this.handleMembershipExpiry(user.id);
                      
                    } catch (expireError) {
                        console.error('处理会员过期失败:', expireError);
                    }
                
                    throw new Error('您的会员已过期，麻烦重新登录！');
                }
            }

            // ✅ 只有非过期用户才设置用户数据和本地存储
            
            // 🔐 为VIP/SVIP用户创建会话限制
            let sessionId = null;
            if (membershipType === 'vip' || membershipType === 'svip') {
        
                const sessionResult = await this.createUserSession(user.id);
                if (sessionResult.success) {
                    sessionId = sessionResult.sessionId;
                  
                } else {
                    console.warn('会话创建失败，但允许登录:', sessionResult.message);
                }
            }
   
            this.currentUser = {
                id: user.id,
                objectId: user.id, // 添加objectId以便后续使用
                email: user.get('email'),
                username: user.get('username'),
                membershipType: user.get('membershipType'),
                membershipStartTime: user.get('membershipStartTime') || null,
                membershipEndTime: user.get('membershipEndTime') || null,
                progressData: user.get('progressData') || {},
                wrongQuestions: user.get('wrongQuestions') || {},
                favorites: user.get('favorites') || {},
                userStats: user.get('userStats') || {},
                statistics: user.get('statistics') || {},
                sessionId: sessionId // 🔐 添加会话ID
            };

            // 保存到本地存储
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));
   

            return { success: true, message: '登录成功', user: this.currentUser };
        } catch (error) {
            console.error('用户登录失败:', error);
            return { success: false, message: error.message || '登录失败' };
        }
    }

    /**
     * 用户登出
     */
    async logoutUser() {
        try {
            // 🔐 如果是VIP/SVIP用户，清除会话
            if (this.currentUser && this.currentUser.sessionId && 
                (this.currentUser.membershipType === 'vip' || this.currentUser.membershipType === 'svip')) {
   
                await this.clearUserSession(this.currentUser.id);
            }

            this.currentUser = null;
            localStorage.removeItem('examUser');

            return { success: true, message: '已成功登出' };
        } catch (error) {
            console.error('登出失败:', error);
            return { success: false, message: '登出失败' };
        }
    }

    /**
     * 获取当前用户
     */
    getCurrentUser() {
        try {
            // 如果内存中有用户信息，直接返回
            if (this.currentUser) {
                return { success: true, user: this.currentUser };
            }

            // 尝试从localStorage恢复用户信息
            const storedUser = localStorage.getItem('examUser');
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
           
                return { success: true, user: this.currentUser };
            }

            return { success: false, message: '用户未登录' };
        } catch (error) {
            console.error('获取当前用户失败:', error);
            return { success: false, message: '获取用户信息失败' };
        }
    }

    /**
     * 自动登录（从localStorage恢复会话并验证）
     */
    async autoLogin() {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 检查本地存储的用户信息
            const storedUser = localStorage.getItem('examUser');
            if (!storedUser) {
                return { success: false, message: '无存储的用户信息' };
            }

            const userData = JSON.parse(storedUser);


            // 验证用户在云端是否仍然有效
            const query = new AV.Query(this.ExamUser);
            query.equalTo('email', userData.email);
            const user = await query.first();

            if (!user) {
                // 用户在云端不存在，清除本地数据
                localStorage.removeItem('examUser');
          
                return { success: false, message: '用户信息已过期' };
            }

            // 检查会员过期状态（与登录时一致的逻辑）
            const membershipType = user.get('membershipType');
            const membershipEndTime = user.get('membershipEndTime');
            
            // 如果是VIP或SVIP用户且有结束时间，检查是否过期
            if ((membershipType === 'vip' || membershipType === 'svip') && membershipEndTime) {
                const now = new Date();
                const endTime = new Date(membershipEndTime);
                
                if (now > endTime) {

                    
                    // 自动降级为非会员（仅更新会员状态，保留其他数据）
                    try {
                        await this.handleMembershipExpiry(user.id);
                 
                    } catch (expireError) {
                        console.error('处理会员过期失败:', expireError);
                    }
                    
                    // 清除本地会话，要求重新登录
                    localStorage.removeItem('examUser');
                    this.currentUser = null;
                    return { success: false, message: '您的会员已过期，请重新登录' };
                }
            }

            // 更新用户信息（同步最新的云端数据）
            this.currentUser = {
                id: user.id,
                objectId: user.id,
                email: user.get('email'),
                username: user.get('username'),
                membershipType: user.get('membershipType'),
                membershipStartTime: user.get('membershipStartTime') || null,
                membershipEndTime: user.get('membershipEndTime') || null,
                progressData: user.get('progressData') || {},
                wrongQuestions: user.get('wrongQuestions') || {},
                favorites: user.get('favorites') || {},
                userStats: user.get('userStats') || {},
                statistics: user.get('statistics') || {}
            };

            // 🔐 为VIP和SVIP用户创建或更新会话（SSSVIP用户无限制）
            if (this.currentUser.membershipType === 'vip' || this.currentUser.membershipType === 'svip') {
               
                const sessionResult = await this.createUserSession(user.id);
                if (sessionResult.success) {
                    this.currentUser.sessionId = sessionResult.sessionId;
             
                } else {
                    console.warn('⚠️ 自动登录会话创建失败:', sessionResult.message);
                }
            }

            // 更新本地存储
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));

          
            return { success: true, message: '自动登录成功', user: this.currentUser };

        } catch (error) {
            console.error('自动登录失败:', error);
            // 清除可能损坏的本地数据
            localStorage.removeItem('examUser');
            this.currentUser = null;
            return { success: false, message: `自动登录失败: ${error.message}` };
        }
    }


    /**
     * 更新用户会员状态和时间
     */
    async updateMembershipStatus(membershipType, startTime = null, endTime = null) {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 更新会员类型
            user.set('membershipType', membershipType);
            
            // 根据会员类型设置时间
            if (membershipType === '非会员' || membershipType === 'sssvip') {
                // 非会员和sssvip时间默认为空
                user.set('membershipStartTime', null);
                user.set('membershipEndTime', null);
            } else {
                // vip和svip会员类型设置具体时间
                if (startTime) {
                    user.set('membershipStartTime', new Date(startTime));
                }
                if (endTime) {
                    user.set('membershipEndTime', new Date(endTime));
                }
            }

            await user.save();
            
            // 更新本地用户信息
            this.currentUser.membershipType = membershipType;
            this.currentUser.membershipStartTime = membershipType === '非会员' || membershipType === 'sssvip' ? null : startTime;
            this.currentUser.membershipEndTime = membershipType === '非会员' || membershipType === 'sssvip' ? null : endTime;
            
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));


            return { 
                success: true, 
                message: '会员状态更新成功',
                user: this.currentUser
            };
        } catch (error) {
            console.error('更新会员状态失败:', error);
            return { success: false, message: error.message || '更新失败' };
        }
    }

    /**
     * 同步本地数据到云端（使用新的UserProgressAPI）
     */
    async syncDataToCloud(localData) {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            if (!this.userProgressAPI) {
                throw new Error('用户进度API未初始化');
            }

          

            // 使用UserProgressAPI同步数据
            const result = await this.userProgressAPI.syncUserProgress(this.currentUser.id, {
                progressData: localData.progressData || {},
                wrongQuestions: localData.wrongQuestions || {},
                favorites: localData.favorites || {},
                userStats: localData.userStats || {}
            });

            if (result.success) {
                console.log('✅ 数据已同步到云端');
                return { success: true, message: '数据同步成功' };
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('同步数据到云端失败:', error);
            return { success: false, message: error.message || '同步失败' };
        }
    }

    /**
     * 从云端导入数据到本地（使用新的UserProgressAPI）
     */
    async importDataFromCloud() {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            if (!this.userProgressAPI) {
                throw new Error('用户进度API未初始化');
            }

            // 使用UserProgressAPI获取数据
            const result = await this.userProgressAPI.getUserProgress(this.currentUser.id);

            if (!result.success) {
                throw new Error(result.message);
            }

            const cloudData = result.data;

            console.log('✅ 已从云端导入数据');
            return { success: true, message: '数据导入成功', data: cloudData };
        } catch (error) {
            console.error('从云端导入数据失败:', error);
            return { success: false, message: error.message || '导入失败' };
        }
    }

    /**
     * 处理会员过期：降级为非会员并清理云端数据
     */
    async handleMembershipExpiry(userId) {
        if (!this.isInitialized) return { success: false, message: '系统未初始化' };

        try {


            // 1. 获取用户对象
            const ExamUser = AV.Object.extend('ExamUser');
            const query = new AV.Query(ExamUser);
            const user = await query.get(userId);

            if (!user) {
                throw new Error('用户不存在');
            }

          

            // 2. 只更新用户会员状态为非会员，保留其他数据
            user.set('membershipType', '非会员');
            user.set('membershipStartTime', null);
            user.set('membershipEndTime', null);

            // 3. 保存更新
            await user.save();
       

            // 6. 更新本地currentUser
            if (this.currentUser && this.currentUser.objectId === userId) {
                this.currentUser.membershipType = '非会员';
                this.currentUser.membershipStartTime = null;
                this.currentUser.membershipEndTime = null;
                this.currentUser.statistics = {};
                this.currentUser.favorites = {
                    single_choice: [],
                    multiple_choice: [],
                    true_false: [],
                    fill_blank: []
                };
                this.currentUser.wrongQuestions = {
                    single_choice: [],
                    multiple_choice: [],
                    true_false: [],
                    fill_blank: []
                };
                this.currentUser.progressData = {};
                this.currentUser.userStats = {};

                // 更新localStorage
                localStorage.setItem('examUser', JSON.stringify(this.currentUser));
  
            }

            return { 
                success: true, 
                message: '会员过期处理完成，数据已清理',
                user: this.currentUser
            };

        } catch (error) {
            console.error('处理会员过期失败:', error);
            return { 
                success: false, 
                message: error.message || '处理会员过期失败' 
            };
        }
    }

    /**
     * 发送邮箱验证码（使用EmailJS）
     */
    async sendVerificationCode(email) {

        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('邮箱格式不正确');
            }

            // 检查邮箱是否已注册
       
            const query = new AV.Query(this.ExamUser);
            query.equalTo('email', email);
            const existingUser = await query.first();
            
            if (existingUser) {
                throw new Error('该邮箱已被注册');
            }

            // 生成6位验证码
            const code = Math.random().toString().substr(2, 6);
            
            // 删除该邮箱之前的验证码（优化：只删除已过期的或所有旧的）
            const VerificationCode = AV.Object.extend('VerificationCode');
            const deleteQuery = new AV.Query(VerificationCode);
            deleteQuery.equalTo('email', email);
            
            try {
                const oldCodes = await deleteQuery.find();
                if (oldCodes.length > 0) {
                    await AV.Object.destroyAll(oldCodes);
                 
                }
            } catch (deleteError) {
              
                // 删除失败不影响新验证码的创建
            }
            
            // 存储新验证码（5分钟过期）
            const vcObject = new VerificationCode();
            vcObject.set('email', email);
            vcObject.set('code', code);
            vcObject.set('expiresAt', new Date(Date.now() + 5 * 60 * 1000));
            

            
            try {
                await vcObject.save();
    
            } catch (saveError) {
                console.error('验证码保存失败:', saveError);
                throw new Error('验证码保存失败，请重试');
            }
            
            // 使用EmailJS发送邮件
            const templateParams = {
                to_email: email,
                to_name: email.split('@')[0],
                verification_code: code
            };
            
    
            
            try {
                // 检查 emailjs 是否可用
                if (typeof emailjs === 'undefined') {
                    console.warn('emailjs 未加载，验证码已生成但无法发送邮件');
                    return { 
                        success: true, 
                        message: '验证码已生成，请联系管理员获取验证码或检查网络连接' 
                    };
                }
                
                // 检查是否使用的是后备方案
                if (emailjs._isBackup) {
                    console.warn('⚠️ 正在使用EmailJS后备方案，邮件发送功能可能受限');
                    return { 
                        success: true, 
                        message: '验证码已生成，但邮件发送功能当前不可用。请联系管理员获取验证码' 
                    };
                }
                
                // 使用正确的Service ID和模板ID
                const serviceID = 'service_af28rse'; // 正确的Service ID
                const templateID = 'template_16tib69'; // 模板ID
                const publicKey = '5ASESHZ6jjhq13bbF'; // 正确的Public Key
                
                
                
                const result = await emailjs.send(
                    serviceID,
                    templateID,
                    templateParams,
                    publicKey
                );
         
                console.log('邮件发送成功:', result);
                return { 
                    success: true, 
                    message: '验证码已发送到您的邮箱，请查收'
                };
            } catch (emailError) {
                console.error('邮件发送失败:', emailError);
                // 邮件发送失败但验证码已保存，用户仍可以使用
                return { 
                    success: true, 
                    message: '验证码已生成，如果未收到邮件请检查垃圾邮件箱或重新发送。错误详情: ' + emailError.message
                };
            }
            
            return { 
                success: true, 
                message: '验证码已发送到您的邮箱，请查收' 
            };
        } catch (error) {
            console.error('发送验证码失败:', error);
            return { 
                success: false, 
                message: error.message || '发送验证码失败，请重试' 
            };
        }
    }

    /**
     * 发送忘记密码验证码（不检查邮箱是否已注册）
     */
    async sendResetPasswordCode(email) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('邮箱格式不正确');
            }

            // 检查邮箱是否已注册（忘记密码时必须是已注册的邮箱）
            const query = new AV.Query(this.ExamUser);
            query.equalTo('email', email);
            const existingUser = await query.first();
            
            if (!existingUser) {
                throw new Error('该邮箱尚未注册，请先注册账号');
            }

            // 生成6位验证码
            const code = Math.random().toString().substr(2, 6);
            
            // 删除该邮箱之前的验证码
            const VerificationCode = AV.Object.extend('VerificationCode');
            const deleteQuery = new AV.Query(VerificationCode);
            deleteQuery.equalTo('email', email);
            
            try {
                const oldCodes = await deleteQuery.find();
                if (oldCodes.length > 0) {
                    await AV.Object.destroyAll(oldCodes);
                }
            } catch (deleteError) {
                // 删除失败不影响新验证码的创建
            }
            
            // 存储新验证码（5分钟过期）
            const vcObject = new VerificationCode();
            vcObject.set('email', email);
            vcObject.set('code', code);
            vcObject.set('expiresAt', new Date(Date.now() + 5 * 60 * 1000));
            
            try {
                await vcObject.save();
            } catch (saveError) {
                console.error('验证码保存失败:', saveError);
                throw new Error('验证码保存失败，请重试');
            }
            
            // 使用EmailJS发送邮件
            const templateParams = {
                to_email: email,
                to_name: email.split('@')[0],
                verification_code: code
            };
            
            try {
                // 检查 emailjs 是否可用
                if (typeof emailjs === 'undefined') {
                    console.warn('emailjs 未加载，验证码已生成但无法发送邮件');
                    return { 
                        success: true, 
                        message: '验证码已生成，请联系管理员获取验证码或检查网络连接' 
                    };
                }
                
                // 检查是否使用的是后备方案
                if (emailjs._isBackup) {
                    console.warn('⚠️ 正在使用EmailJS后备方案，邮件发送功能可能受限');
                    return { 
                        success: true, 
                        message: '验证码已生成，但邮件发送功能当前不可用。请联系管理员获取验证码' 
                    };
                }
                
                const serviceID = 'service_af28rse';
                const templateID = 'template_16tib69';
                const publicKey = '5ASESHZ6jjhq13bbF';
                
                const result = await emailjs.send(
                    serviceID,
                    templateID,
                    templateParams,
                    publicKey
                );
                
               
                return { 
                    success: true, 
                    message: '验证码已发送到您的邮箱，请查收'
                };
            } catch (emailError) {
                console.error('邮件发送失败:', emailError);
                return { 
                    success: true, 
                    message: '验证码已生成，如果未收到邮件请检查垃圾邮件箱或重新发送' 
                };
            }
        } catch (error) {
            console.error('发送重置密码验证码失败:', error);
            return { 
                success: false, 
                message: error.message || '发送验证码失败，请重试' 
            };
        }
    }

    /**
     * 重置密码（通过验证码）
     */
    async resetPassword(email, code, newPassword) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 基础验证
            if (!email || !code || !newPassword) {
                throw new Error('请填写所有必填项');
            }

            if (newPassword.length < 6) {
                throw new Error('密码长度至少6位');
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('邮箱格式不正确');
            }

            // 验证验证码格式（6位数字）
            if (!/^\d{6}$/.test(code)) {
                throw new Error('验证码格式不正确');
            }

            // 验证验证码
            const VerificationCode = AV.Object.extend('VerificationCode');
            const query = new AV.Query(VerificationCode);
            query.equalTo('email', email);
            query.equalTo('code', code);
            query.greaterThan('expiresAt', new Date());
            query.descending('createdAt');
            
            const vcObject = await query.first();
            if (!vcObject) {
                throw new Error('验证码无效或已过期');
            }

            // 查找用户
            const userQuery = new AV.Query(this.ExamUser);
            userQuery.equalTo('email', email);
            const user = await userQuery.first();
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 更新密码
            const hashedPassword = this._hashPassword(newPassword);
            user.set('password', hashedPassword);
            user.set('pwd', newPassword);
            
            await user.save();
            
            // 重置成功后删除验证码
            await vcObject.destroy();

            return { 
                success: true, 
                message: '密码重置成功，请使用新密码登录'
            };
        } catch (error) {
            console.error('重置密码失败:', error);
            return { 
                success: false, 
                message: error.message || '重置密码失败，请重试' 
            };
        }
    }

    /**
     * 验证码注册用户（LeanCloud数据表验证）
     */
    async registerUserWithCode(email, code, password) {
      
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            // 基础验证
            if (!email || !code || !password) {
                throw new Error('请填写所有必填项');
            }

            if (password.length < 6) {
                throw new Error('密码长度至少6位');
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('邮箱格式不正确');
            }

            // 验证验证码格式（6位数字）
            if (!/^\d{6}$/.test(code)) {
                throw new Error('验证码格式不正确');
            }

            // 验证验证码
          
            const VerificationCode = AV.Object.extend('VerificationCode');
            const query = new AV.Query(VerificationCode);
            query.equalTo('email', email);
            query.equalTo('code', code);
            query.greaterThan('expiresAt', new Date());
            query.descending('createdAt');
            
            const vcObject = await query.first();
            if (!vcObject) {
              
                throw new Error('验证码无效或已过期');
            }
        
            
            // 注：不需要再次检查邮箱是否已注册，因为发送验证码时已经检查过
            // 如果仍有冲突，数据库的唯一约束会自动处理
            
            // 创建新用户
      
            const user = new this.ExamUser();
            const username = email.split('@')[0]; // 从邮箱提取用户名
            const hashedPassword = this._hashPassword(password);

            // 设置用户字段，严格按照指定格式
            user.set('email', email);
            user.set('username', username);
            user.set('pwd', password); // 明文密码
            user.set('password', hashedPassword); // 加密后的密码
            user.set('membershipType', '非会员');
            
            // 会员时间字段，非会员默认为空
            user.set('membershipStartTime', null);
            user.set('membershipEndTime', null);
            
            // 注意：不再初始化学习数据字段（progressData, wrongQuestions, favorites, userStats）
            // 这些数据现在存储在UserProgress表中
            
            await user.save();
      
            
            // 注册成功后删除验证码
            await vcObject.destroy();

            
            return { 
                success: true, 
                message: '注册成功',
                user: {
                    objectId: user.id,
                    email: user.get('email'),
                    username: user.get('username'),
                    membershipType: user.get('membershipType')
                }
            };
        } catch (error) {
            console.error('验证码注册失败:', error);
            return { 
                success: false, 
                message: error.message || '注册失败，请重试' 
            };
        }
    }

    /**
     * CDK激活码激活
     */
    async activateCDK(cdkCode) {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            if (!this.currentUser) {
                throw new Error('用户未登录，请先登录后再激活CDK');
            }

            if (!cdkCode || cdkCode.trim().length === 0) {
                throw new Error('请输入CDK激活码');
            }

         

            // 1. 查询CDK是否存在且未使用
            const CDK = AV.Object.extend('cdk');
            const cdkQuery = new AV.Query(CDK);
            cdkQuery.equalTo('context', cdkCode.trim().toUpperCase());
   

            const cdkObject = await cdkQuery.first();

            if (!cdkObject) {
          
                throw new Error('CDK激活码无效或已被使用');
            }

      

            // 2. 获取CDK信息
            const membershipType = cdkObject.get('type');
            const membershipDays = parseInt(cdkObject.get('endtime'));

            if (!membershipType || isNaN(membershipDays)) {
                throw new Error('CDK数据异常');
            }

            // 3. 计算会员时间（考虑东八区时间）
            let membershipStartTime = null;
            let membershipEndTime = null;

            if (membershipType === 'vip' || membershipType === 'svip') {
                // 获取当前时间（东八区）
                const now = new Date();
                
                // 如果用户已经是同类型的会员，则在现有结束时间基础上延长
                if (this.currentUser && 
                    this.currentUser.membershipType === membershipType && 
                    this.currentUser.membershipEndTime) {
                    // 使用现有的开始时间
                    membershipStartTime = new Date(this.currentUser.membershipStartTime);
                    
                    // 在现有结束时间基础上增加新的时间
                    const currentEndTime = new Date(this.currentUser.membershipEndTime);
                    
                    // 根据originalUnit字段确定时间单位
                    let timeInMilliseconds = 0;
                    const originalUnit = cdkObject.get('originalUnit') || 'hours';
                    
                    if (originalUnit === 'days') {
                        // 如果单位是天
                        timeInMilliseconds = membershipDays * 24 * 60 * 60 * 1000;
                    } else {
                        // 默认单位是小时
                        timeInMilliseconds = membershipDays * 60 * 60 * 1000;
                    }
                    
                    // 计算新的结束时间：现有结束时间 + 增加的时间
                    membershipEndTime = new Date(currentEndTime.getTime() + timeInMilliseconds);
                } else {
                    // 新用户或升级用户，使用当前时间作为开始时间
                    membershipStartTime = now;
                    
                    // 根据originalUnit字段确定时间单位
                    let timeInMilliseconds = 0;
                    const originalUnit = cdkObject.get('originalUnit') || 'hours';
                    
                    if (originalUnit === 'days') {
                        // 如果单位是天
                        timeInMilliseconds = membershipDays * 24 * 60 * 60 * 1000;
                    } else {
                        // 默认单位是小时
                        timeInMilliseconds = membershipDays * 60 * 60 * 1000;
                    }
                    
                    // 计算结束时间：开始时间 + 时间（根据单位）
                    membershipEndTime = new Date(now.getTime() + timeInMilliseconds);
                }
                
              
            }

            // 4. 更新用户会员状态
            const userQuery = new AV.Query(this.ExamUser);
            const user = await userQuery.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户信息不存在');
            }

            // 更新用户会员信息
            user.set('membershipType', membershipType);
            user.set('membershipStartTime', membershipStartTime);
            user.set('membershipEndTime', membershipEndTime);

 

            // 6. 同时保存用户
            await Promise.all([
                user.save(),
            
            ]);

            // 7. 删除CDK记录（按用户要求）
            await cdkObject.destroy();
 

            // 8. 更新本地用户信息
            this.currentUser.membershipType = membershipType;
            this.currentUser.membershipStartTime = membershipStartTime ? membershipStartTime.toISOString() : null;
            this.currentUser.membershipEndTime = membershipEndTime ? membershipEndTime.toISOString() : null;
            
            // 为VIP/SVIP用户创建会话
            let sessionId = null;
            if (membershipType === 'vip' || membershipType === 'svip') {
              
                const sessionResult = await this.createUserSession(user.id);
                if (sessionResult.success) {
                    sessionId = sessionResult.sessionId;
                    this.currentUser.sessionId = sessionId;
               
                } else {
                    console.warn('会话创建失败:', sessionResult.message);
                }
            }
            
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));

            const membershipDisplayName = {
                'vip': 'VIP',
                'svip': 'SVIP', 
                'sssvip': 'SSSVIP'
            }[membershipType] || membershipType;

            // 获取时间单位显示名称
            const originalUnit = cdkObject.get('originalUnit') || 'hours';
            const unitDisplayName = originalUnit === 'days' ? '天' : '小时';

            // 根据是否是续费来显示不同的消息
            let successMessage = '';
            if (membershipType === 'sssvip') {
                successMessage = `🎉 恭喜！您已成功升级为${membershipDisplayName}永久会员！`;
            } else if (this.currentUser && 
                      this.currentUser.membershipType === membershipType && 
                      this.currentUser.membershipEndTime) {
                // 续费情况
                successMessage = `🎉 恭喜！您已成功为${membershipDisplayName}会员续费，增加${membershipDays}${unitDisplayName}！`;
            } else {
                // 新购买或升级情况
                successMessage = `🎉 恭喜！您已成功升级为${membershipDisplayName}会员，有效期${membershipDays}${unitDisplayName}！`;
            }

          
            return {
                success: true,
                message: successMessage,
                data: {
                    membershipType: membershipType,
                    membershipDays: membershipDays,
                    startTime: membershipStartTime,
                    endTime: membershipEndTime,
                    originalUnit: originalUnit,
                    unitDisplayName: unitDisplayName
                }
            };

        } catch (error) {
            console.error('❌ CDK激活失败:', error);
            return { 
                success: false, 
                message: error.message || 'CDK激活失败，请稍后重试'
            };
        }
    }
}

// 创建全局实例
window.leanCloudClient = new LeanCloudClient();

