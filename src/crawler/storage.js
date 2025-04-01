/**
 * 存储模块
 * 负责将爬取的数据保存到不同格式的文件中
 */

const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');

// 数据目录路径
const DATA_DIR = path.join(__dirname, '../../data');

/**
 * 确保数据目录存在
 */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`创建数据目录: ${DATA_DIR}`);
  }
}

/**
 * 将数据保存为JSON文件
 * @param {Array} data 要保存的数据
 * @param {string} filename 文件名
 * @returns {Promise<string>} 保存的文件路径
 */
async function saveToJSON(data, filename) {
  ensureDataDir();
  
  return new Promise((resolve, reject) => {
    const filePath = path.join(DATA_DIR, filename);
    const jsonData = JSON.stringify(data, null, 2);
    
    fs.writeFile(filePath, jsonData, 'utf8', (err) => {
      if (err) {
        console.error('保存JSON文件失败:', err);
        reject(err);
      } else {
        console.log(`数据已保存为JSON: ${filePath}`);
        resolve(filePath);
      }
    });
  });
}

/**
 * 将数据保存为CSV文件
 * @param {Array} data 要保存的数据
 * @param {string} filename 文件名
 * @returns {Promise<string>} 保存的文件路径
 */
async function saveToCSV(data, filename) {
  ensureDataDir();
  
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(DATA_DIR, filename);
      const fields = ['title', 'summary', 'date', 'author', 'source', 'url'];
      const parser = new Parser({ fields });
      const csv = parser.parse(data);
      
      fs.writeFile(filePath, csv, 'utf8', (err) => {
        if (err) {
          console.error('保存CSV文件失败:', err);
          reject(err);
        } else {
          console.log(`数据已保存为CSV: ${filePath}`);
          resolve(filePath);
        }
      });
    } catch (err) {
      console.error('转换为CSV失败:', err);
      reject(err);
    }
  });
}

/**
 * 将数据保存为TXT文件
 * @param {Array} data 要保存的数据
 * @param {string} filename 文件名
 * @returns {Promise<string>} 保存的文件路径
 */
async function saveToTXT(data, filename) {
  ensureDataDir();
  
  return new Promise((resolve, reject) => {
    const filePath = path.join(DATA_DIR, filename);
    
    // 将每条新闻格式化为文本
    const textContent = data.map((item, index) => {
      return `[${index + 1}] ${item.title}\n` +
        `摘要: ${item.summary || '无'}\n` +
        `日期: ${item.date || '未知'}\n` +
        `作者: ${item.author || '未知'}\n` +
        `来源: ${item.source || '未知'}\n` +
        `链接: ${item.url || '无'}\n` +
        '-------------------------------------------\n';
    }).join('\n');
    
    fs.writeFile(filePath, textContent, 'utf8', (err) => {
      if (err) {
        console.error('保存TXT文件失败:', err);
        reject(err);
      } else {
        console.log(`数据已保存为TXT: ${filePath}`);
        resolve(filePath);
      }
    });
  });
}

/**
 * 获取最新的数据文件
 * @param {string} format 文件格式(json, csv, txt)
 * @returns {Promise<Object>} 包含文件路径和数据的对象
 */
async function getLatestData(format = 'json') {
  ensureDataDir();
  
  return new Promise((resolve, reject) => {
    fs.readdir(DATA_DIR, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      
      // 按扩展名筛选文件
      const extension = format.toLowerCase();
      const filteredFiles = files.filter(file => file.endsWith(`.${extension}`));
      
      if (filteredFiles.length === 0) {
        resolve({ filePath: null, data: [] });
        return;
      }
      
      // 按修改时间排序
      filteredFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(DATA_DIR, a));
        const statB = fs.statSync(path.join(DATA_DIR, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
      
      const latestFile = filteredFiles[0];
      const filePath = path.join(DATA_DIR, latestFile);
      
      fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          let data = [];
          
          if (format === 'json') {
            data = JSON.parse(content);
          } else {
            // 对于其他格式，我们只返回原始内容
            data = content;
          }
          
          resolve({ filePath, data });
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  });
}

module.exports = {
  saveToJSON,
  saveToCSV,
  saveToTXT,
  getLatestData
}; 