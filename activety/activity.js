/**
 * 邀请新人送会员活动模块
 */

class InvitationActivity {
    constructor() {
        this.ActivityUser = null; // LeanCloud活动用户类
        this.isInitialized = false;
        this.CUTOFF_DATE = new Date('2025-12-22T00:00:00'); // 老用户判定时间
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
            
            console.log('✅ 邀请活动模块初始化成功');
            return { success: true };
        } catch (error) {
            console.error('❌ 邀请活动模块初始化失败:', error);
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

        // 检查用户身份
        const userStatus = await this.checkUserStatus(currentUser.email);
        
        if (userStatus.isOldUser) {
            // 老用户：显示邀请码
            this.showOldUserSection(userStatus.invitationCode, userStatus.activityUser);
        } else {
            // 新用户：显示输入框
            this.showNewUserSection();
        }

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
     * 检查用户状态（新用户/老用户）
     */
    async checkUserStatus(email) {
        try {
            // 查询活动用户表
            const query = new AV.Query(this.ActivityUser);
            query.equalTo('email', email);
            let activityUser = await query.first();
    
            if (activityUser) {
                // 已存在记录，是老用户
                return {
                    isOldUser: true,
                    invitationCode: activityUser.get('invitationCode'),
                    activityUser: activityUser
                };
            }
    
            // 没有记录，检查用户注册时间（从 ExamUser 表）
            const userQuery = new AV.Query(window.leanCloudClient.ExamUser);
            userQuery.equalTo('email', email);
            const examUser = await userQuery.first();
    
            if (examUser) {
                const createdAt = examUser.createdAt;
                if (createdAt < this.CUTOFF_DATE) {
                    // 2025.12.22之前注册的是老用户，自动创建活动记录
                    const code = this.generateInvitationCode();
                    const newActivityUser = await this.createActivityUser(email, code, true);
                    return {
                        isOldUser: true,
                        invitationCode: code,
                        activityUser: newActivityUser
                    };
                }
            }
    
            // 新用户（不创建记录，等待输入邀请码后再创建）
            return {
                isOldUser: false,
                invitationCode: null,
                activityUser: null
            };
        } catch (error) {
            console.error('检查用户状态失败:', error);
            throw error;
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
     * 创建活动用户记录
     */
    async createActivityUser(email, invitationCode, isOldUser) {
        try {
            const activityUser = new this.ActivityUser();
            activityUser.set('email', email);
            activityUser.set('invitationCode', invitationCode); // 老用户的邀请码
            activityUser.set('isOldUser', isOldUser);
            activityUser.set('invitedUsers', []); // 被邀请用户列表（哪些新用户输入了我的邀请码）
            activityUser.set('usedInvitationCodes', []); // 新用户输入过的邀请码列表
            activityUser.set('rewardRecords', []); // 奖励记录
            await activityUser.save();
            return activityUser;
        } catch (error) {
            console.error('创建活动用户失败:', error);
            throw error;
        }
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
            const checkQuery = new AV.Query(this.ActivityUser);
            checkQuery.equalTo('email', currentEmail);
            const existing = await checkQuery.first();

            if (existing) {
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

            // 添加奖励记录（待管理员发放）
            const rewardRecords = inviter.get('rewardRecords') || [];
            rewardRecords.push({
                email: currentEmail,
                recordedAt: new Date().toISOString(),
                status: 'pending' // pending: 待发放, issued: 已发放
            });
            inviter.set('rewardRecords', rewardRecords);

            await inviter.save();

            // 为新用户生成邀请码，转为老用户
            const newCode = this.generateInvitationCode();
            const newActivityUser = await this.createActivityUser(currentEmail, newCode, true);
            
            // 记录新用户输入的邀请码
            newActivityUser.set('usedInvitationCodes', [{
                code: code,
                inviterEmail: inviter.get('email'),
                usedAt: new Date().toISOString()
            }]);
            await newActivityUser.save();

            this.hideLoading();
            this.showMessage('邀请码提交成功！您已成为老用户', 'success');

            // 2秒后刷新界面
            setTimeout(() => {
                this.showOldUserSection(newCode, newActivityUser);
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
window.invitationActivity = new InvitationActivity();
