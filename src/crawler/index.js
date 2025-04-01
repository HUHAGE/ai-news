/**
 * AI新闻爬虫主程序
 * 负责协调爬取任务、解析内容和存储数据
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const parser = require('./parser');
const storage = require('./storage');
const moment = require('moment');

// 创建自定义的 axios 实例
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://www.google.com/',
    'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  },
  // 忽略 SSL 证书错误
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
});

// 爬虫类
class NewsCrawler {
  constructor() {
    this.sites = [];
    this.results = [];
    this.loadSites();
  }

  /**
   * 加载配置的网站
   */
  loadSites() {
    try {
      const sitesPath = path.join(__dirname, '../../config/sites.json');
      const sitesData = fs.readFileSync(sitesPath, 'utf8');
      this.sites = JSON.parse(sitesData);
      console.log(`成功加载 ${this.sites.length} 个网站配置`);
    } catch (error) {
      console.error('加载网站配置失败:', error.message);
      this.sites = [];
    }
  }

  /**
   * 开始爬取所有配置的网站
   * @returns {Promise<Array>} 爬取结果数组
   */
  async crawlAll() {
    this.results = [];
    console.log('开始爬取所有网站...');
    
    for (const site of this.sites) {
      try {
        console.log(`=============================================`);
        console.log(`正在爬取: ${site.name} (${site.url})`);
        const siteResults = await this.crawlSite(site);
        
        if (siteResults.length > 0) {
          this.results = [...this.results, ...siteResults];
          console.log(`从 ${site.name} 成功爬取 ${siteResults.length} 条新闻`);
        } else {
          console.log(`从 ${site.name} 未爬取到任何新闻，尝试打印网页内容片段以辅助调试`);
          // 这里可以尝试再次抓取并打印部分内容来辅助调试
          await this.debugSite(site);
        }
        
        // 爬取间隔，避免频繁请求
        await this.sleep(2000 + Math.random() * 3000); // 随机间隔2-5秒
      } catch (error) {
        console.error(`爬取 ${site.name} 失败:`, error.message);
      }
    }

    // 存储结果
    if (this.results.length > 0) {
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `news_${timestamp}.json`;
      await storage.saveToJSON(this.results, filename);
      
      console.log(`爬取完成，共获取 ${this.results.length} 条新闻`);
    } else {
      console.log('未爬取到任何新闻，请检查网站配置和网络连接');
    }
    
    return this.results;
  }

  /**
   * 辅助调试某个网站
   * @param {Object} site 网站配置
   */
  async debugSite(site) {
    try {
      const response = await axiosInstance.get(site.url);
      if (response.status === 200) {
        const html = response.data;
        
        // 打印HTML片段
        console.log("HTML内容片段:");
        console.log(html.substring(0, 1000) + "...");
        
        // 查找实际存在的容器
        const $ = require('cheerio').load(html);
        
        // 尝试一些常见的容器
        const containers = [
          'div.article', 'div.news-item', 'div.item', 'li.item', 
          'div.card', 'div.post', 'article', '.article-list > *',
          '.news-list > *', '.list > *'
        ];
        
        console.log("尝试查找可能的容器:");
        for (const selector of containers) {
          const count = $(selector).length;
          if (count > 0) {
            console.log(`找到可能的容器: ${selector} (${count}个)`);
          }
        }
      }
    } catch (error) {
      console.error(`调试 ${site.name} 失败:`, error.message);
    }
  }

  /**
   * 爬取单个网站
   * @param {Object} site 网站配置
   * @returns {Promise<Array>} 该网站的爬取结果
   */
  async crawlSite(site) {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // 获取网页内容
        console.log(`尝试获取 ${site.name} 的网页内容 (尝试 ${retries + 1}/${maxRetries})`);
        
        const response = await axiosInstance.get(site.url);
        
        if (response.status === 200) {
          console.log(`成功获取 ${site.name} 的网页内容，内容长度: ${response.data.length}`);
          
          // 解析新闻内容
          const newsItems = parser.parseNewsFromHtml(response.data, site);
          
          // 为每条新闻添加来源信息
          return newsItems.map(item => ({
            ...item,
            source: item.source || site.name,
            sourceUrl: site.url
          }));
        } else {
          throw new Error(`HTTP状态码: ${response.status}`);
        }
      } catch (error) {
        retries++;
        console.error(`爬取 ${site.name} 出错 (尝试 ${retries}/${maxRetries}):`, error.message);
        
        if (retries < maxRetries) {
          // 等待一段时间后重试
          const delay = 3000 * retries + Math.random() * 2000; // 增加随机性
          console.log(`将在 ${Math.round(delay/1000)} 秒后重试...`);
          await this.sleep(delay);
        } else {
          console.error(`已达到最大重试次数，放弃爬取 ${site.name}`);
          return [];
        }
      }
    }
    
    return [];
  }

  /**
   * 获取最近的爬取结果
   * @returns {Array} 最近的爬取结果
   */
  getResults() {
    return this.results;
  }
  
  /**
   * 延迟函数
   * @param {number} ms 延迟毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NewsCrawler(); 