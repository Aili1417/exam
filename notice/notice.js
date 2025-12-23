/**
 * 通知功能模块
 */

class NoticeManager {
    constructor() {
        this.STORAGE_KEY = 'notice_no_remind';
        this.isInitialized = false;
    }

    /**
     * 初始化通知模块
     */
    init() {
        try {
            // 绑定事件
            this.bindEvents();
            
            this.isInitialized = true;
            console.log('✅ 通知模块初始化成功');
            return { success: true };
        } catch (error) {
            console.error('❌ 通知模块初始化失败:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 通知按钮点击
        const noticeBtn = document.getElementById('notice-btn');
        if (noticeBtn) {
            noticeBtn.addEventListener('click', () => this.showNotice());
        }

        // 关闭按钮
        const closeBtn = document.getElementById('close-notice');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideNotice());
        }

        // 确认按钮
        const confirmBtn = document.getElementById('confirm-notice-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmNotice());
        }
    }

    /**
     * 检查是否需要显示通知
     */
    shouldShowNotice() {
        const noRemind = localStorage.getItem(this.STORAGE_KEY);
        return noRemind !== '1';
    }

    /**
     * 显示通知弹窗
     */
    showNotice() {
        const modal = document.getElementById('notice-modal');
        if (!modal) return;

        // 重置复选框状态
        const checkbox = document.getElementById('no-remind-checkbox');
        if (checkbox) {
            checkbox.checked = false;
        }

        modal.classList.remove('hidden');
    }

    /**
     * 隐藏通知弹窗
     */
    hideNotice() {
        const modal = document.getElementById('notice-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 确认通知（关闭弹窗并保存设置）
     */
    confirmNotice() {
        // 检查是否勾选了不再提醒
        const checkbox = document.getElementById('no-remind-checkbox');
        if (checkbox && checkbox.checked) {
            localStorage.setItem(this.STORAGE_KEY, '1');
            console.log('✅ 已设置不再提醒');
        }

        this.hideNotice();
    }

    /**
     * 用户登录时自动显示通知
     */
    showNoticeOnLogin() {
        if (this.shouldShowNotice()) {
            // 延迟1秒显示，避免与登录成功提示冲突
            setTimeout(() => {
                this.showNotice();
            }, 1000);
        }
    }

    /**
     * 重置不再提醒设置（用于测试或用户主动操作）
     */
    resetNoRemind() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('✅ 已重置不再提醒设置');
    }
}

// 创建全局实例
window.noticeManager = new NoticeManager();
