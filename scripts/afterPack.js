const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  console.log('AfterPack: Setting executable permissions and signing...');
  
  const appPath = context.appOutDir;
  const appName = 'K380 Function Keys Manager.app';
  const appFullPath = path.join(appPath, appName);
  const resourcesPath = path.join(appFullPath, 'Contents', 'Resources');
  
  console.log('AfterPack: App path:', appPath);
  console.log('AfterPack: App full path:', appFullPath);
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
        // 设置执行权限
        fs.chmodSync(filePath, 0o755);
        console.log(`AfterPack: Set executable permission for ${binFile}`);
        
        // 清除隔离属性
        try {
          execSync(`xattr -d com.apple.quarantine "${filePath}" 2>/dev/null || true`);
          console.log(`AfterPack: Cleared quarantine attribute for ${binFile}`);
        } catch (error) {
          console.log(`AfterPack: No quarantine attribute to clear for ${binFile}`);
        }
        
        // 进行临时代码签名（ad-hoc signing）
        try {
          execSync(`codesign --force --deep --sign - "${filePath}"`, { stdio: 'inherit' });
          console.log(`AfterPack: Ad-hoc signed ${binFile}`);
        } catch (error) {
          console.warn(`AfterPack: Failed to ad-hoc sign ${binFile}:`, error.message);
        }
        
      } catch (error) {
        console.warn(`AfterPack: Failed to set permission for ${binFile}:`, error.message);
      }
    } else {
      console.warn(`AfterPack: ${binFile} not found at ${filePath}`);
    }
  }
  
  // 设置动态库权限并签名
  const dylibPath = path.join(resourcesPath, 'bin', 'libhidapi.0.dylib');
  if (fs.existsSync(dylibPath)) {
    try {
      fs.chmodSync(dylibPath, 0o644);
      console.log('AfterPack: Set permission for libhidapi.0.dylib');
      
      // 清除隔离属性
      try {
        execSync(`xattr -d com.apple.quarantine "${dylibPath}" 2>/dev/null || true`);
      } catch (error) {
        console.log('AfterPack: No quarantine attribute to clear for dylib');
      }
      
      // 签名动态库
      try {
        execSync(`codesign --force --sign - "${dylibPath}"`, { stdio: 'inherit' });
        console.log('AfterPack: Ad-hoc signed libhidapi.0.dylib');
      } catch (error) {
        console.warn('AfterPack: Failed to sign dylib:', error.message);
      }
    } catch (error) {
      console.warn('AfterPack: Failed to process dylib:', error.message);
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
  
  // 对整个应用进行临时签名
  try {
    console.log('AfterPack: Performing ad-hoc signing for the entire app...');
    execSync(`codesign --force --deep --sign - "${appFullPath}"`, { stdio: 'inherit' });
    console.log('AfterPack: Successfully ad-hoc signed the entire app');
  } catch (error) {
    console.warn('AfterPack: Failed to sign the entire app:', error.message);
  }
  
  // 清除应用的隔离属性
  try {
    execSync(`xattr -dr com.apple.quarantine "${appFullPath}" 2>/dev/null || true`);
    console.log('AfterPack: Cleared quarantine attributes from app');
  } catch (error) {
    console.log('AfterPack: No quarantine attributes to clear from app');
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
  
  console.log('AfterPack: Finished setting permissions and signing');
}; 