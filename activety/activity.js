/**
 * 邀请抽奖活动模块
 */

class InvitationLotteryActivity {
    constructor() {
        this.ActivityUser = null; // LeanCloud活动用户类
        this.isInitialized = false;
        this.CUTOFF_DATE = new Date('2025-12-31T16:00:00'); // 老用户判定时间
        this.currentActivityUser = null; // 当前用户的活动记录
        this.isSpinning = false; // 转盘是否正在旋转
        
        // 抽奖概率配置
        this.lotteryPrizes = [
            { id: 'thanks', name: '谢谢参与', probability: 70, membershipDays: 0 },
            { id: '1day', name: '1天会员', probability: 20, membershipDays: 1 },
            { id: '2day', name: '2天会员', probability: 4, membershipDays: 2 },
            { id: '3day', name: '3天会员', probability: 3.555, membershipDays: 3 },
            { id: '7day', name: '7天会员', probability: 2.444, membershipDays: 7 },
            { id: '1month', name: '1个月会员', probability: 0.001, membershipDays: 30 }
        ];
    }

    /**
     * 初始化活动模块
     */
    async init() {
        try {
            // 定义活动用户类
            this.ActivityUser = AV.Object.extend('ActivityUser');
            this.isInitialized = true;
            
            // 绑定事件
            this.bindEvents();
            
    
            return { success: true };
        } catch (error) {
            console.error('❌ 邀请抽奖活动模块初始化失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 活动按钮点击
        const activityBtn = document.getElementById('activity-btn');
        if (activityBtn) {
            activityBtn.addEventListener('click', () => this.showActivity());
        }

        // 关闭按钮
        const closeBtn = document.getElementById('close-activity');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideActivity());
        }

        // 标签切换
        const lotteryTab = document.getElementById('lottery-tab');
        const inviteTab = document.getElementById('invite-tab');
        if (lotteryTab) {
            lotteryTab.addEventListener('click', () => this.switchTab('lottery'));
        }
        if (inviteTab) {
            inviteTab.addEventListener('click', () => this.switchTab('invite'));
        }

        // 抽奖按钮
        const lotteryBtn = document.getElementById('start-lottery-btn');
        if (lotteryBtn) {
            lotteryBtn.addEventListener('click', () => this.startLottery());
        }

        // 提交邀请码
        const submitBtn = document.getElementById('submit-invitation-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitInvitationCode());
        }

        // 复制邀请码
        const copyBtn = document.getElementById('copy-code-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyInvitationCode());
        }
    }

    /**
     * 显示活动弹窗
     */
    async showActivity() {
        // 检查用户是否登录
        const userResult = window.leanCloudClient.getCurrentUser();
        if (!userResult.success || !userResult.user) {
            this.showMessage('请先登录后再参与活动', 'warning');
            return;
        }

        const currentUser = userResult.user;
        const modal = document.getElementById('activity-modal');
        if (!modal) return;

        // 检查用户身份并初始化活动数据
        await this.initializeUserActivity(currentUser.email);
        
        // 修复可能存在的数据问题
        await this.fixUserTotalChances();
        
        // 更新界面显示
        this.updateActivityDisplay();

        modal.classList.remove('hidden');
    }

    /**
     * 隐藏活动弹窗
     */
    hideActivity() {
        const modal = document.getElementById('activity-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 切换标签
     */
    switchTab(tabName) {
        const lotteryTab = document.getElementById('lottery-tab');
        const inviteTab = document.getElementById('invite-tab');
        const lotterySection = document.getElementById('lottery-section');
        const inviteSection = document.getElementById('invite-section');

        if (tabName === 'lottery') {
            lotteryTab.classList.add('active');
            inviteTab.classList.remove('active');
            lotterySection.classList.remove('hidden');
            inviteSection.classList.add('hidden');
        } else {
            lotteryTab.classList.remove('active');
            inviteTab.classList.add('active');
            lotterySection.classList.add('hidden');
            inviteSection.classList.remove('hidden');
        }
    }

    /**
     * 初始化用户活动数据
     */
    async initializeUserActivity(email) {
        try {
            // 查询活动用户表
            const query = new AV.Query(this.ActivityUser);
            query.equalTo('email', email);
            let activityUser = await query.first();

            if (activityUser) {
                // 已存在记录，检查是否需要补充抽奖字段
                const remainingChances = activityUser.get('remainingLotteryChances');
                const totalChances = activityUser.get('totalLotteryChances');
                
                if (remainingChances === undefined || totalChances === undefined) {
                    // 补充缺失的抽奖字段
                    const recordsCount = (activityUser.get('lotteryRecords') || []).length;
                    
                    if (remainingChances === undefined) {
                        // 如果没有剩余次数，根据是否有记录来设置
                        activityUser.set('remainingLotteryChances', recordsCount > 0 ? 0 : 1);
                    }
                    if (totalChances === undefined) {
                        // 已抽奖次数应该等于记录数量
                        activityUser.set('totalLotteryChances', recordsCount);
                    }
                    if (activityUser.get('lotteryRecords') === undefined) {
                        activityUser.set('lotteryRecords', []);
                    }
                    if (activityUser.get('guaranteeCount') === undefined) {
                        activityUser.set('guaranteeCount', 0);
                    }
                    await activityUser.save();
                   
                }
                
                this.currentActivityUser = activityUser;
                return;
            }

            // 没有记录，检查用户注册时间
            const userQuery = new AV.Query(window.leanCloudClient.ExamUser);
            userQuery.equalTo('email', email);
            const examUser = await userQuery.first();

            let isOldUser = false;
            let invitationCode = null;

            if (examUser) {
                const createdAt = examUser.createdAt;
                if (createdAt < this.CUTOFF_DATE) {
                    // 老用户，生成邀请码
                    isOldUser = true;
                    invitationCode = this.generateInvitationCode();
                }
            }

            // 创建活动记录（新老用户都创建，都有初始抽奖机会）
            this.currentActivityUser = await this.createActivityUser(email, invitationCode, isOldUser);

        } catch (error) {
            console.error('初始化用户活动数据失败:', error);
            throw error;
        }
    }

    /**
     * 创建活动用户记录
     */
    async createActivityUser(email, invitationCode, isOldUser) {
        try {
            const activityUser = new this.ActivityUser();
            activityUser.set('email', email);
            activityUser.set('invitationCode', invitationCode); // 老用户的邀请码，新用户为null
            activityUser.set('isOldUser', isOldUser);
            activityUser.set('invitedUsers', []); // 被邀请用户列表
            activityUser.set('usedInvitationCodes', []); // 新用户输入过的邀请码列表
            
            // 抽奖相关字段
            activityUser.set('remainingLotteryChances', 1); // 剩余抽奖次数，初始为1
            activityUser.set('totalLotteryChances', 0); // 已抽奖次数，初始为0
            activityUser.set('lotteryRecords', []); // 抽奖记录
            activityUser.set('guaranteeCount', 0); // 保底计数器

            await activityUser.save();
            return activityUser;
        } catch (error) {
            console.error('创建活动用户失败:', error);
            throw error;
        }
    }

    /**
     * 更新活动界面显示
     */
    updateActivityDisplay() {
        if (!this.currentActivityUser) return;

        const isOldUser = this.currentActivityUser.get('isOldUser');
        
        // 更新抽奖信息
        this.updateLotteryDisplay();

        // 更新邀请界面
        if (isOldUser) {
            this.showOldUserSection(
                this.currentActivityUser.get('invitationCode'),
                this.currentActivityUser
            );
        } else {
            this.showNewUserSection();
        }
    }

    /**
     * 更新抽奖界面显示
     */
    updateLotteryDisplay() {
        if (!this.currentActivityUser) return;

        const remainingChances = this.currentActivityUser.get('remainingLotteryChances') || 0;
        const totalChances = this.currentActivityUser.get('totalLotteryChances') || 0;
        const lotteryRecords = this.currentActivityUser.get('lotteryRecords') || [];

        // 更新抽奖次数显示
        const remainingElement = document.getElementById('remaining-chances');
        const totalElement = document.getElementById('total-chances');
        if (remainingElement) remainingElement.textContent = remainingChances;
        if (totalElement) totalElement.textContent = totalChances;

        // 更新抽奖按钮状态
        const lotteryBtn = document.getElementById('start-lottery-btn');
        if (lotteryBtn) {
            if (remainingChances > 0 && !this.isSpinning) {
                lotteryBtn.disabled = false;
                const guaranteeCount = this.currentActivityUser.get('guaranteeCount') || 0;
                
                // 如果guaranteeCount==5，下次是第5次抽奖，会触发保底
                if (guaranteeCount === 5) {
                    lotteryBtn.innerHTML = '<i class="fas fa-crown"></i><span>保底抽奖</span>';
                    lotteryBtn.classList.add('guarantee-btn');
                } else {
                    lotteryBtn.innerHTML = '<i class="fas fa-play"></i><span>开始抽奖</span>';
                    lotteryBtn.classList.remove('guarantee-btn');
                }
            } else if (this.isSpinning) {
                lotteryBtn.disabled = true;
                lotteryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>抽奖中...</span>';
                lotteryBtn.classList.remove('guarantee-btn');
            } else {
                lotteryBtn.disabled = true;
                lotteryBtn.innerHTML = '<i class="fas fa-times"></i><span>无抽奖次数</span>';
                lotteryBtn.classList.remove('guarantee-btn');
            }
        }

        // 更新抽奖记录
        this.updateLotteryRecords(lotteryRecords);
    }



    /**
     * 更新抽奖记录显示
     */
    updateLotteryRecords(records) {
        const container = document.getElementById('lottery-records-list');
        if (!container) return;

        if (records.length === 0) {
            container.innerHTML = '<div class="no-records">暂无抽奖记录</div>';
            return;
        }

        container.innerHTML = records.slice(-10).reverse().map(record => {
            const time = new Date(record.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const prizeClass = record.prize === '谢谢参与' ? 'thanks' : 'reward';
            
            return `
                <div class="record-item">
                    <span class="record-prize ${prizeClass}">${record.prize}</span>
                    <span class="record-time">${time}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * 开始抽奖
     */
    async startLottery() {
        if (!this.currentActivityUser || this.isSpinning) return;

        const remainingChances = this.currentActivityUser.get('remainingLotteryChances') || 0;
        if (remainingChances <= 0) {
            this.showMessage('您没有剩余的抽奖次数', 'warning');
            return;
        }

        this.isSpinning = true;
        this.updateLotteryDisplay();

        try {
            // 计算中奖结果
            const result = this.calculateLotteryResult();
            
            // 执行转盘动画
            await this.spinWheel(result.prizeId);
            
            // 更新数据库
            await this.updateLotteryResult(result);
            
            // 显示结果
            this.showLotteryResult(result);
            
            // 如果中奖，发放奖励
            if (result.membershipDays > 0) {
                await this.awardMembership(result.membershipDays);
            }

        } catch (error) {
            console.error('抽奖失败:', error);
            this.showMessage('抽奖失败，请重试', 'error');
        } finally {
            this.isSpinning = false;
            this.updateLotteryDisplay();
            
            // 调试信息
            this.debugUserData();
        }
    }

    /**
     * 计算抽奖结果
     */
    calculateLotteryResult() {
        const guaranteeCount = this.currentActivityUser.get('guaranteeCount') || 0;
        
        // 检查保底机制（抽5次保底1个月会员）
        // 注意：guaranteeCount是即将抽奖前的计数，所以>=4表示这是第5次
        if (guaranteeCount >= 5) {
            return {
                prizeId: '1month',
                prize: '1个月会员',
                membershipDays: 30,
                isGuarantee: true,
            };
        }

        // 正常概率抽奖
        const random = Math.random() * 100;
        let currentProbability = 0;

        for (const prize of this.lotteryPrizes) {
            currentProbability += prize.probability;
            if (random <= currentProbability) {
                return {
                    prizeId: prize.id,
                    prize: prize.name,
                    membershipDays: prize.membershipDays,
                    isGuarantee: false
                };
            }
        }

        // 默认返回谢谢参与
        return {
            prizeId: 'thanks',
            prize: '谢谢参与',
            membershipDays: 0,
            isGuarantee: false
        };
    }

    /**
     * 执行转盘动画
     */
    async spinWheel(prizeId) {
        const display = document.getElementById('lottery-display');
        const displayText = document.getElementById('display-text');
        if (!display || !displayText) return;

        // 奖项文本映射
        const prizeTexts = {
            'thanks': '谢谢参与',
            '1day': '1天会员',
            '2day': '2天会员', 
            '3day': '3天会员',
            '7day': '7天会员',
            '1month': '1个月会员'
        };

        // 所有奖项文本数组
        const allPrizes = Object.values(prizeTexts);
        const targetPrize = prizeTexts[prizeId];

        // 开始闪烁动画
        display.classList.add('spinning');
        
        let currentIndex = 0;
        const flashInterval = 150; // 闪烁间隔
        const totalDuration = 3000; // 总持续时间
        const flashCount = Math.floor(totalDuration / flashInterval);
        
        return new Promise(resolve => {
            let count = 0;
            
            const flashTimer = setInterval(() => {
                // 随机显示奖项文本
                const randomPrize = allPrizes[Math.floor(Math.random() * allPrizes.length)];
                displayText.textContent = randomPrize;
                
                count++;
                
                // 在最后几次闪烁时逐渐减慢，并确保最终显示目标奖项
                if (count >= flashCount - 3) {
                    clearInterval(flashTimer);
                    
                    // 最后的减速效果
                    setTimeout(() => {
                        displayText.textContent = targetPrize;
                        display.classList.remove('spinning');
                        display.classList.add(`result-${prizeId}`);
                        
                        // 3秒后移除结果样式，恢复初始状态
                        setTimeout(() => {
                            display.classList.remove(`result-${prizeId}`);
                            displayText.textContent = '-----';
                        }, 3000);
                        
                        resolve();
                    }, 500);
                }
            }, flashInterval);
        });
    }

    /**
     * 更新抽奖结果到数据库
     */
    async updateLotteryResult(result) {
        try {
            // 获取当前数据
            const currentRemaining = this.currentActivityUser.get('remainingLotteryChances') || 0;
            const currentTotal = this.currentActivityUser.get('totalLotteryChances') || 0;
            const currentGuarantee = this.currentActivityUser.get('guaranteeCount') || 0;
            const currentRecords = this.currentActivityUser.get('lotteryRecords') || [];

            // 减少剩余抽奖次数
            const newRemaining = Math.max(0, currentRemaining - 1);
            this.currentActivityUser.set('remainingLotteryChances', newRemaining);

            // 增加已抽奖次数
            const newTotal = currentTotal + 1;
            this.currentActivityUser.set('totalLotteryChances', newTotal);

            // 更新保底计数器 - 每次抽奖都增加，只有保底奖励时才重置
            let newGuaranteeCount = currentGuarantee + 1; // 每次抽奖都增加
            if (result.isGuarantee) {
                newGuaranteeCount = 0; // 只有保底奖励时才重置为0
            }
            this.currentActivityUser.set('guaranteeCount', newGuaranteeCount);

            // 添加抽奖记录
            const newRecord = {
                prize: result.prize,
                membershipDays: result.membershipDays,
                timestamp: new Date().toISOString(),
                isGuarantee: result.isGuarantee
            };
            const newRecords = [...currentRecords, newRecord];
            this.currentActivityUser.set('lotteryRecords', newRecords);

            // 保存到数据库
            await this.currentActivityUser.save();

           

        } catch (error) {
            console.error('❌ 更新抽奖结果失败:', error);
            throw error;
        }
    }

    /**
     * 显示抽奖结果
     */
    showLotteryResult(result) {
        let message = `🎉 恭喜您抽中：${result.prize}`;
        if (result.isGuarantee) {
            message += '（保底奖励）';
        }
        
        const messageType = result.membershipDays > 0 ? 'success' : 'info';
        this.showMessage(message, messageType);
    }

    /**
     * 发放会员奖励
     */
    async awardMembership(days) {
        try {
            const userResult = window.leanCloudClient.getCurrentUser();
            if (!userResult.success || !userResult.user) return;

            const currentUser = userResult.user;
            
            // 获取用户当前会员信息
            const query = new AV.Query(window.leanCloudClient.ExamUser);
            const user = await query.get(currentUser.id);
            
            if (!user) return;

            const currentMembershipType = user.get('membershipType');
            const currentEndTime = user.get('membershipEndTime');
            
            let newEndTime;
            
            if (currentMembershipType === 'vip' || currentMembershipType === 'svip') {
                // 已是会员，延长时间
                const baseTime = currentEndTime ? new Date(currentEndTime) : new Date();
                newEndTime = new Date(baseTime.getTime() + days * 24 * 60 * 60 * 1000);
            } else {
                // 非会员，从现在开始计算
                newEndTime = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
            }

            // 更新会员信息
            user.set('membershipType', 'vip');
            user.set('membershipStartTime', new Date());
            user.set('membershipEndTime', newEndTime);
            
            await user.save();

            // 更新本地用户信息
            if (window.leanCloudClient.currentUser) {
                window.leanCloudClient.currentUser.membershipType = 'vip';
                window.leanCloudClient.currentUser.membershipEndTime = newEndTime.toISOString();
                localStorage.setItem('examUser', JSON.stringify(window.leanCloudClient.currentUser));
            }

           
        } catch (error) {
            console.error('发放会员奖励失败:', error);
        }
    }

    /**
     * 生成6位邀请码（大写字母+数字）
     */
    generateInvitationCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * 显示新用户界面
     */
    showNewUserSection() {
        const newSection = document.getElementById('new-user-section');
        const oldSection = document.getElementById('old-user-section');
        
        if (newSection) newSection.classList.remove('hidden');
        if (oldSection) oldSection.classList.add('hidden');
        
        // 清空输入框
        const input = document.getElementById('invitation-code-input');
        if (input) input.value = '';
    }

    /**
     * 显示老用户界面
     */
    showOldUserSection(invitationCode, activityUser) {
        const newSection = document.getElementById('new-user-section');
        const oldSection = document.getElementById('old-user-section');
        
        if (newSection) newSection.classList.add('hidden');
        if (oldSection) oldSection.classList.remove('hidden');
        
        // 显示邀请码
        const codeDisplay = document.getElementById('user-invitation-code');
        if (codeDisplay) {
            codeDisplay.textContent = invitationCode;
        }
        
        // 显示邀请记录
        this.displayInvitedUsers(activityUser);
    }

    /**
     * 显示邀请记录
     */
    displayInvitedUsers(activityUser) {
        const container = document.getElementById('invited-users-container');
        const countBadge = document.getElementById('invited-count');
        
        if (!container || !activityUser) return;
        
        const invitedUsers = activityUser.get('invitedUsers') || [];
        
        // 更新计数
        if (countBadge) {
            countBadge.textContent = invitedUsers.length;
        }
        
        // 显示列表
        if (invitedUsers.length === 0) {
            container.innerHTML = '<p class="no-data">还没有人使用您的邀请码</p>';
            return;
        }
        
        container.innerHTML = invitedUsers.map(user => {
            const time = new Date(user.invitedAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="user-item">
                    <span class="user-email">${this.maskEmail(user.email)}</span>
                    <span class="user-time">${time}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * 隐藏邮箱中间部分
     */
    maskEmail(email) {
        if (!email) return '';
        const [name, domain] = email.split('@');
        if (name.length <= 3) {
            return name.charAt(0) + '***@' + domain;
        }
        const visibleStart = name.substring(0, 2);
        const visibleEnd = name.charAt(name.length - 1);
        return visibleStart + '***' + visibleEnd + '@' + domain;
    }

    /**
     * 提交邀请码
     */
    async submitInvitationCode() {
        const input = document.getElementById('invitation-code-input');
        if (!input) return;

        const code = input.value.trim().toUpperCase();
        
        // 验证邀请码格式
        if (code.length !== 6) {
            this.showMessage('请输入6位邀请码', 'warning');
            return;
        }

        // 显示加载状态
        this.showLoading('正在验证邀请码...');

        try {
            // 查询邀请码是否存在
            const query = new AV.Query(this.ActivityUser);
            query.equalTo('invitationCode', code);
            const inviter = await query.first();

            if (!inviter) {
                this.hideLoading();
                this.showMessage('邀请码不存在，请检查后重试', 'error');
                return;
            }

            // 获取当前用户
            const userResult = window.leanCloudClient.getCurrentUser();
            if (!userResult.success) {
                this.hideLoading();
                this.showMessage('获取用户信息失败', 'error');
                return;
            }

            const currentEmail = userResult.user.email;

            // 检查是否已使用过邀请码
            if (this.currentActivityUser.get('usedInvitationCodes').length > 0) {
                this.hideLoading();
                this.showMessage('您已经使用过邀请码了', 'warning');
                return;
            }

            // 记录邀请关系
            const invitedUsers = inviter.get('invitedUsers') || [];
            invitedUsers.push({
                email: currentEmail,
                invitedAt: new Date().toISOString()
            });
            inviter.set('invitedUsers', invitedUsers);

            // 给邀请人增加抽奖次数
            const inviterRemaining = inviter.get('remainingLotteryChances') || 0;
            const inviterTotal = inviter.get('totalLotteryChances') || 0;
            inviter.set('remainingLotteryChances', inviterRemaining + 1);


            await inviter.save();

            // 为新用户生成邀请码，转为老用户，并增加抽奖次数
            const newCode = this.generateInvitationCode();
            this.currentActivityUser.set('invitationCode', newCode);
            this.currentActivityUser.set('isOldUser', true);
            
            // 记录新用户输入的邀请码
            this.currentActivityUser.set('usedInvitationCodes', [{
                code: code,
                inviterEmail: inviter.get('email'),
                usedAt: new Date().toISOString()
            }]);

            // 给被邀请人增加抽奖次数
            const currentRemaining = this.currentActivityUser.get('remainingLotteryChances') || 0;
            const currentTotal = this.currentActivityUser.get('totalLotteryChances') || 0;
            this.currentActivityUser.set('remainingLotteryChances', currentRemaining + 1);
    

            await this.currentActivityUser.save();

    

            this.hideLoading();
            this.showMessage('邀请码提交成功！您已获得额外抽奖机会', 'success');

            // 2秒后刷新界面
            setTimeout(() => {
                this.updateActivityDisplay();
                this.switchTab('lottery'); // 切换到抽奖界面
            }, 2000);

        } catch (error) {
            this.hideLoading();
            console.error('提交邀请码失败:', error);
            this.showMessage('提交失败: ' + error.message, 'error');
        }
    }

    /**
     * 复制邀请码
     */
    copyInvitationCode() {
        const codeDisplay = document.getElementById('user-invitation-code');
        if (!codeDisplay) return;

        const code = codeDisplay.textContent;
        
        // 创建临时文本框复制
        const tempInput = document.createElement('input');
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        
        try {
            document.execCommand('copy');
            this.showMessage('邀请码已复制: ' + code, 'success');
        } catch (error) {
            this.showMessage('复制失败，请手动复制', 'error');
        }
        
        document.body.removeChild(tempInput);
    }

    /**
     * 修复现有用户的totalLotteryChances数据
     */
    async fixUserTotalChances() {
        if (!this.currentActivityUser) return;

        const totalChances = this.currentActivityUser.get('totalLotteryChances') || 0;
        const recordsCount = (this.currentActivityUser.get('lotteryRecords') || []).length;

        // 如果totalLotteryChances与记录数量不一致，修复数据
        if (totalChances !== recordsCount) {
            this.currentActivityUser.set('totalLotteryChances', recordsCount);
            
            try {
                await this.currentActivityUser.save();
               
            } catch (error) {
                console.error('修复数据失败:', error);
            }
        }
    }

    /**
     * 调试函数：显示当前用户活动数据
     */
    debugUserData() {
        if (!this.currentActivityUser) {
           
            return;
        }

        const data = {
            email: this.currentActivityUser.get('email'),
            isOldUser: this.currentActivityUser.get('isOldUser'),
            remainingLotteryChances: this.currentActivityUser.get('remainingLotteryChances'),
            totalLotteryChances: this.currentActivityUser.get('totalLotteryChances'),
            guaranteeCount: this.currentActivityUser.get('guaranteeCount'),
            lotteryRecords: this.currentActivityUser.get('lotteryRecords') || [],
            invitedUsers: this.currentActivityUser.get('invitedUsers') || [],
            invitationCode: this.currentActivityUser.get('invitationCode')
        };

     
        return data;
    }

    /**
     * 显示消息提示
     */
    showMessage(message, type = 'info') {
        if (window.showMessage) {
            window.showMessage(message, type);
        } else {
            alert(message);
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(text) {
        if (window.showLoading) {
            window.showLoading(text);
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        if (window.hideLoading) {
            window.hideLoading();
        }
    }
}

// 创建全局实例
window.invitationActivity = new InvitationLotteryActivity();
