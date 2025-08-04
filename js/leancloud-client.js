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

            // 定义Question类
            this.Question = AV.Object.extend('Question');
            
            // 定义ExamUser类
            this.ExamUser = AV.Object.extend('ExamUser');

            this.isInitialized = true;
            console.log('LeanCloud初始化成功');
            return { success: true, message: 'LeanCloud初始化成功' };
        } catch (error) {
            console.error('LeanCloud初始化失败:', error);
            return { success: false, message: `LeanCloud初始化失败: ${error.message}` };
        }
    }

    /**
     * 获取所有题目
     */
    async getAllQuestions() {
        try {
            if (!this.isInitialized) {
                throw new Error('LeanCloud未初始化');
            }

            const query = new AV.Query(this.Question);
            query.limit(1000); // 设置查询限制
            query.ascending('createdAt'); // 按创建时间升序排列

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
            console.error('获取题目失败:', error);
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
            console.error(`获取${type}题目失败:`, error);
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
                console.warn('会员用户缺少activeSession信息');
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
            console.error('会话验证失败:', error);
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
            
            console.log('🔍 准备保存的activeSession数据:', JSON.stringify(activeSession, null, 2));

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(userId);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            const membershipType = user.get('membershipType');
            
            // 只为VIP和SVIP用户创建会话限制
            if (membershipType === 'vip' || membershipType === 'svip') {
                console.log(`🔐 为${membershipType.toUpperCase()}用户创建单设备会话限制`);
                
                // 🔧 确保LeanCloud正确处理Object类型数据
                try {
                    user.set('activeSession', activeSession);
                    await user.save();
                    console.log('✅ activeSession保存成功:', activeSession);
                } catch (saveError) {
                    console.error('❌ activeSession保存失败:', saveError);
                    // 如果直接设置失败，尝试使用LeanCloud的addUnique方法
                    console.log('🔄 尝试替代方案...');
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
            console.error('创建用户会话失败:', error);
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

            console.log('🔄 开始同步本地数据到云端...');

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

            if (localData.favorites) {
                const existingFavorites = user.get('favorites') || {};
                const mergedFavorites = { ...existingFavorites, ...localData.favorites };
                user.set('favorites', mergedFavorites);
            }

            if (localData.wrongQuestions) {
                const existingWrong = user.get('wrongQuestions') || {};
                const mergedWrong = { ...existingWrong, ...localData.wrongQuestions };
                user.set('wrongQuestions', mergedWrong);
            }

            if (localData.progressData) {
                const existingProgress = user.get('progressData') || {};
                const mergedProgress = { ...existingProgress, ...localData.progressData };
                user.set('progressData', mergedProgress);
            }

            // 保存到云端
            await user.save();

            console.log('✅ 云同步完成');
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

            console.log('🔐 开始修改密码...');

            // 🔧 正确的方案：从ExamUser表验证当前密码
            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 🔐 验证当前密码
            console.log('🔐 验证当前密码...');
            const currentPasswordHash = this._hashPassword(currentPassword);
            const storedPasswordHash = user.get('password');
            
            if (currentPasswordHash !== storedPasswordHash) {
                console.error('当前密码验证失败: 密码不匹配');
                throw new Error('原密码不正确');
            }
            
            console.log('✅ 当前密码验证成功');

            // 🔐 更新为新密码
            console.log('🔐 更新密码...');
            const newPasswordHash = this._hashPassword(newPassword);
            user.set('password', newPasswordHash);
            
            await user.save();
            
            console.log('✅ 密码修改成功');
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
                
                    throw new Error('您的会员已过期，请重新购买会员后登录');
                }
            }

            // ✅ 只有非过期用户才设置用户数据和本地存储
            
            // 🔐 为VIP/SVIP用户创建会话限制
            let sessionId = null;
            if (membershipType === 'vip' || membershipType === 'svip') {
                console.log(`🔐 检测到${membershipType.toUpperCase()}用户，创建单设备会话限制`);
                const sessionResult = await this.createUserSession(user.id);
                if (sessionResult.success) {
                    sessionId = sessionResult.sessionId;
                    console.log(`✅ 会话创建成功: ${sessionId}`);
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
                console.log('🔐 清除VIP/SVIP用户会话');
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

            // 🔐 为VIP和SVIP用户创建或更新会话
            if (this.currentUser.membershipType === 'vip' || this.currentUser.membershipType === 'svip' || this.currentUser.membershipType === 'sssvip') {
                console.log(`🔐 自动登录 - 为${this.currentUser.membershipType.toUpperCase()}用户创建会话`);
                const sessionResult = await this.createUserSession(user.id);
                if (sessionResult.success) {
                    this.currentUser.sessionId = sessionResult.sessionId;
                    console.log('✅ 自动登录会话创建成功');
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
     * 同步本地数据到云端
     */
    async syncDataToCloud(localData) {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            // 更新用户数据
            if (localData.progressData) {
                user.set('progressData', localData.progressData);
            }
            if (localData.wrongQuestions) {
                user.set('wrongQuestions', localData.wrongQuestions);
            }
            if (localData.favorites) {
                user.set('favorites', localData.favorites);
            }
            if (localData.userStats) {
                user.set('userStats', localData.userStats);
            }


            await user.save();
            
            // 更新本地用户信息
            this.currentUser.progressData = localData.progressData || this.currentUser.progressData;
            this.currentUser.wrongQuestions = localData.wrongQuestions || this.currentUser.wrongQuestions;
            this.currentUser.favorites = localData.favorites || this.currentUser.favorites;
            this.currentUser.userStats = localData.userStats || this.currentUser.userStats;

            
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));


            return { success: true, message: '数据同步成功' };
        } catch (error) {
            console.error('同步数据到云端失败:', error);
            return { success: false, message: error.message || '同步失败' };
        }
    }

    /**
     * 从云端导入数据到本地
     */
    async importDataFromCloud() {
        try {
            if (!this.currentUser) {
                throw new Error('用户未登录');
            }

            const query = new AV.Query(this.ExamUser);
            const user = await query.get(this.currentUser.id);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            const cloudData = {
                progressData: user.get('progressData') || {},
                wrongQuestions: user.get('wrongQuestions') || {},
                favorites: user.get('favorites') || {},
                userStats: user.get('userStats') || {},
                statistics: user.get('statistics') || {}
            };

            // 更新本地用户信息
            this.currentUser.progressData = cloudData.progressData;
            this.currentUser.wrongQuestions = cloudData.wrongQuestions;
            this.currentUser.favorites = cloudData.favorites;
            this.currentUser.userStats = cloudData.userStats;
      
            
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));

      
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
        console.log('🚀 开始发送验证码流程 for:', email);
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
            console.log('📧 检查邮箱是否已注册:', email);
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
                    console.log(`删除了 ${oldCodes.length} 个旧验证码`);
                }
            } catch (deleteError) {
                console.log('删除旧验证码时出错（可忽略）:', deleteError);
                // 删除失败不影响新验证码的创建
            }
            
            // 存储新验证码（5分钟过期）
            const vcObject = new VerificationCode();
            vcObject.set('email', email);
            vcObject.set('code', code);
            vcObject.set('expiresAt', new Date(Date.now() + 5 * 60 * 1000));
            
            console.log('保存验证码到LeanCloud:', { email, code });
            
            try {
                await vcObject.save();
                console.log('验证码保存成功');
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
            
            console.log('准备发送邮件:', templateParams);
            
            try {
                const result = await emailjs.send(
                    'default_service', // 如果不工作，请替换为您的实际Service ID
                    'template_16tib69', // 您的模板ID
                    templateParams,
                    'xzO6Di-kOyucPdAdr' // 您的Public Key
                );
                console.log('EmailJS响应:', result);
                console.log('邮件发送成功');
            } catch (emailError) {
                console.error('邮件发送失败:', emailError);
                // 邮件发送失败但验证码已保存，用户仍可以使用
                return { 
                    success: true, 
                    message: '验证码已生成，如果未收到邮件请检查垃圾邮件箱或重新发送' 
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
     * 验证码注册用户（LeanCloud数据表验证）
     */
    async registerUserWithCode(email, code, password) {
        console.log('🔐 开始验证码注册流程 for:', email);
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
            console.log('🔍 验证验证码:', { email, code });
            const VerificationCode = AV.Object.extend('VerificationCode');
            const query = new AV.Query(VerificationCode);
            query.equalTo('email', email);
            query.equalTo('code', code);
            query.greaterThan('expiresAt', new Date());
            query.descending('createdAt');
            
            const vcObject = await query.first();
            if (!vcObject) {
                console.log('❌ 验证码验证失败');
                throw new Error('验证码无效或已过期');
            }
            console.log('✅ 验证码验证成功');
            
            // 注：不需要再次检查邮箱是否已注册，因为发送验证码时已经检查过
            // 如果仍有冲突，数据库的唯一约束会自动处理
            
            // 创建新用户
            console.log('👤 开始创建用户');
            const user = new this.ExamUser();
            const username = email.split('@')[0]; // 从邮箱提取用户名
            const hashedPassword = this._hashPassword(password);

            user.set('email', email);
            user.set('username', username);
            user.set('password', hashedPassword);
            user.set('membershipType', '非会员');
            
            // 会员时间字段，非会员默认为空
            user.set('membershipStartTime', null);
            user.set('membershipEndTime', null);
            
            // 初始化进度数据 - 对应 exam_progress_${type} 的格式
            user.set('progressData', {
                single_choice: {
                    currentIndex: 0,
                    userAnswers: [],
                    judgedAnswers: [],
                    detailedProgress: [],
                    timestamp: Date.now()
                },
                multiple_choice: {
                    currentIndex: 0,
                    userAnswers: [],
                    judgedAnswers: [],
                    detailedProgress: [],
                    timestamp: Date.now()
                },
                true_false: {
                    currentIndex: 0,
                    userAnswers: [],
                    judgedAnswers: [],
                    detailedProgress: [],
                    timestamp: Date.now()
                },
                fill_blank: {
                    currentIndex: 0,
                    userAnswers: [],
                    judgedAnswers: [],
                    detailedProgress: [],
                    timestamp: Date.now()
                }
            });
            
            // 初始化错题本 - 对应 exam_wrong_questions 的格式
            user.set('wrongQuestions', {
                single_choice: [],
                multiple_choice: [],
                true_false: [],
                fill_blank: []
            });
            
            // 初始化收藏 - 对应 exam_favorites 的格式
            user.set('favorites', {
                single_choice: [],
                multiple_choice: [],
                true_false: [],
                fill_blank: []
            });
            
            // 初始化用户统计 - 对应 exam_user_stats 的格式
            user.set('userStats', {
                completed: 0,
                correct: 0,
                total: 0,
                correctRate: 0
            });
            
            await user.save();
            console.log('✅ 用户创建成功');
            
            // 注册成功后删除验证码
            await vcObject.destroy();
            console.log('🗑️ 验证码已删除');
            
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

            console.log('🎫 开始CDK激活流程:', cdkCode);

            // 1. 查询CDK是否存在且未使用
            const CDK = AV.Object.extend('cdk');
            const cdkQuery = new AV.Query(CDK);
            cdkQuery.equalTo('context', cdkCode.trim().toUpperCase());
   

            const cdkObject = await cdkQuery.first();

            if (!cdkObject) {
                console.log('❌ CDK不存在或已被使用');
                throw new Error('CDK激活码无效或已被使用');
            }

            console.log('✅ CDK验证通过:', {
                type: cdkObject.get('type'),
                endtime: cdkObject.get('endtime')
            });

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
                membershipStartTime = now;
                
                // 计算结束时间：开始时间 + 天数
                membershipEndTime = new Date(now.getTime() + membershipDays * 24 * 60 * 60 * 1000);
                
                console.log('⏰ 计算会员时间:', {
                    startTime: membershipStartTime.toLocaleString('zh-CN'),
                    endTime: membershipEndTime.toLocaleString('zh-CN'),
                    days: membershipDays
                });
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
            console.log('🗑️ CDK记录已删除');

            // 8. 更新本地用户信息
            this.currentUser.membershipType = membershipType;
            this.currentUser.membershipStartTime = membershipStartTime ? membershipStartTime.toISOString() : null;
            this.currentUser.membershipEndTime = membershipEndTime ? membershipEndTime.toISOString() : null;
            
            localStorage.setItem('examUser', JSON.stringify(this.currentUser));

            const membershipDisplayName = {
                'vip': 'VIP',
                'svip': 'SVIP', 
                'sssvip': 'SSSVIP'
            }[membershipType] || membershipType;

            const successMessage = membershipType === 'sssvip' 
                ? `🎉 恭喜！您已成功升级为${membershipDisplayName}永久会员！`
                : `🎉 恭喜！您已成功升级为${membershipDisplayName}会员，有效期${membershipDays}天！`;

            console.log('✅ CDK激活成功:', {
                membershipType,
                startTime: membershipStartTime?.toLocaleString('zh-CN'),
                endTime: membershipEndTime?.toLocaleString('zh-CN')
            });

            return {
                success: true,
                message: successMessage,
                data: {
                    membershipType: membershipType,
                    membershipDays: membershipDays,
                    startTime: membershipStartTime,
                    endTime: membershipEndTime
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

console.log('LeanCloud客户端已加载');