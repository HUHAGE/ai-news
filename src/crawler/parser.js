/**
 * 解析器模块
 * 负责从HTML内容中提取新闻信息
 */

const cheerio = require('cheerio');

/**
 * 从HTML内容中解析新闻
 * @param {string} html HTML内容
 * @param {Object} site 网站配置信息，包含选择器
 * @returns {Array} 解析出的新闻数组
 */
function parseNewsFromHtml(html, site) {
  try {
    console.log(`开始解析 ${site.name} 的HTML内容`);
    const $ = cheerio.load(html);
    const newsItems = [];
    const selectors = site.selectors;
    
    // 调试信息：检查容器是否存在
    const containerElements = $(selectors.container);
    const containerCount = containerElements.length;
    console.log(`在 ${site.name} 中找到 ${containerCount} 个容器元素`);
    
    // 如果没有找到容器，尝试使用更通用的选择器
    if (containerCount === 0) {
      console.log(`尝试使用备用选择器查找容器...`);
      // 打印页面标题帮助调试
      console.log(`页面标题: ${$('title').text()}`);
      
      // 尝试一些通用的选择器
      const backupSelectors = [
        'div.article-item', 'div.news-item', 'div.post-item', 'div.article',
        'li.article', 'div.card', 'article', '.article-list > *', '.content-list > *',
        '.news-list > *', '.list > *'
      ];
      
      for (const selector of backupSelectors) {
        const count = $(selector).length;
        if (count > 0) {
          console.log(`使用备用选择器 "${selector}" 找到 ${count} 个容器元素`);
          // 使用找到的第一个有效的备选选择器
          return parseWithSelector(html, site, selector, $);
        }
      }
      
      console.log(`无法找到任何适合的容器选择器`);
      return [];
    }
    
    // 查找所有新闻容器
    containerElements.each((index, element) => {
      try {
        const $element = $(element);
        
        // 提取新闻各项属性
        let title = extractContent($element, selectors.title, $);
        let summary = extractContent($element, selectors.summary, $);
        let date = extractContent($element, selectors.date, $);
        let author = extractContent($element, selectors.author, $);
        let source = extractContent($element, selectors.source, $) || site.name;
        
        // 调试信息
        if (title) {
          console.log(`[${index}] 标题: ${title.length > 30 ? title.substring(0, 30) + '...' : title}`);
        } else {
          console.log(`[${index}] 未找到标题，打印容器内容片段:`);
          console.log($element.html().substring(0, 200) + '...');
        }
        
        // 提取链接
        let url = extractUrl($element, selectors.link, site.url, $);
        console.log(`[${index}] 链接: ${url || '未找到'}`);
        
        // 确保标题存在且不为空
        if (title && title.trim() !== '') {
          newsItems.push({
            title: title.trim(),
            summary: summary ? summary.trim() : '',
            date: date ? date.trim() : '',
            author: author ? author.trim() : '',
            source: source ? source.trim() : site.name,
            url: url ? url.trim() : ''
          });
        }
      } catch (err) {
        console.error(`解析 ${site.name} 的第 ${index + 1} 个新闻项失败:`, err.message);
      }
    });
    
    console.log(`从 ${site.name} 成功解析出 ${newsItems.length} 条新闻`);
    return newsItems;
  } catch (error) {
    console.error(`解析 ${site.name} 的HTML失败:`, error.message);
    return [];
  }
}

/**
 * 使用特定的选择器解析新闻
 * @param {string} html HTML内容
 * @param {Object} site 网站配置
 * @param {string} containerSelector 容器选择器
 * @param {Object} $ Cheerio实例
 * @returns {Array} 解析出的新闻数组
 */
function parseWithSelector(html, site, containerSelector, $) {
  if (!$) {
    $ = cheerio.load(html);
  }
  
  const newsItems = [];
  const containers = $(containerSelector);
  
  containers.each((index, element) => {
    try {
      const $element = $(element);
      
      // 尝试找到标题和链接
      let title = '';
      let url = '';
      
      // 尝试多种常见标题选择器
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4', '.title', '.headline', 
        '[class*="title"]', '[class*="headline"]', 'a[title]'
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = $element.find(selector).first();
        if (titleElement.length > 0) {
          title = titleElement.text().trim();
          
          // 尝试从标题元素获取链接
          if (titleElement.is('a')) {
            url = titleElement.attr('href');
          } else {
            const linkElement = titleElement.find('a').first();
            if (linkElement.length > 0) {
              url = linkElement.attr('href');
            }
          }
          
          if (title) break;
        }
      }
      
      // 如果还没找到链接，尝试找链接
      if (!url) {
        const linkElement = $element.find('a').first();
        if (linkElement.length > 0) {
          url = linkElement.attr('href');
        }
      }
      
      // 处理相对URL
      url = normalizeUrl(url, site.url);
      
      // 尝试找摘要
      let summary = '';
      const summarySelectors = [
        'p', '.summary', '.desc', '[class*="summary"]', '[class*="desc"]'
      ];
      
      for (const selector of summarySelectors) {
        const summaryElement = $element.find(selector).first();
        if (summaryElement.length > 0) {
          summary = summaryElement.text().trim();
          if (summary) break;
        }
      }
      
      // 如果找到标题，添加到结果
      if (title) {
        console.log(`[备选${index}] 标题: ${title.length > 30 ? title.substring(0, 30) + '...' : title}`);
        console.log(`[备选${index}] 链接: ${url || '未找到'}`);
        
        newsItems.push({
          title: title,
          summary: summary || '',
          date: '',
          author: '',
          source: site.name,
          url: url || ''
        });
      }
    } catch (err) {
      console.error(`备选解析失败:`, err.message);
    }
  });
  
  console.log(`使用备选选择器 ${containerSelector} 解析出 ${newsItems.length} 条新闻`);
  return newsItems;
}

/**
 * 规范化URL，处理相对路径
 * @param {string} url URL或相对路径
 * @param {string} baseUrl 基础URL
 * @returns {string} 规范化后的URL
 */
function normalizeUrl(url, baseUrl) {
  if (!url) return '';
  
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    const base = new URL(baseUrl);
    
    if (url.startsWith('//')) {
      return `${base.protocol}${url}`;
    } else if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`;
    } else {
      let basePath = base.pathname;
      if (!basePath.endsWith('/')) {
        basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
      }
      return `${base.protocol}//${base.host}${basePath}${url}`;
    }
  } catch (error) {
    console.error(`规范化URL失败: ${url}`, error.message);
    return url;
  }
}

/**
 * 从元素中提取内容
 * @param {Object} $element jQuery元素
 * @param {string} selector 选择器
 * @param {Object} $ Cheerio实例
 * @returns {string} 提取的内容
 */
function extractContent($element, selector, $) {
  if (!selector) return '';
  
  try {
    const found = $element.find(selector);
    if (found.length === 0) return '';
    
    return found.text().trim();
  } catch (error) {
    console.error(`提取内容失败 (${selector}):`, error.message);
    return '';
  }
}

/**
 * 从元素中提取URL
 * @param {Object} $element jQuery元素
 * @param {string} selector 选择器
 * @param {string} baseUrl 基础URL
 * @param {Object} $ Cheerio实例
 * @returns {string} 提取的URL
 */
function extractUrl($element, selector, baseUrl, $) {
  if (!selector) return '';
  
  try {
    const linkElements = $element.find(selector);
    if (linkElements.length === 0) return '';
    
    // 获取href属性
    let url = linkElements.attr('href');
    
    // 如果没有href，可能是包含链接的容器
    if (!url && !linkElements.is('a')) {
      const aElement = linkElements.find('a').first();
      if (aElement.length > 0) {
        url = aElement.attr('href');
      }
    }
    
    // 处理相对URL
    return normalizeUrl(url, baseUrl);
  } catch (error) {
    console.error(`提取URL失败 (${selector}):`, error.message);
    return '';
  }
}

module.exports = {
  parseNewsFromHtml
}; 