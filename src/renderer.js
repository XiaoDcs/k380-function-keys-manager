const { ipcRenderer, shell } = require('electron');
const Store = require('electron-store');
const store = new Store();

class K380RendererManager {
    constructor() {
        console.log('K380RendererManager constructor started');
        
        // 延迟初始化，确保DOM完全加载
        setTimeout(() => {
            try {
                this.initializeElements();
                this.setupTabNavigation();
                this.loadSettings();
                this.attachEventListeners();
                this.setupIPCListeners();
                this.updateConnectionStatus();
                this.checkPermissionStatus();
                console.log('K380RendererManager initialized successfully');
            } catch (error) {
                console.error('Error during initialization:', error);
            }
        }, 100);
    }

    initializeElements() {
        console.log('Initializing elements...');
        
        // 标签页
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // 主要功能
        this.connectionStatus = document.getElementById('connectionStatus');
        this.checkConnectionBtn = document.getElementById('checkConnectionBtn');
        this.fnKeysToggle = document.getElementById('fnKeysToggle');
        this.applySettingsBtn = document.getElementById('applySettingsBtn');
        
        // 设置
        this.autoStartToggle = document.getElementById('autoStartToggle');
        this.showWindowToggle = document.getElementById('showWindowToggle');
        this.autoApplyToggle = document.getElementById('autoApplyToggle');
        this.passwordCacheSelect = document.getElementById('passwordCacheSelect');
        this.skipPermissionCheckToggle = document.getElementById('skipPermissionCheckToggle');
        this.showDockIconToggle = document.getElementById('showDockIconToggle');
        this.showTrayIconToggle = document.getElementById('showTrayIconToggle');
        this.persistentPasswordCacheToggle = document.getElementById('persistentPasswordCacheToggle');
        
        // 工具
        this.permissionStatus = document.getElementById('permissionStatus');
        this.checkPermissionsBtn = document.getElementById('checkPermissionsBtn');
        this.openSystemSettingsBtn = document.getElementById('openSystemSettingsBtn');
        this.testK380ExecutableBtn = document.getElementById('testK380ExecutableBtn');
        this.showDebugInfoBtn = document.getElementById('showDebugInfoBtn');
        this.showDebugLogsBtn = document.getElementById('showDebugLogsBtn');
        this.clearDebugLogsBtn = document.getElementById('clearDebugLogsBtn');
        
        // 关于
        this.visitGithubBtn = document.getElementById('visitGithubBtn');
        this.hideWindowBtn = document.getElementById('hideWindowBtn');
        
        // 调试信息：检查关键元素是否存在
        const elementCheck = {
            connectionStatus: !!this.connectionStatus,
            checkConnectionBtn: !!this.checkConnectionBtn,
            fnKeysToggle: !!this.fnKeysToggle,
            applySettingsBtn: !!this.applySettingsBtn,
            tabButtons: this.tabButtons.length,
            tabContents: this.tabContents.length,
            autoStartToggle: !!this.autoStartToggle,
            showWindowToggle: !!this.showWindowToggle,
            autoApplyToggle: !!this.autoApplyToggle,
            passwordCacheSelect: !!this.passwordCacheSelect,
            skipPermissionCheckToggle: !!this.skipPermissionCheckToggle,
            showDockIconToggle: !!this.showDockIconToggle,
            showTrayIconToggle: !!this.showTrayIconToggle,
            persistentPasswordCacheToggle: !!this.persistentPasswordCacheToggle
        };
        
        console.log('Elements check:', elementCheck);
        
        // 检查是否有缺失的关键元素
        const missingElements = Object.entries(elementCheck)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
            
        if (missingElements.length > 0) {
            console.error('Missing elements:', missingElements);
        }
    }

    setupTabNavigation() {
        console.log('Setting up tab navigation...');
        
        if (this.tabButtons.length === 0) {
            console.error('No tab buttons found!');
            return;
        }
        
        this.tabButtons.forEach((button, index) => {
            console.log(`Setting up tab button ${index}:`, button.dataset.tab);
            button.addEventListener('click', (e) => {
                const targetTab = button.dataset.tab;
                console.log('Tab clicked:', targetTab);
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // 移除所有active类
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        // 添加active类到目标tab
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        const targetContent = document.getElementById(tabName);
        
        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetContent.classList.add('active');
            console.log('Tab switched successfully to:', tabName);
        } else {
            console.error('Tab not found:', tabName, {
                targetButton: !!targetButton,
                targetContent: !!targetContent
            });
        }
    }

    loadSettings() {
        console.log('Loading settings...');
        
        try {
            // 主要功能设置
            if (this.fnKeysToggle) {
                this.fnKeysToggle.checked = store.get('fnKeysEnabled', true);
            }
            
            // 设置页面
            if (this.autoStartToggle) {
                this.autoStartToggle.checked = store.get('autoStart', false);
            }
            if (this.showWindowToggle) {
                this.showWindowToggle.checked = store.get('showWindowOnStart', true);
            }
            if (this.autoApplyToggle) {
                this.autoApplyToggle.checked = store.get('autoApply', true);
            }
            
            // 密码缓存设置
            if (this.passwordCacheSelect) {
                const passwordCacheTime = store.get('passwordCacheTime', 5);
                this.passwordCacheSelect.value = passwordCacheTime.toString();
            }
            
            // 新增的设置
            if (this.skipPermissionCheckToggle) {
                this.skipPermissionCheckToggle.checked = store.get('skipStartupPermissionCheck', false);
            }
            if (this.showDockIconToggle) {
                this.showDockIconToggle.checked = store.get('showDockIcon', false);
            }
            if (this.showTrayIconToggle) {
                this.showTrayIconToggle.checked = store.get('showTrayIcon', true);
            }
            if (this.persistentPasswordCacheToggle) {
                this.persistentPasswordCacheToggle.checked = store.get('persistentPasswordCache', false);
            }
            
            const settings = {
                fnKeysEnabled: store.get('fnKeysEnabled', true),
                autoStart: store.get('autoStart', false),
                showWindowOnStart: store.get('showWindowOnStart', true),
                autoApply: store.get('autoApply', true),
                passwordCacheTime: store.get('passwordCacheTime', 5),
                skipStartupPermissionCheck: store.get('skipStartupPermissionCheck', false),
                showDockIcon: store.get('showDockIcon', false),
                showTrayIcon: store.get('showTrayIcon', true),
                persistentPasswordCache: store.get('persistentPasswordCache', false)
            };
            
            console.log('Settings loaded:', settings);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    setupIPCListeners() {
        console.log('Setting up IPC listeners...');
        
        try {
            // 监听来自主进程的状态更新
            ipcRenderer.on('k380-status-changed', (event, isConnected) => {
                console.log('Received k380-status-changed:', isConnected);
                this.updateConnectionStatusUI(isConnected);
            });
            
            // 监听权限状态更新
            ipcRenderer.on('permission-status-changed', (event, hasPermission) => {
                console.log('Received permission-status-changed:', hasPermission);
                this.updatePermissionStatusUI(hasPermission);
            });
            
            // 监听强制启用Dock图标事件（安全检查）
            ipcRenderer.on('force-dock-icon-enabled', () => {
                console.log('Received force-dock-icon-enabled');
                if (this.showDockIconToggle) {
                    this.showDockIconToggle.checked = true;
                    // 更新本地存储
                    store.set('showDockIcon', true);
                }
                this.showNotification('info', '为确保应用可访问，已自动启用Dock图标');
            });
            
            console.log('IPC listeners set up successfully');
        } catch (error) {
            console.error('Error setting up IPC listeners:', error);
        }
    }

    attachEventListeners() {
        console.log('Attaching event listeners...');
        
        try {
            // 主要功能
            if (this.checkConnectionBtn) {
                this.checkConnectionBtn.addEventListener('click', () => {
                    console.log('Check connection button clicked');
                    this.checkConnection();
                });
            }

            if (this.fnKeysToggle) {
                this.fnKeysToggle.addEventListener('change', () => {
                    console.log('Fn keys toggle changed:', this.fnKeysToggle.checked);
                    this.toggleFnKeys();
                });
            }

            if (this.applySettingsBtn) {
                this.applySettingsBtn.addEventListener('click', () => {
                    console.log('Apply settings button clicked');
                    this.applySettings();
                });
            }

            // 设置页面
            if (this.autoStartToggle) {
                this.autoStartToggle.addEventListener('change', () => {
                    console.log('Auto start toggle changed:', this.autoStartToggle.checked);
                    this.toggleAutoStart();
                });
            }

            if (this.showWindowToggle) {
                this.showWindowToggle.addEventListener('change', () => {
                    console.log('Show window toggle changed:', this.showWindowToggle.checked);
                    this.toggleShowWindow();
                });
            }

            if (this.autoApplyToggle) {
                this.autoApplyToggle.addEventListener('change', () => {
                    console.log('Auto apply toggle changed:', this.autoApplyToggle.checked);
                    this.toggleAutoApply();
                });
            }

            if (this.passwordCacheSelect) {
                this.passwordCacheSelect.addEventListener('change', () => {
                    console.log('Password cache select changed:', this.passwordCacheSelect.value);
                    this.changePasswordCacheTime();
                });
            }

            // 新增的设置事件监听器
            if (this.skipPermissionCheckToggle) {
                this.skipPermissionCheckToggle.addEventListener('change', () => {
                    console.log('Skip permission check toggle changed:', this.skipPermissionCheckToggle.checked);
                    this.toggleSkipPermissionCheck();
                });
            }

            if (this.showDockIconToggle) {
                this.showDockIconToggle.addEventListener('change', () => {
                    console.log('Show dock icon toggle changed:', this.showDockIconToggle.checked);
                    this.toggleShowDockIcon();
                });
            }

            if (this.showTrayIconToggle) {
                this.showTrayIconToggle.addEventListener('change', () => {
                    console.log('Show tray icon toggle changed:', this.showTrayIconToggle.checked);
                    this.toggleShowTrayIcon();
                });
            }

            if (this.persistentPasswordCacheToggle) {
                this.persistentPasswordCacheToggle.addEventListener('change', () => {
                    console.log('Persistent password cache toggle changed:', this.persistentPasswordCacheToggle.checked);
                    this.togglePersistentPasswordCache();
                });
            }

            // 工具页面
            if (this.checkPermissionsBtn) {
                this.checkPermissionsBtn.addEventListener('click', () => {
                    console.log('Check permissions button clicked');
                    this.checkPermissions();
                });
            }

            if (this.openSystemSettingsBtn) {
                this.openSystemSettingsBtn.addEventListener('click', () => {
                    console.log('Open system settings button clicked');
                    this.openSystemSettings();
                });
            }

            if (this.testK380ExecutableBtn) {
                this.testK380ExecutableBtn.addEventListener('click', () => {
                    console.log('Test K380 executable button clicked');
                    this.testK380Executable();
                });
            }

            if (this.showDebugInfoBtn) {
                this.showDebugInfoBtn.addEventListener('click', () => {
                    console.log('Show debug info button clicked');
                    this.showDebugInfo();
                });
            }

            if (this.showDebugLogsBtn) {
                this.showDebugLogsBtn.addEventListener('click', () => {
                    console.log('Show debug logs button clicked');
                    this.showDebugLogs();
                });
            }

            if (this.clearDebugLogsBtn) {
                this.clearDebugLogsBtn.addEventListener('click', () => {
                    console.log('Clear debug logs button clicked');
                    this.clearDebugLogs();
                });
            }

            // 关于页面
            if (this.visitGithubBtn) {
                this.visitGithubBtn.addEventListener('click', () => {
                    console.log('Visit github button clicked');
                    this.visitGithub();
                });
            }

            if (this.hideWindowBtn) {
                this.hideWindowBtn.addEventListener('click', () => {
                    console.log('Hide window button clicked');
                    this.hideWindow();
                });
            }

            // 定期更新连接状态
            setInterval(() => {
                this.updateConnectionStatus();
            }, 30000);
            
            console.log('Event listeners attached successfully');
        } catch (error) {
            console.error('Error attaching event listeners:', error);
        }
    }

    async checkConnection() {
        try {
            console.log('Checking K380 connection...');
            this.checkConnectionBtn.textContent = '检查中...';
            this.checkConnectionBtn.disabled = true;

            const isConnected = await ipcRenderer.invoke('check-k380-connection');
            console.log('Connection check result:', isConnected);
            
            this.updateConnectionStatusUI(isConnected);
            this.showNotification(
                isConnected ? 'success' : 'info',
                isConnected ? 'K380 已连接' : 'K380 未找到，请检查蓝牙连接'
            );

        } catch (error) {
            console.error('Check connection error:', error);
            this.updateConnectionStatusUI(false);
            this.showNotification('error', '检查连接时出错: ' + error.message);
        } finally {
            this.checkConnectionBtn.textContent = '检查连接';
            this.checkConnectionBtn.disabled = false;
        }
    }

    async updateConnectionStatus() {
        try {
            const isConnected = await ipcRenderer.invoke('get-k380-status');
            this.updateConnectionStatusUI(isConnected);
        } catch (error) {
            console.error('Failed to get K380 status:', error);
        }
    }

    updateConnectionStatusUI(isConnected) {
        console.log('Updating connection status UI:', isConnected);
        
        try {
            if (this.connectionStatus && this.connectionStatus.querySelector('span')) {
                if (isConnected) {
                    this.connectionStatus.className = 'status-indicator status-connected';
                    this.connectionStatus.querySelector('span').textContent = 'K380 已连接';
                } else {
                    this.connectionStatus.className = 'status-indicator status-disconnected';
                    this.connectionStatus.querySelector('span').textContent = 'K380 未连接';
                }
                console.log('Connection status UI updated successfully');
            } else {
                console.error('Connection status element not found or invalid');
            }
        } catch (error) {
            console.error('Error updating connection status UI:', error);
        }
    }

    async toggleFnKeys() {
        try {
            const enabled = this.fnKeysToggle.checked;
            store.set('fnKeysEnabled', enabled);
            console.log('Fn keys setting saved:', enabled);
            
            // 自动应用设置，无需用户手动点击"立即应用设置"
            if (this.applySettingsBtn) {
                this.applySettingsBtn.textContent = '应用中...';
                this.applySettingsBtn.disabled = true;
            }
            
            try {
                await ipcRenderer.invoke('apply-k380-settings', enabled);
                console.log('Fn keys settings applied automatically');
                this.showNotification('success', `Fn键直接访问已${enabled ? '启用' : '禁用'}并立即生效`);
            } catch (applyError) {
                console.error('Auto-apply error:', applyError);
                this.showNotification('error', `设置已保存但应用失败: ${applyError.message}`);
            } finally {
                if (this.applySettingsBtn) {
                    this.applySettingsBtn.textContent = '立即应用设置';
                    this.applySettingsBtn.disabled = false;
                }
            }
            
        } catch (error) {
            console.error('Error toggling Fn keys:', error);
            this.showNotification('error', '切换Fn键设置失败: ' + error.message);
        }
    }

    async applySettings() {
        try {
            const fnKeysEnabled = this.fnKeysToggle.checked;
            console.log('Applying K380 settings:', fnKeysEnabled);
            
            this.applySettingsBtn.textContent = '应用中...';
            this.applySettingsBtn.disabled = true;

            await ipcRenderer.invoke('apply-k380-settings', fnKeysEnabled);
            console.log('Settings applied successfully');
            
            this.showNotification('success', `K380 设置已应用成功`);

        } catch (error) {
            console.error('Apply settings error:', error);
            this.showNotification('error', `应用设置失败: ${error.message}`);
        } finally {
            this.applySettingsBtn.textContent = '立即应用设置';
            this.applySettingsBtn.disabled = false;
        }
    }

    async toggleAutoStart() {
        const enabled = this.autoStartToggle.checked;
        console.log('Toggling auto start:', enabled);
        
        try {
            await ipcRenderer.invoke('toggle-auto-start', enabled);
            store.set('autoStart', enabled);
            this.showNotification('success', `开机自启动已${enabled ? '启用' : '禁用'}`);
        } catch (error) {
            console.error('Toggle auto start error:', error);
            this.autoStartToggle.checked = !enabled;
            
            if (error.message.includes('开发模式')) {
                this.showNotification('info', '开发模式下不支持开机自启动，请使用构建的正式版本');
            } else {
                this.showNotification('error', `设置开机自启动失败: ${error.message}`);
            }
        }
    }

    toggleShowWindow() {
        const enabled = this.showWindowToggle.checked;
        store.set('showWindowOnStart', enabled);
        
        // 通知主进程更新设置
        ipcRenderer.send('update-show-window-setting', enabled);
        
        this.showNotification('success', `启动时显示窗口已${enabled ? '启用' : '禁用'}`);
    }

    toggleAutoApply() {
        const enabled = this.autoApplyToggle.checked;
        store.set('autoApply', enabled);
        
        // 通知主进程更新设置
        ipcRenderer.send('update-auto-apply-setting', enabled);
        
        this.showNotification('success', `自动应用设置已${enabled ? '启用' : '禁用'}`);
    }

    changePasswordCacheTime() {
        const time = parseInt(this.passwordCacheSelect.value);
        store.set('passwordCacheTime', time);
        
        // 通知主进程更新密码缓存时间
        ipcRenderer.send('update-password-cache-time', time);
        
        let message;
        if (time === 0) {
            message = '密码缓存已设置为永不过期';
        } else {
            message = `密码缓存时间已设置为 ${time} 分钟`;
        }
        
        this.showNotification('success', message);
    }

    toggleSkipPermissionCheck() {
        const enabled = this.skipPermissionCheckToggle.checked;
        store.set('skipStartupPermissionCheck', enabled);
        
        // 通知主进程更新设置
        ipcRenderer.send('update-skip-permission-check', enabled);
        
        this.showNotification('success', `权限检查提醒已${enabled ? '禁用' : '启用'}`);
    }

    toggleShowDockIcon() {
        const enabled = this.showDockIconToggle.checked;
        store.set('showDockIcon', enabled);
        
        // 通知主进程更新Dock图标显示
        ipcRenderer.send('update-show-dock-icon', enabled);
        
        this.showNotification('success', `Dock图标已${enabled ? '显示' : '隐藏'}`);
    }

    toggleShowTrayIcon() {
        const enabled = this.showTrayIconToggle.checked;
        store.set('showTrayIcon', enabled);
        
        // 通知主进程更新托盘图标显示
        ipcRenderer.send('update-show-tray-icon', enabled);
        
        if (enabled) {
            this.showNotification('success', '顶部栏图标已显示');
        } else {
            this.showNotification('info', '顶部栏图标已隐藏，可通过Dock图标访问应用');
        }
    }

    togglePersistentPasswordCache() {
        const enabled = this.persistentPasswordCacheToggle.checked;
        store.set('persistentPasswordCache', enabled);
        
        // 通知主进程更新设置
        ipcRenderer.send('update-persistent-password-cache', enabled);
        
        this.showNotification('success', `持久化密码缓存已${enabled ? '启用' : '禁用'}`);
    }

    async checkPermissions() {
        try {
            console.log('Checking permissions...');
            this.checkPermissionsBtn.textContent = '检查中...';
            this.checkPermissionsBtn.disabled = true;
            
            this.updatePermissionStatusUI(null, '检查权限中...');
            
            const result = await ipcRenderer.invoke('check-permissions');
            console.log('Permission check result:', result);
            
            if (result.success) {
                if (result.needsPassword) {
                    // K380找到但需要管理员密码 - 这是正常情况
                    this.updatePermissionStatusUI(true, result.message || 'K380功能正常（需要密码）');
                    this.showNotification('success', 'K380设备检测正常，功能可用');
                } else {
                    // 完全正常，可直接访问
                    this.updatePermissionStatusUI(true, result.message || 'HID 权限正常');
                    this.showNotification('success', 'K380设备权限已正确配置');
                }
            } else {
                // 根据具体情况显示不同的状态
                if (result.hasPermission === false) {
                    this.updatePermissionStatusUI(false, result.message || 'HID 权限缺失');
                    this.showNotification('warning', '检测到权限问题，请点击"系统设置"进行配置');
                } else if (result.k380Found === false) {
                    this.updatePermissionStatusUI(null, result.message || 'K380 设备未找到');
                    this.showNotification('info', 'K380 设备未找到，请检查蓝牙连接');
                } else {
                    this.updatePermissionStatusUI(false, result.message || '权限检查失败');
                    this.showNotification('warning', result.message || '检测到未知问题');
                }
            }
            
        } catch (error) {
            console.error('Check permissions error:', error);
            this.updatePermissionStatusUI(false, '权限检查失败');
            this.showNotification('error', '权限检查失败: ' + error.message);
        } finally {
            this.checkPermissionsBtn.textContent = '检查权限';
            this.checkPermissionsBtn.disabled = false;
        }
    }

    updatePermissionStatusUI(hasPermission, customMessage = null) {
        try {
            const statusElement = this.permissionStatus;
            if (!statusElement) {
                console.error('Permission status element not found');
                return;
            }
            
            const dotElement = statusElement.querySelector('.permission-dot');
            const textElement = statusElement.querySelector('span');
            
            if (!dotElement || !textElement) {
                console.error('Permission status child elements not found');
                return;
            }
            
            if (customMessage) {
                textElement.textContent = customMessage;
            }
            
            if (hasPermission === true) {
                dotElement.className = 'permission-dot permission-ok';
                if (!customMessage) textElement.textContent = 'HID 权限正常';
            } else if (hasPermission === false) {
                dotElement.className = 'permission-dot permission-error';
                if (!customMessage) textElement.textContent = 'HID 权限缺失';
            } else {
                // null 或其他值 - 表示信息状态（如K380未找到）
                dotElement.className = 'permission-dot permission-warning';
                if (!customMessage) textElement.textContent = '权限状态未知';
            }
            
            console.log('Permission status UI updated:', hasPermission, customMessage);
        } catch (error) {
            console.error('Error updating permission status UI:', error);
        }
    }

    async checkPermissionStatus() {
        try {
            console.log('Checking initial permission status...');
            const result = await ipcRenderer.invoke('check-permissions');
            console.log('Initial permission check result:', result);
            
            if (result.success) {
                if (result.needsPassword) {
                    // K380找到但需要管理员密码 - 这是正常情况
                    this.updatePermissionStatusUI(true, result.message || 'K380功能正常（需要密码）');
                } else {
                    // 完全正常
                    this.updatePermissionStatusUI(true, result.message || 'HID 权限正常');
                }
            } else if (result.hasPermission === false) {
                this.updatePermissionStatusUI(false, result.message || 'HID 权限缺失');
            } else if (result.k380Found === false) {
                this.updatePermissionStatusUI(null, result.message || 'K380 设备未找到');
            } else {
                this.updatePermissionStatusUI(false, result.message || '权限状态未知');
            }
        } catch (error) {
            console.error('Failed to check permission status:', error);
            this.updatePermissionStatusUI(false, '权限检查失败');
        }
    }

    openSystemSettings() {
        // 通知主进程打开系统设置
        ipcRenderer.send('open-system-settings');
        this.showNotification('info', '正在打开系统设置...');
    }

    async testK380Executable() {
        try {
            console.log('Testing K380 executable...');
            const result = await ipcRenderer.invoke('test-k380-executable');
            
            let message = '🔧 K380可执行文件测试结果:\n\n';
            
            if (result.success) {
                message += `✅ 文件存在\n`;
                message += `📁 路径: ${result.path}\n`;
                message += `🔐 权限: ${result.permissions}\n`;
                message += `⚡ 可执行: ${result.hasExecutePermission ? '是' : '否'}\n`;
                message += `📏 大小: ${result.size} bytes\n`;
                message += `📅 修改时间: ${result.modified}`;
            } else {
                message += `❌ 测试失败\n`;
                message += `📁 查找路径: ${result.path}\n`;
                message += `❌ 错误: ${result.error}`;
            }
            
            alert(message);
            
        } catch (error) {
            console.error('Test K380 executable error:', error);
            this.showNotification('error', '测试K380可执行文件失败: ' + error.message);
        }
    }

    async showDebugInfo() {
        try {
            console.log('Getting debug info...');
            const debugInfo = await ipcRenderer.invoke('get-debug-info');
            
            let message = '🐛 调试信息:\n\n';
            message += `📦 已打包: ${debugInfo.isPackaged ? '是' : '否'}\n`;
            message += `📁 执行路径: ${debugInfo.execPath}\n`;
            message += `📂 资源路径: ${debugInfo.resourcesPath}\n`;
            message += `🔗 K380连接: ${debugInfo.isK380Connected ? '已连接' : '未连接'}\n`;
            message += `⚙️ 最后应用状态: ${debugInfo.lastAppliedState !== null ? (debugInfo.lastAppliedState ? 'Fn键直接访问' : '媒体键优先') : '未知'}\n`;
            message += `📡 监控活跃: ${debugInfo.monitoringActive ? '是' : '否'}\n`;
            message += `🗝️ 持久化密码缓存: ${debugInfo.persistentPasswordCache ? '启用' : '禁用'}\n`;
            message += `🎹 Fn键设置: ${debugInfo.fnKeysEnabled ? '启用' : '禁用'}\n`;
            message += `💻 平台: ${debugInfo.platform}\n`;
            message += `🏗️ 架构: ${debugInfo.arch}\n`;
            message += `🔧 Node版本: ${debugInfo.version.node}\n`;
            message += `⚡ Electron版本: ${debugInfo.version.electron}`;
            
            alert(message);
            
        } catch (error) {
            console.error('Get debug info error:', error);
            this.showNotification('error', '获取调试信息失败: ' + error.message);
        }
    }

    async showDebugLogs() {
        try {
            console.log('Getting debug logs...');
            const logs = await ipcRenderer.invoke('get-debug-logs');
            
            if (logs.length === 0) {
                alert('📋 调试日志为空\n\n没有找到任何调试日志。请尝试执行一些操作（如切换Fn键设置）来生成日志。');
                return;
            }
            
            // 只显示最近的20条日志
            const recentLogs = logs.slice(-20);
            let message = `📋 实时调试日志 (最近${recentLogs.length}条):\n\n`;
            message += recentLogs.join('\n');
            
            // 创建一个可滚动的弹窗
            const logWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
            logWindow.document.write(`
                <html>
                <head>
                    <title>K380 调试日志</title>
                    <style>
                        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #ffffff; }
                        .log-entry { margin-bottom: 5px; word-wrap: break-word; }
                        .timestamp { color: #888; }
                        .emoji { color: #ffd700; }
                    </style>
                </head>
                <body>
                    <h2>🔍 K380 实时调试日志</h2>
                    <p>总共 ${logs.length} 条日志，显示最近 ${recentLogs.length} 条：</p>
                    <hr>
                    <div id="logs">
                        ${recentLogs.map(log => `<div class="log-entry">${this.escapeHtml(log)}</div>`).join('')}
                    </div>
                    <hr>
                    <button onclick="window.close()">关闭</button>
                </body>
                </html>
            `);
            
        } catch (error) {
            console.error('Get debug logs error:', error);
            this.showNotification('error', '获取调试日志失败: ' + error.message);
        }
    }

    async clearDebugLogs() {
        try {
            console.log('Clearing debug logs...');
            await ipcRenderer.invoke('clear-debug-logs');
            this.showNotification('success', '调试日志已清除');
            
        } catch (error) {
            console.error('Clear debug logs error:', error);
            this.showNotification('error', '清除调试日志失败: ' + error.message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    visitGithub() {
        shell.openExternal('https://github.com/XiaoDcs/k380-function-keys-manager');
    }

    hideWindow() {
        window.close();
    }

    showNotification(type, message) {
        console.log('Showing notification:', type, message);
        
        try {
            // 创建一个简单的通知显示
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 300px;
                padding: 12px 16px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                font-size: 14px;
                z-index: 1000;
                backdrop-filter: blur(20px);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
                transform: translateX(400px);
                transition: transform 0.3s ease;
            `;
            
            // 设置颜色
            switch (type) {
                case 'success':
                    notification.style.background = 'rgba(52, 199, 89, 0.9)';
                    break;
                case 'error':
                    notification.style.background = 'rgba(255, 59, 48, 0.9)';
                    break;
                case 'warning':
                    notification.style.background = 'rgba(255, 159, 10, 0.9)';
                    break;
                default:
                    notification.style.background = 'rgba(0, 122, 255, 0.9)';
            }
            
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // 显示动画
            setTimeout(() => {
                notification.style.transform = 'translateX(0)';
            }, 100);
            
            // 自动隐藏
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }, 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing K380RendererManager...');
    
    // 确保页面完全加载后再初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new K380RendererManager();
        });
    } else {
        new K380RendererManager();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.close();
    }
    
    // 快捷键支持
    if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                document.querySelector('[data-tab="main"]')?.click();
                break;
            case '2':
                e.preventDefault();
                document.querySelector('[data-tab="settings"]')?.click();
                break;
            case '3':
                e.preventDefault();
                document.querySelector('[data-tab="tools"]')?.click();
                break;
            case '4':
                e.preventDefault();
                document.querySelector('[data-tab="about"]')?.click();
                break;
        }
    }
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

console.log('renderer.js loaded successfully'); 