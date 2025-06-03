const { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

class K380Manager {
  constructor() {
    this.store = new Store();
    this.tray = null;
    this.mainWindow = null;
    this.autoLauncher = null;
    this.isK380Connected = false;
    this.monitoringActive = false;
    this.lastAppliedState = null;
    this.bluetoothCheckInterval = null;
    this.isQuitting = false;
    this.debugLogs = [];
    
    // 添加密码缓存配置
    this.cachedPassword = null;
    this.passwordCacheTime = null;
    this.getPasswordCacheTime = () => {
      const setting = this.store.get('passwordCacheTime', 5); // 默认5分钟
      if (setting === 0) return Infinity; // 0表示永不过期
      return setting * 60 * 1000; // 转换为毫秒
    };
    
    // 窗口显示设置
    this.shouldShowWindowOnStart = this.store.get('showWindowOnStart', true); // 默认显示窗口
    
    // 新增：初始化图标显示设置
    this.showDockIcon = this.store.get('showDockIcon', false); // 默认隐藏Dock图标
    this.showTrayIcon = this.store.get('showTrayIcon', true); // 默认显示托盘图标
    
    // 持久化密码缓存配置
    this.persistentPasswordCache = this.store.get('persistentPasswordCache', false);
    this.encryptionKey = this.getEncryptionKey();
    
    // 启动时尝试加载持久化的密码
    this.loadPersistentPassword();
    
    this.initAutoLauncher();
    this.setupIPC();
    
    // 启动时权限检测
    this.performStartupPermissionCheck();
  }

  async performStartupPermissionCheck() {
    const skipStartupCheck = this.store.get('skipStartupPermissionCheck', false);
    if (skipStartupCheck) return;

    // 延迟检查，给应用时间完全启动
    setTimeout(async () => {
      const hasPermission = await this.checkHIDPermission();
      if (!hasPermission) {
        this.showPermissionRequiredDialog();
      }
    }, 2000);
  }

  async checkHIDPermission() {
    return new Promise((resolve) => {
      const testHidPath = this.getExecutablePath('test_hid');
      
      if (!fs.existsSync(testHidPath)) {
        console.warn('test_hid not found, skipping permission check');
        resolve(true); // 如果找不到测试程序，假设有权限
        return;
      }

      exec(`"${testHidPath}"`, (error, stdout, stderr) => {
        if (!error && stdout.includes('Successfully opened K380')) {
          resolve(true);
        } else if (stderr.includes('privilege violation') || 
                   stdout.includes('privilege violation') ||
                   (error && error.message.includes('not permitted'))) {
          resolve(false);
        } else {
          resolve(true); // 其他情况假设有权限
        }
      });
    });
  }

  showPermissionRequiredDialog() {
    dialog.showMessageBox({
      type: 'warning',
      title: 'K380 Manager - 需要权限设置',
      message: '检测到输入监控权限未设置',
      detail: `为了正常使用 K380 功能，您需要：

1. 打开 系统设置 → 隐私与安全性 → 输入监控
2. 添加此应用：
   ${process.execPath}
3. 确保勾选该应用
4. 重启应用生效

是否现在打开系统设置？`,
      buttons: ['打开系统设置', '稍后设置', '不再提醒'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        // 打开系统设置
        const macosVersion = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
        const majorVersion = parseInt(macosVersion.split('.')[0]);
        
        if (majorVersion >= 13) {
          shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension');
        } else {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent');
        }
      } else if (result.response === 2) {
        // 不再提醒
        this.store.set('skipStartupPermissionCheck', true);
      }
    });
  }

  getExecutablePath(executable) {
    if (app.isPackaged) {
      // 尝试多个可能的路径
      const possiblePaths = [
        path.join(process.resourcesPath, 'bin', executable),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', executable),
        path.join(path.dirname(process.execPath), '..', 'Resources', 'bin', executable),
        path.join(process.resourcesPath, '..', 'bin', executable)
      ];
      
      console.log(`Looking for executable: ${executable}`);
      console.log(`Process resources path: ${process.resourcesPath}`);
      console.log(`Process exec path: ${process.execPath}`);
      
      for (const possiblePath of possiblePaths) {
        console.log(`Checking path: ${possiblePath}`);
        if (fs.existsSync(possiblePath)) {
          console.log(`✅ Found executable at: ${possiblePath}`);
          
          // 检查文件权限
          try {
            const stats = fs.statSync(possiblePath);
            console.log(`File permissions: ${stats.mode.toString(8)}`);
            if (stats.mode & parseInt('111', 8)) {
              console.log('✅ File has execute permissions');
            } else {
              console.log('❌ File lacks execute permissions');
              // 尝试设置执行权限
              fs.chmodSync(possiblePath, '755');
              console.log('✅ Execute permissions set');
            }
          } catch (error) {
            console.error('Error checking file permissions:', error);
          }
          
          return possiblePath;
        }
      }
      
      console.error(`❌ Executable ${executable} not found in any of the expected locations`);
      console.error('Available files in Resources:', fs.readdirSync(process.resourcesPath));
      
      if (fs.existsSync(path.join(process.resourcesPath, 'bin'))) {
        console.error('Files in Resources/bin:', fs.readdirSync(path.join(process.resourcesPath, 'bin')));
      }
      
      // 返回第一个路径用于错误信息
      return possiblePaths[0];
    }
    
    // 开发模式使用相对路径
    return path.join(__dirname, '..', 'bin', executable);
  }

  initAutoLauncher() {
    // 检测是否为开发模式
    const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || !app.isPackaged;
    
    if (isDev) {
      // 开发模式下禁用自动启动功能，避免路径问题
      console.log('Development mode detected, auto-launch disabled');
      this.autoLauncher = {
        enable: async () => {
          throw new Error('开发模式下不支持开机自启动。请使用 "npm run build" 构建正式版本后再设置开机自启动。');
        },
        disable: async () => {
          // 开发模式下什么都不做
        },
        isEnabled: async () => false
      };
    } else {
      // 生产模式下使用正常的 auto-launch
      this.autoLauncher = new AutoLaunch({
        name: 'K380 Function Keys Manager',
        path: process.execPath,
        isHidden: !this.shouldShowWindowOnStart, // 根据设置决定是否隐藏启动
        mac: {
          useLaunchAgent: true
        }
      });
    }
  }

  createTray() {
    let trayIcon;
    
    try {
      // 优先使用专用的托盘图标
      const iconPath = this.getTrayIconPath();
      
      if (iconPath && fs.existsSync(iconPath)) {
        console.log(`Using custom tray icon: ${iconPath}`);
        trayIcon = nativeImage.createFromPath(iconPath);
        
        // 确保图标大小合适
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
        
        // 设置为模板图像，让系统自动处理深色/浅色模式
        trayIcon.setTemplateImage(true);
      } else {
        console.log('Custom tray icon not found, using system icon');
        // 降级使用系统内置图标
        trayIcon = nativeImage.createFromNamedImage('NSImageNameComputer', [16, 16]);
      }
    } catch (e) {
      console.error('Error creating tray icon:', e);
      // 最后降级使用空图标
      trayIcon = nativeImage.createEmpty();
    }
    
    this.tray = new Tray(trayIcon);
    this.updateTrayMenu();
    
    this.tray.setToolTip('K380 Function Keys Manager');
  }

  // 新增：获取托盘图标路径的方法
  getTrayIconPath() {
    const iconPreference = this.store.get('trayIconType', 'tray'); // 'tray', 'logo', 'system'
    
    if (iconPreference === 'system') {
      return null; // 使用系统图标
    }
    
    let iconPath;
    
    if (app.isPackaged) {
      // 打包后的路径
      const resourcesPath = process.resourcesPath;
      
      if (iconPreference === 'logo') {
        // 使用主logo
        iconPath = path.join(resourcesPath, 'assets', 'icons', 'icon.png');
      } else {
        // 使用专用托盘图标 (默认)
        // 检测系统是否为深色模式 (在macOS上)
        const isDarkMode = this.isDarkMode();
        
        if (isDarkMode && fs.existsSync(path.join(resourcesPath, 'assets', 'icons', 'tray', 'tray-dark.png'))) {
          iconPath = path.join(resourcesPath, 'assets', 'icons', 'tray', 'tray-dark.png');
        } else {
          iconPath = path.join(resourcesPath, 'assets', 'icons', 'tray', 'tray.png');
        }
      }
    } else {
      // 开发模式路径
      if (iconPreference === 'logo') {
        iconPath = path.join(__dirname, '..', 'assets', 'icons', 'icon.png');
      } else {
        const isDarkMode = this.isDarkMode();
        
        if (isDarkMode && fs.existsSync(path.join(__dirname, '..', 'assets', 'icons', 'tray', 'tray-dark.png'))) {
          iconPath = path.join(__dirname, '..', 'assets', 'icons', 'tray', 'tray-dark.png');
        } else {
          iconPath = path.join(__dirname, '..', 'assets', 'icons', 'tray', 'tray.png');
        }
      }
    }
    
    console.log(`Tray icon preference: ${iconPreference}, selected path: ${iconPath}`);
    return iconPath;
  }

  // 新增：检测是否为深色模式
  isDarkMode() {
    try {
      // 在macOS上检测深色模式
      if (process.platform === 'darwin') {
        const theme = execSync('defaults read -g AppleInterfaceStyle 2>/dev/null || echo "Light"', { encoding: 'utf8' }).trim();
        return theme === 'Dark';
      }
    } catch (error) {
      console.log('Could not detect dark mode, defaulting to light');
    }
    return false;
  }

  // 新增：设置托盘图标类型
  setTrayIconType(iconType) {
    const validTypes = ['tray', 'logo', 'system'];
    if (!validTypes.includes(iconType)) {
      console.error(`Invalid icon type: ${iconType}`);
      return;
    }
    
    this.store.set('trayIconType', iconType);
    
    // 重新创建托盘图标
    if (this.tray) {
      this.tray.destroy();
      this.createTray();
    }
    
    let message;
    switch (iconType) {
      case 'logo':
        message = '托盘图标已切换为主Logo';
        break;
      case 'system':
        message = '托盘图标已切换为系统默认';
        break;
      default:
        message = '托盘图标已切换为专用图标';
    }
    
    this.showNotification('K380 Manager', message);
  }

  updateTrayMenu() {
    if (!this.tray) {
      console.warn('Tray not initialized yet, skipping menu update');
      return;
    }
    
    const currentState = this.store.get('fnKeysEnabled', true);
    const autoStart = this.store.get('autoStart', false);
    const autoApply = this.store.get('autoApply', true);
    const showWindowOnStart = this.store.get('showWindowOnStart', true);
    const passwordCacheTime = this.store.get('passwordCacheTime', 5);
    const trayIconType = this.store.get('trayIconType', 'tray');
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `K380 ${this.isK380Connected ? '已连接' : '未连接'}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '启用 Fn 键直接访问',
        type: 'checkbox',
        checked: currentState,
        click: () => this.toggleFnKeys()
      },
      { type: 'separator' },
      {
        label: '开机自启动',
        type: 'checkbox',
        checked: autoStart,
        click: () => this.toggleAutoStart()
      },
      {
        label: '启动时显示窗口',
        type: 'checkbox',
        checked: showWindowOnStart,
        click: () => this.toggleShowWindowOnStart()
      },
      {
        label: '自动应用设置',
        type: 'checkbox',
        checked: autoApply,
        click: () => this.toggleAutoApply()
      },
      { type: 'separator' },
      {
        label: '密码缓存设置',
        submenu: [
          {
            label: '1分钟',
            type: 'radio',
            checked: passwordCacheTime === 1,
            click: () => this.setPasswordCacheTime(1)
          },
          {
            label: '5分钟 (推荐)',
            type: 'radio',
            checked: passwordCacheTime === 5,
            click: () => this.setPasswordCacheTime(5)
          },
          {
            label: '15分钟',
            type: 'radio',
            checked: passwordCacheTime === 15,
            click: () => this.setPasswordCacheTime(15)
          },
          {
            label: '30分钟',
            type: 'radio',
            checked: passwordCacheTime === 30,
            click: () => this.setPasswordCacheTime(30)
          },
          {
            label: '永不过期',
            type: 'radio',
            checked: passwordCacheTime === 0,
            click: () => this.setPasswordCacheTime(0)
          }
        ]
      },
      {
        label: '托盘图标样式',
        submenu: [
          {
            label: '专用图标',
            type: 'radio',
            checked: trayIconType === 'tray',
            click: () => this.setTrayIconType('tray')
          },
          {
            label: '主Logo',
            type: 'radio',
            checked: trayIconType === 'logo',
            click: () => this.setTrayIconType('logo')
          },
          {
            label: '系统默认',
            type: 'radio',
            checked: trayIconType === 'system',
            click: () => this.setTrayIconType('system')
          }
        ]
      },
      { type: 'separator' },
      {
        label: '检查 K380 连接',
        click: () => this.checkK380Connection()
      },
      {
        label: '检查权限设置',
        click: () => this.checkPermissionsAndShowGuide()
      },
      {
        label: '立即应用设置',
        click: () => this.applySettings()
      },
      { type: 'separator' },
      {
        label: '显示窗口',
        click: () => this.showMainWindow()
      },
      {
        label: '关于',
        click: () => this.showAbout()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          console.log('User clicked exit from tray menu');
          this.isQuitting = true;
          this.cleanup();
          app.quit();
        }
      }
    ]);
    
    this.tray.setContextMenu(contextMenu);
  }

  toggleShowWindowOnStart() {
    const currentState = this.store.get('showWindowOnStart', true);
    const newState = !currentState;
    this.store.set('showWindowOnStart', newState);
    this.shouldShowWindowOnStart = newState;
    this.updateTrayMenu();
    
    this.showNotification(
      'K380 Manager',
      `启动时显示窗口已${newState ? '启用' : '禁用'}`
    );
  }

  setPasswordCacheTime(minutes) {
    this.store.set('passwordCacheTime', minutes);
    this.clearPasswordCache(); // 清除当前缓存
    this.updateTrayMenu();
    
    let message;
    if (minutes === 0) {
      message = '密码缓存已设置为永不过期';
    } else {
      message = `密码缓存时间已设置为 ${minutes} 分钟`;
    }
    
    this.showNotification('K380 Manager', message);
  }

  async executeK380Command(mode) {
    return new Promise(async (resolve, reject) => {
      const k380Path = this.getExecutablePath('k380_improved');
      
      this.addDebugLog(`📱 执行K380命令: ${k380Path} -f ${mode}`);
      this.addDebugLog(`🔍 当前时间: ${new Date().toISOString()}`);
      this.addDebugLog(`🎯 目标模式: ${mode} (${mode === 'on' ? 'Fn键直接访问' : '媒体键优先'})`);
      
      // 检查文件是否存在
      if (!fs.existsSync(k380Path)) {
        const error = `K380 executable not found at: ${k380Path}`;
        this.addDebugLog(`❌ ${error}`);
        reject(new Error('K380 executable not found. Please rebuild the application.'));
        return;
      }
      
      // 检查文件权限
      try {
        fs.accessSync(k380Path, fs.constants.F_OK | fs.constants.X_OK);
        this.addDebugLog('✅ K380可执行文件存在且有执行权限');
      } catch (accessError) {
        this.addDebugLog(`❌ K380可执行文件访问错误: ${accessError.message}`);
        reject(new Error(`无法访问 K380 可执行文件: ${accessError.message}`));
        return;
      }
      
      // 尝试不带sudo运行
      this.addDebugLog('🔄 尝试直接执行（无sudo）...');
      const startTime = Date.now();
      
      exec(`"${k380Path}" -f ${mode}`, { timeout: 10000 }, (error, stdout, stderr) => {
        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        this.addDebugLog(`⏱️ 命令执行耗时: ${executionTime}ms`);
        this.addDebugLog('📋 命令执行结果:');
        this.addDebugLog(`- 错误信息: ${error?.message || 'none'}`);
        this.addDebugLog(`- 标准输出: ${stdout || 'empty'}`);
        this.addDebugLog(`- 错误输出: ${stderr || 'empty'}`);
        
        if (!error) {
          this.addDebugLog('🎉 命令执行成功（无需sudo）');
          this.verifyK380Setting(mode, stdout);
          resolve(stdout);
          return;
        }
        
        // 检查是否是K380设备问题
        if (stdout.includes('K380 not found') || stdout.includes('cannot be opened') || 
            stderr.includes('K380 not found') || stderr.includes('cannot be opened')) {
          this.addDebugLog('❌ K380设备访问被拒绝，立即尝试使用sudo...');
          
          // 直接尝试使用sudo，而不是先报错
          this.getPasswordWithCache().then(password => {
            this.addDebugLog(`🔑 密码提示完成: ${password ? '已获取密码' : '已取消'}`);
            
            if (!password) {
              // 如果是打包后的应用，提供特殊的错误信息和解决方案
              if (app.isPackaged) {
                reject(new Error(`无法访问 K380 设备。这通常是因为 macOS 安全限制。

解决方法：
1. 打开"系统设置" → "隐私与安全性" → "输入监控"
2. 添加此应用：${process.execPath.replace('.app/Contents/MacOS/K380 Function Keys Manager', '.app')}
3. 确保应用已勾选
4. 完全退出并重启此应用

如果问题持续存在：
• 尝试重启系统
• 检查 K380 是否通过蓝牙正确连接
• 确保没有其他应用占用 K380 设备`));
              } else {
                reject(new Error('K380 设备未找到或无法访问。请检查蓝牙连接状态。'));
              }
              return;
            }
            
            // 使用spawn而不是exec，避免密码泄露
            this.addDebugLog('🚀 使用sudo执行命令（设备访问失败后的重试）...');
            const sudoStartTime = Date.now();
            const child = spawn('sudo', ['-S', k380Path, '-f', mode], {
              stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let sudoStdout = '';
            let sudoStderr = '';
            
            // 发送密码
            child.stdin.write(password + '\n');
            child.stdin.end();
            
            child.stdout.on('data', (data) => {
              sudoStdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
              sudoStderr += data.toString();
            });
            
            child.on('close', (code) => {
              const sudoEndTime = Date.now();
              const sudoExecutionTime = sudoEndTime - sudoStartTime;
              
              this.addDebugLog(`⏱️ Sudo命令执行耗时: ${sudoExecutionTime}ms`);
              this.addDebugLog('📋 Sudo命令执行结果:');
              this.addDebugLog(`- 退出代码: ${code}`);
              this.addDebugLog(`- 标准输出: ${sudoStdout || 'empty'}`);
              this.addDebugLog(`- 错误输出: ${sudoStderr || 'empty'}`);
              
              if (code === 0) {
                // 密码正确，更新缓存
                this.updatePasswordCache(password);
                this.addDebugLog('🎉 Sudo命令执行成功（设备访问重试）');
                this.verifyK380Setting(mode, sudoStdout);
                resolve(sudoStdout);
              } else {
                this.addDebugLog('❌ Sudo命令执行失败（设备访问重试）');
                
                // 检查K380设备问题（即使使用sudo也无法访问）
                if (sudoStdout.includes('K380 not found') || sudoStdout.includes('cannot be opened') || 
                    sudoStderr.includes('K380 not found') || sudoStderr.includes('cannot be opened')) {
                  
                  if (app.isPackaged) {
                    reject(new Error(`即使使用管理员权限也无法访问 K380 设备。

可能的原因和解决方法：

1. 权限设置问题：
   • 打开"系统设置" → "隐私与安全性" → "输入监控"
   • 确保此应用已添加并勾选
   • 完全退出并重启应用

2. K380 连接问题：
   • 确保 K380 通过蓝牙已正确连接
   • 尝试断开并重新连接 K380
   • 检查系统蓝牙设置中的设备状态

3. 系统安全限制：
   • 尝试重启系统
   • 在"安全性与隐私"中允许下载的应用运行

4. 设备冲突：
   • 确保没有其他应用正在使用 K380
   • 关闭可能占用键盘的其他工具`));
                  } else {
                    reject(new Error('K380 设备未找到或无法访问，即使使用管理员权限。请检查设备连接状态。'));
                  }
                  return;
                }
                
                // 检查具体的错误类型
                if (sudoStderr.includes('not permitted') || sudoStdout.includes('not permitted') ||
                    sudoStderr.includes('privilege violation') || sudoStdout.includes('privilege violation')) {
                  reject(new Error('权限被拒绝。请在系统设置中添加应用到"输入监控"权限列表，然后重启应用。'));
                } else if (sudoStderr.includes('Sorry, try again') || sudoStderr.includes('incorrect password')) {
                  // 密码错误，清除缓存
                  this.clearPasswordCache();
                  reject(new Error('密码错误，请重试。'));
                } else if (sudoStderr.includes('Unable to open device') || sudoStdout.includes('Unable to open device')) {
                  reject(new Error('无法打开 K380 设备。请确保设备已连接且权限设置正确。'));
                } else if (sudoStderr.includes('dyld') || sudoStderr.includes('Library not loaded')) {
                  reject(new Error('动态库加载失败。请重新构建应用程序。'));
                } else {
                  reject(new Error(`命令执行失败 (退出代码: ${code}): ${sudoStderr || sudoStdout || '未知错误'}`));
                }
              }
            });
            
            child.on('error', (err) => {
              this.addDebugLog(`❌ 进程启动错误: ${err.message}`);
              reject(new Error(`执行命令时出错: ${err.message}`));
            });
            
          }).catch(reject);
          return;
        }
        
        // 检查是否是权限问题
        if (error.message.includes('not permitted') || error.message.includes('unable to open device') ||
            stderr.includes('not permitted') || stdout.includes('not permitted') ||
            stderr.includes('privilege violation') || stdout.includes('privilege violation')) {
          this.addDebugLog('❌ 权限被拒绝，需要HID访问权限');
          reject(new Error('权限被拒绝。请在系统设置中添加应用到"输入监控"权限列表，然后重启应用。'));
          return;
        }
        
        // 检查是否是依赖库问题
        if (error.message.includes('dyld') || stderr.includes('dyld') || 
            error.message.includes('Library not loaded') || stderr.includes('Library not loaded')) {
          this.addDebugLog('❌ 动态库加载错误');
          this.addDebugLog('Library loading error - this might be a dependency issue');
          reject(new Error('动态库加载失败。这可能是因为缺少依赖库。请重新构建应用程序。'));
          return;
        }
        
        // 如果是其他错误，尝试使用sudo
        this.addDebugLog('🔐 直接执行失败，尝试使用sudo...');
        this.getPasswordWithCache().then(password => {
          this.addDebugLog(`🔑 密码提示完成: ${password ? '已获取密码' : '已取消'}`);
          
          if (!password) {
            reject(new Error('需要管理员密码来配置 K380 设备'));
            return;
          }
          
          // 使用spawn而不是exec，避免密码泄露
          this.addDebugLog('🚀 使用sudo执行命令...');
          const sudoStartTime = Date.now();
          const child = spawn('sudo', ['-S', k380Path, '-f', mode], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          // 发送密码
          child.stdin.write(password + '\n');
          child.stdin.end();
          
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('close', (code) => {
            const sudoEndTime = Date.now();
            const sudoExecutionTime = sudoEndTime - sudoStartTime;
            
            this.addDebugLog(`⏱️ Sudo命令执行耗时: ${sudoExecutionTime}ms`);
            this.addDebugLog('📋 Sudo命令执行结果:');
            this.addDebugLog(`- 退出代码: ${code}`);
            this.addDebugLog(`- 标准输出: ${stdout || 'empty'}`);
            this.addDebugLog(`- 错误输出: ${stderr || 'empty'}`);
            
            if (code === 0) {
              // 密码正确，更新缓存
              this.updatePasswordCache(password);
              this.addDebugLog('🎉 Sudo命令执行成功');
              this.verifyK380Setting(mode, stdout);
              resolve(stdout);
            } else {
              this.addDebugLog('❌ Sudo命令执行失败');
              
              // 检查K380设备问题（即使使用sudo也无法访问）
              if (stdout.includes('K380 not found') || stdout.includes('cannot be opened') || 
                  stderr.includes('K380 not found') || stderr.includes('cannot be opened')) {
                
                if (app.isPackaged) {
                  reject(new Error(`即使使用管理员权限也无法访问 K380 设备。

可能的原因和解决方法：

1. 权限设置问题：
   • 打开"系统设置" → "隐私与安全性" → "输入监控"
   • 确保此应用已添加并勾选
   • 完全退出并重启应用

2. K380 连接问题：
   • 确保 K380 通过蓝牙已正确连接
   • 尝试断开并重新连接 K380
   • 检查系统蓝牙设置中的设备状态

3. 系统安全限制：
   • 尝试重启系统
   • 在"安全性与隐私"中允许下载的应用运行

4. 设备冲突：
   • 确保没有其他应用正在使用 K380
   • 关闭可能占用键盘的其他工具`));
                } else {
                  reject(new Error('K380 设备未找到或无法访问，即使使用管理员权限。请检查设备连接状态。'));
                }
                return;
              }
              
              // 检查具体的错误类型
              if (stderr.includes('not permitted') || stdout.includes('not permitted') ||
                  stderr.includes('privilege violation') || stdout.includes('privilege violation')) {
                reject(new Error('权限被拒绝。请在系统设置中添加应用到"输入监控"权限列表，然后重启应用。'));
              } else if (stderr.includes('Sorry, try again') || stderr.includes('incorrect password')) {
                // 密码错误，清除缓存
                this.clearPasswordCache();
                reject(new Error('密码错误，请重试。'));
              } else if (stderr.includes('Unable to open device') || stdout.includes('Unable to open device')) {
                reject(new Error('无法打开 K380 设备。请确保设备已连接且权限设置正确。'));
              } else if (stderr.includes('dyld') || stderr.includes('Library not loaded')) {
                reject(new Error('动态库加载失败。请重新构建应用程序。'));
              } else {
                reject(new Error(`命令执行失败 (退出代码: ${code}): ${stderr || stdout || '未知错误'}`));
              }
            }
          });
          
          child.on('error', (err) => {
            this.addDebugLog(`❌ 进程启动错误: ${err.message}`);
            reject(new Error(`执行命令时出错: ${err.message}`));
          });
          
        }).catch(reject);
      });
    });
  }

  // 新增：验证K380设置是否真的生效了
  verifyK380Setting(expectedMode, commandOutput) {
    this.addDebugLog(`🔍 验证K380设置是否生效...`);
    this.addDebugLog(`📝 期望模式: ${expectedMode}`);
    this.addDebugLog(`📄 命令输出: ${commandOutput}`);
    
    // 检查命令输出中的关键信息
    if (commandOutput.includes('Success') || commandOutput.includes('successfully')) {
      this.addDebugLog('✅ 命令报告执行成功');
    } else if (commandOutput.includes('Failed') || commandOutput.includes('Error')) {
      this.addDebugLog('❌ 命令报告执行失败');
    } else {
      this.addDebugLog('⚠️ 命令输出不明确，无法确定是否成功');
    }
    
    // 更新内部状态
    this.lastAppliedState = expectedMode === 'on';
    this.addDebugLog(`💾 已更新内部状态: ${this.lastAppliedState ? 'Fn键直接访问' : '媒体键优先'}`);
  }

  async getPasswordWithCache() {
    // 检查缓存是否有效
    const cacheTime = this.getPasswordCacheTime();
    if (this.cachedPassword && this.passwordCacheTime && 
        (Date.now() - this.passwordCacheTime) < cacheTime) {
      console.log('Using cached password');
      return this.cachedPassword;
    }
    
    // 缓存无效，提示用户输入新密码
    return await this.promptForPassword();
  }
  
  updatePasswordCache(password) {
    this.cachedPassword = password;
    this.passwordCacheTime = Date.now();
    const cacheTime = this.getPasswordCacheTime();
    if (cacheTime === Infinity) {
      console.log('Password cached permanently');
    } else {
      console.log(`Password cached for ${this.store.get('passwordCacheTime', 5)} minutes`);
    }
    this.savePersistentPassword(password);
  }
  
  clearPasswordCache(clearPersistent = true) {
    this.cachedPassword = null;
    this.passwordCacheTime = null;
    console.log('Password cache cleared');
    
    // 只有在明确指定时才清除持久化缓存
    if (clearPersistent) {
      this.clearPersistentPassword();
    }
  }

  // 持久化密码缓存方法
  getEncryptionKey() {
    // 使用系统唯一标识符作为加密密钥的基础
    const machineId = require('os').hostname() + require('os').platform() + require('os').arch();
    return crypto.createHash('sha256').update(machineId).digest();
  }

  async loadPersistentPassword() {
    if (!this.persistentPasswordCache) return;

    try {
      const encryptedData = this.store.get('encryptedPassword');
      const iv = this.store.get('passwordIV');
      const cacheTimestamp = this.store.get('passwordCacheTimestamp');
      
      if (!encryptedData || !iv || !cacheTimestamp) return;

      // 检查是否过期
      const cacheTime = this.getPasswordCacheTime();
      if (cacheTime !== Infinity && (Date.now() - cacheTimestamp) > cacheTime) {
        console.log('Persistent password cache expired');
        this.clearPersistentPassword();
        return;
      }

      // 解密密码
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, Buffer.from(iv, 'hex'));
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      this.cachedPassword = decrypted;
      this.passwordCacheTime = cacheTimestamp;
      console.log('Persistent password cache loaded');
    } catch (error) {
      console.error('Failed to load persistent password cache:', error);
      this.clearPersistentPassword();
    }
  }

  async savePersistentPassword(password) {
    if (!this.persistentPasswordCache) return;

    try {
      // 生成随机初始化向量
      const iv = crypto.randomBytes(16);
      
      // 加密密码
      const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
      let encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // 保存加密的密码、IV和时间戳
      this.store.set('encryptedPassword', encrypted);
      this.store.set('passwordIV', iv.toString('hex'));
      this.store.set('passwordCacheTimestamp', Date.now());
      console.log('Password saved to persistent cache');
    } catch (error) {
      console.error('Failed to save persistent password cache:', error);
    }
  }

  clearPersistentPassword() {
    this.store.delete('encryptedPassword');
    this.store.delete('passwordIV');
    this.store.delete('passwordCacheTimestamp');
    console.log('Persistent password cache cleared');
  }

  async toggleAutoStart() {
    const currentState = this.store.get('autoStart', false);
    const newState = !currentState;
    
    try {
      if (newState) {
        await this.autoLauncher.enable();
      } else {
        await this.autoLauncher.disable();
      }
      
      this.store.set('autoStart', newState);
      this.updateTrayMenu();
      
      this.showNotification(
        'K380 Manager',
        `开机自启动已${newState ? '启用' : '禁用'}`
      );
    } catch (error) {
      console.error('Toggle auto start error:', error);
      
      // 检查是否是开发模式错误
      if (error.message.includes('开发模式下不支持')) {
        dialog.showMessageBox({
          type: 'info',
          title: '开发模式限制',
          message: '开发模式下无法设置开机自启动',
          detail: error.message + '\n\n构建正式版本的步骤：\n1. 运行 "npm run build" 构建应用\n2. 在构建后的应用中设置开机自启动',
          buttons: ['了解', '查看构建说明']
        }).then((result) => {
          if (result.response === 1) {
            this.showBuildInstructions();
          }
        });
      } else {
        dialog.showErrorBox(
          '设置失败',
          `无法${newState ? '启用' : '禁用'}开机自启动: ${error.message}`
        );
      }
    }
  }

  toggleAutoApply() {
    const currentState = this.store.get('autoApply', true);
    const newState = !currentState;
    this.store.set('autoApply', newState);
    this.updateTrayMenu();
    
    if (newState) {
      this.startBluetoothMonitoring();
    } else {
      this.stopBluetoothMonitoring();
    }
    
    this.showNotification(
      'K380 Manager',
      `自动应用设置已${newState ? '启用' : '禁用'}`
    );
  }

  async toggleFnKeys() {
    const currentState = this.store.get('fnKeysEnabled', true);
    const newState = !currentState;
    
    this.store.set('fnKeysEnabled', newState);
    this.updateTrayMenu();
    
    await this.applySettings();
  }

  async applySettings() {
    const fnKeysEnabled = this.store.get('fnKeysEnabled', true);
    
    try {
      await this.executeK380Command(fnKeysEnabled ? 'on' : 'off');
      this.lastAppliedState = fnKeysEnabled;
      
      // 只有在命令成功执行后才显示成功消息
      this.showNotification(
        'K380 设置已应用',
        `Fn 键直接访问: ${fnKeysEnabled ? '启用' : '禁用'}`
      );
    } catch (error) {
      console.error('Apply settings error:', error.message);
      dialog.showErrorBox(
        '设置失败',
        `无法应用 K380 设置: ${error.message}`
      );
    }
  }

  async promptForPassword() {
    return new Promise((resolve) => {
      const passwordWindow = new BrowserWindow({
        width: 400,
        height: 260,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        },
        title: 'K380 Manager - 需要管理员权限',
        resizable: false,
        modal: true,
        parent: this.mainWindow,
        show: false,
        titleBarStyle: 'hiddenInset'
      });

      const passwordHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
              background: #f5f5f7;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              height: calc(100vh - 40px);
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            }
            h3 {
              margin: 0 0 16px 0;
              color: #1d1d1f;
              font-size: 17px;
              font-weight: 600;
            }
            p {
              margin: 0 0 16px 0;
              color: #86868b;
              font-size: 14px;
              line-height: 1.4;
            }
            input[type="password"] {
              width: 100%;
              padding: 12px;
              border: 1px solid #d2d2d7;
              border-radius: 8px;
              font-size: 14px;
              margin-bottom: 16px;
              box-sizing: border-box;
            }
            input[type="password"]:focus {
              outline: none;
              border-color: #007aff;
              box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
            }
            .buttons {
              display: flex;
              gap: 12px;
              justify-content: flex-end;
            }
            button {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              min-width: 70px;
            }
            .cancel-btn {
              background: #f5f5f7;
              color: #1d1d1f;
            }
            .ok-btn {
              background: #007aff;
              color: white;
            }
            .cancel-btn:hover {
              background: #e5e5e7;
            }
            .ok-btn:hover {
              background: #0056cc;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h3>需要管理员权限</h3>
            <p>配置 K380 键盘需要管理员权限。请输入您的密码：</p>
            <input type="password" id="password" placeholder="密码" autofocus>
            <div class="buttons">
              <button class="cancel-btn" onclick="cancel()">取消</button>
              <button class="ok-btn" onclick="submit()">确定</button>
            </div>
          </div>
          <script>
            const { ipcRenderer } = require('electron');
            
            function submit() {
              const password = document.getElementById('password').value;
              ipcRenderer.send('password-result', password);
            }
            
            function cancel() {
              ipcRenderer.send('password-result', null);
            }
            
            document.getElementById('password').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                submit();
              }
            });
          </script>
        </body>
        </html>
      `;

      passwordWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(passwordHtml));
      passwordWindow.show();

      ipcMain.once('password-result', (event, password) => {
        passwordWindow.close();
        resolve(password);
      });

      passwordWindow.on('closed', () => {
        resolve(null);
      });
    });
  }

  async checkK380Connection() {
    try {
      const output = execSync('system_profiler SPBluetoothDataType -json', { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      const bluetoothData = JSON.parse(output);
      let k380Found = false;
      let k380Device = null;
      
      if (bluetoothData.SPBluetoothDataType) {
        for (const controller of bluetoothData.SPBluetoothDataType) {
          if (controller.device_connected) {
            for (const deviceEntry of controller.device_connected) {
              for (const deviceName in deviceEntry) {
                const device = deviceEntry[deviceName];
                
                if (deviceName.includes('K380') || deviceName.includes('Keyboard K380')) {
                  if (device.device_vendorID === '0x046D' && device.device_productID === '0xB342') {
                    k380Found = true;
                    k380Device = { 
                      name: deviceName, 
                      address: device.device_address,
                      ...device 
                    };
                    console.log(`Found K380: ${deviceName} (${device.device_address})`);
                    break;
                  }
                }
              }
              if (k380Found) break;
            }
          }
          if (k380Found) break;
        }
      }
      
      const wasConnected = this.isK380Connected;
      this.isK380Connected = k380Found;
      
      this.notifyRendererOfStatusChange(k380Found);
      
      if (k380Found) {
        console.log(`K380 Status: Connected (${k380Device.name})`);
        
        if (!wasConnected && this.store.get('autoApply', true)) {
          console.log('K380 connected, auto-applying settings');
          setTimeout(() => this.applySettings(), 1000);
        }
      } else {
        console.log('K380 Status: Not connected');
      }
      
      this.updateTrayMenu();
      return k380Found;
      
    } catch (error) {
      console.error('Check K380 connection error:', error);
      this.isK380Connected = false;
      this.notifyRendererOfStatusChange(false);
      this.updateTrayMenu();
      return false;
    }
  }

  notifyRendererOfStatusChange(isConnected) {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('k380-status-changed', isConnected);
    });
  }

  setupIPC() {
    ipcMain.handle('get-k380-status', () => {
      return this.isK380Connected;
    });

    ipcMain.handle('check-k380-connection', async () => {
      return await this.checkK380Connection();
    });

    ipcMain.handle('apply-k380-settings', async (event, enabled) => {
      this.store.set('fnKeysEnabled', enabled);
      await this.applySettings();
    });
    
    // 新增的IPC处理程序
    ipcMain.handle('toggle-auto-start', async (event, enabled) => {
      return await this.handleToggleAutoStart(enabled);
    });
    
    ipcMain.handle('check-permissions', async () => {
      return await this.checkHIDPermissionStatus();
    });
    
    ipcMain.on('update-show-window-setting', (event, enabled) => {
      this.store.set('showWindowOnStart', enabled);
      this.shouldShowWindowOnStart = enabled;
      this.updateTrayMenu();
    });
    
    ipcMain.on('update-auto-apply-setting', (event, enabled) => {
      this.store.set('autoApply', enabled);
      this.updateTrayMenu();
      
      if (enabled) {
        this.startBluetoothMonitoring();
      } else {
        this.stopBluetoothMonitoring();
      }
    });
    
    ipcMain.on('update-password-cache-time', (event, time) => {
      this.store.set('passwordCacheTime', time);
      this.clearPasswordCache(); // 清除当前缓存
      this.updateTrayMenu();
    });
    
    ipcMain.on('open-system-settings', () => {
      this.openSystemSettingsForPermissions();
    });
    
    // 新增的IPC监听器
    ipcMain.on('update-skip-permission-check', (event, enabled) => {
      this.store.set('skipStartupPermissionCheck', enabled);
      console.log('Skip permission check setting updated:', enabled);
    });
    
    ipcMain.on('update-show-dock-icon', (event, enabled) => {
      this.store.set('showDockIcon', enabled);
      this.updateDockIcon(enabled);
      console.log('Dock icon setting updated:', enabled);
    });
    
    ipcMain.on('update-show-tray-icon', (event, enabled) => {
      this.store.set('showTrayIcon', enabled);
      this.updateTrayIcon(enabled);
      console.log('Tray icon setting updated:', enabled);
    });

    ipcMain.on('update-persistent-password-cache', (event, enabled) => {
      this.store.set('persistentPasswordCache', enabled);
      this.persistentPasswordCache = enabled;
      
      // 如果用户禁用了持久化密码缓存，清除已保存的持久化缓存
      if (!enabled) {
        this.clearPersistentPassword();
      }
      
      console.log('Persistent password cache setting updated:', enabled);
    });

    // 添加调试信息处理程序
    ipcMain.handle('test-k380-executable', async () => {
      try {
        const k380Path = this.getExecutablePath('k380_improved');
        console.log('🔧 测试K380可执行文件...');
        
        if (!fs.existsSync(k380Path)) {
          return { success: false, error: 'K380 executable not found', path: k380Path };
        }
        
        const stats = fs.statSync(k380Path);
        const hasExecutePermission = (stats.mode & parseInt('111', 8)) !== 0;
        
        return {
          success: true,
          path: k380Path,
          permissions: stats.mode.toString(8),
          hasExecutePermission,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('get-debug-info', async () => {
      return {
        isPackaged: app.isPackaged,
        execPath: process.execPath,
        resourcesPath: process.resourcesPath,
        isK380Connected: this.isK380Connected,
        lastAppliedState: this.lastAppliedState,
        monitoringActive: this.monitoringActive,
        persistentPasswordCache: this.persistentPasswordCache,
        fnKeysEnabled: this.store.get('fnKeysEnabled', true),
        platform: process.platform,
        arch: process.arch,
        version: {
          node: process.version,
          electron: process.versions.electron
        }
      };
    });

    ipcMain.handle('get-debug-logs', async () => {
      return this.debugLogs;
    });

    ipcMain.handle('clear-debug-logs', async () => {
      this.debugLogs = [];
      return true;
    });
  }
  
  async handleToggleAutoStart(enabled) {
    try {
      if (enabled) {
        await this.autoLauncher.enable();
      } else {
        await this.autoLauncher.disable();
      }
      
      this.store.set('autoStart', enabled);
      this.updateTrayMenu();
      
      return { success: true };
    } catch (error) {
      console.error('Toggle auto start error:', error);
      throw error;
    }
  }
  
  openSystemSettingsForPermissions() {
    try {
      const macosVersion = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
      const majorVersion = parseInt(macosVersion.split('.')[0]);
      
      if (majorVersion >= 13) {
        shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension');
      } else {
        shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent');
      }
    } catch (error) {
      console.error('Failed to open system settings:', error);
    }
  }

  updateDockIcon(enabled) {
    try {
      if (process.platform === 'darwin') {
        if (enabled) {
          app.dock.show();
          console.log('Dock icon shown');
        } else {
          app.dock.hide();
          console.log('Dock icon hidden');
        }
      }
    } catch (error) {
      console.error('Failed to update dock icon:', error);
    }
  }

  updateTrayIcon(enabled) {
    try {
      if (enabled) {
        if (!this.tray) {
          this.createTray();
          console.log('Tray icon created and shown');
        }
      } else {
        // 安全检查：如果要隐藏托盘图标，确保Dock图标是显示的
        const showDockIcon = this.store.get('showDockIcon', false);
        if (!showDockIcon) {
          console.warn('Cannot hide tray icon when dock icon is also hidden. Enabling dock icon for accessibility.');
          this.updateDockIcon(true);
          this.store.set('showDockIcon', true);
          
          // 通知前端更新UI状态
          BrowserWindow.getAllWindows().forEach(window => {
            window.webContents.send('force-dock-icon-enabled');
          });
          
          this.showNotification(
            '安全提示', 
            '为确保能够访问应用，已自动显示Dock图标'
          );
        }
        
        if (this.tray) {
          this.tray.destroy();
          this.tray = null;
          console.log('Tray icon hidden');
        }
      }
    } catch (error) {
      console.error('Failed to update tray icon:', error);
    }
  }

  async testHIDAccess() {
    return new Promise(async (resolve) => {
      const testHidPath = this.getExecutablePath('test_hid');
      
      if (!fs.existsSync(testHidPath)) {
        resolve({ 
          success: false, 
          error: 'test_hid executable not found',
          k380Found: false,
          hasPermission: false 
        });
        return;
      }

      exec(`"${testHidPath}"`, (error, stdout, stderr) => {
        if (!error) {
          const hasPermission = !stdout.includes('not permitted') && !stdout.includes('privilege violation');
          const k380Found = stdout.includes('*** FOUND K380! ***');
          const successfulOpen = stdout.includes('Successfully opened K380!');
          
          resolve({ 
            success: hasPermission && successfulOpen, 
            k380Found: k380Found,
            hasPermission: hasPermission,
            successfulOpen: successfulOpen,
            output: stdout 
          });
          return;
        }
        
        resolve({ 
          success: false, 
          error: error.message,
          needsPermission: stderr.includes('not permitted') || stdout.includes('not permitted') || 
                          stderr.includes('privilege violation') || stdout.includes('privilege violation') ||
                          error.message.includes('not permitted') || error.message.includes('unable to open device'),
          k380Found: stdout.includes('*** FOUND K380! ***'),
          hasPermission: false,
          output: stdout || error.message
        });
      });
    });
  }

  // 新增：专门用于前端的权限检查方法，只返回状态不显示弹窗
  async checkHIDPermissionStatus() {
    try {
      const testHidPath = this.getExecutablePath('test_hid');
      
      if (!fs.existsSync(testHidPath)) {
        console.warn('test_hid not found, assuming permissions are OK');
        return { 
          success: true, 
          k380Found: this.isK380Connected,
          hasPermission: true,
          message: 'test_hid不存在，跳过权限检查'
        };
      }

      return new Promise((resolve) => {
        exec(`"${testHidPath}"`, (error, stdout, stderr) => {
          const k380Found = stdout.includes('*** FOUND K380! ***') || stdout.includes('K380 found: YES');
          const successfulOpen = stdout.includes('Successfully opened K380!');
          const hasPermissionError = stderr.includes('privilege violation') || 
                                   stdout.includes('privilege violation') ||
                                   (error && error.message.includes('not permitted'));
          
          console.log('Permission check details:', {
            k380Found,
            successfulOpen,
            hasPermissionError,
            error: error?.message,
            stdout: stdout.slice(-200), // 最后200字符
            stderr: stderr.slice(-200)
          });
          
          if (!error && successfulOpen) {
            // 完全成功 - K380找到且能直接访问
            resolve({ 
              success: true, 
              k380Found: k380Found,
              hasPermission: true,
              message: 'HID权限正常，可直接访问K380'
            });
          } else if (k380Found && hasPermissionError) {
            // K380找到但需要权限 - 这是正常情况，功能仍然可用（通过sudo）
            resolve({ 
              success: true, 
              k380Found: k380Found,
              hasPermission: false,
              needsPassword: true,
              message: 'K380已找到，功能正常（需要管理员密码）'
            });
          } else if (k380Found && error) {
            // K380找到但其他错误
            resolve({ 
              success: false, 
              k380Found: k380Found,
              hasPermission: true,
              message: 'K380已找到但访问失败：' + (error.message || '未知错误')
            });
          } else {
            // K380未找到
            resolve({ 
              success: false, 
              k380Found: false,
              hasPermission: true,
              message: 'K380设备未找到，请检查蓝牙连接'
            });
          }
        });
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return { 
        success: false, 
        error: error.message,
        message: '权限检查失败：' + error.message
      };
    }
  }

  async checkPermissionsAndShowGuide() {
    const hidResult = await this.testHIDAccess();
    
    console.log('HID Permission Test Result:', {
      success: hidResult.success,
      k380Found: hidResult.k380Found,
      hasPermission: hidResult.hasPermission,
      needsPermission: hidResult.needsPermission
    });
    
    if (!hidResult.success) {
      this.showPermissionGuide(hidResult);
    } else {
      dialog.showMessageBox({
        type: 'info',
        title: 'K380 权限检查',
        message: '权限设置正常',
        detail: 'K380 设备权限已正确配置，可以正常使用所有功能。',
        buttons: ['确定']
      });
    }
    
    return hidResult;
  }

  showPermissionGuide(hidResult) {
    const appPath = app.isPackaged ? process.execPath : path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app');
    
    let message, detail;
    
    if (hidResult.k380Found && hidResult.needsPermission) {
      message = 'K380 已检测到，但访问权限被拒绝';
      detail = `
权限设置步骤：

1. 打开"系统设置" → "隐私与安全性" → "输入监控"
   (macOS 13+) 或 "系统偏好设置" → "安全性与隐私" → "隐私" → "输入监控"

2. 点击左下角锁图标，输入管理员密码

3. 点击"+"按钮，添加以下应用：
   ${appPath}

4. 确保应用已勾选

5. 完全退出并重启此应用

🔄 如果权限已设置但仍有问题：
- 尝试重启系统
- 删除应用后重新添加权限
- 检查是否添加了正确的应用路径

技术详情：${hidResult.error || '权限检查完成'}
      `;
    } else if (!hidResult.k380Found) {
      message = 'K380 设备未检测到';
      detail = `
请检查：
1. K380 是否已通过蓝牙配对并连接
2. 设备是否在系统蓝牙设置中显示为"已连接"
3. 尝试重新配对设备

当前蓝牙状态：${this.isK380Connected ? '已连接' : '未连接'}
      `;
    } else {
      message = '未知权限问题';
      detail = `
技术详情：
${hidResult.error || 'Unknown error'}

请尝试：
1. 重启应用
2. 重启系统
3. 重新配对 K380 设备
      `;
    }

    dialog.showMessageBox({
      type: 'warning',
      title: 'K380 权限设置',
      message: message,
      detail: detail,
      buttons: ['了解', '打开系统设置', '重启应用', '稍后'],
    }).then((result) => {
      if (result.response === 1) {
        const macosVersion = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
        const majorVersion = parseInt(macosVersion.split('.')[0]);
        
        if (majorVersion >= 13) {
          shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension');
        } else {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent');
        }
      } else if (result.response === 2) {
        app.relaunch();
        app.exit();
      }
    });
  }

  startBluetoothMonitoring() {
    if (this.monitoringActive || !this.store.get('autoApply', true)) {
      return;
    }
    
    this.monitoringActive = true;
    console.log('Starting Bluetooth monitoring...');
    
    this.checkK380Connection();
    
    this.bluetoothCheckInterval = setInterval(() => {
      this.checkK380Connection();
    }, 30000);
  }

  stopBluetoothMonitoring() {
    if (this.bluetoothCheckInterval) {
      clearInterval(this.bluetoothCheckInterval);
      this.bluetoothCheckInterval = null;
    }
    this.monitoringActive = false;
    console.log('Bluetooth monitoring stopped');
  }

  showMainWindow() {
    if (!this.mainWindow) {
      this.createMainWindow();
    }
    
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 500,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      title: 'K380 Function Keys Manager',
      resizable: false,
      minimizable: false,
      show: false
    });

    this.mainWindow.loadFile(path.join(__dirname, 'renderer.html'));

    // 在开发模式或调试模式下自动打开开发者工具
    if (!app.isPackaged || process.env.DEBUG === 'true') {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.mainWindow.hide();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    this.mainWindow.webContents.once('did-finish-load', () => {
      this.notifyRendererOfStatusChange(this.isK380Connected);
    });
  }

  showBuildInstructions() {
    dialog.showMessageBox({
      type: 'info',
      title: '构建正式版本',
      message: '如何构建 K380 Manager 正式版本',
      detail: `当前您正在使用开发版本，无法设置开机自启动。

构建步骤：
1. 运行构建命令：
   npm run build

2. 安装构建后的应用：
   在 dist 文件夹中找到 .dmg 文件并安装

3. 在正式版本中设置开机自启动

构建后即可在正式版本中设置开机自启动功能。`,
      buttons: ['了解']
    });
  }

  showAbout() {
    dialog.showMessageBox({
      type: 'info',
      title: '关于 K380 Function Keys Manager',
      message: 'K380 Function Keys Manager',
      detail: `版本: 1.0.0\n\n用于管理罗技 K380 蓝牙键盘的 Fn 键行为。`,
      buttons: ['确定', '查看项目主页'],
    }).then((result) => {
      if (result.response === 1) {
        shell.openExternal('https://github.com/XiaoDcs/k380-function-keys-manager');
      }
    });
  }

  showNotification(title, body) {
    if (this.tray) {
      this.tray.displayBalloon({
        title: title,
        content: body
      });
    }
  }

  cleanup() {
    console.log('Starting cleanup process...');
    
    // 停止蓝牙监控
    this.stopBluetoothMonitoring();
    
    // 清除密码缓存（但保留持久化缓存）
    this.clearPasswordCache(false);
    
    // 销毁托盘图标
    if (this.tray) {
      console.log('Destroying tray icon...');
      this.tray.destroy();
      this.tray = null;
    }
    
    // 关闭主窗口
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      console.log('Closing main window...');
      this.mainWindow.removeAllListeners(); // 移除所有监听器
      this.mainWindow.destroy();
      this.mainWindow = null;
    }
    
    // 清理IPC监听器
    if (this.isQuitting) {
      console.log('Removing IPC listeners...');
      ipcMain.removeAllListeners();
    }
    
    // 标记清理完成
    console.log('Cleanup completed');
  }

  // 添加调试日志方法
  addDebugLog(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this.debugLogs.push(logEntry);
    
    // 只保留最近的100条日志
    if (this.debugLogs.length > 100) {
      this.debugLogs = this.debugLogs.slice(-100);
    }
    
    // 发送到前端显示
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('debug-log', logEntry);
    }
    
    // 同时输出到控制台
    console.log(message);
  }
}

let k380Manager = null;

// 启用远程模块（兼容性）
app.allowRendererProcessReuse = false;

// 禁用 Electron 的某些警告
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

app.whenReady().then(async () => {
  k380Manager = new K380Manager();
  
  // 根据设置初始化Dock图标
  k380Manager.updateDockIcon(k380Manager.showDockIcon);
  
  // 根据设置创建托盘图标
  if (k380Manager.showTrayIcon) {
    k380Manager.createTray();
  }
  
  // 在tray创建完成后启动蓝牙监控
  k380Manager.startBluetoothMonitoring();
  
  // 根据设置决定是否显示主窗口
  if (k380Manager.shouldShowWindowOnStart) {
    k380Manager.showMainWindow();
  }
});

app.on('window-all-closed', (event) => {
  // 在 macOS 上，即使所有窗口关闭，应用通常仍保持活跃状态
  // 但如果没有托盘图标，则应该退出应用
  if (process.platform !== 'darwin' || !k380Manager?.tray) {
    if (k380Manager) {
      k380Manager.cleanup();
    }
    app.quit();
  }
});

app.on('before-quit', (event) => {
  console.log('App is about to quit, cleaning up...');
  if (k380Manager) {
    k380Manager.isQuitting = true; // 标记正在退出
    k380Manager.cleanup();
  }
});

app.on('will-quit', (event) => {
  console.log('App will quit, final cleanup...');
  if (k380Manager) {
    k380Manager.cleanup();
  }
}); 