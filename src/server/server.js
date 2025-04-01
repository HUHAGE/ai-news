/**
 * Web服务器
 * 提供爬虫的Web界面和API
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crawler = require('../crawler');
const storage = require('../crawler/storage');

const app = express();
const PORT = process.env.PORT || 3000;

// 设置静态文件目录
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

// 新闻展示页面路由
app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/news.html'));
});

// API: 开始爬取
app.post('/api/crawl', async (req, res) => {
  try {
    console.log('收到爬取请求，参数:', req.body);
    
    // 爬取所有配置的网站
    const results = await crawler.crawlAll();
    
    if (results.length === 0) {
      console.log('爬取结果为空，可能是网站结构变化或网络问题');
      res.json({
        success: false,
        message: '未能爬取到任何新闻，请检查网站配置和网络连接',
        count: 0
      });
      return;
    }
    
    // 获取时间戳
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 根据请求中指定的格式保存数据
    const format = req.body.format || 'json';
    let filePath;
    
    switch (format.toLowerCase()) {
      case 'csv':
        filePath = await storage.saveToCSV(results, `news_${timestamp}.csv`);
        break;
      case 'txt':
        filePath = await storage.saveToTXT(results, `news_${timestamp}.txt`);
        break;
      case 'json':
      default:
        filePath = await storage.saveToJSON(results, `news_${timestamp}.json`);
        break;
    }
    
    res.json({
      success: true,
      message: '爬取完成',
      count: results.length,
      filePath,
      format
    });
  } catch (error) {
    console.error('爬虫执行失败:', error);
    res.status(500).json({
      success: false,
      message: '爬虫执行失败: ' + error.message
    });
  }
});

// API: 获取最新数据
app.get('/api/news', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    const result = await storage.getLatestData(format);
    
    if (!result.filePath) {
      console.log('未找到数据文件');
      res.json({
        success: true,
        message: '未找到数据文件',
        filePath: null,
        data: []
      });
      return;
    }
    
    res.json({
      success: true,
      filePath: result.filePath,
      data: result.data
    });
  } catch (error) {
    console.error('获取数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取数据失败: ' + error.message
    });
  }
});

// API: 获取配置的网站列表
app.get('/api/sites', (req, res) => {
  try {
    const configPath = path.join(__dirname, '../../config/sites.json');
    const sitesData = fs.readFileSync(configPath, 'utf8');
    const sites = JSON.parse(sitesData);
    
    res.json({
      success: true,
      sites: sites.map(site => ({
        name: site.name,
        url: site.url
      }))
    });
  } catch (error) {
    console.error('获取网站配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取网站配置失败: ' + error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  console.log(`- 访问主页: http://localhost:${PORT}/`);
  console.log(`- 查看新闻: http://localhost:${PORT}/news`);
}); 