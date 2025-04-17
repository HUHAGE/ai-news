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
const cheerio = require('cheerio');

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

// 预定义的网站特殊处理规则
const SPECIAL_SITES = {
  // 36氪需要特殊处理，是SPA网站
  '36氪AI频道': {
    api: 'https://36kr.com/api/information/web/information/flow?column_ids=1190&per_page=20',
    processResponse: function(response) {
      try {
        const data = response.data;
        if (data && data.data && data.data.items) {
          return data.data.items.map(item => ({
            title: item.title || '',
            summary: item.summary || '',
            date: item.published_at ? moment(item.published_at).format('YYYY-MM-DD HH:mm') : '',
            author: item.author ? item.author.name : '',
            source: '36氪',
            url: `https://36kr.com/p/${item.id}`
          }));
        }
        return [];
      } catch (error) {
        console.error('处理36氪数据失败:', error.message);
        return [];
      }
    }
  },
  // 其他SPA网站也可以在这里添加特殊处理
};

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
          // 这里尝试再次抓取并打印部分内容来辅助调试
          await this.debugSite(site);
        }
        
        // 爬取间隔，避免频繁请求
        const delay = 2000 + Math.random() * 3000; // 随机间隔2-5秒
        console.log(`等待 ${Math.round(delay/1000)} 秒后继续...`);
        await this.sleep(delay); 
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
        const $ = cheerio.load(html);
        
        // 打印页面标题
        console.log(`页面标题: ${$('title').text()}`);
        
        // 检查是否为单页应用(SPA)
        const scriptTags = $('script').length;
        const hasReactOrVue = html.includes('reactjs') || html.includes('vuejs') || html.includes('react.js') || html.includes('vue.js');
        if (scriptTags > 10 || hasReactOrVue) {
          console.log("该网站可能是SPA(单页应用)，需要特殊处理或使用浏览器引擎");
        }
        
        // 尝试分析网页结构，找出可能的新闻容器和选择器
        const possibleContainers = parser.analyzePageStructure(html);
        console.log("可能的新闻容器选择器:", possibleContainers);
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
    // 检查是否有针对该网站的特殊处理
    const specialHandler = SPECIAL_SITES[site.name];
    if (specialHandler) {
      return this.crawlSpecialSite(site, specialHandler);
    }
    
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // 获取网页内容
        console.log(`尝试获取 ${site.name} 的网页内容 (尝试 ${retries + 1}/${maxRetries})`);
        
        // 添加随机查询参数避免缓存
        const url = new URL(site.url);
        url.searchParams.append('_t', Date.now());
        
        const response = await axiosInstance.get(url.toString());
        
        if (response.status === 200) {
          console.log(`成功获取 ${site.name} 的网页内容，内容长度: ${response.data.length}`);
          
          // 使用改进的解析器自动分析网页结构并提取新闻内容
          const newsItems = await parser.parseNewsAutomatically(response.data, site);
          
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
          const delay = 3000 + Math.random() * 2000; // 随机间隔3-5秒
          console.log(`等待 ${Math.round(delay/1000)} 秒后重试...`);
          await this.sleep(delay);
        } else {
          // 达到最大重试次数，放弃该网站
          console.error(`达到最大重试次数 (${maxRetries})，放弃爬取 ${site.name}`);
          return [];
        }
      }
    }
    
    return [];
  }

  /**
   * 爬取需要特殊处理的网站
   * @param {Object} site 网站配置
   * @param {Object} handler 特殊处理器
   * @returns {Promise<Array>} 该网站的爬取结果
   */
  async crawlSpecialSite(site, handler) {
    try {
      console.log(`使用特殊处理器爬取 ${site.name}`);
      
      if (handler.api) {
        console.log(`调用API: ${handler.api}`);
        const response = await axiosInstance.get(handler.api);
        
        if (response.status === 200) {
          console.log(`API响应成功，数据长度: ${JSON.stringify(response.data).length}`);
          
          if (handler.processResponse) {
            const newsItems = handler.processResponse(response);
            console.log(`特殊处理器解析出 ${newsItems.length} 条新闻`);
            return newsItems;
          }
        } else {
          throw new Error(`API状态码: ${response.status}`);
        }
      }
      
      return [];
    } catch (error) {
      console.error(`特殊处理 ${site.name} 失败:`, error.message);
      return [];
    }
  }

  /**
   * 获取爬取结果
   * @returns {Array} 爬取结果数组
   */
  getResults() {
    return this.results;
  }

  /**
   * 休眠函数
   * @param {number} ms 休眠毫秒数
   * @returns {Promise} Promise对象
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NewsCrawler(); 