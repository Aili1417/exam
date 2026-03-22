/**
 * 极简主题管理器
 * 负责主题切换、持久化存储和UI更新
 * v1.4.0 - 直接从 localStorage 读取会员信息
 */

class ThemeManager {
    constructor() {
        this.THEME_KEY = 'exam_theme_preference';
        this.MINIMAL_THEME = 'minimal';
        this.DEFAULT_THEME = 'default';
        this.currentTheme = this.DEFAULT_THEME;
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化主题管理器
     */
    init() {

        
        // 从本地存储加载主题偏好
        this.loadThemePreference();
        
        // 无权限时强制恢复默认主题并重置本地偏好
        const hasThemePermission = this.syncThemeWithPermission(false);
        
        // 仅在有权限时恢复保存的主题
        if (hasThemePermission) {
            this.applyTheme(this.currentTheme, false);
        }
        
        // 绑定主题切换按钮事件
        this.bindThemeToggleButton();
        
        // 立即更新按钮状态（从 localStorage 读取会员信息）
        this.updateThemeToggleButton();
        

    }
    
    /**
     * 从本地存储加载主题偏好
     */
    loadThemePreference() {
        try {
            const savedTheme = localStorage.getItem(this.THEME_KEY);
            if (savedTheme === this.MINIMAL_THEME || savedTheme === this.DEFAULT_THEME) {
                this.currentTheme = savedTheme;
            }
        } catch (error) {
            console.error('[主题] 加载主题偏好失败:', error);
        }
    }
    
    /**
     * 保存主题偏好到本地存储
     */
    saveThemePreference() {
        try {
            localStorage.setItem(this.THEME_KEY, this.currentTheme);
        } catch (error) {
            console.error('[主题] 保存主题偏好失败:', error);
        }
    }

    /**
     * 强制恢复默认主题，并将偏好写回本地存储
     * @param {boolean} showMessage - 是否显示提示
     */
    forceDefaultTheme(showMessage = false) {
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem(this.THEME_KEY);
        } catch (error) {
            console.error('[主题] 读取主题偏好失败:', error);
        }

        if (this.currentTheme === this.DEFAULT_THEME && savedTheme === this.DEFAULT_THEME) {
            this.updateThemeToggleButton();
            return;
        }

        const shouldNotify = showMessage && this.currentTheme !== this.DEFAULT_THEME;
        this.applyTheme(this.DEFAULT_THEME, shouldNotify);
    }

    /**
     * 根据当前权限同步主题状态
     * 无权限时强制切回默认主题，并将 exam_theme_preference 重置为 default
     * @param {boolean} showMessage - 是否显示提示
     * @returns {boolean} 当前是否仍有主题权限
     */
    syncThemeWithPermission(showMessage = false) {
        const hasPermission = this.checkMembershipPermission();
        if (!hasPermission) {
            this.forceDefaultTheme(showMessage);
            return false;
        }

        this.updateThemeToggleButton();
        return true;
    }
    
    /**
     * 应用主题
     * @param {string} theme - 主题名称 ('minimal' 或 'default')
     * @param {boolean} showMessage - 是否显示切换消息
     */
    applyTheme(theme, showMessage = true) {
        const body = document.body;
        
        if (theme === this.MINIMAL_THEME) {
            // 应用极简主题
            body.classList.add('minimal-theme');
            this.currentTheme = this.MINIMAL_THEME;
            
            // 隐藏粒子背景
            this.hideParticles();
            
            if (showMessage && typeof window.showMessage === 'function') {
                window.showMessage('已切换到极简主题', 'success');
            }
        } else {
            // 应用默认主题
            body.classList.remove('minimal-theme');
            this.currentTheme = this.DEFAULT_THEME;
            
            // 显示粒子背景
            this.showParticles();
            
            if (showMessage && typeof window.showMessage === 'function') {
                window.showMessage('已切换到默认主题', 'success');
            }
        }
        
        // 保存主题偏好
        this.saveThemePreference();
        
        // 更新主题切换按钮状态
        this.updateThemeToggleButton();
    }
    
    /**
     * 切换主题
     */
    toggleTheme() {
        // 检查会员权限
        if (!this.checkMembershipPermission()) {
            this.forceDefaultTheme(false);
            this.showMembershipRequiredMessage();
            return;
        }
        
        const newTheme = this.currentTheme === this.MINIMAL_THEME 
            ? this.DEFAULT_THEME 
            : this.MINIMAL_THEME;
        
        this.applyTheme(newTheme, true);
    }
    
    /**
     * 检查会员权限（直接从 localStorage 读取）
     * @returns {boolean} 是否有权限使用主题功能
     */
    checkMembershipPermission() {
        // 优先从本地存储的 examUser 读取会员信息
        let membershipType = null;
        
        try {
            const examUserStr = localStorage.getItem('examUser');
            if (examUserStr) {
                const examUser = JSON.parse(examUserStr);
                membershipType = examUser.membershipType;
              
            }
        } catch (e) {
            console.warn('[主题] 解析 examUser 失败:', e);
        }
        
        // 如果本地存储没有，再尝试从全局用户对象获取（备用方案）
        if (!membershipType && window.currentUser) {
            if (typeof window.currentUser.get === 'function') {
                membershipType = window.currentUser.get('membershipType');
            } else {
                membershipType = window.currentUser.membershipType;
            }
            
        }
        
        // 如果还是没有会员类型，返回false
        if (!membershipType) {
          
            return false;
        }
        
        // 转换为大写并检查是否包含 SVIP 或 SSSVIP
        const typeUpper = String(membershipType).toUpperCase().trim();
        
        
        // 检查是否包含 SVIP 或 SSSVIP（但不能只是VIP）
        let hasPermission = false;
        
        if (typeUpper.includes('SSSVIP')) {
            hasPermission = true;
            
        } else if (typeUpper.includes('SVIP')) {
            hasPermission = true;
           
        } else if (typeUpper === 'VIP') {
            hasPermission = false;
           
        } else {
            hasPermission = false;
        }console
        

        
        return hasPermission;
    }
    
    /**
     * 显示会员权限不足提示
     */
    showMembershipRequiredMessage() {
        // 如果有全局的showMessage函数，使用它
        if (typeof window.showMessage === 'function') {
            window.showMessage('主题功能仅限SVIP和SSSVIP会员使用', 'error');
        } else {
            alert('主题功能仅限SVIP和SSSVIP会员使用\n\n请升级到SVIP或SSSVIP会员以使用此功能');
        }
    }
    
    /**
     * 隐藏粒子背景
     */
    hideParticles() {
        const particlesContainer = document.getElementById('particles-js');
        if (particlesContainer) {
            particlesContainer.style.display = 'none';
        }
    }
    
    /**
     * 显示粒子背景
     */
    showParticles() {
        const particlesContainer = document.getElementById('particles-js');
        if (particlesContainer) {
            particlesContainer.style.display = 'block';
            
            // 重新初始化粒子背景
            setTimeout(() => {
                try {
                    // 检查particlesJS函数是否存在
                    if (typeof particlesJS !== 'undefined' && particlesJS) {
                        // 重新初始化粒子背景
                        if (window.initParticles && typeof window.initParticles === 'function') {
                            window.initParticles();
                        } else {
                            // 如果没有initParticles函数，尝试直接重新初始化
                            particlesJS('particles-js', {
                                particles: {
                                    number: {
                                        value: 80,
                                        density: {
                                            enable: true,
                                            value_area: 800
                                        }
                                    },
                                    color: {
                                        value: '#ffffff'
                                    },
                                    shape: {
                                        type: 'circle'
                                    },
                                    opacity: {
                                        value: 0.5,
                                        random: false,
                                        anim: {
                                            enable: false
                                        }
                                    },
                                    size: {
                                        value: 3,
                                        random: true,
                                        anim: {
                                            enable: false
                                        }
                                    },
                                    line_linked: {
                                        enable: true,
                                        distance: 150,
                                        color: '#ffffff',
                                        opacity: 0.4,
                                        width: 1
                                    },
                                    move: {
                                        enable: true,
                                        speed: 2,
                                        direction: 'none',
                                        random: false,
                                        straight: false,
                                        out_mode: 'out',
                                        bounce: false
                                    }
                                },
                                interactivity: {
                                    detect_on: 'canvas',
                                    events: {
                                        onhover: {
                                            enable: true,
                                            mode: 'grab'
                                        },
                                        onclick: {
                                            enable: true,
                                            mode: 'push'
                                        },
                                        resize: true
                                    },
                                    modes: {
                                        grab: {
                                            distance: 140,
                                            line_linked: {
                                                opacity: 1
                                            }
                                        },
                                        push: {
                                            particles_nb: 4
                                        }
                                    }
                                },
                                retina_detect: true
                            });
                        }
                    }
                } catch (error) {
                    console.warn('[主题] 重新初始化粒子背景失败:', error);
                }
            }, 100);
        }
    }
    
    /**
     * 绑定主题切换按钮事件
     */
    bindThemeToggleButton() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    }
    
    /**
     * 更新主题切换按钮状态
     */
    updateThemeToggleButton() {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (!themeToggleBtn) {
            return;
        }
        
        const icon = themeToggleBtn.querySelector('i');
        const text = themeToggleBtn.querySelector('.theme-text');
        const small = themeToggleBtn.querySelector('small');
        
        // 检查会员权限
        const hasPermission = this.checkMembershipPermission();
 
        
        if (this.currentTheme === this.MINIMAL_THEME) {
            // 当前是极简主题，按钮显示"切换到默认主题"
            if (icon) {
                icon.className = hasPermission ? 'fas fa-palette' : 'fas fa-lock';
            }
            if (text) {
                text.textContent = '默认主题';
            }
            if (small) {
                small.textContent = hasPermission ? '彩色渐变，有粒子背景' : '需要SVIP/SSSVIP会员';
            }
            themeToggleBtn.classList.add('minimal-active');
        } else {
            // 当前是默认主题，按钮显示"切换到极简主题"
            if (icon) {
                icon.className = hasPermission ? 'fas fa-adjust' : 'fas fa-lock';
            }
            if (text) {
                text.textContent = '极简主题';
            }
            if (small) {
                small.textContent = hasPermission ? '黑底白字，无粒子背景' : '需要SVIP/SSSVIP会员';
            }
            themeToggleBtn.classList.remove('minimal-active');
        }
        
        // 更新锁定状态
        if (!hasPermission) {
            themeToggleBtn.classList.add('locked');
     ;
        } else {
            themeToggleBtn.classList.remove('locked');
            
        }
    }
    
    /**
     * 获取当前主题
     * @returns {string} 当前主题名称
     */
    getCurrentTheme() {
        return this.currentTheme;
    }
    
    /**
     * 检查是否为极简主题
     * @returns {boolean}
     */
    isMinimalTheme() {
        return this.currentTheme === this.MINIMAL_THEME;
    }
}

// 创建全局主题管理器实例
window.themeManager = null;

// 在DOM加载完成后初始化主题管理器
document.addEventListener('DOMContentLoaded', function() {
    window.themeManager = new ThemeManager();
});

// 导出主题管理器类（用于模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
