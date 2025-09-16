/**
 * 在线考试系统主脚本
 */

// 全局变量
let questionsData = {}; // 题库数据
let currentQuestions = []; // 当前题目列表
let currentQuestionIndex = 0; // 当前题目索引
let currentQuestionType = ''; // 当前题型
let userAnswers = []; // 用户答案
let judgedAnswers = []; // 已评判的答案
let isExamMode = false; // 是否为考试模式
let isReviewMode = false; // 查看详情模式
let isPracticingWrongQuestions = false; // 是否在练习错题本中的题目
let favorites = {}; // 收藏题目
let wrongQuestions = {}; // 错题本
let statistics = {
    total: 0,
    single_choice: 0,
    multiple_choice: 0,
    true_false: 0,
    fill_blank: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    correctRate: 0
}; // 统计信息
let examTimer = null; // 考试计时器
let examStartTime = null; // 考试开始时间
let examDuration = 0; // 考试总时长（分钟）

// 科目相关变量
let currentSubject = null; // 当前选择的科目
let allQuestionsData = {}; // 所有题目数据（未过滤）
let selectedSubjectOption = null; // 当前选中的科目选项

// 初始化系统
document.addEventListener('DOMContentLoaded', async function() {
    initParticles();
    initEventListeners();
    initResetDialogListeners();
    await initEmailJS(); // 等待EmailJS初始化完成
    initPasswordToggle(); // 初始化密码切换功能
    loadStoredData();
    await initSystem(); // 等待系统初始化完成
});

// 初始化EmailJS
async function initEmailJS() {
    try {
        // 检查是否已经初始化过
        if (window.emailjsInitialized) {
 
            return true;
        }
        
        // 等待动态加载器完成EmailJS加载
        if (window.dynamicLoader && window.dynamicLoader.loadEmailJS) {
            const emailjsLoaded = await window.dynamicLoader.loadEmailJS();
            if (!emailjsLoaded) {
                console.warn('EmailJS加载失败，验证码功能可能受限');
                return false;
            }
        }
        
        // 初始化EmailJS
        if (typeof emailjs !== 'undefined' && emailjs.init) {
            try {
                emailjs.init('xzO6Di-kOyucPdAdr'); // 您的Public Key
                window.emailjsInitialized = true; // 标记已初始化
                console.log('EmailJS初始化成功');
                return true;
            } catch (error) {
                console.error('EmailJS初始化错误:', error);
                return false;
            }
        } else {
            console.warn('EmailJS不可用，将使用后备方案');
            return false;
        }
    } catch (error) {
        console.error('EmailJS初始化过程出错:', error);
        return false;
    }
}

// 初始化粒子背景
function initParticles() {
    // 检查 particlesJS 是否可用
    if (typeof particlesJS === 'undefined') {

        return;
    }
    
    try {
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
    } catch (error) {
        console.error('粒子背景初始化失败:', error);
    }
}

// 加载保存的错题本和收藏题目（按科目类型）
function loadStoredWrongQuestionsAndFavorites() {
    const subjects = ['毛概', '思修', '近代史', '马原']; // 假设这些是所有科目

    wrongQuestions = {};
    favorites = {};

    subjects.forEach(subject => {
        const wrongKey = `exam_wrong_questions_${subject}`;
        const favKey = `exam_favorites_${subject}`;

        const wrongQuestionsJson = localStorage.getItem(wrongKey);
        if (wrongQuestionsJson) {
            wrongQuestions[subject] = JSON.parse(wrongQuestionsJson);
        } else {
            // 确保默认结构存在
            wrongQuestions[subject] = {
                'single_choice': [],
                'multiple_choice': [],
                'true_false': [],
                'fill_blank': []
            };
        }

        const favoritesJson = localStorage.getItem(favKey);
        if (favoritesJson) {
            favorites[subject] = JSON.parse(favoritesJson);
        } else {
            // 确保默认结构存在
            favorites[subject] = {
                'single_choice': [],
                'multiple_choice': [],
                'true_false': [],
                'fill_blank': []
            };
        }
    });
}

// 在 initSystem 中调用加载函数
async function initSystem() {
    showLoading('正在初始化系统...');
    
    try {
        // 初始化LeanCloud
        const initResult = await window.leanCloudClient.init();
        if (!initResult.success) {
            throw new Error(initResult.message);
        }
        
        updateStatus('已连接到云端数据库', 'connected');
        
        // 加载题目数据
        await loadQuestionsFromCloud();
        
        // 加载保存的错题本和收藏题目
        loadStoredWrongQuestionsAndFavorites();

        // 从已加载的题库数据中计算统计信息，不再单独请求
        calculateStatisticsFromData();
        
        // 更新UI
        updateUI();
        
        hideLoading();
        showMessage('系统初始化成功！', 'success');
        
    } catch (error) {
        console.error('系统初始化失败:', error);
        updateStatus('连接失败: ' + error.message, 'error');
        hideLoading();
        showMessage('系统初始化失败: ' + error.message, 'error');
    }
}

// 初始化事件监听器
function initEventListeners() {
    // 登录检查函数
    function requireLogin(callback) {
        if (!currentUser) {
            // 用户未登录，显示登录提示弹窗
            if (window.showLoginRequiredModal) {
                window.showLoginRequiredModal();
            }
            return false;
        }
        // 用户已登录，执行回调函数
        callback();
        return true;
    }

    // 题型按钮事件（需要登录和会员状态检查）
    document.querySelectorAll('[data-type]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            requireLogin(async () => {
                await withMembershipCheck(() => handleTypeButtonClick(e), '进入练习模式');
            });
        });
    });
    
    // 模拟考试按钮（需要登录和会员状态检查）
    document.getElementById('mock-exam-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showExamConfigModal, '开始模拟考试');
        });
    });

    // 个人中心按钮（需要登录和会员状态检查）
    document.getElementById('favorites-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showFavoritesModal, '查看收藏夹');
        });
    });
    document.getElementById('wrong-questions-btn').addEventListener('click', async () => {
        requireLogin(async () => {
            await withMembershipCheck(showWrongQuestionsModal, '查看错题本');
        });
    });

    // 题目导航事件
    document.getElementById('prev-btn').addEventListener('click', previousQuestion);
    document.getElementById('next-btn').addEventListener('click', nextQuestion);
    document.getElementById('submit-btn').addEventListener('click', submitAnswer);
    
    // 收藏按钮（需要登录）
    document.getElementById('favorite-btn').addEventListener('click', () => {
        requireLogin(toggleFavorite);
    });

    // 重置记录按钮
    document.getElementById('reset-records-btn').addEventListener('click', () => {
        showResetRecordsConfirmModal();
    });
    // 返回主页按钮（会员状态检查）
    document.getElementById('home-btn').addEventListener('click', async () => {
        if (currentUser) {
            await withMembershipCheck(returnToHome, '返回主页');
        } else {
            returnToHome();
        }
    });

    // 用户系统事件（会员状态检查）
    document.getElementById('user-center-btn').addEventListener('click', async () => {
        if (currentUser) {
            await withMembershipCheck(showUserCenterModal, '打开个人中心');
        } else {
            showUserCenterModal();
        }
    });
    document.getElementById('close-auth').addEventListener('click', hideAuthModal);
    document.getElementById('close-user-center').addEventListener('click', hideUserCenterModal);
    document.getElementById('login-register-btn').addEventListener('click', showAuthModal);
    
    // 科目选择相关事件
    document.getElementById('subject-selector-btn').addEventListener('click', handleSubjectSelectorClick);
    document.getElementById('close-subject-selector').addEventListener('click', hideSubjectSelectorModal);
    document.getElementById('confirm-subject-selection').addEventListener('click', confirmSubjectSelection);
    
    // 修改密码相关事件
    document.getElementById('change-password-btn').addEventListener('click', showChangePasswordModal);
    document.getElementById('close-change-password').addEventListener('click', hideChangePasswordModal);
    document.getElementById('cancel-change-password').addEventListener('click', hideChangePasswordModal);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('send-code-btn').addEventListener('click', handleSendVerificationCode);
    
    // 邮箱组合功能
    document.getElementById('register-username').addEventListener('input', updateEmailAddress);
    document.getElementById('email-domain').addEventListener('change', updateEmailAddress);
    
    // 数据导入和同步（需要登录）
    document.getElementById('import-data-btn').addEventListener('click', () => {
        requireLogin(importDataFromCloud);
    });
    document.getElementById('sync-data-btn').addEventListener('click', () => {
        requireLogin(syncDataToCloud);
    });
    
    // 会员系统事件
    document.getElementById('membership-btn').addEventListener('click', showMembershipModal);
    
    // CDK激活按钮事件
    document.getElementById('activate-cdk-btn').addEventListener('click', handleCDKActivation);
    
    // 联系官方按钮事件 - 滚动到会员弹窗底部
    document.getElementById('contact-official-btn').addEventListener('click', () => {
        scrollMembershipModalToBottom();
    });
    
    // 通用关闭按钮事件（通过data-modal属性）
    document.querySelectorAll('.close-btn[data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.getAttribute('data-modal');
            hideMembershipModal(modalId);
        });
    });

    // 模拟考试配置模态框事件
    document.getElementById('close-exam-config').addEventListener('click', hideExamConfigModal);
    document.getElementById('cancel-exam-config').addEventListener('click', hideExamConfigModal);
    document.getElementById('start-exam').addEventListener('click', startConfiguredExam);

    // 错题本模态框事件
    document.getElementById('close-wrong-questions').addEventListener('click', hideWrongQuestionsModal);
    document.getElementById('wrong-type-filter').addEventListener('change', filterWrongQuestions);
    document.getElementById('clear-wrong-questions').addEventListener('click', clearWrongQuestions);
    


    // 收藏模态框事件
    document.getElementById('close-favorites').addEventListener('click', hideFavoritesModal);
    document.getElementById('favorite-type-filter').addEventListener('change', filterFavorites);
    document.getElementById('clear-favorites').addEventListener('click', clearFavorites);


    // 考试配置输入事件
    ['single-count-input', 'multiple-count-input', 'judge-count-input', 'fill-count-input'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateExamSummary);
    });

    // 点击模态框外部关闭
    // 交卷相关事件
   
    // 注意：nav-submit-exam-btn 的事件监听器在 updateExamNavigation 中动态绑定
    document.getElementById('cancel-submit').addEventListener('click', hideSubmitConfirmModal);
    document.getElementById('confirm-submit').addEventListener('click', submitExam);
    document.getElementById('return-home').addEventListener('click', () => {
        hideExamResultModal();
        returnToHome();
    });
    document.getElementById('review-exam').addEventListener('click', reviewExamDetails);

    // 题号选择模态框关闭事件
    document.getElementById('close-question-number-modal').addEventListener('click', hideQuestionNumberModal);
    
    // 修改模态框外部点击关闭逻辑，添加遮罩层阻止点击
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // 检查是否是必须选择的模态框
                if (modal.hasAttribute('data-required')) {
                    return; // 必须选择时不允许点击外部关闭
                }
                // 检查是否允许点击外部关闭（通过data-closeable属性控制）
                if (modal.hasAttribute('data-closeable') && modal.getAttribute('data-closeable') === 'false') {
                    // 对于考试题目数超限提示模态框，允许点击外部关闭
                    if (modal.id !== 'exam-limit-modal') {
                        return; // 不允许点击外部关闭
                    }
                }
                modal.classList.add('hidden');
            }
        });
    });
    
    // 考试题目数超限提示模态框事件
    document.getElementById('exam-limit-ok').addEventListener('click', function() {
        document.getElementById('exam-limit-modal').classList.add('hidden');
    });
}

// 从云端加载题目数据
async function loadQuestionsFromCloud() {
    try {
        showLoading('正在加载数据...');
        
        const result = await window.leanCloudClient.getAllQuestions();
        if (!result.success) {
            throw new Error(result.message);
        }
        
        // 保存所有题目数据（未过滤）
        allQuestionsData = {};
        result.data.forEach(question => {
            if (!allQuestionsData[question.type]) {
                allQuestionsData[question.type] = [];
            }
            allQuestionsData[question.type].push(question);
        });
        
        // 加载保存的科目选择
        loadCurrentSubject();
        
        // 根据当前科目过滤题目数据
        filterQuestionsBySubject();

        updateStatus(`已加载 ${result.data.length} 个题目`, 'success');
        
        // 立即从加载的数据中计算统计信息，避免后续的重复计算和请求
        calculateStatisticsFromData();
        
    } catch (error) {
        console.error('加载题目数据失败:', error);
        throw error;
    }
}

// 从已加载的题库数据中计算统计信息，避免额外的数据库请求
function calculateStatisticsFromData() {
    try {
        // 从本地题库数据计算各题型数量
        const singleChoiceCount = questionsData.single_choice ? questionsData.single_choice.length : 0;
        const multipleChoiceCount = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
        const trueFalseCount = questionsData.true_false ? questionsData.true_false.length : 0;
        const fillBlankCount = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
        const totalCount = singleChoiceCount + multipleChoiceCount + trueFalseCount + fillBlankCount;
        
        // 更新全局统计对象
        statistics.total = totalCount;
        statistics.single_choice = singleChoiceCount;
        statistics.multiple_choice = multipleChoiceCount;
        statistics.true_false = trueFalseCount;
        statistics.fill_blank = fillBlankCount;
        
        // 保留用户答题统计（从本地存储获取）
        const userStats = getUserStatistics();
        statistics.totalAnswered = userStats.total || 0;
        statistics.totalCorrect = userStats.correct || 0;
        statistics.correctRate = userStats.correctRate || 0;

            updateStatisticsDisplay();
    } catch (error) {
        console.error('计算统计信息失败:', error);
    }
}

// 保留原函数但不再使用云端请求（仅用于用户登录后的特殊情况）
async function loadStatistics() {
    try {
        // 优先从本地数据计算，避免额外的数据库请求
        calculateStatisticsFromData();
        
        // 注释掉云端请求部分以提高性能
        // const result = await window.leanCloudClient.getStatistics();
        // if (result.success) {
        //     statistics = result.data;
        //     updateStatisticsDisplay();
        // }
    } catch (error) {
        console.error('加载统计信息失败:', error);
    }
}

// 更新统计信息显示
function updateStatisticsDisplay() {
    // 直接使用已计算的统计数据，避免重复计算
    document.getElementById('total-questions').textContent = statistics.total || 0;
    
    // 从本地存储获取用户统计
    const userStats = getUserStatistics();
    document.getElementById('completed-questions').textContent = userStats.total || 0;
    document.getElementById('correct-rate').textContent = userStats.correctRate + '%';
    
    // 使用已计算的统计数据更新题型按钮上的题目数量
    document.getElementById('single-count').textContent = (statistics.single_choice || 0) + ' 题';
    document.getElementById('multiple-count').textContent = (statistics.multiple_choice || 0) + ' 题';
    document.getElementById('judge-count').textContent = (statistics.true_false || 0) + ' 题';
    document.getElementById('fill-count').textContent = (statistics.fill_blank || 0) + ' 题';
}

// 获取用户统计信息
function getUserStatistics() {
    const stats = JSON.parse(localStorage.getItem('exam_user_stats') || '{}');
    return {
        correct: stats.correct || 0,
        total: stats.total || 0,
        correctRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    };
}

// 更新答题统计信息
function updateAnswerStatistics(isCorrect) {
    // 更新本地 exam_user_stats
    const stats = getUserStatistics();
    stats.total += 1;
    if (isCorrect) {
        stats.correct += 1;
    }
    stats.correctRate = Math.round((stats.correct / stats.total) * 100);
    localStorage.setItem('exam_user_stats', JSON.stringify(stats));
    
    // 更新全局 statistics 对象
    if (!statistics) {
        statistics = {};
    }
    
    // 只更新用户答题统计，保留题库统计信息
    statistics.totalAnswered = stats.total;
    statistics.totalCorrect = stats.correct;
    statistics.correctRate = stats.correctRate;
    
    // 如果题库统计信息丢失，重新计算
    if (!statistics.total && questionsData && Object.keys(questionsData).length > 0) {
      
        const singleChoiceCount = questionsData.single_choice ? questionsData.single_choice.length : 0;
        const multipleChoiceCount = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
        const trueFalseCount = questionsData.true_false ? questionsData.true_false.length : 0;
        const fillBlankCount = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
        const totalCount = singleChoiceCount + multipleChoiceCount + trueFalseCount + fillBlankCount;
        
        statistics.total = totalCount;
        statistics.single_choice = singleChoiceCount;
        statistics.multiple_choice = multipleChoiceCount;
        statistics.true_false = trueFalseCount;
        statistics.fill_blank = fillBlankCount;
    }
    
    // 如果用户已登录，同步更新云端用户的 statistics
    if (currentUser) {
        currentUser.statistics = statistics;
        currentUser.userStats = stats;
        localStorage.setItem('examUser', JSON.stringify(currentUser));
    }
    
    updateStatisticsDisplay();
}

// 检查用户是否已登录
function requireLogin(actionName = '使用此功能') {
    if (!currentUser) {
        showLoginRequiredModal(actionName);
        return false;
    }
    return true;
}

// 检查用户是否为会员
function requireMembership(actionName = '使用此功能') {
    if (!currentUser) {
        showLoginRequiredModal(actionName);
        return false;
    }
    
    if (!currentUser.membershipType || currentUser.membershipType === '非会员') {
        showMembershipRequiredModal(actionName);
        return false;
    }
    
    // 检查会员是否过期（sssvip永不过期）
    if (currentUser.membershipType !== 'sssvip' && currentUser.membershipEndTime) {
        const now = new Date();
        const endTime = new Date(currentUser.membershipEndTime);
        if (now > endTime) {
            // 检测到过期，不显示重复的提示，让checkCurrentUserMembershipStatus统一处理
            // 异步触发过期处理，不阻塞当前流程
            checkCurrentUserMembershipStatus().catch(error => {
                console.error('后台过期处理失败:', error);
            });
            return false;
        }
    }
    
    return true;
}

// 删除重复的checkMembershipExpiry函数，过期检查现在统一在leancloud-client.js中处理

// 检查当前用户会员状态（用于操作前校验）
async function checkCurrentUserMembershipStatus() {
    // 如果用户未登录，无需检查
    if (!currentUser) {
        return { needsAction: false, message: '用户未登录' };
    }
    
    // 检查当前用户是否过期
    const isExpired = (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') && 
                      currentUser.membershipEndTime && 
                      new Date() > new Date(currentUser.membershipEndTime);
    
    if (isExpired) {
        
        try {
            // 立即显示过期确认弹窗
            const userChoice = await showMembershipExpiredConfirmModal();
            
            if (userChoice.action === 'confirm') {
                // 用户确认过期，开始处理
                const success = await handleMembershipExpiry(currentUser, false); // 传递false表示不再显示弹窗
                if (success) {
                    return { 
                        needsAction: true, 
                        message: '您的会员已过期，已强制退出登录。',
                        action: 'expired'
                    };
                } else {
                    // 如果处理失败，强制退出登录
                    await handleLogout();
                    return { 
                        needsAction: true, 
                        message: '会员状态异常，请重新登录。',
                        action: 'logout'
                    };
                }
            } else {
                // 用户选择稍后处理，返回但标记需要处理
                return { 
                    needsAction: true, 
                    message: '会员已过期，请尽快处理。',
                    action: 'expired_pending'
                };
            }
        } catch (error) {
            console.error('处理会员过期时发生错误:', error);
            await handleLogout();
            return { 
                needsAction: true, 
                message: '会员状态检查失败，请重新登录。',
                action: 'logout'
            };
        }
    }
    
    return { needsAction: false, message: '会员状态正常' };
}

// 包装函数：在执行关键操作前检查会员状态
async function withMembershipCheck(callback, actionName = '执行操作') {
    // 检查会员状态
    const statusCheck = await checkCurrentUserMembershipStatus();
    
    if (statusCheck.needsAction) {
        // 如果需要处理会员过期或退出登录，不执行原操作
        if (statusCheck.action === 'expired') {
            // 会员过期时已经强制退出登录，不执行原操作
            return false;
        } else if (statusCheck.action === 'logout') {
            showMessage(statusCheck.message, 'error');
            // 不执行原操作
            return false;
        }
    } else {
        // 会员状态正常，执行原操作
        if (typeof callback === 'function') {
            callback();
        }
    }
    
    return true;
}

// 处理会员过期：清理本地数据并强制重新登录
async function handleMembershipExpiry(user, showNotification = true) {
    
    try {
        // 1. 更新云端用户数据：降级为非会员（保留其他数据）
        const updateResult = await window.leanCloudClient.handleMembershipExpiry(user.objectId);
        
        if (!updateResult.success) {
            console.error('云端会员状态更新失败:', updateResult.message);
            throw new Error('云端会员状态更新失败');
        }
        
        
        // 2. 清理本地存储（保留examUser）
        clearLocalStorageExceptUser();
        
        // 3. 强制退出登录
        await handleLogout();
        

        
        // 4. 根据参数决定是否显示过期提示
        if (showNotification) {
            showMembershipExpiredLoginNotification();
        }
        
        return true;
        
    } catch (error) {
        console.error('会员过期处理失败:', error);
        showMessage('会员状态处理异常，请重新登录', 'error');
        // 即使处理失败，也要强制退出登录
        await handleLogout();
        return false;
    }
}

// 清理本地存储（保留examUser）
function clearLocalStorageExceptUser() {

    
    const examUser = localStorage.getItem('examUser');

    
    // 显示清理前的存储内容

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            console.log(`  - ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
        }
    }
    
    // 获取所有需要清理的存储项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== 'examUser') {
            keysToRemove.push(key);
        }
    }
    

    
    // 清理存储项
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    
    });
    
    // 恢复examUser
    if (examUser) {
        localStorage.setItem('examUser', examUser);
    
    }
    

}

// 删除重复的showMembershipExpiredNotification函数，统一使用showMembershipExpiredLoginNotification

// 显示会员时间不足一小时的提醒
function showMembershipExpiryWarning(timeRemaining) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('data-closeable', 'false');
        
        // 计算剩余时间显示
        const minutes = Math.floor(timeRemaining / (1000 * 60));
        const timeText = minutes < 60 ? `${minutes}分钟` : `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
                    <h3><i class="fas fa-clock"></i> 会员即将到期</h3>
                    <span class="close-btn" onclick="closeWarningModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; color: #f59e0b; margin-bottom: 16px;">
                            ⏰
                        </div>
                        <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员即将到期</h4>
                        <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                            您的会员将在 <strong style="color: #f59e0b;">${timeText}</strong> 后到期。<br/>
                            请及时将本地数据同步到云端，<br/>
                            到期后，您的本地学习数据将被清理并强制退出登录。<br/>
                            建议您及时升级会员以保留学习进度。
                        </p>
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                💡 升级会员后，您的所有学习数据将继续保留但需要手动同步到云端。
                            </p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; font-size: 14px; cursor: pointer;">
                                <input type="checkbox" id="dont-remind-checkbox" style="margin: 0;">
                                <span>不再提醒（勾选后将清理本地数据并退出登录）</span>
                            </label>
                        </div>
                        
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button class="secondary-btn" onclick="handleWarningClose()">
                                <i class="fas fa-times"></i> 稍后再说
                            </button>
                            <button class="membership-btn" onclick="handleWarningUpgrade()">
                                <i class="fas fa-crown"></i> 立即升级
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 全局函数，处理弹窗关闭
        window.closeWarningModal = function() {
            const dontRemind = document.getElementById('dont-remind-checkbox').checked;
            modal.remove();
            delete window.closeWarningModal;
            delete window.handleWarningClose;
            delete window.handleWarningUpgrade;
            
            if (dontRemind) {
                resolve({ action: 'no_remind' });
            } else {
                resolve({ action: 'close' });
            }
        };
        
        window.handleWarningClose = function() {
            closeWarningModal();
        };
        
        window.handleWarningUpgrade = function() {
            modal.remove();
            delete window.closeWarningModal;
            delete window.handleWarningClose;
            delete window.handleWarningUpgrade;
            resolve({ action: 'upgrade' });
        };
        
        // 点击外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeWarningModal();
            }
        });
    });
}

// 显示会员过期确认弹窗（立即显示，用户确认后处理）
function showMembershipExpiredConfirmModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.setAttribute('data-closeable', 'false');
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                    <h3><i class="fas fa-exclamation-triangle"></i> 会员已过期</h3>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; padding: 20px 0;">
                        <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                            🚫
                        </div>
                        <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员已过期</h4>
                        <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                            您的会员时间已到期，无法继续使用高级功能。<br/>
                            系统将清理本地学习数据并强制退出登录。<br/>
                            请重新购买会员后重新登录。
                        </p>
                        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                            <p style="color: #92400e; margin: 0; font-size: 14px;">
                                💡 您的学习数据将被保留到云端，重新购买会员后可继续使用
                            </p>
                        </div>
                        <div style="display: flex; gap: 12px; justify-content: center;">
                            <button class="secondary-btn" onclick="handleExpiredLater()">
                                <i class="fas fa-clock"></i> 稍后处理
                            </button>
                            <button class="primary-btn" onclick="handleExpiredConfirm()">
                                <i class="fas fa-check"></i> 确认并清理
                            </button>
                            <button class="membership-btn" onclick="handleExpiredUpgrade()">
                                <i class="fas fa-crown"></i> 升级会员
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 全局函数，处理弹窗操作
        window.handleExpiredConfirm = function() {
            modal.remove();
            delete window.handleExpiredConfirm;
            delete window.handleExpiredLater;
            delete window.handleExpiredUpgrade;
            resolve({ action: 'confirm' });
        };
        
        window.handleExpiredLater = function() {
            modal.remove();
            delete window.handleExpiredConfirm;
            delete window.handleExpiredLater;
            delete window.handleExpiredUpgrade;
            resolve({ action: 'later' });
        };
        
        window.handleExpiredUpgrade = function() {
            modal.remove();
            delete window.handleExpiredConfirm;
            delete window.handleExpiredLater;
            delete window.handleExpiredUpgrade;
            // 显示会员升级窗口
            forceShowMembershipModal();
            resolve({ action: 'upgrade' });
        };
    });
}

// 显示会员过期登录提示（要求重新登录）
function showMembershipExpiredLoginNotification() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                <h3><i class="fas fa-exclamation-triangle"></i> 会员已过期</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                        🚫
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">您的会员已过期</h4>
                    <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                        您的会员时间已到期，无法继续使用高级功能。<br/>
                        您的账户已自动降级为非会员状态。<br/>
                        请重新购买会员后重新登录。
                    </p>
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            💡 您的学习数据已保留，重新购买会员后可继续使用
                        </p>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 重新登录
                        </button>
                        <button class="membership-btn" onclick="this.closest('.modal').remove(); forceShowMembershipModal();">
                            <i class="fas fa-crown"></i> 购买会员
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 时间工具函数：将UTC时间转换为东八区时间并格式化
function formatChineseDateTime(utcTimeString) {
    if (!utcTimeString) return null;
    
    try {
        const utcTime = new Date(utcTimeString);
        
        // 使用toLocaleString方法转换为中国时区（东八区）
        const options = {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        const chinaTimeString = utcTime.toLocaleString('zh-CN', options);
        // 格式化为 YYYY-MM-DD HH:mm:ss，处理各种可能的格式
        let formatted = chinaTimeString
            .replace(/\//g, '-')           // 替换斜杠为连字符
            .replace(/,\s*/g, ' ')         // 替换逗号和空格
            .replace(/上午|下午/g, '')      // 移除上午下午标识
            .replace(/\s+/g, ' ')          // 规范化空格
            .trim();
        
        // 如果格式不符合预期，尝试重新格式化
        if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(formatted)) {
            // 重新使用标准格式
            const year = utcTime.getFullYear();
            const month = String(utcTime.getMonth() + 1).padStart(2, '0');
            const day = String(utcTime.getDate()).padStart(2, '0');
            const hours = String(utcTime.getHours()).padStart(2, '0');
            const minutes = String(utcTime.getMinutes()).padStart(2, '0');
            const seconds = String(utcTime.getSeconds()).padStart(2, '0');
            
            // 手动计算东八区时间
            const beijingTime = new Date(utcTime.getTime() + (8 * 60 * 60 * 1000) - (utcTime.getTimezoneOffset() * 60 * 1000));
            
            return `${beijingTime.getFullYear()}-${String(beijingTime.getMonth() + 1).padStart(2, '0')}-${String(beijingTime.getDate()).padStart(2, '0')} ${String(beijingTime.getHours()).padStart(2, '0')}:${String(beijingTime.getMinutes()).padStart(2, '0')}:${String(beijingTime.getSeconds()).padStart(2, '0')}`;
        }
        
        return formatted;
    } catch (error) {
        console.error('时间格式化错误:', error);
        
        // 备用方案：手动计算UTC+8
        try {
            const utcTime = new Date(utcTimeString);
            const chinaTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
            
            const year = chinaTime.getUTCFullYear();
            const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(chinaTime.getUTCDate()).padStart(2, '0');
            const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
            const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
            const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch (fallbackError) {
            console.error('备用时间格式化也失败:', fallbackError);
            return null;
        }
    }
}

// 获取会员剩余时间
function getMembershipRemainingTime() {
    if (!currentUser || currentUser.membershipType === '非会员') {
        return null;
    }
    
    if (currentUser.membershipType === 'sssvip') {
        return '永久有效';
    }
    
    // vip和svip会员都需要检查时间
    if (!currentUser.membershipEndTime) {
        return null;
    }
    
    const now = new Date();
    const endTime = new Date(currentUser.membershipEndTime);
    const diffTime = endTime.getTime() - now.getTime();
    
    if (diffTime <= 0) {
        return '已过期';
    }
    
    // 计算总的天数、小时数、分钟数
    const totalMinutes = Math.floor(diffTime / (1000 * 60));
    const totalHours = Math.floor(diffTime / (1000 * 60 * 60));
    const totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // 计算剩余的小时和分钟
    const days = totalDays;
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    
    // 如果超过30天，显示月/年
    if (totalDays > 365) {
        const years = Math.floor(totalDays / 365);
        const remainingDays = totalDays % 365;
        if (remainingDays > 0) {
            return `${years}年${remainingDays}天`;
        } else {
            return `${years}年`;
        }
    } else if (totalDays > 30) {
        const months = Math.floor(totalDays / 30);
        const remainingDays = totalDays % 30;
        if (remainingDays > 0) {
            return `${months}个月${remainingDays}天`;
        } else {
            return `${months}个月`;
        }
    }
    
    // 详细的天时分显示
    if (days >= 1) {
        // 超过一天：显示天、小时、分钟
        let result = `${days}天`;
        if (hours > 0) {
            result += `${hours}小时`;
        }
        if (minutes > 0) {
            result += `${minutes}分钟`;
        }
        return result;
    } else if (totalHours >= 1) {
        // 不足一天但超过一小时：只显示小时、分钟
        let result = `${hours}小时`;
        if (minutes > 0) {
            result += `${minutes}分钟`;
        }
        return result;
    } else if (totalMinutes >= 1) {
        // 不足一小时：只显示分钟
        return `${minutes}分钟`;
    } else {
        // 不足一分钟
        return '不足1分钟';
    }
}

// 获取会员详细时间信息（包含开始和结束时间）
function getMembershipTimeDetails() {
    if (!currentUser || currentUser.membershipType === '非会员') {
        return null;
    }
    
    if (currentUser.membershipType === 'sssvip') {
        return {
            type: 'permanent',
            startTime: null,
            endTime: null,
            startTimeFormatted: null,
            endTimeFormatted: null,
            remaining: '永久有效'
        };
    }
    
    const startTime = currentUser.membershipStartTime;
    const endTime = currentUser.membershipEndTime;
    
    if (!endTime) {
        return null;
    }
    
    const startTimeFormatted = formatChineseDateTime(startTime);
    const endTimeFormatted = formatChineseDateTime(endTime);
    const remaining = getMembershipRemainingTime();
    
    return {
        type: 'limited',
        startTime: startTime,
        endTime: endTime,
        startTimeFormatted: startTimeFormatted,
        endTimeFormatted: endTimeFormatted,
        remaining: remaining
    };
}

// 删除重复的showMembershipExpiredModal函数，使用统一的过期处理逻辑

// 检查非会员练习限制（每种题型最多10题）
function checkPracticeLimit(questionType, currentIndex) {
    if (!currentUser || currentUser.membershipType === '非会员') {
        if (currentIndex >= 10) {
            showMembershipRequiredModal('继续练习更多题目');
            return false;
        }
    }
    return true;
}

// 显示需要登录的提示模态框
function showLoginRequiredModal(actionName) {
    // 创建临时模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-lock"></i> 需要登录</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;">
                        🔐
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">请先登录</h4>
                    <p style="color: #6b7280; margin-bottom: 24px;">
                        ${actionName}需要登录后才能使用，请先登录您的账户。
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove()">取消</button>
                        <button class="primary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 立即登录
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 显示需要会员的提示模态框
function showMembershipRequiredModal(actionName) {
    // 创建临时模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h3><i class="fas fa-crown"></i> 需要会员</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;">
                        💎
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">升级会员享受更多权益</h4>
                    <p style="color: #6b7280; margin-bottom: 24px;">
                        ${actionName}需要升级会员后才能使用。<br/>
                        会员用户可享受无限题目练习、模拟考试、数据云同步等特权服务。
                    </p>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="secondary-btn" onclick="this.closest('.modal').remove()">稍后再说</button>
                        <button class="membership-btn" onclick="this.closest('.modal').remove(); showMembershipModal();">
                            <i class="fas fa-crown"></i> 立即升级
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 处理题型按钮点击
function handleTypeButtonClick(e) {
    const button = e.currentTarget;
    const type = button.dataset.type;
    
    if (!requireLogin('开始做题练习')) {
        return;
    }
    
    if (type) {
        startPractice(type);
    }
}

// 开始练习
function startPractice(type) {
    if (!questionsData[type] || questionsData[type].length === 0) {
        showMessage('该题型暂无题目，请联系管理员添加题目', 'warning');
        return;
    }

    currentQuestionType = type;
    currentQuestions = [...questionsData[type]];
    isExamMode = false;
    
    // 加载进度
    loadProgress(type);
    
    // 隐藏科目按钮（进入练习模式）
    hideSubjectButton();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    showQuestion();
    updateStatusDisplay();
}

// 开始模拟考试
function startMockExam() {
    // 简化的模拟考试，随机选择题目
    const allQuestions = [];
    Object.keys(questionsData).forEach(type => {
        if (questionsData[type] && questionsData[type].length > 0) {
            const typeQuestions = questionsData[type].slice(0, 5); // 每种题型最多5题
            typeQuestions.forEach(q => {
                allQuestions.push({ ...q, _type: type });
            });
        }
    });

    if (allQuestions.length === 0) {
        showMessage('题库为空，请先导入题目', 'warning');
        return;
    }

    // 随机排序
    currentQuestions = shuffleArray(allQuestions);
    currentQuestionType = 'mock_exam';
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    judgedAnswers = new Array(currentQuestions.length).fill(false);
    isExamMode = true;

    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    showQuestion();
    updateStatusDisplay();
    showMessage('模拟考试已开始', 'info');
}

// 显示题目
function showQuestion() {
    // 检查非会员练习限制（仅在练习模式下）
    if (!isExamMode) {
        if (!checkPracticeLimit(currentQuestionType, currentQuestionIndex)) {
            return;
        }
    }
    
    if (currentQuestionIndex >= currentQuestions.length) {
        if (isExamMode) {
            showExamResult();
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            returnToHome();
        }
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    const questionType = isExamMode ? question._type : currentQuestionType;
    
    // 更新题目信息
    document.getElementById('question-number').textContent = `第${currentQuestionIndex + 1}题`;
    document.getElementById('question-type-label').textContent = getTypeLabel(questionType);
    document.getElementById('question-text').textContent = question.title;
    
    // 为题目区域添加题型标识，用于CSS样式区分
    const questionSection = document.getElementById('question-section');
    questionSection.setAttribute('data-type', questionType);

    // 清空之前的答案反馈和样式
    document.getElementById('answer-feedback').classList.add('hidden');
    
    // 清除所有选项的评判样式
    const allOptions = document.querySelectorAll('.option');
    allOptions.forEach(option => {
        option.classList.remove('correct', 'wrong');
        option.style.pointerEvents = 'auto';
    });
    
    // 清除填空题输入框的评判样式
    const answerInput = document.getElementById('answer-input');
    if (answerInput) {
        answerInput.classList.remove('correct-answer', 'wrong-answer');
        answerInput.disabled = false;
    }

    // 根据题型显示选项或输入框
    if (questionType === 'single_choice' || questionType === 'multiple_choice') {
        showOptions(question, questionType);
        document.getElementById('answer-input-container').classList.add('hidden');
    } else if (questionType === 'true_false') {
        showTrueFalseOptions(question);
        document.getElementById('answer-input-container').classList.add('hidden');
    } else if (questionType === 'fill_blank') {
        showFillBlankInput();
        document.getElementById('options-container').innerHTML = '';
    }

    // 恢复用户答案
    if (userAnswers[currentQuestionIndex] !== null) {
        restoreUserAnswer();
    }

    // 如果已经评判过，显示结果（练习模式或查看详情模式下）
    if (judgedAnswers[currentQuestionIndex] && (!isExamMode || isReviewMode)) {
        const userAnswer = userAnswers[currentQuestionIndex];
        const correctAnswer = question.correctAnswer.trim().toUpperCase();
        
        // 检查是否未作答
        if (userAnswer === null || userAnswer === undefined || userAnswer === '') {
            // 显示未作答状态
            showAnswerFeedback(null, question.correctAnswer, question.explanation, true);
            // 对于未作答的题目，不更新选项样式（保持默认状态）
        } else {
            const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
            const isCorrect = userAnswerUpper === correctAnswer;
            
            // 显示答案反馈
            showAnswerFeedback(isCorrect, question.correctAnswer, question.explanation);
            
            // 更新选项样式
            updateOptionStyles(isCorrect, question.correctAnswer);
        }
    }

    // 更新按钮状态

    updateFavoriteButton();
    
    // 更新进度显示
    updateStatusDisplay();
}

// 显示选择题选项
function showOptions(question, questionType) {
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    if (!question.options || question.options.length === 0) {
        container.innerHTML = '<p>该题目缺少选项数据</p>';
        return;
    }

    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.dataset.index = index;
        optionElement.dataset.value = String.fromCharCode(65 + index); // A, B, C, D

        optionElement.innerHTML = `
            <div class="option-marker">${String.fromCharCode(65 + index)}</div>
            <div class="option-text">${option}</div>
        `;

        optionElement.addEventListener('click', () => {
            // 查看详情模式下不能修改答案
            if (isReviewMode) return;
            // 只有在练习模式下已评判的题目才不能修改
            if (judgedAnswers[currentQuestionIndex] && !isExamMode) return;
            // 防止多次点击触发多次跳转
            if (questionType === 'single_choice' && judgedAnswers[currentQuestionIndex] && isExamMode) return;

            if (questionType === 'single_choice') {
                // 单选题：清除其他选项选中状态
                container.querySelectorAll('.option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                optionElement.classList.add('selected');
                userAnswers[currentQuestionIndex] = optionElement.dataset.value;
                
                // 单选题选择后的处理
                if (isExamMode) {
                    // 考试模式下自动跳到下一题但不评分
                    // 禁用选项点击防止多次触发
                    container.querySelectorAll('.option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                    });
                    setTimeout(() => {
                        autoNextQuestion();
                    }, 1000);
                } else {
                    // 练习模式下自动评题
                    // 禁用选项点击防止多次触发
                    container.querySelectorAll('.option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                    });
                    setTimeout(() => {
                        autoSubmitAnswer();
                    }, 300);
                }
            } else if (questionType === 'multiple_choice') {
                // 多选题：切换选中状态
                optionElement.classList.toggle('selected');
                const selectedOptions = container.querySelectorAll('.option.selected');
                const selectedValues = Array.from(selectedOptions).map(opt => opt.dataset.value).sort().join('');
                userAnswers[currentQuestionIndex] = selectedValues || null;
            }
        });

        container.appendChild(optionElement);
    });
}

// 显示判断题选项
function showTrueFalseOptions(question) {
    const container = document.getElementById('options-container');
    container.innerHTML = '';

    const options = question.options || ['对', '错'];
    
    options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.dataset.index = index;
        optionElement.dataset.value = option;

        optionElement.innerHTML = `
            <div class="option-marker">${option}</div>
            <div class="option-text">${option}</div>
        `;

        optionElement.addEventListener('click', () => {
            // 查看详情模式下不能修改答案
            if (isReviewMode) return;
            // 只有在练习模式下已评判的题目才不能修改
            if (judgedAnswers[currentQuestionIndex] && !isExamMode) return;
            // 防止多次点击触发多次跳转
            if (judgedAnswers[currentQuestionIndex] && isExamMode) return;

            container.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            optionElement.classList.add('selected');
            userAnswers[currentQuestionIndex] = option;
            
            // 判断题选择后的处理
            if (isExamMode) {
                // 考试模式下自动跳到下一题但不评分
                // 禁用选项点击防止多次触发
                container.querySelectorAll('.option').forEach(opt => {
                    opt.style.pointerEvents = 'none';
                });
                setTimeout(() => {
                    autoNextQuestion();
                }, 1000);
            } else {
                // 练习模式下自动评题
                // 禁用选项点击防止多次触发
                container.querySelectorAll('.option').forEach(opt => {
                    opt.style.pointerEvents = 'none';
                });
                setTimeout(() => {
                    autoSubmitAnswer();
                }, 300);
            }
        });

        container.appendChild(optionElement);
    });
}

// 显示填空题输入框
function showFillBlankInput() {
    document.getElementById('answer-input-container').classList.remove('hidden');
    const input = document.getElementById('answer-input');
    input.value = userAnswers[currentQuestionIndex] || '';
    
    input.addEventListener('input', () => {
        userAnswers[currentQuestionIndex] = input.value.trim() || null;
    });
}

// 恢复用户答案
function restoreUserAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    const questionType = isExamMode ? currentQuestions[currentQuestionIndex]._type : currentQuestionType;

    if (questionType === 'single_choice' || questionType === 'true_false') {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            if (option.dataset.value === userAnswer) {
                option.classList.add('selected');
            }
        });
    } else if (questionType === 'multiple_choice') {
        const options = document.querySelectorAll('.option');
        options.forEach(option => {
            if (userAnswer && userAnswer.includes(option.dataset.value)) {
                option.classList.add('selected');
            }
        });
    } else if (questionType === 'fill_blank') {
        document.getElementById('answer-input').value = userAnswer || '';
    }
}

// 提交答案
function submitAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    
    if (userAnswer === null || userAnswer === '') {
        showMessage('请先作答再提交', 'warning');
        return;
    }

    if (isExamMode) {
        // 考试模式下只保存答案，不评判
        showMessage('答案已提交', 'success');
		 // 直接跳转到下一题
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题，提示可以交卷
        if (isExamMode) {
        showMessage('已完成所有题目，可以点击交卷按钮提交考试', 'info');
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
        // 保存进度但不评判
        saveProgress();
    } else {
        // 练习模式下正常评判
        processAnswer();
    }
}

// 自动提交答案（用于单选题和判断题）
function autoSubmitAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    
    if (userAnswer === null || userAnswer === '') {
        return;
    }

    processAnswer();
}

// 自动跳转到下一题（考试模式下使用，不评判）
function autoNextQuestion() {
    // 保存当前答案
    saveProgress();
    
    // 检查非会员练习限制（仅练习模式）
    if (!isExamMode && (!currentUser || currentUser.membershipType === '非会员')) {
        // 非会员用户最多只能到第10题（索引9）
        if (currentQuestionIndex >= 9) {
            showMembershipRequiredModal('继续练习更多题目');
            return;
        }
    }
    
    // 直接跳转到下一题
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题，提示可以交卷
        if (isExamMode) {
        showMessage('已完成所有题目，可以点击交卷按钮提交考试', 'info');
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
}

// 处理答案评判
function processAnswer() {
    const userAnswer = userAnswers[currentQuestionIndex];
    const question = currentQuestions[currentQuestionIndex];
    const questionType = isExamMode ? question._type : currentQuestionType;
    const correctAnswer = question.correctAnswer.trim().toUpperCase();
    const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
    
    const isCorrect = userAnswerUpper === correctAnswer;
    
    // 标记为已评判
    judgedAnswers[currentQuestionIndex] = true;
    
    // 更新用户统计
    updateAnswerStatistics(isCorrect);
    
    // 显示答案反馈
    showAnswerFeedback(isCorrect, correctAnswer, question.explanation);
    
    // 更新选项样式
    updateOptionStyles(isCorrect, correctAnswer);
    
    // 处理错题本 - 在模拟考试模式下记录错题，或在练习错题本时移除答对的题目
    if (isExamMode) {
        if (!isCorrect) {
            addToWrongQuestions(questionType, question, userAnswer);
        } else {
            removeFromWrongQuestions(questionType, question);
        }
    } else if (isPracticingWrongQuestions) {
        // 在练习错题本中的题目时，如果答对了就从错题本中移除
        if (isCorrect) {
            removeFromWrongQuestions(questionType, question);
            // 重置练习错题本标志
            isPracticingWrongQuestions = false;
        }
    }
    
    // 保存进度
    saveProgress();
    
    // 检查是否是非会员用户的第10题
    const isNonMemberLastQuestion = (!currentUser || currentUser.membershipType === '非会员') && 
                                   currentQuestionIndex === 9 && !isExamMode;
    
    if (isNonMemberLastQuestion) {
        // 非会员用户第10题，不自动跳转，显示完成提示
        setTimeout(() => {
            showMessage('恭喜完成前10题！升级会员可练习更多题目', 'success');
            setTimeout(() => {
                showMembershipRequiredModal('继续练习更多题目');
            }, 2000);
        }, 1500);
    } else if (isCorrect) {
        // 正常情况下，答对了延迟自动跳转到下一题
        setTimeout(() => {
            goToNextQuestion();
        }, 1000);
    } else {
        // 如果答错了，滚动到解析区域
        setTimeout(() => {
            scrollToAnalysis();
        }, 500);
    }
}

// 显示答案反馈
function showAnswerFeedback(isCorrect, correctAnswer, explanation, isUnanswered = false) {
    const feedbackElement = document.getElementById('answer-feedback');
    const resultElement = document.getElementById('feedback-result');
    const correctAnswerElement = document.getElementById('correct-answer');
    const explanationElement = document.getElementById('explanation');
    
    // 设置结果
    if (isUnanswered) {
        resultElement.textContent = '未作答';
        resultElement.className = 'feedback-unanswered';
        correctAnswerElement.innerHTML = `<strong>正确答案：</strong>${correctAnswer}`;
    } else if (isCorrect !== undefined) {
        resultElement.textContent = isCorrect ? '回答正确！' : '回答错误！';
        resultElement.className = isCorrect ? 'feedback-correct' : 'feedback-wrong';
        correctAnswerElement.innerHTML = `<strong>正确答案：</strong>${correctAnswer}`;
    }
    
    // 设置解析
    if (explanation) {
        explanationElement.innerHTML = `<strong>解析：</strong>${explanation}`;
        explanationElement.style.display = 'block';
    } else {
        explanationElement.style.display = 'none';
    }
    
    feedbackElement.classList.remove('hidden');
}

// 更新选项样式
function updateOptionStyles(isCorrect, correctAnswer) {
    const questionType = isExamMode ? currentQuestions[currentQuestionIndex]._type : currentQuestionType;
    
    if (questionType === 'fill_blank') {
        // 处理填空题输入框样式
        const answerInput = document.getElementById('answer-input');
        if (answerInput) {
            // 在练习模式已评判或查看详情模式下禁用输入框
            if ((!isExamMode && judgedAnswers[currentQuestionIndex]) || isReviewMode) {
                answerInput.disabled = true;
            }
            answerInput.classList.add(isCorrect ? 'correct-answer' : 'wrong-answer');
        }
    } else {
        // 处理选择题选项样式
        const options = document.querySelectorAll('.option');
        
        options.forEach(option => {
            const optionValue = option.dataset.value;
            
            if (questionType === 'single_choice' || questionType === 'true_false') {
                if (optionValue === correctAnswer) {
                    option.classList.add('correct');
                } else if (option.classList.contains('selected') && !isCorrect) {
                    option.classList.add('wrong');
                }
            } else if (questionType === 'multiple_choice') {
                if (correctAnswer.includes(optionValue)) {
                    option.classList.add('correct');
                } else if (option.classList.contains('selected')) {
                    option.classList.add('wrong');
                }
            }
            
            // 禁用点击（练习模式已评判或查看详情模式下）
            if ((!isExamMode && judgedAnswers[currentQuestionIndex]) || isReviewMode) {
                option.style.pointerEvents = 'none';
            }
        });
    }
}

// 上一题
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion();
    }
}

// 下一题
function nextQuestion() {
    // 考试模式下不自动评判，直接跳转
    if (isExamMode) {
        goToNextQuestion();
        return;
    }
    
    // 练习模式下如果当前题目未评判且有答案，先自动评判
    if (!judgedAnswers[currentQuestionIndex] && userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex] !== '') {
        processAnswer();
        return; // 评判后会自动处理跳转
    }
    
    goToNextQuestion();
}

// 直接跳转到下一题（不进行评判）
function goToNextQuestion() {
    // 检查非会员练习限制
    if (!isExamMode && (!currentUser || currentUser.membershipType === '非会员')) {
        // 非会员用户最多只能到第10题（索引9）
        if (currentQuestionIndex >= 9) {
            showMembershipRequiredModal('继续练习更多题目');
            return;
        }
    }
    
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 已经是最后一题
        if (isExamMode) {
            // 在考试模式下，显示交卷确认模态框而不是直接提交
            showSubmitConfirmModal();
        } else if (isPracticingWrongQuestions) {
            // 如果是在练习错题本中的题目，返回到错题本界面
            showMessage('已完成错题练习', 'success');
            setTimeout(() => {
                returnToHome();
                // 重新显示错题本
                showWrongQuestionsModal();
            }, 1000);
        } else {
            showMessage('恭喜！您已完成所有题目', 'success');
            setTimeout(() => {
                returnToHome();
            }, 2000);
        }
    }
}

// 加载存储的数据
function loadStoredData() {
    try {
        // 加载题库
        const questionsJson = localStorage.getItem('exam_questions');
        if (questionsJson) {
            questionsData = JSON.parse(questionsJson);
        }

        // 加载收藏
        const subjects = ['毛概', '思修', '近代史', '马原'];
        favorites = {};
        
        subjects.forEach(subject => {
            const favoritesKey = `exam_favorites_${subject}`;
            const favoritesJson = localStorage.getItem(favoritesKey);
            if (favoritesJson) {
                favorites[subject] = JSON.parse(favoritesJson);
            } else {
                // 确保默认结构存在
                favorites[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });

        // 加载错题本
        wrongQuestions = {};
        
        subjects.forEach(subject => {
            const wrongQuestionsKey = `exam_wrong_questions_${subject}`;
            const wrongQuestionsJson = localStorage.getItem(wrongQuestionsKey);
            if (wrongQuestionsJson) {
                wrongQuestions[subject] = JSON.parse(wrongQuestionsJson);
            } else {
                // 确保默认结构存在
                wrongQuestions[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });
        
        // 加载用户统计
        const userStatsJson = localStorage.getItem('exam_user_stats');
        const userStats = userStatsJson ? JSON.parse(userStatsJson) : {};
    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
}

// 添加到错题本
function addToWrongQuestions(type, question, userAnswer) {
    // 确保当前科目存在
    const subjectKey = currentSubject || '毛概';
    
    // 确保科目对象存在
    if (!wrongQuestions[subjectKey]) {
        wrongQuestions[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = [];
    }
    
    // 检查是否已存在
    const existingIndex = wrongQuestions[subjectKey][type].findIndex(q => q.title === question.title);
    if (existingIndex >= 0) {
        wrongQuestions[subjectKey][type][existingIndex].userAnswer = userAnswer;
    } else {
        wrongQuestions[subjectKey][type].push({
            ...question,
            userAnswer: userAnswer
        });
    }
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
}

// 从错题本移除
function removeFromWrongQuestions(type, question) {
    // 确保当前科目存在
    const subjectKey = currentSubject || '毛概';
    
    if (wrongQuestions[subjectKey] && wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = wrongQuestions[subjectKey][type].filter(q => q.title !== question.title);
        // 保存到本地存储（按科目存储）
        const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
        localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    }
}

// 切换收藏状态
function toggleFavorite() {
    const question = currentQuestions[currentQuestionIndex];
    const questionType = isExamMode ? question._type : currentQuestionType;
    
    // 确保当前科目存在
    const subjectKey = currentSubject || '毛概';
    
    // 确保科目对象存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][questionType]) {
        favorites[subjectKey][questionType] = [];
    }
    
    const existingIndex = favorites[subjectKey][questionType].findIndex(q => q.title === question.title);
    
    if (existingIndex >= 0) {
        // 取消收藏
        favorites[subjectKey][questionType].splice(existingIndex, 1);
        if (favorites[subjectKey][questionType].length === 0) {
            // 不删除空数组，保持结构完整
        }
        showMessage('已取消收藏', 'info');
    } else {
        // 添加收藏
        favorites[subjectKey][questionType].push(question);
        showMessage('已添加到收藏', 'success');
    }
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    // 获取该科目下所有题型的题目数量
    let subjectFavorites = favorites[subjectKey];
    localStorage.setItem(favoritesKey, JSON.stringify(subjectFavorites));
    updateFavoriteButton();
}

// 更新收藏按钮状态
function updateFavoriteButton() {
    const button = document.getElementById('favorite-btn');
    const question = currentQuestions[currentQuestionIndex];
    const questionType = isExamMode ? question._type : currentQuestionType;
    
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    const isFavorited = favorites[subjectKey] && 
        favorites[subjectKey][questionType] && 
        favorites[subjectKey][questionType].some(q => q.title === question.title);
    
    const icon = button.querySelector('i');
    if (isFavorited) {
        icon.className = 'fas fa-star';
        button.classList.add('favorited');
    } else {
        icon.className = 'far fa-star';
        button.classList.remove('favorited');
    }
}



// 显示考试结果
function showExamResult() {
    // 直接调用提交考试逻辑
    submitExam();
}

// 返回主页
function returnToHome() {
    document.getElementById('question-section').classList.add('hidden');
    document.getElementById('welcome-section').classList.remove('hidden');
    document.getElementById('question-type-section').classList.remove('hidden');
//    提交按钮可用
    document.getElementById('submit-btn').disabled = false;
    
    // 显示科目按钮（返回首页）
    showSubjectButton();
    
    // 停止考试计时器
    stopExamTimer();
    
    // 隐藏考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.add('hidden');
    
    // 如果是考试模式或查看详情模式，恢复导航按钮
    if (isExamMode || isReviewMode || isPracticingWrongQuestions) {
        document.getElementById('home-btn').style.display = '';
        document.getElementById('wrong-questions-btn').style.display = '';
        document.getElementById('favorites-btn').style.display = '';
    }
    
    // 重置状态
    currentQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = [];
    judgedAnswers = [];
    isExamMode = false;
    isReviewMode = false;
    isPracticingWrongQuestions = false; // 重置练习错题本标志
    examStartTime = null;
    examDuration = 0;
    
    // 重置导航栏按钮
    resetExamNavigation();
    
    // 更新主页显示
    updateStatusDisplay();
    
    // 重新计算题库统计信息，确保数据正确显示
    if (questionsData && Object.keys(questionsData).length > 0) {
        calculateStatisticsFromData();
    } else {
        // 如果题库数据不存在，重新加载
        updateStatisticsDisplay();
    }
}

// 重置考试导航栏
function resetExamNavigation() {
    const navSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 移除所有事件监听器并重置按钮
    navSubmitBtn.replaceWith(navSubmitBtn.cloneNode(true));
    const newNavSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 恢复默认状态
    newNavSubmitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 交卷';
    newNavSubmitBtn.classList.remove('hidden');
    
    // 重新绑定初始事件监听器（但不会触发，因为考试导航栏是隐藏的）
    newNavSubmitBtn.addEventListener('click', showSubmitConfirmModal);
    
    // 显示计时器
    const timer = document.querySelector('.exam-timer');
    if (timer) {
        timer.style.display = 'flex';
    }
}

// 更新状态显示
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-text');
    const statusContainer = document.getElementById('connection-status');
    
    statusElement.textContent = message;
    
    // 清除之前的状态类
    statusContainer.classList.remove('connected', 'success', 'error');
    
    // 添加新的状态类
    if (type === 'connected' || type === 'success') {
        statusContainer.classList.add('connected');
    }
}

// 更新状态栏显示
function updateStatusDisplay() {
    const progressElement = document.getElementById('current-progress');
    
    if (currentQuestions.length > 0) {
        // 在练习或考试模式下显示进度
        const total = currentQuestions.length;
        const current = currentQuestionIndex + 1;
        progressElement.textContent = `第 ${current} 题 / 共 ${total} 题(点击可切换题目)`;
    } else {
        // 在主页显示欢迎信息
        progressElement.textContent = '祝您学习愉快！';
    }
    
    // 添加点击事件监听器（只添加一次）
    if (!progressElement.hasAttribute('data-listener-added')) {
        progressElement.addEventListener('click', showQuestionNumberModal);
        progressElement.setAttribute('data-listener-added', 'true');
    }
}

// 显示题号选择模态框
function showQuestionNumberModal() {
    // 只在练习或考试模式下显示
    if (currentQuestions.length === 0) {
        return;
    }
    
    const modal = document.getElementById('question-number-modal');
    const container = document.getElementById('question-numbers-container');
    
    // 清空容器
    container.innerHTML = '';
    
    // 生成题号按钮
    for (let i = 0; i < currentQuestions.length; i++) {
        const btn = document.createElement('button');
        btn.className = 'question-number-btn';
        btn.textContent = i + 1;
        btn.setAttribute('data-index', i);
        
        // 设置题号状态样式
        if (i === currentQuestionIndex) {
            btn.classList.add('current'); // 当前题目
        } else if (isExamMode) {
            // 考试模式下：只区分已作答（蓝色）和未作答（默认）
            if (userAnswers[i] !== null && userAnswers[i] !== '') {
                btn.classList.add('answered'); // 已作答（蓝色）
            }
            // 未作答的题目保持默认样式
        } else if (judgedAnswers[i]) {
            // 练习模式下：显示对错状态
            const userAnswer = userAnswers[i];
            const question = currentQuestions[i];
            const correctAnswer = question.correctAnswer.trim().toUpperCase();
            const userAnswerUpper = userAnswer ? userAnswer.toString().trim().toUpperCase() : '';
            
            if (userAnswerUpper === correctAnswer) {
                btn.classList.add('correct'); // 答对
            } else {
                btn.classList.add('wrong'); // 答错
            }
        }
        // 未作答的题目保持默认样式
        
        // 添加点击事件
        btn.addEventListener('click', () => {
            jumpToQuestion(i);
        });
        
        container.appendChild(btn);
    }
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// 跳转到指定题目
function jumpToQuestion(index) {
    if (index >= 0 && index < currentQuestions.length) {
        // 保存当前题目的答案（如果是练习模式且已作答但未评判）
        if (!isExamMode && userAnswers[currentQuestionIndex] !== null && userAnswers[currentQuestionIndex] !== '' && !judgedAnswers[currentQuestionIndex]) {
            // 先评判当前题目
            processAnswer();
        }
        
        // 切换到指定题目
        currentQuestionIndex = index;
        showQuestion();
        
        // 隐藏模态框
        document.getElementById('question-number-modal').classList.add('hidden');
    }
}

// 隐藏题号选择模态框
function hideQuestionNumberModal() {
    document.getElementById('question-number-modal').classList.add('hidden');
}

// 显示Loading
function showLoading(message = '正在处理...') {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    
    if (text) text.textContent = message;
    if (overlay) overlay.style.display = 'flex';
}

// 隐藏Loading
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// 显示收藏模态框
function showFavoritesModal() {
    if (!requireLogin('查看收藏题目')) {
        return;
    }
    
    // 获取当前科目的收藏题目
    const subjectKey = currentSubject || '毛概';
    let favoriteCount = 0;
    
    if (favorites[subjectKey]) {
        Object.values(favorites[subjectKey]).forEach(items => {
            favoriteCount += items.length;
        });
    }
    
    if (favoriteCount === 0) {
        showMessage('暂无收藏题目', 'info');
    } else {
        let message = `共收藏了 ${favoriteCount} 个题目`;
        if (!currentUser || currentUser.membershipType === '非会员') {
            message += '（非会员数据不会云端存档）';
        }
        showMessage(message, 'info');
    }
}

// 显示错题本模态框
function showWrongQuestionsModal() {
    if (!requireLogin('查看错题本')) {
        return;
    }
    
    // 获取当前科目的错题
    const subjectKey = currentSubject || '毛概';
    let wrongCount = 0;
    
    if (wrongQuestions[subjectKey]) {
        Object.values(wrongQuestions[subjectKey]).forEach(items => {
            wrongCount += items.length;
        });
    }
    
    if (wrongCount === 0) {
        showMessage('暂无错题', 'info');
    } else {
        let message = `错题本中有 ${wrongCount} 个题目`;
        if (!currentUser || currentUser.membershipType === '非会员') {
            message += '（非会员数据不会云端存档）';
        }
        showMessage(message, 'info');
    }
}

// 添加到错题本
function addToWrongQuestions(type, question, userAnswer) {
    // 确保当前科目存在
    const subjectKey = currentSubject || '毛概';
    
    // 确保科目对象存在
    if (!wrongQuestions[subjectKey]) {
        wrongQuestions[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = [];
    }
    
    // 检查是否已存在
    const existingIndex = wrongQuestions[subjectKey][type].findIndex(q => q.title === question.title);
    if (existingIndex >= 0) {
        wrongQuestions[subjectKey][type][existingIndex].userAnswer = userAnswer;
    } else {
        wrongQuestions[subjectKey][type].push({
            ...question,
            userAnswer: userAnswer
        });
    }
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
}

// 从错题本移除
function removeFromWrongQuestions(type, question) {
    // 确保当前科目存在
    const subjectKey = currentSubject || '毛概';
    
    if (wrongQuestions[subjectKey] && wrongQuestions[subjectKey][type]) {
        wrongQuestions[subjectKey][type] = wrongQuestions[subjectKey][type].filter(q => q.title !== question.title);
        // 保存到本地存储（按科目存储）
        const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
        localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    }
}

// 保存进度
function saveProgress() {
    if (!isExamMode && currentQuestionType) {
        // 非会员用户只能保存前10题的进度
        const maxSaveIndex = (!currentUser || currentUser.membershipType === '非会员') ? 9 : currentQuestions.length - 1;
        
        // 限制保存的题目范围
        const limitedQuestions = currentQuestions.slice(0, maxSaveIndex + 1);
        const limitedUserAnswers = userAnswers.slice(0, maxSaveIndex + 1);
        const limitedJudgedAnswers = judgedAnswers.slice(0, maxSaveIndex + 1);
        
        // 保存完整的题目状态信息（仅限制范围内）
        const detailedProgress = limitedQuestions.map((question, index) => ({
            question: {
                id: question.id,
                title: question.title,
                type: question.type || currentQuestionType,
                options: question.options || [],
                correctAnswer: question.correctAnswer,
                explanation: question.explanation || ''
            },
            userAnswer: limitedUserAnswers[index],
            isJudged: limitedJudgedAnswers[index],
            isCorrect: limitedJudgedAnswers[index] ? 
                (limitedUserAnswers[index] && limitedUserAnswers[index].toString().trim().toUpperCase() === question.correctAnswer.trim().toUpperCase()) : 
                null
        }));
        
        // 限制当前索引不超过允许范围
        const limitedCurrentIndex = Math.min(currentQuestionIndex, maxSaveIndex);
        
        const progress = {
            currentIndex: limitedCurrentIndex,
            userAnswers: limitedUserAnswers,
            judgedAnswers: limitedJudgedAnswers,
            detailedProgress: detailedProgress,
            timestamp: Date.now(),
            maxAllowedIndex: maxSaveIndex // 记录最大允许索引
        };
        
        // 根据当前科目保存进度数据
        const subjectKey = currentSubject || 'default';
        localStorage.setItem(`exam_progress_${subjectKey}_${currentQuestionType}`, JSON.stringify(progress));
        
    }
}

// 加载进度
function loadProgress(type) {
    try {
        // 根据当前科目加载进度数据
        const subjectKey = currentSubject || 'default';
        const progressData = localStorage.getItem(`exam_progress_${subjectKey}_${type}`);
        if (progressData) {
            const progress = JSON.parse(progressData);
            currentQuestionIndex = progress.currentIndex || 0;
            
            // 检查是否是非会员用户的限制数据
            const isLimitedData = progress.maxAllowedIndex !== undefined;
            const maxAllowedIndex = progress.maxAllowedIndex || (currentQuestions.length - 1);
            
            // 初始化完整长度的数组
                userAnswers = new Array(currentQuestions.length).fill(null);
                judgedAnswers = new Array(currentQuestions.length).fill(false);
            
            // 恢复保存的答案数据
            if (progress.userAnswers && progress.judgedAnswers) {
                const savedAnswers = progress.userAnswers;
                const savedJudged = progress.judgedAnswers;
                
                // 只恢复允许范围内的数据
                const restoreCount = Math.min(savedAnswers.length, maxAllowedIndex + 1, currentQuestions.length);
                
                for (let i = 0; i < restoreCount; i++) {
                    if (i < savedAnswers.length) {
                        userAnswers[i] = savedAnswers[i];
                    }
                    if (i < savedJudged.length) {
                        judgedAnswers[i] = savedJudged[i];
                    }
                }
                
               
            }
            
            // 对于非会员用户，确保当前索引不超过限制
            if ((!currentUser || currentUser.membershipType === '非会员') && currentQuestionIndex > 9) {
                currentQuestionIndex = 9;
            }
            
        } else {
            currentQuestionIndex = 0;
            userAnswers = new Array(currentQuestions.length).fill(null);
            judgedAnswers = new Array(currentQuestions.length).fill(false);
        }
    } catch (error) {
        console.error('加载进度失败:', error);
        currentQuestionIndex = 0;
        userAnswers = new Array(currentQuestions.length).fill(null);
        judgedAnswers = new Array(currentQuestions.length).fill(false);
    }
}

// 加载存储的数据
function loadStoredData() {
    try {
        // 加载题库
        const questionsJson = localStorage.getItem('exam_questions');
        if (questionsJson) {
            questionsData = JSON.parse(questionsJson);
        }

        // 加载收藏
        const subjects = ['毛概', '思修', '近代史', '马原'];
        favorites = {};
        
        subjects.forEach(subject => {
            const favoritesKey = `exam_favorites_${subject}`;
            const favoritesJson = localStorage.getItem(favoritesKey);
            if (favoritesJson) {
                favorites[subject] = JSON.parse(favoritesJson);
            } else {
                // 确保默认结构存在
                favorites[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });

        // 加载错题本
        wrongQuestions = {};
        
        subjects.forEach(subject => {
            const wrongQuestionsKey = `exam_wrong_questions_${subject}`;
            const wrongQuestionsJson = localStorage.getItem(wrongQuestionsKey);
            if (wrongQuestionsJson) {
                wrongQuestions[subject] = JSON.parse(wrongQuestionsJson);
            } else {
                // 确保默认结构存在
                wrongQuestions[subject] = {
                    'single_choice': [],
                    'multiple_choice': [],
                    'true_false': [],
                    'fill_blank': []
                };
            }
        });
        
        // 加载用户统计
        const userStatsJson = localStorage.getItem('exam_user_stats');
        const userStats = userStatsJson ? JSON.parse(userStatsJson) : {};
    } catch (error) {
        console.error('加载存储数据失败:', error);
    }
}

// 更新UI
function updateUI() {
    // 更新题型按钮状态
    document.querySelectorAll('[data-type]').forEach(btn => {
        const type = btn.dataset.type;
        if (type && questionsData[type] && questionsData[type].length > 0) {
            btn.disabled = false;
        }
    });

    // 检查是否有题目可以进行模拟考试
    const hasQuestions = Object.values(questionsData).some(questions => questions && questions.length > 0);
    const mockExamBtn = document.getElementById('mock-exam-btn');
    if (mockExamBtn) {
        mockExamBtn.disabled = !hasQuestions;
    }

    updateStatusDisplay();
    updateStatisticsDisplay();
}



// 工具函数
function getTypeLabel(type) {
    const labels = {
        'single_choice': '单选题',
        'multiple_choice': '多选题',
        'true_false': '判断题',
        'fill_blank': '填空题'
    };
    return labels[type] || type;
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function showMessage(message, type = 'info', duration = 3000) {
    const messageArea = document.getElementById('message-area');
    if (!messageArea) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    
    const icons = {
        'success': '<i class="fas fa-check-circle"></i>',
        'error': '<i class="fas fa-times-circle"></i>', 
        'warning': '<i class="fas fa-exclamation-triangle"></i>',
        'info': '<i class="fas fa-info-circle"></i>'
    };
    
    messageElement.innerHTML = `
        ${icons[type] || icons.info}
        <span>${message}</span>
    `;

    messageArea.appendChild(messageElement);

    setTimeout(() => {
        messageElement.style.animation = 'messageSlideIn 0.3s reverse';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, duration);
}

// 出题记录管理器
const ExamQuestionHistory = {
    // 获取当前科目的出题记录
    getHistory(subject, questionType) {
        const key = `exam_question_history_${subject}_${questionType}`;
        const history = localStorage.getItem(key);
        return history ? JSON.parse(history) : {
            correctQuestions: [], // 作对的题目ID列表
            totalGenerated: 0     // 总出题数
        };
    },
    
    // 添加作对的题目到历史记录
    addCorrectQuestion(subject, questionType, questionId) {
        const history = this.getHistory(subject, questionType);
        // 添加到列表开头
        history.correctQuestions.unshift(questionId);
        // 只保留最近的记录（避免存储膨胀）
        if (history.correctQuestions.length > 50) {
            history.correctQuestions = history.correctQuestions.slice(0, 50);
        }
        history.totalGenerated++;
        this.saveHistory(subject, questionType, history);
    },
    
    // 保存历史记录
    saveHistory(subject, questionType, history) {
        const key = `exam_question_history_${subject}_${questionType}`;
        localStorage.setItem(key, JSON.stringify(history));
    },
    
    // 检查题目是否在近期作对过
    wasRecentlyCorrect(subject, questionType, questionId) {
        const history = this.getHistory(subject, questionType);
        return history.correctQuestions.includes(questionId);
    },
    
    // 清理指定科目和题型的历史记录
    clearHistory(subject, questionType) {
        const key = `exam_question_history_${subject}_${questionType}`;
        localStorage.removeItem(key);
    }
};

// 清理所有科目的考试记录会话
function clearAllExamQuestionHistory() {
    // 清理所有以exam_question_history_开头的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam_question_history_')) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
}

// 基于优先级的智能抽题算法
function smartSelectQuestions(subject, questionType, requestedCount) {
    // 获取当前科目的数据
    const subjectKey = subject || currentSubject || '毛概';
    
    // 获取题目数据
    const allQuestions = questionsData[questionType] || [];
    if (allQuestions.length === 0) return [];
    
    // 获取错题本和收藏数据
    const wrongQuestionsData = (wrongQuestions[subjectKey] && wrongQuestions[subjectKey][questionType]) || [];
    const favoritesData = (favorites[subjectKey] && favorites[subjectKey][questionType]) || [];
    
    // 获取出题历史
    const history = ExamQuestionHistory.getHistory(subjectKey, questionType);
    
    // 创建题目分类映射
    const wrongQuestionMap = new Map();
    const favoriteQuestionMap = new Map();
    
    // 建立映射关系（通过title识别题目）
    wrongQuestionsData.forEach(q => wrongQuestionMap.set(q.title, q));
    favoritesData.forEach(q => favoriteQuestionMap.set(q.title, q));
    
    // 分类题目并标记来源
    const wrongQuestionsList = wrongQuestionsData.map(q => ({...q, source: 'wrong'}));
    const favoritesList = favoritesData
        .filter(q => !wrongQuestionMap.has(q.title)) // 排除已在错题本中的题目
        .map(q => ({...q, source: 'favorite'}));
    const normalQuestionsList = allQuestions
        .filter(q => !wrongQuestionMap.has(q.title) && !favoriteQuestionMap.has(q.title)) // 排除已在错题本和收藏中的题目
        .map(q => ({...q, source: 'normal'}));
    
    // 过滤掉近期作对的题目
    const filterRecentCorrect = (questions) => {
        return questions.filter(q => !ExamQuestionHistory.wasRecentlyCorrect(subjectKey, questionType, q.title));
    };
    
    const filteredWrong = filterRecentCorrect(wrongQuestionsList);
    const filteredFavorites = filterRecentCorrect(favoritesList);
    const filteredNormal = filterRecentCorrect(normalQuestionsList);
    
    // 计算总体权重
    const totalWrong = filteredWrong.length;
    const totalFavorites = filteredFavorites.length;
    const totalNormal = filteredNormal.length;
    const totalAvailable = totalWrong + totalFavorites + totalNormal;
    
    if (totalAvailable === 0) {
        // 如果没有可用题目，返回原始题目中的随机选择
        return shuffleArray([...allQuestions]).slice(0, requestedCount).map(q => ({...q, _type: questionType}));
    }
    
    // 按优先级分配抽取概率
    // 错题本:收藏:题库 = 50%:30%:20%
    const wrongWeight = 0.5;
    const favoriteWeight = 0.3;
    const normalWeight = 0.2;
    
    const selectedQuestions = [];
    const usedTitles = new Set();
    
    // 抽取题目
    for (let i = 0; i < requestedCount; i++) {
        if (selectedQuestions.length >= totalAvailable) break;
        
        // 生成随机数决定从哪个池子抽取
        const random = Math.random();
        let selectedQuestion = null;
        
        if (random < wrongWeight && filteredWrong.length > 0) {
            // 从错题本抽取
            const availableWrong = filteredWrong.filter(q => !usedTitles.has(q.title));
            if (availableWrong.length > 0) {
                selectedQuestion = availableWrong[Math.floor(Math.random() * availableWrong.length)];
            }
        }
        
        if (!selectedQuestion && random < (wrongWeight + favoriteWeight) && filteredFavorites.length > 0) {
            // 从收藏抽取
            const availableFavorites = filteredFavorites.filter(q => !usedTitles.has(q.title));
            if (availableFavorites.length > 0) {
                selectedQuestion = availableFavorites[Math.floor(Math.random() * availableFavorites.length)];
            }
        }
        
        if (!selectedQuestion && filteredNormal.length > 0) {
            // 从题库抽取
            const availableNormal = filteredNormal.filter(q => !usedTitles.has(q.title));
            if (availableNormal.length > 0) {
                selectedQuestion = availableNormal[Math.floor(Math.random() * availableNormal.length)];
            }
        }
        
        // 如果还没选到题目，从任意可用题目中选一个
        if (!selectedQuestion) {
            const allAvailable = [...filteredWrong, ...filteredFavorites, ...filteredNormal]
                .filter(q => !usedTitles.has(q.title));
            if (allAvailable.length > 0) {
                selectedQuestion = allAvailable[Math.floor(Math.random() * allAvailable.length)];
            }
        }
        
        if (selectedQuestion) {
            selectedQuestions.push({...selectedQuestion, _type: questionType});
            usedTitles.add(selectedQuestion.title);
        }
    }
    
    return selectedQuestions;
}

// 显示考试配置模态框
async function showExamConfigModal() {
    if (!requireLogin('参加模拟考试')) {
        return;
    }
    
    if (!requireMembership('参加模拟考试')) {
        return;
    }
    
    // 🔐 触发会话检查
    await triggerSessionCheck('开始模拟考试');
    
    // 检查数据是否已加载，如果没有则重新计算统计信息
    if (!statistics.total) {
        if (questionsData && Object.keys(questionsData).length > 0) {
            calculateStatisticsFromData();
        } else {
            // 题库数据还未加载完成，显示提示
            showMessage('题库数据正在加载中，请稍后再试...', 'warning');
            return;
        }
    }
    
    // 使用已计算的统计数据更新可用题目数量，避免重复计算
    document.getElementById('single-available').textContent = statistics.single_choice || 0;
    document.getElementById('multiple-available').textContent = statistics.multiple_choice || 0;
    document.getElementById('judge-available').textContent = statistics.true_false || 0;
    document.getElementById('fill-available').textContent = statistics.fill_blank || 0;
    
    // 使用统计数据计算默认值
    const maxSingle = Math.min(10, statistics.single_choice || 0);
    const maxMultiple = Math.min(5, statistics.multiple_choice || 0);
    const maxJudge = Math.min(5, statistics.true_false || 0);
    const maxFill = Math.min(5, statistics.fill_blank || 0);
    
    document.getElementById('single-count-input').value = maxSingle;
    document.getElementById('multiple-count-input').value = maxMultiple;
    document.getElementById('judge-count-input').value = maxJudge;
    document.getElementById('fill-count-input').value = maxFill;
    
    updateExamSummary();
    document.getElementById('exam-config-modal').classList.remove('hidden');
}

// 隐藏考试配置模态框
function hideExamConfigModal() {
    document.getElementById('exam-config-modal').classList.add('hidden');
}

// 隐藏考试题目数超限提示模态框
function hideExamLimitModal() {
    document.getElementById('exam-limit-modal').classList.add('hidden');
}

// 更新考试摘要
function updateExamSummary() {
    const singleInput = document.getElementById('single-count-input');
    const multipleInput = document.getElementById('multiple-count-input');
    const judgeInput = document.getElementById('judge-count-input');
    const fillInput = document.getElementById('fill-count-input');
    
    let singleCount = parseInt(singleInput.value) || 0;
    let multipleCount = parseInt(multipleInput.value) || 0;
    let judgeCount = parseInt(judgeInput.value) || 0;
    let fillCount = parseInt(fillInput.value) || 0;
    
    // 检查并调整超过可用题目数的输入值
    const maxSingle = statistics.single_choice || 0;
    const maxMultiple = statistics.multiple_choice || 0;
    const maxJudge = statistics.true_false || 0;
    const maxFill = statistics.fill_blank || 0;
    
    let adjusted = false;
    
    if (singleCount > maxSingle) {
        singleCount = maxSingle;
        singleInput.value = singleCount;
        adjusted = true;
    }
    
    if (multipleCount > maxMultiple) {
        multipleCount = maxMultiple;
        multipleInput.value = multipleCount;
        adjusted = true;
    }
    
    if (judgeCount > maxJudge) {
        judgeCount = maxJudge;
        judgeInput.value = judgeCount;
        adjusted = true;
    }
    
    if (fillCount > maxFill) {
        fillCount = maxFill;
        fillInput.value = fillCount;
        adjusted = true;
    }
    
    // 如果有调整，显示提示信息
    if (adjusted) {
        showMessage('检测到输入的题目数超过可用数量，已自动调整为最大可用数量', 'info');
    }
    
    const totalQuestions = singleCount + multipleCount + judgeCount + fillCount;
    const estimatedTime = totalQuestions; // 每题预计1分钟
    
    document.getElementById('total-exam-questions').textContent = totalQuestions;
    document.getElementById('estimated-time').textContent = estimatedTime + '分钟';
    
    // 检查总题目数是否超过100道限制
    const totalLimitExceeded = totalQuestions > 100;
    if (totalLimitExceeded) {
        document.getElementById('total-exam-questions').style.color = '#ef4444';
        document.getElementById('estimated-time').style.color = '#ef4444';
    } else {
        document.getElementById('total-exam-questions').style.color = '';
        document.getElementById('estimated-time').style.color = '';
    }
    
    // 使用已计算的统计数据检查是否超出可用题目数量，避免重复访问questionsData
    const startBtn = document.getElementById('start-exam');
    let canStart = totalQuestions > 0;
    
    // 如果总题目数超过限制，显示提示信息
    if (totalLimitExceeded) {
        document.getElementById('total-exam-questions').title = '单次考试总题目数不得超过100道题';
        document.getElementById('estimated-time').title = '单次考试总题目数不得超过100道题';
    } else {
        document.getElementById('total-exam-questions').title = '';
        document.getElementById('estimated-time').title = '';
    }
    
    startBtn.disabled = !canStart;
}

// 开始配置的模拟考试
function startConfiguredExam() {
    const singleInput = document.getElementById('single-count-input');
    const multipleInput = document.getElementById('multiple-count-input');
    const judgeInput = document.getElementById('judge-count-input');
    const fillInput = document.getElementById('fill-count-input');
    
    let singleCount = parseInt(singleInput.value) || 0;
    let multipleCount = parseInt(multipleInput.value) || 0;
    let judgeCount = parseInt(judgeInput.value) || 0;
    let fillCount = parseInt(fillInput.value) || 0;
    
    // 检查并调整超过可用题目数的输入值
    const maxSingle = statistics.single_choice || 0;
    const maxMultiple = statistics.multiple_choice || 0;
    const maxJudge = statistics.true_false || 0;
    const maxFill = statistics.fill_blank || 0;
    
    if (singleCount > maxSingle) {
        singleCount = maxSingle;
        singleInput.value = singleCount;
    }
    
    if (multipleCount > maxMultiple) {
        multipleCount = maxMultiple;
        multipleInput.value = multipleCount;
    }
    
    if (judgeCount > maxJudge) {
        judgeCount = maxJudge;
        judgeInput.value = judgeCount;
    }
    
    if (fillCount > maxFill) {
        fillCount = maxFill;
        fillInput.value = fillCount;
    }
    
    const totalQuestions = singleCount + multipleCount + judgeCount + fillCount;
    
    // 检查总题目数是否超过100道限制
    if (totalQuestions > 100) {
        // 显示超限提示模态框
        document.getElementById('current-total-questions').textContent = totalQuestions;
        document.getElementById('exam-limit-modal').classList.remove('hidden');
        return;
    }
    
    const subjectKey = currentSubject || '毛概';
    
    // 在开始抽题前，检查是否需要清理历史记录（整体检查）
    checkAndClearHistoryIfNeeded(subjectKey, singleCount, multipleCount, judgeCount, fillCount);
    
    const examQuestions = [];
    
    // 添加单选题（使用智能抽题算法）
    if (singleCount > 0 && questionsData.single_choice) {
        const selected = smartSelectQuestions(subjectKey, 'single_choice', singleCount);
        examQuestions.push(...selected);
    }
    
    // 添加多选题（使用智能抽题算法）
    if (multipleCount > 0 && questionsData.multiple_choice) {
        const selected = smartSelectQuestions(subjectKey, 'multiple_choice', multipleCount);
        examQuestions.push(...selected);
    }
    
    // 添加判断题（使用智能抽题算法）
    if (judgeCount > 0 && questionsData.true_false) {
        const selected = smartSelectQuestions(subjectKey, 'true_false', judgeCount);
        examQuestions.push(...selected);
    }
    
    // 添加填空题（使用智能抽题算法）
    if (fillCount > 0 && questionsData.fill_blank) {
        const selected = smartSelectQuestions(subjectKey, 'fill_blank', fillCount);
        examQuestions.push(...selected);
    }
    
    if (examQuestions.length === 0) {
        showMessage('没有可用的题目', 'warning');
        return;
    }

    // 随机排序所有题目
    currentQuestions = shuffleArray(examQuestions);
    currentQuestionType = 'mock_exam';
    currentQuestionIndex = 0;
    userAnswers = new Array(currentQuestions.length).fill(null);
    judgedAnswers = new Array(currentQuestions.length).fill(false);
    isExamMode = true;

    // 隐藏模态框
    hideExamConfigModal();
    
    // 隐藏科目按钮（进入考试模式）
    hideSubjectButton();
    
    // 显示题目区域，隐藏导航按钮
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    // 在考试模式下隐藏顶部的所有导航按钮
    document.getElementById('home-btn').style.display = 'none';
    document.getElementById('wrong-questions-btn').style.display = 'none';
    document.getElementById('favorites-btn').style.display = 'none';
    
    // 启动考试计时器
    const actualTotalQuestions = currentQuestions.length;
    startExamTimer(actualTotalQuestions); // 每题1分钟
    
    // 显示考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.remove('hidden');
    
    // 更新考试导航栏
    updateExamNavigation();
    
    showQuestion();
    updateStatusDisplay();
    showMessage(`模拟考试已开始，共${actualTotalQuestions}题，时长${actualTotalQuestions}分钟`, 'info');
}

// 检查并清理历史记录（整体检查）
function checkAndClearHistoryIfNeeded(subject, singleCount, multipleCount, judgeCount, fillCount) {
    // 计算每种题型的总题目数
    const singleTotal = questionsData.single_choice ? questionsData.single_choice.length : 0;
    const multipleTotal = questionsData.multiple_choice ? questionsData.multiple_choice.length : 0;
    const judgeTotal = questionsData.true_false ? questionsData.true_false.length : 0;
    const fillTotal = questionsData.fill_blank ? questionsData.fill_blank.length : 0;
    
    // 获取每种题型的历史记录
    const singleHistory = ExamQuestionHistory.getHistory(subject, 'single_choice');
    const multipleHistory = ExamQuestionHistory.getHistory(subject, 'multiple_choice');
    const judgeHistory = ExamQuestionHistory.getHistory(subject, 'true_false');
    const fillHistory = ExamQuestionHistory.getHistory(subject, 'fill_blank');
    
    // 计算每种题型的作对题目数（去重）
    const singleCorrect = new Set(singleHistory.correctQuestions).size;
    const multipleCorrect = new Set(multipleHistory.correctQuestions).size;
    const judgeCorrect = new Set(judgeHistory.correctQuestions).size;
    const fillCorrect = new Set(fillHistory.correctQuestions).size;
    
    // 计算每种题型的可用题目数
    const singleAvailable = singleTotal - singleCorrect;
    const multipleAvailable = multipleTotal - multipleCorrect;
    const judgeAvailable = judgeTotal - judgeCorrect;
    const fillAvailable = fillTotal - fillCorrect;
    
    // 检查每种题型是否需要清理（仅当用户请求该题型且请求数超过可用数时）
    if (singleCount > 0 && singleCount > singleAvailable) {
        singleHistory.correctQuestions = [];
        singleHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'single_choice', singleHistory);
    }
    
    if (multipleCount > 0 && multipleCount > multipleAvailable) {
        multipleHistory.correctQuestions = [];
        multipleHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'multiple_choice', multipleHistory);
    }
    
    if (judgeCount > 0 && judgeCount > judgeAvailable) {
        judgeHistory.correctQuestions = [];
        judgeHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'true_false', judgeHistory);
    }
    
    if (fillCount > 0 && fillCount > fillAvailable) {
        fillHistory.correctQuestions = [];
        fillHistory.totalGenerated = 0;
        ExamQuestionHistory.saveHistory(subject, 'fill_blank', fillHistory);
    }
}

// 显示错题本模态框
function showWrongQuestionsModal() {
    if (!requireLogin('查看错题本')) {
        return;
    }
    
    const modal = document.getElementById('wrong-questions-modal');
    modal.classList.remove('hidden');
    renderWrongQuestions();
    
    // 非会员提示
    if (!currentUser || currentUser.membershipType === '非会员') {
        showMessage('非会员用户的错题数据不会云端存档', 'warning');
    }
}

// 隐藏错题本模态框
function hideWrongQuestionsModal() {
    document.getElementById('wrong-questions-modal').classList.add('hidden');
}

// 渲染错题列表
function renderWrongQuestions(filterType = '') {
    const container = document.getElementById('wrong-questions-list');
    container.innerHTML = '';
    
    let hasQuestions = false;
    
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 确保当前科目的错题本存在
    if (!wrongQuestions[subjectKey]) {
        wrongQuestions[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    // 只渲染当前科目的错题
    Object.keys(wrongQuestions[subjectKey]).forEach(type => {
        if (filterType && type !== filterType) return;
        
        wrongQuestions[subjectKey][type].forEach((question, index) => {
            hasQuestions = true;
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            questionItem.innerHTML = `
                <div class="question-item-header">
                    <span class="question-type-badge">${getTypeLabel(type)}</span>
                    <div class="question-item-actions">
                        <button class="small-btn practice" onclick="practiceWrongQuestion('${type}', ${index})">练习</button>
                        <button class="small-btn remove" onclick="removeWrongQuestion('${type}', ${index})">移除</button>
                    </div>
                </div>
                <div class="question-item-text">${question.title}</div>
                <div class="question-item-answer">正确答案: ${question.correctAnswer}</div>
            `;
            
            container.appendChild(questionItem);
        });
    });
    
    if (!hasQuestions) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无错题</div>';
    }
}

// 过滤错题
function filterWrongQuestions() {
    const filterType = document.getElementById('wrong-type-filter').value;
    renderWrongQuestions(filterType);
}

// 清空错题本
function clearWrongQuestions() {
    // 显示自定义确认对话框
    document.getElementById('clear-wrong-questions-modal').classList.remove('hidden');
}

// 确认清空错题本
function confirmClearWrongQuestions() {
    // 隐藏确认对话框
    hideClearWrongQuestionsModal();
    
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 清空当前科目的错题本
    wrongQuestions[subjectKey] = {
        'single_choice': [],
        'multiple_choice': [],
        'true_false': [],
        'fill_blank': []
    };
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    renderWrongQuestions();
    updateStatisticsDisplay();
    showMessage('错题本已清空', 'success');
}

// 隐藏清空错题本确认对话框
function hideClearWrongQuestionsModal() {
    document.getElementById('clear-wrong-questions-modal').classList.add('hidden');
}

// 练习错题
function practiceWrongQuestion(type, index) {
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    if (!wrongQuestions[subjectKey] || !wrongQuestions[subjectKey][type] || !wrongQuestions[subjectKey][type][index]) return;
    
    const question = wrongQuestions[subjectKey][type][index];
    currentQuestions = [question];
    currentQuestionType = type;
    currentQuestionIndex = 0;
    userAnswers = [null];
    judgedAnswers = [false];
    isExamMode = false;
    
    // 添加一个标志，表示当前是在练习错题本中的题目
    isPracticingWrongQuestions = true;
    
    hideWrongQuestionsModal();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    showQuestion();
    updateStatusDisplay();
}

// 移除错题
function removeWrongQuestion(type, index) {
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    if (!wrongQuestions[subjectKey] || !wrongQuestions[subjectKey][type] || !wrongQuestions[subjectKey][type][index]) return;
    
    wrongQuestions[subjectKey][type].splice(index, 1);
    if (wrongQuestions[subjectKey][type].length === 0) {
        delete wrongQuestions[subjectKey][type];
    }
    
    // 保存到本地存储（按科目存储）
    const wrongQuestionsKey = `exam_wrong_questions_${subjectKey}`;
    localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subjectKey]));
    renderWrongQuestions();
    updateStatisticsDisplay();
    showMessage('已从错题本移除', 'success');
}

// 显示收藏模态框
function showFavoritesModal() {
    if (!requireLogin('查看收藏题目')) {
        return;
    }
    
    const modal = document.getElementById('favorites-modal');
    modal.classList.remove('hidden');
    renderFavorites();
    
    // 非会员提示
    if (!currentUser || currentUser.membershipType === '非会员') {
        showMessage('非会员用户的收藏数据不会云端存档', 'warning');
    }
}

// 隐藏收藏模态框
function hideFavoritesModal() {
    document.getElementById('favorites-modal').classList.add('hidden');
}

// 渲染收藏列表
function renderFavorites(filterType = '') {
    const container = document.getElementById('favorites-list');
    container.innerHTML = '';
    
    let hasQuestions = false;
    
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    // 只渲染当前科目的收藏
    Object.keys(favorites[subjectKey]).forEach(type => {
        if (filterType && type !== filterType) return;
        
        // 确保题型数组存在
        if (!Array.isArray(favorites[subjectKey][type])) {
            favorites[subjectKey][type] = [];
        }
        
        favorites[subjectKey][type].forEach((question, index) => {
            hasQuestions = true;
            const questionItem = document.createElement('div');
            questionItem.className = 'question-item';
            questionItem.innerHTML = `
                <div class="question-item-header">
                    <span class="question-type-badge">${getTypeLabel(type)}</span>
                    <div class="question-item-actions">
                        <button class="small-btn practice" onclick="practiceFavoriteQuestion('${type}', ${index})">练习</button>
                        <button class="small-btn remove" onclick="removeFavoriteQuestion('${type}', ${index})">移除</button>
                    </div>
                </div>
                <div class="question-item-text">${question.title}</div>
                <div class="question-item-answer">正确答案: ${question.correctAnswer}</div>
            `;
            
            container.appendChild(questionItem);
        });
    });
    
    if (!hasQuestions) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">暂无收藏题目</div>';
    }
}

// 过滤收藏
function filterFavorites() {
    const filterType = document.getElementById('favorite-type-filter').value;
    renderFavorites(filterType);
}

// 清空收藏
// 清空收藏
function clearFavorites() {
    // 显示自定义确认对话框
    document.getElementById('clear-favorites-modal').classList.remove('hidden');
}

// 确认清空收藏
function confirmClearFavorites() {
    // 隐藏确认对话框
    hideClearFavoritesModal();
    
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 清空当前科目的收藏
    favorites[subjectKey] = {
        'single_choice': [],
        'multiple_choice': [],
        'true_false': [],
        'fill_blank': []
    };
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites[subjectKey]));
    renderFavorites();
    updateStatisticsDisplay();
    showMessage('收藏已清空', 'success');
}

// 隐藏清空收藏确认对话框
function hideClearFavoritesModal() {
    document.getElementById('clear-favorites-modal').classList.add('hidden');
}

// 练习收藏题目
// 练习收藏题目
function practiceFavoriteQuestion(type, index) {
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][type] || !favorites[subjectKey][type][index]) return;
    
    const question = favorites[subjectKey][type][index];
    currentQuestions = [question];
    currentQuestionType = type;
    currentQuestionIndex = 0;
    userAnswers = [null];
    judgedAnswers = [false];
    isExamMode = false;
    
    hideFavoritesModal();
    
    // 显示题目区域
    document.getElementById('welcome-section').classList.add('hidden');
    document.getElementById('question-type-section').classList.add('hidden');
    document.getElementById('question-section').classList.remove('hidden');
    
    showQuestion();
    updateStatusDisplay();
}

// 移除收藏题目
// 移除收藏题目
function removeFavoriteQuestion(type, index) {
    // 获取当前科目
    const subjectKey = currentSubject || '毛概';
    
    // 确保当前科目的收藏存在
    if (!favorites[subjectKey]) {
        favorites[subjectKey] = {
            'single_choice': [],
            'multiple_choice': [],
            'true_false': [],
            'fill_blank': []
        };
    }
    
    if (!favorites[subjectKey][type] || !favorites[subjectKey][type][index]) return;
    
    favorites[subjectKey][type].splice(index, 1);
    // 不删除空数组，保持结构完整
    
    // 保存到本地存储（按科目存储）
    const favoritesKey = `exam_favorites_${subjectKey}`;
    localStorage.setItem(favoritesKey, JSON.stringify(favorites[subjectKey]));
    renderFavorites();
    updateStatisticsDisplay();
    showMessage('已从收藏移除', 'success');
}

// 滚动到解析区域
function scrollToAnalysis() {
    const feedbackElement = document.getElementById('answer-feedback');
    if (feedbackElement && !feedbackElement.classList.contains('hidden')) {
        feedbackElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
        
        // 添加高亮效果
        feedbackElement.style.animation = 'none';
        feedbackElement.offsetHeight; // 触发重绘
        feedbackElement.style.animation = 'highlightAnalysis 2s ease';
    }
}

// 显示交卷确认模态框
function showSubmitConfirmModal() {
    const modal = document.getElementById('submit-confirm-modal');
    const answeredCount = userAnswers.filter(answer => answer !== null && answer !== '').length;
    const unansweredCount = currentQuestions.length - answeredCount;
    
    document.getElementById('answered-count').textContent = answeredCount;
    document.getElementById('unanswered-count').textContent = unansweredCount;
    
    modal.classList.remove('hidden');
}

// 隐藏交卷确认模态框
function hideSubmitConfirmModal() {
    document.getElementById('submit-confirm-modal').classList.add('hidden');
}

// 提交考试
function submitExam() {
    hideSubmitConfirmModal();
    
    // 停止考试计时器
    stopExamTimer();
    
    // 计算考试结果
    let correctCount = 0;
    let totalCount = currentQuestions.length;
    const subjectKey = currentSubject || '毛概';
    
    // 评判所有题目并处理错题本记录
    for (let i = 0; i < currentQuestions.length; i++) {
        const question = currentQuestions[i];
        const userAnswer = userAnswers[i];
        const questionType = question._type;
        
        if (userAnswer !== null && userAnswer !== '') {
            const correctAnswer = question.correctAnswer.trim().toUpperCase();
            const userAnswerUpper = userAnswer.toString().trim().toUpperCase();
            const isCorrect = userAnswerUpper === correctAnswer;
            
            if (isCorrect) {
                correctCount++;
                // 记录作对的题目到出题历史（按题型分别记录）
                ExamQuestionHistory.addCorrectQuestion(subjectKey, questionType, question.title);
                // 如果答对了，从错题本中移除
                removeFromWrongQuestions(questionType, question);
            } else {
                // 只在模拟考试模式下记录错题
                addToWrongQuestions(questionType, question, userAnswer);
            }
        }
        // 未作答的题目不记录到错题本
    }
    
    const wrongCount = totalCount - correctCount;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const score = Math.round((correctCount / totalCount) * 100);
    
    // 显示考试结果
    showExamResultModal(score, totalCount, correctCount, wrongCount, accuracy);
}

// 显示考试结果模态框
function showExamResultModal(score, totalCount, correctCount, wrongCount, accuracy) {
    const modal = document.getElementById('exam-result-modal');
    
    document.getElementById('exam-score').textContent = score;
    document.getElementById('exam-total-questions').textContent = totalCount;
    document.getElementById('correct-questions').textContent = correctCount;
    document.getElementById('wrong-questions-count').textContent = wrongCount;
    document.getElementById('accuracy-rate').textContent = accuracy + '%';
    
    modal.classList.remove('hidden');
}

// 隐藏考试结果模态框
function hideExamResultModal() {
    document.getElementById('exam-result-modal').classList.add('hidden');
}

// 查看考试详情
function reviewExamDetails() {
    hideExamResultModal();
    
    // 进入查看详情模式
    isReviewMode = true;
    // 提交按钮不可用
    document.getElementById('submit-btn').disabled = true;
   

    
    
    // 标记所有题目为已评判状态以显示正确答案
    for (let i = 0; i < currentQuestions.length; i++) {
        judgedAnswers[i] = true;
    }
    
    // 显示考试导航栏
    const examNav = document.getElementById('exam-nav');
    examNav.classList.remove('hidden');
    
    // 更新导航栏显示
    updateExamNavigation();
    
    // 回到第一题开始查看
    currentQuestionIndex = 0;
    showQuestion();
    
    showMessage('现在可以查看所有题目的正确答案和解析', 'info');
}

// 启动考试计时器
function startExamTimer(durationMinutes) {
    examDuration = durationMinutes;
    examStartTime = Date.now();
    
    // 显示考试导航栏
    document.getElementById('exam-nav').classList.remove('hidden');
    
    // 更新计时器显示
    updateTimerDisplay();
    
    // 每秒更新一次
    examTimer = setInterval(updateTimerDisplay, 1000);
}

// 停止考试计时器
function stopExamTimer() {
    if (examTimer) {
        clearInterval(examTimer);
        examTimer = null;
    }
    
    // 隐藏考试导航栏
    document.getElementById('exam-nav').classList.add('hidden');
}

// 更新计时器显示
function updateTimerDisplay() {
    if (!examStartTime || !examDuration) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - examStartTime) / 1000); // 已过去的秒数
    const totalSeconds = examDuration * 60; // 总秒数
    const remaining = Math.max(0, totalSeconds - elapsed); // 剩余秒数
    
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
    
    // 时间用完自动交卷
    if (remaining === 0) {
        showMessage('考试时间已到，自动交卷', 'warning');
        setTimeout(() => {
            submitExam();
        }, 1000);
    }
    
    // 最后5分钟警告
    if (remaining === 300) {
        showMessage('剩余时间5分钟，请注意时间', 'warning');
    }
    
    // 最后1分钟警告
    if (remaining === 60) {
        showMessage('剩余时间1分钟！', 'warning');
    }
}

// 更新考试导航栏显示
function updateExamNavigation() {
    const examNav = document.getElementById('exam-nav');
    const navSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    // 移除所有现有的事件监听器
    navSubmitBtn.replaceWith(navSubmitBtn.cloneNode(true));
    const newNavSubmitBtn = document.getElementById('nav-submit-exam-btn');
    
    if (isReviewMode) {
        // 查看详情模式：显示返回首页按钮
        newNavSubmitBtn.innerHTML = '<i class="fas fa-home"></i> 返回首页';
        newNavSubmitBtn.addEventListener('click', returnToHome);
        
        // 隐藏计时器
        document.querySelector('.exam-timer').style.display = 'none';
    } else if (isExamMode) {
        // 考试模式：显示交卷按钮和计时器
        newNavSubmitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 交卷';
        newNavSubmitBtn.addEventListener('click', showSubmitConfirmModal);
        
        // 显示计时器
        document.querySelector('.exam-timer').style.display = 'flex';
    }
}

// ========== 用户系统功能 ==========

// 当前用户信息
let currentUser = null;

// 会员状态检查定时器
let membershipCheckTimer = null;

// 🔐 会话管理相关变量
let sessionCheckTimer = null; // 会话检查定时器
let sessionCheckInProgress = false; // 会话检查进行中标志
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查间隔

// 独立的时间不足检查函数（每10分钟执行一次）
async function checkMembershipTimeWarning() {
    // 如果用户未登录或不是有时限的会员，无需检查
    if (!currentUser || 
        !(currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') || 
        !currentUser.membershipEndTime) {
        return;
    }
    
    const now = new Date();
    const endTime = new Date(currentUser.membershipEndTime);
    const timeRemaining = endTime.getTime() - now.getTime();
    const oneHourInMs = 60 * 60 * 1000; // 一小时的毫秒数
    
    // 检查是否已过期，如果已过期就不显示提醒了
    if (timeRemaining <= 0) {
        return;
    }
    
    // 检查是否时间不足一小时且用户未选择"不再提醒"
    if (timeRemaining <= oneHourInMs) {
        const dontRemindKey = `no_remind_expiry_${currentUser.objectId}`;
        const dontRemind = localStorage.getItem(dontRemindKey) === 'true';
        
        if (!dontRemind) {
  
            try {
                const result = await showMembershipExpiryWarning(timeRemaining);
                
                if (result.action === 'no_remind') {
                    // 用户选择不再提醒，清理本地存储并退出登录
                    localStorage.setItem(dontRemindKey, 'true');
                    await handleMembershipExpiry(currentUser, true); // 显示最终登录提示
                } else if (result.action === 'upgrade') {
                    // 用户选择升级会员，显示会员窗口
                    forceShowMembershipModal();
                }
            } catch (error) {
                console.error('会员时间不足提醒处理失败:', error);
            }
        }
    }
}

// 启动会员状态定期检查（每10分钟检查一次）
function startMembershipStatusCheck() {
    // 清除之前的定时器
    if (membershipCheckTimer) {
        clearInterval(membershipCheckTimer);
    }
    
    // 只对有时限的会员启动定期检查
    if (currentUser && (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip') && currentUser.membershipEndTime) {

        
        // 立即检查一次时间不足提醒
        checkMembershipTimeWarning().catch(error => {
            console.error('会员时间检查失败:', error);
        });
        
        // 每10分钟检查一次时间不足提醒
        membershipCheckTimer = setInterval(async () => {
            try {
                await checkMembershipTimeWarning();
            } catch (error) {
                console.error('定期会员时间检查失败:', error);
            }
        }, 10 * 60 * 1000); // 10分钟
    }
}

// 停止会员状态检查
function stopMembershipStatusCheck() {
    if (membershipCheckTimer) {
        clearInterval(membershipCheckTimer);
        membershipCheckTimer = null;

    }
}

// 🔐 会话管理函数
// 检查会话有效性
async function checkSessionValidity() {
    try {
        // 🔧 防止重复请求 - 如果正在检查中，直接返回
        if (sessionCheckInProgress) {
      
            return;
        }

        // 只检查VIP和SVIP用户
        if (!currentUser || !currentUser.sessionId || 
            (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip')) {
            return;
        }

        sessionCheckInProgress = true; // 🔒 设置请求锁
    
        
        const result = await window.leanCloudClient.validateSession(currentUser.id, currentUser.sessionId);
        
        if (!result.success) {
            if (result.code === 'SESSION_EXPIRED') {
                console.warn('⚠️ 会话已失效:', result.message);
                await handleSessionExpired(result.message);
            } else {
                console.error('❌ 会话验证失败:', result.message);
            }
        } else {
     
        }
    } catch (error) {
        console.error('会话检查失败:', error);
    } finally {
        sessionCheckInProgress = false; // 🔓 释放请求锁
    }
}

// 🎯 手动触发会话检查（用于特定操作）
async function triggerSessionCheck(actionName = '操作') {
    if (!currentUser || !currentUser.sessionId || 
        (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip' && currentUser.membershipType !== 'sssvip')) {
        return { success: true, message: '非会员用户，无需检查' };
    }


    
    // 直接调用检查函数
    await checkSessionValidity();
    
    return { success: true, message: '会话检查完成' };
}

// 🔄 显示云同步确认对话框
function showCloudSyncConfirmDialog() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay sync-confirm-overlay';
        modal.setAttribute('data-closeable', 'false');
        modal.innerHTML = `
            <div class="modal-content sync-confirm-modal">
                <div class="modal-header">
                    <h3>☁️ 云同步提醒</h3>
                </div>
                <div class="modal-body">
                    <div class="sync-message">
                        <p>🎯 <strong>VIP用户专享</strong></p>
                        <p>您的本地学习数据（答题记录、错题本、收藏等）尚未同步到云端。</p>
                        <p><strong>建议在退出前进行云同步，避免数据丢失。</strong></p>
                    </div>
                    <div class="sync-options">
                        <button id="sync-and-logout" class="btn btn-primary">
                            <i class="fas fa-cloud-upload-alt"></i> 同步后退出
                        </button>
                        <button id="logout-without-sync" class="btn btn-secondary">
                            <i class="fas fa-sign-out-alt"></i> 不同步直接退出
                        </button>
                        <button id="cancel-logout" class="btn btn-light">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 绑定事件
        document.getElementById('sync-and-logout').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve('sync');
        });

        document.getElementById('logout-without-sync').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve('logout');
        });

        document.getElementById('cancel-logout').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve('cancel');
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve('cancel');
            }
        });
    });
}

// 🔄 执行云同步
async function performCloudSync() {
    try {
        showMessage('正在同步数据到云端...', 'info');
        
        // 检查是否有数据需要同步
        const hasLocalData = checkLocalDataForSync();
        
        if (!hasLocalData.hasData) {
            return { success: true, message: '无需同步的数据' };
        }
        
        // 调用后端同步API
        const syncResult = await window.leanCloudClient.syncLocalDataToCloud({
            statistics: statistics,
            favorites: favorites,
            wrongQuestions: wrongQuestions,
            progressData: getProgressData()
        });
        
        if (syncResult.success) {
            showMessage('✅ 云同步完成', 'success');
            return { success: true, message: '同步成功' };
        } else {
            throw new Error(syncResult.message);
        }
        
    } catch (error) {
        console.error('云同步失败:', error);
        showMessage('❌ 云同步失败: ' + error.message, 'error');
        return { success: false, message: error.message };
    }
}

// 获取本地进度数据
function getProgressData() {
    const progressData = {};
    const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
    const subjects = ['毛概', '思修', '近代史', '马原'];
    
    subjects.forEach(subject => {
        if (!progressData[subject]) {
            progressData[subject] = {};
        }
        
        questionTypes.forEach(type => {
            const progress = localStorage.getItem(`exam_progress_${subject}_${type}`);
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
    
    return progressData;
}

// 检查是否有需要同步的本地数据
function checkLocalDataForSync() {
    const hasStats = statistics && (statistics.totalAnswered > 0 || statistics.totalCorrect > 0);
    const hasFavorites = favorites && Object.keys(favorites).length > 0;
    const hasWrongQuestions = wrongQuestions && Object.keys(wrongQuestions).length > 0;
    
    const progressData = getProgressData();
    const hasProgress = progressData && Object.keys(progressData).some(subject => {
        const subjectData = progressData[subject];
        return subjectData && Object.keys(subjectData).some(type => {
            const typeData = subjectData[type];
            return typeData && (
                (typeData.userAnswers && typeData.userAnswers.length > 0) ||
                (typeData.currentIndex && typeData.currentIndex > 0)
            );
        });
    });
    
    return {
        hasData: hasStats || hasFavorites || hasWrongQuestions || hasProgress,
        details: {
            hasStats,
            hasFavorites,
            hasWrongQuestions,
            hasProgress
        }
    };
}

// 处理会话过期
async function handleSessionExpired(message) {
    // 停止所有定时器
    stopSessionCheck();
    stopMembershipStatusCheck();
    
    // 清除用户信息
    currentUser = null;
    localStorage.removeItem('examUser');
    
    // 🔧 清理所有科目的考试记录会话
    clearAllExamQuestionHistory();
    
    // 显示友好的提示弹窗
    showSessionExpiredModal(message);
    
    // 返回主页并显示登录界面
    returnToHome();
    setTimeout(() => {
        showAuthModal();
    }, 1000);
}

// 显示会话过期提示弹窗
function showSessionExpiredModal(message) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-closeable', 'false');
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 480px;">
            <div class="modal-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                <h3><i class="fas fa-exclamation-triangle"></i> 设备限制提醒</h3>
                <span class="close-btn" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 20px 0;">
                    <div style="font-size: 64px; color: #ef4444; margin-bottom: 16px;">
                        🔐
                    </div>
                    <h4 style="color: #1f2937; margin-bottom: 12px;">账号已在其他设备登录</h4>
                    <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.6;">
                        ${message || '您的VIP/SVIP账号已在其他设备登录，当前会话已失效。'}<br/>
                        为保护您的账号安全，同一时间只允许在一个设备上使用。
                    </p>
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
                        <p style="color: #92400e; margin: 0; font-size: 14px;">
                            💡 如果不是您本人操作，请及时修改密码
                        </p>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button class="primary-btn" onclick="this.closest('.modal').remove(); showAuthModal();">
                            <i class="fas fa-sign-in-alt"></i> 重新登录
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 点击外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 启动会话检查
function startSessionCheck() {
    // 只为VIP和SVIP用户启动会话检查
    if (!currentUser || !currentUser.sessionId || 
        (currentUser.membershipType !== 'vip' && currentUser.membershipType !== 'svip')) {
        return;
    }

    // 🔧 防止重复启动 - 先停止现有的定时器
    stopSessionCheck();

  
    
    // 立即检查一次
    setTimeoutAsync(checkSessionValidity, 0);
    
    // 设置定时检查
    sessionCheckTimer = setInterval(() => {
        checkSessionValidity().catch(error => {
            console.error('定期会话检查失败:', error);
        });
    }, SESSION_CHECK_INTERVAL);
}

// 停止会话检查
function stopSessionCheck() {
    if (sessionCheckTimer) {
        clearInterval(sessionCheckTimer);
        sessionCheckTimer = null;
      
    }
    // 🔧 重置请求锁标志
    sessionCheckInProgress = false;
}

// 异步setTimeout辅助函数
function setTimeoutAsync(fn, delay) {
    setTimeout(() => {
        if (typeof fn === 'function') {
            fn().catch(error => console.error('异步setTimeout执行失败:', error));
        }
    }, delay);
}

// 初始化用户系统
async function initUserSystem() {
    try {
        // 首先尝试自动登录（从localStorage恢复会话并验证）
        const autoLoginResult = await window.leanCloudClient.autoLogin();
        
        if (autoLoginResult.success) {
            console.log('自动登录成功:', autoLoginResult.user.username);
            
            // 直接设置用户数据（过期检查已在leancloud-client.js的autoLogin中处理）
            currentUser = autoLoginResult.user;
            console.log('用户状态:', currentUser.membershipType);
            
            // 自动登录成功后也立即检查会员状态（确保本地存储一致性）
            const membershipCheck = await checkCurrentUserMembershipStatus();
            
            if (membershipCheck.needsAction) {
                // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
                console.log('自动登录后会员状态检查:', membershipCheck.message);
                return; // 不继续后续的初始化流程
            }
            
            // 合并云端统计数据到本地全局变量，但不要覆盖本地已有的数据
            if (currentUser.statistics) {
                statistics = { ...currentUser.statistics, ...statistics };
            }
            
            // 合并用户的收藏和错题本数据，确保本地数据优先
            if (currentUser.favorites) {
                // 遍历云端数据，只在本地没有该科目数据时才使用云端数据
                Object.keys(currentUser.favorites).forEach(subject => {
                    if (!favorites[subject]) {
                        favorites[subject] = currentUser.favorites[subject];
                    }
                    // 对于已存在的科目，合并题型数据，本地数据优先
                    else {
                        Object.keys(currentUser.favorites[subject]).forEach(type => {
                            if (!favorites[subject][type]) {
                                favorites[subject][type] = currentUser.favorites[subject][type];
                            }
                        });
                    }
                });
            }
            
            if (currentUser.wrongQuestions) {
                // 遍历云端数据，只在本地没有该科目数据时才使用云端数据
                Object.keys(currentUser.wrongQuestions).forEach(subject => {
                    if (!wrongQuestions[subject]) {
                        wrongQuestions[subject] = currentUser.wrongQuestions[subject];
                    }
                    // 对于已存在的科目，合并题型数据，本地数据优先
                    else {
                        Object.keys(currentUser.wrongQuestions[subject]).forEach(type => {
                            if (!wrongQuestions[subject][type]) {
                                wrongQuestions[subject][type] = currentUser.wrongQuestions[subject][type];
                            }
                        });
                    }
                });
            }
                
                updateUserInterface();
                
                // 启动会员状态定期检查
                startMembershipStatusCheck();
                
                // 🔐 启动会话检查（仅VIP/SVIP用户）
                startSessionCheck();
                
                // 显示欢迎回来的消息
                setTimeout(() => {
                    showMessage(`欢迎回来，${currentUser.username}！`, 'success');
                }, 1000);
                
                // 检查是否需要显示科目选择
                checkSubjectSelection();
        } else {
            // 自动登录失败，检查是否有本地会话（离线模式）
            const userResult = window.leanCloudClient.getCurrentUser();
            if (userResult.success) {
                currentUser = userResult.user;
                
                // 离线模式下也检查会员状态（确保本地存储一致性）
                const membershipCheck = await checkCurrentUserMembershipStatus();
                
                if (membershipCheck.needsAction) {
                    // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
       
                    return; // 不继续后续的初始化流程
                }
                
                // 同步统计数据
                if (currentUser.statistics) {
                    statistics = { ...statistics, ...currentUser.statistics };
                }
                
                updateUserInterface();
                
                // 启动会员状态定期检查
                startMembershipStatusCheck();
                

                
                // 提示用户网络连接问题（如果适用）
                if (autoLoginResult.message && (autoLoginResult.message.includes('网络') || autoLoginResult.message.includes('连接'))) {
                    setTimeout(() => {
                        showMessage('网络连接异常，请检查！', 'warning');
                    }, 1000);
                }
                
                // 检查是否需要显示科目选择
                checkSubjectSelection();
            }
        }
    } catch (error) {
        console.error('用户系统初始化失败:', error);
        
        // 发生错误时，尝试使用本地数据
        const userResult = window.leanCloudClient.getCurrentUser();
        if (userResult.success) {
            currentUser = userResult.user;
            
            // 错误恢复时也检查会员状态（确保本地存储一致性）
            try {
                const membershipCheck = await checkCurrentUserMembershipStatus();
                
                if (membershipCheck.needsAction) {
                    // 如果检测到过期等问题，处理已经在checkCurrentUserMembershipStatus中完成
   
                    return; // 不继续后续的初始化流程
                }
            } catch (checkError) {
                console.error('错误恢复时的会员状态检查失败:', checkError);
                // 即使检查失败，也继续使用本地数据，但可能存在不一致
            }
            
            updateUserInterface();
            
            // 启动会员状态定期检查
            startMembershipStatusCheck();
            

        }
    }
    
    // 控制个人中心按钮显示
    updateUserCenterVisibility();
}

// 显示认证模态框
function showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    showLoginForm();
}

// 隐藏认证模态框
function hideAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    // 重置表单
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
}

// 显示用户中心模态框
function showUserCenterModal() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    updateUserCenterContent();
    document.getElementById('user-center-modal').classList.remove('hidden');
}

// 隐藏用户中心模态框
function hideUserCenterModal() {
    document.getElementById('user-center-modal').classList.add('hidden');
}

// 显示会员升级模态框
function showMembershipModal() {
    // 检查用户是否已登录
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    document.getElementById('membership-modal').classList.remove('hidden');
}

// 强制显示会员升级模态框（用于过期用户等特殊情况）
function forceShowMembershipModal() {
    document.getElementById('membership-modal').classList.remove('hidden');
}

// 隐藏会员升级模态框
function hideMembershipModal(modalId) {
    if (modalId) {
        document.getElementById(modalId).classList.add('hidden');
    } else {
        document.getElementById('membership-modal').classList.add('hidden');
    }
}

// 滚动会员升级模态框到底部
function scrollMembershipModalToBottom() {
  
    
    const membershipModal = document.getElementById('membership-modal');
    if (!membershipModal) {
        console.error('❌ membership-modal 元素未找到');
        return;
    }
    
    const modalBody = membershipModal.querySelector('.modal-body');
    if (!modalBody) {
        console.error('❌ modal-body 元素未找到');
        return;
    }
    

    
    // 平滑滚动到底部 - 使用多种方法确保兼容性
    modalBody.scrollTo({
        top: modalBody.scrollHeight,
        behavior: 'smooth'
    });
    
    // 备用方法，如果scrollTo不工作
    modalBody.scrollTop = modalBody.scrollHeight;
    

    
    // 添加滚动提示效果
    const contactSection = modalBody.querySelector('.contact-section');
    if (contactSection) {
  
        // 移除可能存在的高亮类
        contactSection.classList.remove('highlight-contact');
        
        // 延迟添加高亮效果，确保滚动完成后执行
        setTimeout(() => {
            contactSection.classList.add('highlight-contact');
       
            
            // 2秒后移除高亮效果
            setTimeout(() => {
                contactSection.classList.remove('highlight-contact');
             
            }, 2000);
        }, 800);
    } else {
        console.warn('⚠️ contact-section 元素未找到');
    }
}

// 显示登录表单
function showLoginForm() {
    document.getElementById('auth-title').textContent = '用户登录';
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

// 显示注册表单
function showRegisterForm() {
    document.getElementById('auth-title').textContent = '用户注册';
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showMessage('请输入邮箱和密码', 'error');
        return;
    }
    
    showLoading('正在登录...');
    
    try {
        const result = await window.leanCloudClient.loginUser(email, password);
        
                if (result.success) {

            
            // ✅ 设置用户数据（过期用户已在leancloud-client.js中被拒绝登录）
            currentUser = result.user;
     
            
            // 备注：过期检查已在leancloud-client.js的loginUser中处理
            // 只有非过期用户才能成功登录到这里
            
            // 同步云端统计数据到本地全局变量
            if (currentUser.statistics) {
                statistics = { ...statistics, ...currentUser.statistics };
            }
            
            updateUserInterface();
            
            // 启动会员状态定期检查
            startMembershipStatusCheck();
            
            // 🔐 启动会话检查（仅VIP/SVIP用户）
            startSessionCheck();
            
            hideAuthModal();
            showMessage('登录成功', 'success');
            
            // 检查是否需要显示科目选择
            checkSubjectSelection();
          
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showMessage('登录失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 更新邮箱地址
function updateEmailAddress() {
    const username = document.getElementById('register-username').value.trim();
    const domain = document.getElementById('email-domain').value;
    const emailField = document.getElementById('register-email');
    
    if (username && domain) {
        emailField.value = `${username}@${domain}`;
    } else {
        emailField.value = '';
    }
}

// 获取完整邮箱地址
function getFullEmailAddress() {
    updateEmailAddress(); // 确保邮箱地址是最新的
    return document.getElementById('register-email').value.trim();
}

// 发送验证码
async function handleSendVerificationCode() {
    const email = getFullEmailAddress();
    const sendBtn = document.getElementById('send-code-btn');
    
    // 防止重复点击
    if (sendBtn.disabled) {
        return;
    }
    
    if (!email) {
        const username = document.getElementById('register-username').value.trim();
        const domain = document.getElementById('email-domain').value;
        
        if (!username) {
            showMessage('请输入用户名', 'error');
            document.getElementById('register-username').focus();
        } else if (!domain) {
            showMessage('请选择邮箱后缀', 'error');
            document.getElementById('email-domain').focus();
        } else {
            showMessage('请完整填写邮箱信息', 'error');
        }
        return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('邮箱格式不正确', 'error');
        document.getElementById('register-username').focus();
        return;
    }
    
    // 禁用按钮并显示加载状态
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    
    try {
        const result = await window.leanCloudClient.sendVerificationCode(email);
        
        if (result.success) {
            showMessage(result.message, 'success');
            
            // 开始倒计时
            startCodeCountdown();
        } else {
            showMessage(result.message, 'error');
            // 恢复按钮状态
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
        }
    } catch (error) {
        console.error('发送验证码失败:', error);
        showMessage('发送验证码失败，请重试', 'error');
        // 恢复按钮状态
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
    }
}

// 验证码倒计时
function startCodeCountdown() {
    const sendBtn = document.getElementById('send-code-btn');
    let countdown = 60;
    
    sendBtn.disabled = true;
    sendBtn.classList.add('countdown');
    
    const timer = setInterval(() => {
        sendBtn.textContent = `${countdown}秒后重发`;
        countdown--;
        
        if (countdown < 0) {
            clearInterval(timer);
            sendBtn.disabled = false;
            sendBtn.textContent = '发送验证码';
            sendBtn.classList.remove('countdown');
        }
    }, 1000);
}

// 处理注册（使用验证码）
async function handleRegister(e) {
    e.preventDefault();
    
    // 防止重复提交
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.disabled) {
        return;
    }
    
    const email = getFullEmailAddress();
    const code = document.getElementById('verification-code').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 详细检查各个字段
    const username = document.getElementById('register-username').value.trim();
    const domain = document.getElementById('email-domain').value;
    
    if (!username) {
        showMessage('请输入用户名', 'error');
        document.getElementById('register-username').focus();
        return;
    }
    
    if (!domain) {
        showMessage('请选择邮箱后缀', 'error');
        document.getElementById('email-domain').focus();
        return;
    }
    
    if (!code) {
        showMessage('请输入验证码', 'error');
        document.getElementById('verification-code').focus();
        return;
    }
    
    if (!password) {
        showMessage('请输入密码', 'error');
        document.getElementById('register-password').focus();
        return;
    }
    
    if (!confirmPassword) {
        showMessage('请输入确认密码', 'error');
        document.getElementById('confirm-password').focus();
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致', 'error');
        return;
    }
    
    if (password.length < 6) {
        showMessage('密码长度至少6位', 'error');
        return;
    }
    
    // 验证验证码格式
    if (!/^\d{6}$/.test(code)) {
        showMessage('验证码格式不正确，请输入6位数字', 'error');
        document.getElementById('verification-code').focus();
        return;
    }
    
    showLoading('正在注册...');
    
    try {
        const result = await window.leanCloudClient.registerUserWithCode(email, code, password);
        
        if (result.success) {
            showMessage('注册成功，请登录', 'success');
            showLoginForm();
            // 自动填入邮箱
            document.getElementById('login-email').value = email;
            // 清空注册表单
            document.getElementById('register-form').reset();
            // 清空隐藏的邮箱字段
            document.getElementById('register-email').value = '';
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('注册失败:', error);
        showMessage('注册失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 处理登出前的确认（为VIP用户提供云同步选项）
async function handleLogout() {
    try {
        // 🔧 先关闭个人中心窗口
        hideUserCenterModal();
        
        // 🔐 检查是否为VIP用户，如果是则提供云同步选项
        if (currentUser && (currentUser.membershipType === 'vip' || currentUser.membershipType === 'svip' || currentUser.membershipType === 'sssvip')) {
            const syncConfirm = await showCloudSyncConfirmDialog();
            
            if (syncConfirm === 'cancel') {
                // 用户取消退出，重新打开个人中心
                showUserCenterModal();
                return;
            }
            
            if (syncConfirm === 'sync') {
                // 执行云同步
                const syncResult = await performCloudSync();
                if (!syncResult.success) {
                    showMessage('云同步失败，但仍将退出登录', 'warning');
                }
            }
        }
        
        // 执行实际的登出操作
        await performLogout();
        
    } catch (error) {
        console.error('登出失败:', error);
        // 即使登出失败，也要清理用户数据
        await performLogout(true); // 强制退出
    }
}

// 实际执行登出操作
async function performLogout(isForced = false) {
    try {
        const result = await window.leanCloudClient.logoutUser();
        
        if (result.success || isForced) {
            currentUser = null;
            
            // 停止会员状态定期检查
            stopMembershipStatusCheck();
            
            // 🔐 停止会话检查
            stopSessionCheck();
            
            // 🔧 清理所有科目的考试记录会话
            clearAllExamQuestionHistory();
            
            // 🔧 只删除examUser，保留其他本地存储
            localStorage.removeItem('examUser');
            
            // 重置统计数据为本地数据
            const localStats = getUserStatistics();
            statistics = {
                totalAnswered: localStats.total || 0,
                totalCorrect: localStats.correct || 0,
                correctRate: localStats.correctRate || 0
            };
            
            updateUserInterface();
            // hideUserCenterModal(); // 已在handleLogout开头关闭
            showMessage(isForced ? '已强制退出登录' : '已成功退出', 'success');

        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('执行登出失败:', error);
        // 强制清理
        currentUser = null;
        localStorage.removeItem('examUser');
        // 🔧 即使出错也要清理考试记录会话
        clearAllExamQuestionHistory();
        updateUserInterface();
        showMessage('登出失败，但已清理用户数据', 'warning');
    }
}

// 🔐 修改密码相关函数

// 初始化密码切换功能
function initPasswordToggle() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('toggle-password-btn')) {
            
            const btn = e.target.classList.contains('toggle-password-btn') ? e.target : e.target.parentElement;
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fas fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fas fa-eye';
            }
        }
    });
    
    // 密码强度检测
    document.addEventListener('input', function(e) {
        if (e.target.id === 'new-password') {
            updatePasswordStrength(e.target.value);
        }
    });
}

// 显示修改密码模态框
function showChangePasswordModal() {
    if (!currentUser) {
        showMessage('请先登录', 'warning');
        return;
    }
    
    // 重置表单
    document.getElementById('change-password-form').reset();
    updatePasswordStrength('');
    
    document.getElementById('change-password-modal').classList.remove('hidden');
    document.getElementById('current-password').focus();
}

// 隐藏修改密码模态框
function hideChangePasswordModal() {
    document.getElementById('change-password-modal').classList.add('hidden');
    document.getElementById('change-password-form').reset();
}

// 更新密码强度指示器
function updatePasswordStrength(password) {
    const indicator = document.querySelector('.password-strength-indicator');
    const progress = document.getElementById('password-strength-progress');
    const text = document.getElementById('password-strength-text');
    
    if (!password) {
        indicator.className = 'password-strength-indicator';
        progress.style.width = '0%';
        text.textContent = '密码强度：请输入密码';
        return;
    }
    
    let score = 0;
    let feedback = [];
    
    // 长度检查
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    
    // 复杂度检查
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;
    
    let strength = '';
    let className = '';
    
    if (score < 2) {
        strength = '弱';
        className = 'strength-weak';
        feedback.push('密码强度较弱');
    } else if (score < 4) {
        strength = '一般';
        className = 'strength-fair';
        feedback.push('密码强度一般');
    } else if (score < 5) {
        strength = '良好';
        className = 'strength-good';
        feedback.push('密码强度良好');
    } else {
        strength = '强';
        className = 'strength-strong';
        feedback.push('密码强度很强');
    }
    
    indicator.className = `password-strength-indicator ${className}`;
    text.textContent = `密码强度：${strength}`;
}

// 处理修改密码表单提交
async function handleChangePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;
    const submitBtn = document.getElementById('submit-change-password');
    
    // 表单验证
    if (!currentPassword) {
        showMessage('请输入当前密码', 'warning');
        return;
    }
    
    if (!newPassword) {
        showMessage('请输入新密码', 'warning');
        return;
    }
    
    if (newPassword.length < 6) {
        showMessage('新密码长度不能少于6位', 'warning');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showMessage('两次输入的新密码不一致', 'warning');
        return;
    }
    
    if (currentPassword === newPassword) {
        showMessage('新密码不能与当前密码相同', 'warning');
        return;
    }
    
    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 修改中...';
    
    try {
        showMessage('正在修改密码...', 'info');
        
        const result = await window.leanCloudClient.changePassword(currentPassword, newPassword);
        
        if (result.success) {
            showMessage('密码修改成功！', 'success');
            hideChangePasswordModal();
            
            // 可选：提示用户重新登录
            setTimeout(() => {
                showMessage('为了安全，建议您重新登录', 'info');
            }, 2000);
        } else {
            showMessage(result.message, 'error');
        }
        
    } catch (error) {
        console.error('修改密码失败:', error);
        showMessage('修改密码失败，请稍后重试', 'error');
    } finally {
        // 恢复提交按钮
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> 确认修改';
    }
}

// 处理CDK激活
async function handleCDKActivation() {
    const cdkInput = document.getElementById('cdk-input');
    const activateBtn = document.getElementById('activate-cdk-btn');
    
    if (!cdkInput || !activateBtn) {
        console.error('CDK元素未找到');
        return;
    }
    
    const cdkCode = cdkInput.value.trim();
    
    // 输入验证
    if (!cdkCode) {
        showMessage('请输入CDK激活码', 'warning');
        cdkInput.focus();
        return;
    }
    
    if (cdkCode.length < 6 || cdkCode.length > 14) {
        showMessage('CDK激活码长度应在6-14位之间', 'warning');
        cdkInput.focus();
        return;
    }
    
    // 检查是否已登录
    if (!currentUser) {
        showMessage('请先登录后再激活CDK', 'warning');
        showAuthModal();
        return;
    }
    
    // 防止重复提交
    if (activateBtn.disabled) {
        return;
    }
    
    // 禁用按钮并显示加载状态
    activateBtn.disabled = true;
    const originalContent = activateBtn.innerHTML;
    activateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 激活中...';
    
    showLoading('正在激活CDK，请稍候...');
    
    try {
        const result = await window.leanCloudClient.activateCDK(cdkCode);
        
        if (result.success) {
            showMessage('CDK激活成功！会员权限已生效', 'success');
            
            // 清空输入框
            cdkInput.value = '';
            
            // 🔒 关闭会员升级窗口和免费提示窗口
            const membershipModal = document.getElementById('membership-modal');
            const freeVersionModal = document.getElementById('free-version-modal');
            if (membershipModal) {
                membershipModal.classList.add('hidden');
            }
            if (freeVersionModal) {
                freeVersionModal.classList.add('hidden');
            }
            
            // 获取最新的用户信息
            const userResult = window.leanCloudClient.getCurrentUser();
            if (userResult.success && userResult.user) {
                currentUser = userResult.user;
                
                // 更新用户界面显示
                updateUserInterface();
                updateUserCenterContent();
                
                // 如果需要，重新启动会员状态检查
                startMembershipStatusCheck();
                
                // 🔐 启动会话检查（仅VIP/SVIP用户）
                // 注意：会话已经在activateCDK中创建，这里只需要启动检查
                startSessionCheck();
                
                // 显示会员详情
                if (result.data && result.data.membershipType) {
                    setTimeout(() => {
                        // 使用返回的时间单位信息
                        const unitDisplayName = result.data.unitDisplayName || '小时';
                        showMessage(`恭喜您成为${result.data.membershipType.toUpperCase()}会员，有效期增加${result.data.membershipDays}${unitDisplayName}!`, 'success');
                    }, 1500);
                }
            }
            
        } else {
            showMessage(result.message || 'CDK激活失败', 'error');
        }
        
    } catch (error) {
        console.error('CDK激活失败:', error);
        let errorMessage = 'CDK激活失败，请稍后重试';
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        // 恢复按钮状态
        activateBtn.disabled = false;
        activateBtn.innerHTML = originalContent;
        hideLoading();
    }
}

// 更新用户界面
function updateUserInterface() {
    const userDisplayName = document.getElementById('user-display-name');
    const userEmail = document.getElementById('user-name');
    const userMembership = document.getElementById('user-membership');
    const loginRegisterBtn = document.getElementById('login-register-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const membershipBtn = document.getElementById('membership-btn');
    const importBtn = document.getElementById('import-data-btn');
    const syncBtn = document.getElementById('sync-data-btn');
    
    // 检查关键元素是否存在
    if (!userDisplayName || !userEmail || !userMembership) {
        console.error('关键用户界面元素缺失:', {
            userDisplayName: !!userDisplayName,
            userEmail: !!userEmail,
            userMembership: !!userMembership
        });
        return;
    }
    
    if (currentUser) {
        // 用户已登录
        userDisplayName.textContent = currentUser.username;
        userEmail.textContent = currentUser.email;
        
        // 更新会员状态显示，包含剩余时间
        let membershipText = currentUser.membershipType;
        const remainingTime = getMembershipRemainingTime();
        if (remainingTime && remainingTime !== '永久有效') {
            membershipText += ` (剩余${remainingTime})`;
        } else if (remainingTime === '永久有效') {
            membershipText += ' (永久)';
        }
        
        userMembership.textContent = membershipText;
        userMembership.className = `membership-badge ${currentUser.membershipType.toLowerCase()}`;
        
        // 安全更新按钮状态
        if (loginRegisterBtn) loginRegisterBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        
        // 显示修改密码按钮
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) changePasswordBtn.classList.remove('hidden');
        if (membershipBtn) membershipBtn.classList.remove('hidden');
        if (importBtn) importBtn.disabled = false;
        if (syncBtn) syncBtn.disabled = false;
        
        // 更新学习统计
        displayUserStatistics();
    } else {
        // 用户未登录
        userDisplayName.textContent = '未登录';
        userEmail.textContent = '请先登录';
        userMembership.textContent = '非会员';
        userMembership.className = 'membership-badge';
        
        // 安全更新按钮状态
        if (loginRegisterBtn) loginRegisterBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        // 隐藏修改密码按钮
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) changePasswordBtn.classList.add('hidden');
        if (membershipBtn) membershipBtn.classList.add('hidden');
        if (importBtn) importBtn.disabled = true;
        if (syncBtn) syncBtn.disabled = true;
        
        // 重置统计信息
        resetUserStatistics();
    }
}

// 更新用户中心内容
function updateUserCenterContent() {
    if (!currentUser) return;
    
    updateUserInterface();
    displayUserStatistics();
}

// 显示用户统计信息
function displayUserStatistics() {
    if (!currentUser) return;
    
    // 优先使用 userStats，然后是 statistics
    const userStats = currentUser.userStats || {};
    const stats = currentUser.statistics || {};
    const localStats = getUserStatistics();
    
    
    // 显示总答题数和正确率，优先使用本地数据
    const totalAnswered = localStats.total || userStats.total || stats.totalAnswered || 0;
    const correctRate = localStats.correctRate || userStats.correctRate || stats.correctRate || 0;
    

    
    document.getElementById('user-total-questions').textContent = totalAnswered;
    document.getElementById('user-correct-rate').textContent = `${correctRate}%`;
    
    // 计算收藏和错题数量
    let favoritesCount = 0;
    let wrongCount = 0;
    
    // 获取本地存储的收藏和错题数据（按科目存储）
    const subjects = ['毛概', '思修', '近代史', '马原'];
    let localFavorites = {};
    let localWrongQuestions = {};
    
    subjects.forEach(subject => {
        const favoritesKey = `exam_favorites_${subject}`;
        const wrongKey = `exam_wrong_questions_${subject}`;
        
        localFavorites[subject] = JSON.parse(localStorage.getItem(favoritesKey) || '{}');
        localWrongQuestions[subject] = JSON.parse(localStorage.getItem(wrongKey) || '{}');
    });
    

    // 优先从当前变量读取，然后从本地存储，最后从用户数据读取
    const activeFavorites = favorites || localFavorites || currentUser.favorites || {};
    const activeWrongQuestions = wrongQuestions || localWrongQuestions || currentUser.wrongQuestions || {};
    
    // 处理按科目组织的数据结构
    if (activeFavorites && Object.keys(activeFavorites).length > 0) {
        // 检查是否是按科目组织的数据结构
        const isSubjectOrganized = Object.keys(activeFavorites).some(key => 
            ['毛概', '思修', '近代史', '马原'].includes(key));
        
        if (isSubjectOrganized) {
            // 按科目组织的数据
            Object.values(activeFavorites).forEach(subjectData => {
                if (subjectData && typeof subjectData === 'object') {
                    Object.values(subjectData).forEach(typeList => {
                        if (Array.isArray(typeList)) {
                            favoritesCount += typeList.length;
                        }
                    });
                }
            });
        } else {
            // 旧的数据结构
            Object.values(activeFavorites).forEach(typeList => {
                if (Array.isArray(typeList)) {
                    favoritesCount += typeList.length;
                }
            });
        }
    }
    
    if (activeWrongQuestions && Object.keys(activeWrongQuestions).length > 0) {
        // 检查是否是按科目组织的数据结构
        const isSubjectOrganized = Object.keys(activeWrongQuestions).some(key => 
            ['毛概', '思修', '近代史', '马原'].includes(key));
        
        if (isSubjectOrganized) {
            // 按科目组织的数据
            Object.values(activeWrongQuestions).forEach(subjectData => {
                if (subjectData && typeof subjectData === 'object') {
                    Object.values(subjectData).forEach(typeList => {
                        if (Array.isArray(typeList)) {
                            wrongCount += typeList.length;
                        }
                    });
                }
            });
        } else {
            // 旧的数据结构
            Object.values(activeWrongQuestions).forEach(typeList => {
                if (Array.isArray(typeList)) {
                    wrongCount += typeList.length;
                }
            });
        }
    }
    

    
    document.getElementById('user-favorites-count').textContent = favoritesCount;
    document.getElementById('user-wrong-count').textContent = wrongCount;
}

// 重置用户统计信息
function resetUserStatistics() {
    document.getElementById('user-total-questions').textContent = '0';
    document.getElementById('user-correct-rate').textContent = '0%';
    document.getElementById('user-favorites-count').textContent = '0';
    document.getElementById('user-wrong-count').textContent = '0';
}

// 从云端导入数据
async function importDataFromCloud() {
    if (!currentUser) {
        showMessage('请先登录', 'error');
        return;
    }
    
    if (!requireMembership('使用数据导入功能')) {
        return;
    }
    
    showLoading('正在导入数据...');
    
    try {
        const result = await window.leanCloudClient.importDataFromCloud();
        
        if (result.success) {
            // 更新本地数据
            const cloudData = result.data;
            
            // 导入进度数据（按科目存储）
            if (cloudData.progressData) {
                const progressData = cloudData.progressData;
                // 为每个科目和题型保存进度数据
                Object.keys(progressData).forEach(subject => {
                    Object.keys(progressData[subject]).forEach(type => {
                        localStorage.setItem(`exam_progress_${subject}_${type}`, JSON.stringify(progressData[subject][type]));
                    });
                });
            }
            
            // 导入错题本（按科目存储）
            if (cloudData.wrongQuestions) {
                wrongQuestions = cloudData.wrongQuestions;
                // 保存到本地存储（按科目存储）
                const subjects = ['毛概', '思修', '近代史', '马原'];
                subjects.forEach(subject => {
                    if (wrongQuestions[subject]) {
                        const wrongQuestionsKey = `exam_wrong_questions_${subject}`;
                        localStorage.setItem(wrongQuestionsKey, JSON.stringify(wrongQuestions[subject]));
                    }
                });
            }
            
            // 导入收藏（按科目存储）
            if (cloudData.favorites) {
                favorites = cloudData.favorites;
                // 保存到本地存储（按科目存储）
                const subjects = ['毛概', '思修', '近代史', '马原'];
                subjects.forEach(subject => {
                    if (favorites[subject]) {
                        const favoritesKey = `exam_favorites_${subject}`;
                        localStorage.setItem(favoritesKey, JSON.stringify(favorites[subject]));
                    }
                });
            }
            
            // 导入用户统计
            if (cloudData.userStats) {
                localStorage.setItem('exam_user_stats', JSON.stringify(cloudData.userStats));
            }
            

            
            // 刷新当前用户信息
            currentUser = window.leanCloudClient.getCurrentUser().user;
            updateUserCenterContent();
            
            // 刷新UI
            updateStatisticsDisplay();
            
            showMessage('数据导入成功', 'success');
     
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('导入数据失败:', error);
        showMessage('导入数据失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 获取指定科目的进度数据
function getProgressData(subject) {
    const progressData = {};
    const questionTypes = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank'];
    const subjects = ['毛概', '思修', '近代史', '马原'];
    
    // 如果指定了科目，只获取该科目的进度数据
    if (subject) {
        const subjectKey = subject;
        progressData[subjectKey] = {};
        questionTypes.forEach(type => {
            const progress = localStorage.getItem(`exam_progress_${subjectKey}_${type}`);
            if (progress) {
                try {
                    progressData[subjectKey][type] = JSON.parse(progress);
                } catch (e) {
                    console.warn(`解析${type}进度数据失败:`, e);
                    progressData[subjectKey][type] = {
                        currentIndex: 0,
                        userAnswers: [],
                        judgedAnswers: [],
                        detailedProgress: [],
                        timestamp: Date.now()
                    };
                }
            } else {
                progressData[subjectKey][type] = {
                    currentIndex: 0,
                    userAnswers: [],
                    judgedAnswers: [],
                    detailedProgress: [],
                    timestamp: Date.now()
                };
            }
        });
    } else {
        // 如果没有指定科目，获取所有科目的进度数据
        subjects.forEach(subjectKey => {
            progressData[subjectKey] = {};
            questionTypes.forEach(type => {
                const progress = localStorage.getItem(`exam_progress_${subjectKey}_${type}`);
                if (progress) {
                    try {
                        progressData[subjectKey][type] = JSON.parse(progress);
                    } catch (e) {
                        console.warn(`解析${subjectKey}_${type}进度数据失败:`, e);
                        progressData[subjectKey][type] = {
                            currentIndex: 0,
                            userAnswers: [],
                            judgedAnswers: [],
                            detailedProgress: [],
                            timestamp: Date.now()
                        };
                    }
                } else {
                    progressData[subjectKey][type] = {
                        currentIndex: 0,
                        userAnswers: [],
                        judgedAnswers: [],
                        detailedProgress: [],
                        timestamp: Date.now()
                    };
                }
            });
        });
    }
    
    return progressData;
}

// 同步数据到云端（支持按科目同步）
async function syncDataToCloud(subject) {
    if (!currentUser) {
        showMessage('请先登录', 'error');
        return;
    }
    
    if (!requireMembership('使用数据云同步功能')) {
        return;
    }
    
    showLoading('正在同步数据...');
    
    try {
        // 获取按科目存储的错题本和收藏数据
        const subjects = ['毛概', '思修', '近代史', '马原'];
        let syncWrongQuestions = {};
        let syncFavorites = {};
        
        subjects.forEach(subjectKey => {
            const wrongKey = `exam_wrong_questions_${subjectKey}`;
            const favKey = `exam_favorites_${subjectKey}`;
            
            syncWrongQuestions[subjectKey] = JSON.parse(localStorage.getItem(wrongKey) || '{}');
            syncFavorites[subjectKey] = JSON.parse(localStorage.getItem(favKey) || '{}');
        });
        
        // 获取所有科目的进度数据
        const progressData = getProgressData();
        
        const localData = {
            progressData: progressData,
            wrongQuestions: syncWrongQuestions,
            favorites: syncFavorites,
            userStats: JSON.parse(localStorage.getItem('exam_user_stats') || '{}'),
        };
        
        const result = await window.leanCloudClient.syncDataToCloud(localData);
        
        if (result.success) {
            // 更新当前用户信息
            currentUser = window.leanCloudClient.getCurrentUser().user;
            updateUserCenterContent();
            
            showMessage('数据同步成功', 'success');
        } else {
            showMessage(result.message, 'error');
        }
    } catch (error) {
        console.error('同步数据失败:', error);
        showMessage('同步数据失败，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 控制用户中心按钮显示（仅首页显示）
function updateUserCenterVisibility() {
    const userCenterBtn = document.getElementById('user-center-btn');
    const isHomePage = document.getElementById('welcome-section').style.display !== 'none' &&
                      document.getElementById('question-type-section').style.display !== 'none';
    
    if (isHomePage) {
        userCenterBtn.classList.remove('hidden');
    } else {
        userCenterBtn.classList.add('hidden');
    }
}

// 重写返回首页函数，添加用户中心按钮控制
const originalReturnToHome = returnToHome;
returnToHome = function() {
    originalReturnToHome();
    updateUserCenterVisibility();
};

// 在系统初始化时启动用户系统
const originalInitSystem = initSystem;
initSystem = async function() {
    await originalInitSystem();
    await initUserSystem();
};


// 显示重置记录确认对话框
function showResetRecordsConfirmModal() {
    document.getElementById('reset-confirm-modal').classList.remove('hidden');
}

// 隐藏重置记录确认对话框
function hideResetConfirmModal() {
    document.getElementById('reset-confirm-modal').classList.add('hidden');
}

// 显示重置成功对话框
function showResetSuccessModal() {
    document.getElementById('reset-success-modal').classList.remove('hidden');
}

// 隐藏重置成功对话框
function hideResetSuccessModal() {
    document.getElementById('reset-success-modal').classList.add('hidden');
}

// 确认执行重置操作
function confirmResetRecords() {
    hideResetConfirmModal();
    resetUserRecords();
}

// 初始化重置对话框的事件监听器
function initResetDialogListeners() {
    // 点击外部关闭重置确认对话框
    document.getElementById('reset-confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideResetConfirmModal();
        }
    });
    
    // 点击外部关闭重置成功对话框
    document.getElementById('reset-success-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideResetSuccessModal();
        }
    });
}

// 重置用户记录（保留examUser）
function resetUserRecords() {
    try {

        
        // 保存当前的examUser和appVersion
        const examUser = localStorage.getItem('examUser');
        const appVersion = localStorage.getItem('appVersion');
   
        
        // 显示清理前的存储内容

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                console.log(`  - ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
            }
        }
        
        // 获取所有需要清理的存储项
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // 保留examUser和appVersion
            if (key && key !== 'examUser' && key !== 'appVersion') {
                keysToRemove.push(key);
            }
        }
        

        
        // 清理存储项
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
 
        });
        
        // 恢复examUser和appVersion
        if (examUser) {
            localStorage.setItem('examUser', examUser);
        }
        if (appVersion) {
            localStorage.setItem('appVersion', appVersion);
        }
        
        // 重置内存中的数据
        questionsData = {};
        currentQuestions = [];
        currentQuestionIndex = 0;
        currentQuestionType = '';
        userAnswers = [];
        judgedAnswers = [];
        favorites = {};
        wrongQuestions = {};
        statistics = {
            total: 0,
            single_choice: 0,
            multiple_choice: 0,
            true_false: 0,
            fill_blank: 0,
            totalAnswered: 0,
            totalCorrect: 0,
            correctRate: 0
        };
        
        // 显示清理后的存储内容
  
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                console.log(`  - ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
            }
        }
        

        
        // 显示成功提示并刷新页面
        showResetSuccessModal();
        
        // 刷新页面以更新UI
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        
    } catch (error) {
        console.error('❌ 重置用户记录失败:', error);
        alert('重置失败，请稍后再试。');
    }
}

// ========== 科目管理功能 ==========

// 科目映射
const SUBJECT_CATEGORIES = {
    '毛概': '毛概',
    '思修': '思修', 
    '近代史': '近代史',
    '马原': '马原'
};

// 加载当前科目选择
function loadCurrentSubject() {
    const savedSubject = localStorage.getItem('exam_current_subject');
    if (savedSubject && SUBJECT_CATEGORIES[savedSubject]) {
        currentSubject = savedSubject;
        updateSubjectDisplay();
    } else {
        // 没有保存的科目，为未登录用户设置默认值但不存储
        currentSubject = '毛概'; // 默认科目
        updateSubjectDisplay();
    }
}

// 保存当前科目选择
function saveCurrentSubject(subject) {
    currentSubject = subject;
    localStorage.setItem('exam_current_subject', subject);
    updateSubjectDisplay();
}

// 更新科目显示
function updateSubjectDisplay() {
    const subjectText = document.getElementById('current-subject-text');
    if (subjectText && currentSubject && SUBJECT_CATEGORIES[currentSubject]) {
        subjectText.textContent = SUBJECT_CATEGORIES[currentSubject];
    }
}

// 根据科目过滤题目
function filterQuestionsBySubject() {
    if (!currentSubject) {
        // 没有选择科目，清空题目数据
        questionsData = {};
        return;
    }
    
    // 按科目过滤
    questionsData = {};
    Object.keys(allQuestionsData).forEach(type => {
        questionsData[type] = allQuestionsData[type].filter(question => 
            question.category === currentSubject
        );
    });
}

// 获取各科目的题目数量统计
function getSubjectStatistics() {
    const stats = {
        '毛概': 0,
        '思修': 0,
        '近代史': 0,
        '马原': 0
    };
    
    Object.keys(allQuestionsData).forEach(type => {
        allQuestionsData[type].forEach(question => {
            if (question.category && stats[question.category] !== undefined) {
                stats[question.category]++;
            }
        });
    });
    
    return stats;
}

// 处理科目选择器点击
function handleSubjectSelectorClick() {
    // 检查用户是否已登录
    if (!currentUser) {
        // 调用已有的登录提示函数
        if (window.showLoginRequiredModal) {
            window.showLoginRequiredModal();
        } else {
            showMessage('请先登录后再选择科目', 'warning');
        }
        return;
    }
    
    // 用户已登录，显示科目选择模态框
    showSubjectSelectorModal(false);
}

// 显示科目选择模态框
function showSubjectSelectorModal(isRequired = false) {
    const modal = document.getElementById('subject-selector-modal');
    const closeBtn = document.getElementById('close-subject-selector');
    
    // 更新题目数量统计
    updateSubjectCounts();
    
    // 设置当前选中的科目
    if (currentSubject) {
        setSelectedSubject(currentSubject);
    } else {
        // 如果没有当前科目，默认选择第一个
        setSelectedSubject('毛概');
    }
    
    // 根据是否必需设置关闭按钮的显示状态
    if (isRequired) {
        closeBtn.classList.add('hidden');
        // 必须选择时，禁止点击外部关闭
        modal.setAttribute('data-required', 'true');
    } else {
        closeBtn.classList.remove('hidden');
        modal.removeAttribute('data-required');
    }
    
    modal.classList.remove('hidden');
}

// 隐藏科目选择模态框
function hideSubjectSelectorModal() {
    document.getElementById('subject-selector-modal').classList.add('hidden');
}

// 更新科目题目数量显示
function updateSubjectCounts() {
    const stats = getSubjectStatistics();
    
    document.getElementById('maogai-count').textContent = `${stats['毛概']} 题`;
    document.getElementById('sixiu-count').textContent = `${stats['思修']} 题`;
    document.getElementById('jindaishi-count').textContent = `${stats['近代史']} 题`;
    document.getElementById('mayuan-count').textContent = `${stats['马原']} 题`;
}

// 设置选中的科目
function setSelectedSubject(subject) {
    // 清除之前的选择
    document.querySelectorAll('.subject-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // 设置新的选择
    const option = document.querySelector(`[data-subject="${subject}"]`);
    if (option) {
        option.classList.add('selected');
        selectedSubjectOption = option;
        
        // 启用确认按钮
        document.getElementById('confirm-subject-selection').disabled = false;
    }
    
    // 添加点击事件监听
    document.querySelectorAll('.subject-option').forEach(option => {
        option.addEventListener('click', () => {
            // 清除之前的选择
            document.querySelectorAll('.subject-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // 设置新的选择
            option.classList.add('selected');
            selectedSubjectOption = option;
            
            // 启用确认按钮
            document.getElementById('confirm-subject-selection').disabled = false;
        });
    });
}

// 确认科目选择
function confirmSubjectSelection() {
    if (!selectedSubjectOption) return;
    
    const newSubject = selectedSubjectOption.dataset.subject;
    
    // 更新当前科目
    currentSubject = newSubject;
    
    // 只有登录用户才保存到本地存储
    if (currentUser) {
        localStorage.setItem('exam_current_subject', newSubject);
    }
    
    // 更新显示
    updateSubjectDisplay();
    
    // 重新过滤题目数据
    filterQuestionsBySubject();
    
    // 重新计算统计信息
    calculateStatisticsFromData();
    
    // 更新UI
    updateUI();
    
    // 隐藏模态框
    hideSubjectSelectorModal();
    
    // 显示成功消息
    showMessage(`已切换到：${SUBJECT_CATEGORIES[newSubject]}`, 'success');
}

// 检查是否需要显示科目选择（用户登录后）
function checkSubjectSelection() {
    // 只为已登录用户检查科目选择
    if (!currentUser) {
        return false; // 未登录用户不需要选择
    }
    
    // 如果没有保存的科目选择，必须显示科目选择模态框
    const savedSubject = localStorage.getItem('exam_current_subject');
    if (!savedSubject || !SUBJECT_CATEGORIES[savedSubject]) {
        setTimeout(() => {
            showSubjectSelectorModal(true); // 传入true表示必须选择
            showMessage('请选择您要学习的科目类型', 'info');
        }, 1000);
        return true; // 需要选择科目
    }
    return false; // 不需要选择科目
}

// 显示科目按钮
function showSubjectButton() {
    const subjectBtn = document.getElementById('subject-selector-btn');
    if (subjectBtn) {
        subjectBtn.style.display = '';
    }
}

// 隐藏科目按钮
function hideSubjectButton() {
    const subjectBtn = document.getElementById('subject-selector-btn');
    if (subjectBtn) {
        subjectBtn.style.display = 'none';
    }
}

