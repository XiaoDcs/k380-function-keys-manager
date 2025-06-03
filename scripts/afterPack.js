const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  console.log('AfterPack: Setting executable permissions...');
  
  const appPath = context.appOutDir;
  const appName = 'K380 Function Keys Manager.app';
  const resourcesPath = path.join(appPath, appName, 'Contents', 'Resources');
  
  console.log('AfterPack: App path:', appPath);
  console.log('AfterPack: Resources path:', resourcesPath);
  
  // extraResources 会创建 Resources/bin/ 目录结构
  const binFiles = [
    'bin/k380',
    'bin/k380_improved', 
    'bin/test_hid'
  ];
  
  for (const binFile of binFiles) {
    const filePath = path.join(resourcesPath, binFile);
    if (fs.existsSync(filePath)) {
      try {
        fs.chmodSync(filePath, 0o755);
        console.log(`AfterPack: Set executable permission for ${binFile}`);
      } catch (error) {
        console.warn(`AfterPack: Failed to set permission for ${binFile}:`, error.message);
      }
    } else {
      console.warn(`AfterPack: ${binFile} not found at ${filePath}`);
    }
  }
  
  // 设置shell脚本权限
  const scripts = [
    'tools/build_improved.sh',
    'tools/build_Apple_Silicon.sh',
    'tools/test_permissions.sh',
    'tools/fix_permissions.sh',
    'tools/quick_test.sh'
  ];
  
  for (const script of scripts) {
    const filePath = path.join(resourcesPath, script);
    if (fs.existsSync(filePath)) {
      try {
        fs.chmodSync(filePath, 0o755);
        console.log(`AfterPack: Set executable permission for ${script}`);
      } catch (error) {
        console.warn(`AfterPack: Failed to set permission for ${script}:`, error.message);
      }
    }
  }
  
  // 列出实际的文件结构以调试
  console.log('AfterPack: Listing Resources directory...');
  try {
    const files = fs.readdirSync(resourcesPath);
    console.log('AfterPack: Files in Resources:', files);
    
    // 检查是否有 bin 目录
    const binDir = path.join(resourcesPath, 'bin');
    if (fs.existsSync(binDir)) {
      const binFiles = fs.readdirSync(binDir);
      console.log('AfterPack: Files in Resources/bin:', binFiles);
    } else {
      console.warn('AfterPack: bin directory not found in Resources');
    }
  } catch (error) {
    console.warn('AfterPack: Failed to list directory:', error.message);
  }
  
  console.log('AfterPack: Finished setting permissions');
}; 