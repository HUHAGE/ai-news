/**
 * 解析器模块
 * 负责从HTML内容中提取新闻信息
 */

const cheerio = require('cheerio');
const url = require('url');

// 通用备用选择器集合
const BACKUP_SELECTORS = {
  container: [
    'article', 'div.article-item', 'div.news-item', 'div.post-item', 'div.article',
    'li.article', 'div.card', 'article', '.article-list > *', '.content-list > *',
    '.news-list > *', '.list > *', '.articles > *', 'div.news-list-item',
    'div[class*="article"]', 'div[class*="news"]', 'div[class*="post"]',
    'div[class*="item"]', 'div[class*="content"]', '.post', '.blog-entry',
    '.entry', 'div.entry', 'li.item'
  ],
  title: [
    'h1', 'h2', 'h3', 'h4', '.title', '.headline', 'a.title', 
    '[class*="title"]', '[class*="headline"]', '[class*="heading"]',
    'a:has(h2)', 'a:has(h3)', 'a[title]', '.subject', '.topic'
  ],
  summary: [
    'p', '.summary', '.desc', '.description', '.excerpt',
    '[class*="summary"]', '[class*="desc"]', '[class*="content"]',
    '.text', '.intro', '.abstract'
  ],
  date: [
    '.date', '.time', '.pubdate', '.timestamp', '.datetime',
    '[class*="date"]', '[class*="time"]', '[class*="publish"]',
    'time', '[datetime]', '.meta time', 'span.date', 'div.date'
  ],
  author: [
    '.author', '.writer', '.by', '.byline', 
    '[class*="author"]', '[class*="by"]', '[rel="author"]',
    '.meta .author', 'a[rel="author"]'
  ],
  link: [
    'a', 'a.title', 'a.more', 'a.read-more', 'a.link',
    'h2 a', 'h3 a', 'h4 a', '.title a', '.headline a',
    '[class*="title"] a', '[class*="headline"] a'
  ]
};

// 关键词提示，用于识别新闻内容
const NEWS_KEYWORDS = [
  'news', '新闻', 'article', '文章', 'post', '博客', 'blog', 
  '资讯', '报道', '最新', 'latest', 'recent', '消息', 'content',
  '研究', 'research', '发布', 'release', '动态', 'update', 
  'AI', '智能', '算法', 'GPT', '大模型', 'LLM', '机器学习', 
  '深度学习', '神经网络', '人工智能', '模型', 'model'
];

/**
 * 自动分析网页结构，找出可能的新闻容器和各字段选择器
 * @param {string} html HTML内容
 * @returns {Object} 分析结果，包含可能的选择器
 */
function analyzePageStructure(html) {
  const $ = cheerio.load(html);
  
  // 分析结果
  const result = {
    containerSelectors: [],
    titleSelectors: {},
    summarySelectors: {},
    dateSelectors: {},
    authorSelectors: {},
    linkSelectors: {}
  };
  
  // 1. 查找可能的容器
  console.log('开始分析网页结构...');
  
  // 获取所有可能的容器选择器
  const scoreMap = new Map();
  
  // 首先尝试已知的常见容器选择器
  for (const selector of BACKUP_SELECTORS.container) {
    const elements = $(selector);
    const count = elements.length;
    
    if (count >= 3 && count <= 30) {
      // 可能是新闻列表容器，进一步评分
      const score = evaluateContainerCandidate($, selector, elements);
      if (score > 0) {
        scoreMap.set(selector, { score, count });
      }
    }
  }
  
  // 如果没有找到可能的容器，尝试通过分析DOM结构来寻找
  if (scoreMap.size === 0) {
    console.log('没有找到常见容器，尝试通过DOM结构分析...');
    findPotentialContainers($, scoreMap);
  }
  
  // 按分数排序
  const sortedContainers = [...scoreMap.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([selector, info]) => ({ 
      selector, 
      score: info.score, 
      count: info.count
    }));
  
  // 取前三名作为可能的容器
  result.containerSelectors = sortedContainers.slice(0, 3);
  
  console.log(`找到 ${result.containerSelectors.length} 个可能的新闻容器`);
  result.containerSelectors.forEach((container, i) => {
    console.log(`容器候选 #${i+1}: ${container.selector} (分数: ${container.score}, 数量: ${container.count})`);
    
    // 2. 为每个可能的容器找出可能的标题、摘要、日期、作者和链接选择器
    const containerElements = $(container.selector);
    const firstElement = containerElements.first();
    
    // 找出标题选择器
    result.titleSelectors[container.selector] = findBestChildSelector($, containerElements, BACKUP_SELECTORS.title, 'title');
    
    // 找出摘要选择器
    result.summarySelectors[container.selector] = findBestChildSelector($, containerElements, BACKUP_SELECTORS.summary, 'summary');
    
    // 找出日期选择器
    result.dateSelectors[container.selector] = findBestChildSelector($, containerElements, BACKUP_SELECTORS.date, 'date');
    
    // 找出作者选择器
    result.authorSelectors[container.selector] = findBestChildSelector($, containerElements, BACKUP_SELECTORS.author, 'author');
    
    // 找出链接选择器
    result.linkSelectors[container.selector] = findBestChildSelector($, containerElements, BACKUP_SELECTORS.link, 'link');
  });
  
  return result;
}

/**
 * 评估容器候选的分数
 * @param {Object} $ Cheerio实例
 * @param {string} selector 选择器
 * @param {Object} elements 元素集合
 * @returns {number} 分数
 */
function evaluateContainerCandidate($, selector, elements) {
  let score = 0;
  const count = elements.length;
  
  // 基础分：元素数量在理想范围内（3-20）加分
  if (count >= 3 && count <= 20) {
    score += 20;
  } else if (count > 20 && count <= 30) {
    score += 10;
  }
  
  // 检查第一个元素是否包含标题、链接等新闻必要元素
  const firstElement = elements.first();
  
  // 检查是否有标题元素
  for (const titleSelector of BACKUP_SELECTORS.title) {
    if (firstElement.find(titleSelector).length > 0) {
      score += 15;
      break;
    }
  }
  
  // 检查是否有链接
  if (firstElement.find('a').length > 0) {
    score += 10;
  }
  
  // 检查是否有段落或摘要
  if (firstElement.find('p').length > 0) {
    score += 8;
  }
  
  // 检查元素内是否包含与新闻相关的关键词
  const text = firstElement.text().toLowerCase();
  for (const keyword of NEWS_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      score += 5;
      break;
    }
  }
  
  // 检查元素的class或id是否包含新闻相关关键词
  const className = firstElement.attr('class') || '';
  const id = firstElement.attr('id') || '';
  for (const keyword of NEWS_KEYWORDS) {
    if (className.toLowerCase().includes(keyword.toLowerCase()) || 
        id.toLowerCase().includes(keyword.toLowerCase())) {
      score += 10;
      break;
    }
  }
  
  // 检查元素的宽度是否适合内容（不太窄）
  const width = firstElement.css('width');
  if (width && !width.includes('px') && parseInt(width) > 200) {
    score += 5;
  }
  
  // 检查所有元素是否具有相似的结构（子元素数量和类型）
  const firstChildCount = firstElement.children().length;
  let similarStructureCount = 0;
  
  elements.each(function(i) {
    if (i === 0) return; // 跳过第一个元素
    const currentChildCount = $(this).children().length;
    if (Math.abs(currentChildCount - firstChildCount) <= 2) { // 允许有小的差异
      similarStructureCount++;
    }
  });
  
  // 如果超过70%的元素具有相似结构，加分
  if (similarStructureCount >= count * 0.7) {
    score += 15;
  }
  
  return score;
}

/**
 * 在DOM中寻找潜在的新闻容器
 * @param {Object} $ Cheerio实例
 * @param {Map} scoreMap 存储评分的Map
 */
function findPotentialContainers($, scoreMap) {
  // 获取所有可能是列表的元素
  $('div, ul, ol, section').each(function() {
    const $this = $(this);
    const childCount = $this.children().length;
    
    // 忽略子元素过少或过多的元素
    if (childCount < 3 || childCount > 30) return;
    
    // 检查子元素是否有相似的结构（可能是新闻列表）
    const children = $this.children();
    let similarChildren = 0;
    const firstChild = children.first();
    const firstChildTag = firstChild.prop('tagName');
    
    children.each(function(i) {
      if (i === 0) return;
      if ($(this).prop('tagName') === firstChildTag) {
        similarChildren++;
      }
    });
    
    // 如果超过70%的子元素具有相同的标签，该元素可能是容器
    if (similarChildren >= childCount * 0.7) {
      // 构建这个元素的选择器
      const selector = buildSelector($this);
      if (selector) {
        const elements = $(selector);
        const score = evaluateContainerCandidate($, selector, elements);
        if (score > 0) {
          scoreMap.set(selector, { score, count: childCount });
        }
      }
    }
  });
}

/**
 * 为元素构建CSS选择器
 * @param {Object} $element Cheerio元素
 * @returns {string|null} CSS选择器
 */
function buildSelector($element) {
  const tagName = $element.prop('tagName')?.toLowerCase();
  if (!tagName) return null;
  
  let selector = tagName;
  
  // 添加id
  const id = $element.attr('id');
  if (id) {
    return `${tagName}#${id.trim()}`;
  }
  
  // 添加class
  const className = $element.attr('class');
  if (className) {
    // 提取第一个class
    const firstClass = className.trim().split(/\s+/)[0];
    if (firstClass) {
      return `${tagName}.${firstClass}`;
    }
  }
  
  // 如果没有id和class，使用属性选择器
  const role = $element.attr('role');
  if (role) {
    return `${tagName}[role="${role}"]`;
  }
  
  // 退回到普通tag选择器
  return selector;
}

/**
 * 为容器找出最佳的子元素选择器
 * @param {Object} $ Cheerio实例
 * @param {Object} containerElements 容器元素集合
 * @param {Array} candidateSelectors 候选选择器列表
 * @param {string} type 类型（title|summary|date|author|link）
 * @returns {string|null} 最佳选择器
 */
function findBestChildSelector($, containerElements, candidateSelectors, type) {
  const results = [];
  
  // 遍历所有候选选择器
  for (const selector of candidateSelectors) {
    let matchCount = 0;
    let totalLength = 0;
    let examples = [];
    
    containerElements.each(function(i, container) {
      const found = $(this).find(selector);
      if (found.length > 0) {
        matchCount++;
        const text = found.first().text().trim();
        totalLength += text.length;
        
        if (examples.length < 3) {
          examples.push(text);
        }
      }
    });
    
    // 要求匹配率至少50%
    const matchRatio = matchCount / containerElements.length;
    if (matchRatio >= 0.5) {
      const averageLength = totalLength / matchCount;
      
      // 根据类型判断内容是否合理
      let score = matchRatio * 50; // 基础分
      let isValid = false;
      
      switch (type) {
        case 'title':
          // 标题通常长度适中且不会太短
          isValid = averageLength >= 10 && averageLength <= 100;
          if (isValid) score += 30;
          break;
        case 'summary':
          // 摘要通常较长
          isValid = averageLength >= 30;
          if (isValid) score += 20;
          break;
        case 'date':
          // 日期通常较短且包含数字
          isValid = averageLength <= 30 && /\d/.test(examples.join(''));
          if (isValid) score += 25;
          break;
        case 'author':
          // 作者通常较短
          isValid = averageLength <= 30;
          if (isValid) score += 15;
          break;
        case 'link':
          // 链接必须是a标签且有href属性
          if (selector.includes('a') || selector === 'a') {
            isValid = true;
            score += 30;
          }
          break;
      }
      
      if (isValid) {
        results.push({
          selector,
          score,
          matchRatio,
          averageLength,
          examples
        });
      }
    }
  }
  
  // 按分数排序
  results.sort((a, b) => b.score - a.score);
  
  // 返回最佳选择器
  if (results.length > 0) {
    console.log(`${type}选择器: ${results[0].selector} (分数: ${results[0].score.toFixed(1)}, 匹配率: ${(results[0].matchRatio * 100).toFixed(1)}%, 示例: ${results[0].examples.join(' | ')})`);
    return results[0].selector;
  }
  
  console.log(`未找到合适的${type}选择器`);
  return null;
}

/**
 * 自动分析网页并提取新闻内容
 * @param {string} html HTML内容
 * @param {Object} site 网站配置，仅包含name和url
 * @returns {Promise<Array>} 解析出的新闻数组
 */
async function parseNewsAutomatically(html, site) {
  try {
    console.log(`开始自动分析并提取 ${site.name} 的新闻内容...`);
    
    // 分析网页结构
    const analysisResult = analyzePageStructure(html);
    
    // 如果没有找到任何容器，无法提取
    if (analysisResult.containerSelectors.length === 0) {
      console.log(`无法在 ${site.name} 找到合适的新闻容器`);
      return [];
    }
    
    // 使用最高分的容器选择器
    const bestContainer = analysisResult.containerSelectors[0];
    console.log(`使用最佳容器: ${bestContainer.selector} (分数: ${bestContainer.score})`);
    
    // 根据分析结果构建临时选择器配置
    const tempSelectors = {
      container: bestContainer.selector,
      title: analysisResult.titleSelectors[bestContainer.selector],
      summary: analysisResult.summarySelectors[bestContainer.selector],
      date: analysisResult.dateSelectors[bestContainer.selector],
      author: analysisResult.authorSelectors[bestContainer.selector],
      link: analysisResult.linkSelectors[bestContainer.selector]
    };
    
    console.log('使用以下选择器提取新闻:');
    console.log(JSON.stringify(tempSelectors, null, 2));
    
    // 使用构建的选择器提取新闻
    const tempSite = { ...site, selectors: tempSelectors };
    return parseNewsFromHtml(html, tempSite);
  } catch (error) {
    console.error(`自动分析提取 ${site.name} 的新闻失败:`, error.message);
    return [];
  }
}

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
    
    // 如果选择器不完整，返回空数组
    if (!selectors || !selectors.container) {
      console.log(`${site.name} 的选择器配置不完整`);
      return [];
    }
    
    // 调试信息：检查容器是否存在
    const containerElements = $(selectors.container);
    const containerCount = containerElements.length;
    console.log(`在 ${site.name} 中找到 ${containerCount} 个容器元素`);
    
    // 如果没有找到容器，尝试使用更通用的选择器
    if (containerCount === 0) {
      console.log(`尝试使用备用选择器查找容器...`);
      // 打印页面标题帮助调试
      console.log(`页面标题: ${$('title').text()}`);
      
      // 尝试通用备用选择器
      for (const selector of BACKUP_SELECTORS.container) {
        const count = $(selector).length;
        if (count > 0) {
          console.log(`使用备用选择器 "${selector}" 找到 ${count} 个容器元素`);
          return parseWithBackupSelectors(html, site, selector, $);
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
          // 如果没有找到标题，尝试使用备用选择器
          for (const backupSelector of BACKUP_SELECTORS.title) {
            title = extractContent($element, backupSelector, $);
            if (title) {
              console.log(`[${index}] 使用备用标题选择器 ${backupSelector} 找到标题: ${title.length > 30 ? title.substring(0, 30) + '...' : title}`);
              break;
            }
          }
          
          // 如果仍然没有找到标题，打印容器内容片段
          if (!title) {
            console.log(`[${index}] 未找到标题，打印容器内容片段:`);
            const html = $element.html();
            if (html) {
              console.log(html.substring(0, 200) + '...');
            } else {
              console.log('容器内容为空');
            }
          }
        }
        
        // 提取链接
        let url = extractUrl($element, selectors.link, site.url, $);
        
        // 如果没有找到链接，尝试备用选择器
        if (!url) {
          for (const backupSelector of BACKUP_SELECTORS.link) {
            url = extractUrl($element, backupSelector, site.url, $);
            if (url) {
              console.log(`[${index}] 使用备用链接选择器 ${backupSelector} 找到链接`);
              break;
            }
          }
        }
        
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
 * 使用备用选择器解析新闻
 * @param {string} html HTML内容
 * @param {Object} site 网站配置
 * @param {string} containerSelector 容器选择器
 * @param {Object} $ Cheerio实例
 * @returns {Array} 解析出的新闻数组
 */
function parseWithBackupSelectors(html, site, containerSelector, $) {
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
      let summary = '';
      let date = '';
      let author = '';
      
      // 使用备用选择器查找标题
      for (const selector of BACKUP_SELECTORS.title) {
        const titleElement = $element.find(selector).first();
        if (titleElement.length > 0 && titleElement.text().trim()) {
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
        for (const selector of BACKUP_SELECTORS.link) {
          const linkElement = $element.find(selector).first();
          if (linkElement.length > 0) {
            url = linkElement.attr('href');
            if (url) break;
          }
        }
      }
      
      // 处理相对URL
      url = normalizeUrl(url, site.url);
      
      // 尝试找摘要
      for (const selector of BACKUP_SELECTORS.summary) {
        const summaryElement = $element.find(selector).first();
        if (summaryElement.length > 0 && summaryElement.text().trim()) {
          summary = summaryElement.text().trim();
          break;
        }
      }
      
      // 尝试找日期
      for (const selector of BACKUP_SELECTORS.date) {
        const dateElement = $element.find(selector).first();
        if (dateElement.length > 0 && dateElement.text().trim()) {
          date = dateElement.text().trim();
          break;
        }
      }
      
      // 尝试找作者
      for (const selector of BACKUP_SELECTORS.author) {
        const authorElement = $element.find(selector).first();
        if (authorElement.length > 0 && authorElement.text().trim()) {
          author = authorElement.text().trim();
          break;
        }
      }
      
      // 如果找到标题，添加到结果
      if (title) {
        console.log(`[备选${index}] 标题: ${title.length > 30 ? title.substring(0, 30) + '...' : title}`);
        console.log(`[备选${index}] 链接: ${url || '未找到'}`);
        
        newsItems.push({
          title: title,
          summary: summary || '',
          date: date || '',
          author: author || '',
          source: site.name,
          url: url || ''
        });
      }
    } catch (error) {
      console.error(`使用备用选择器解析第 ${index + 1} 项时出错:`, error.message);
    }
  });
  
  console.log(`使用备用选择器成功解析出 ${newsItems.length} 条新闻`);
  return newsItems;
}

/**
 * 将相对URL转为绝对URL
 * @param {string} relativeUrl 相对URL
 * @param {string} baseUrl 基础URL
 * @returns {string} 绝对URL
 */
function normalizeUrl(relativeUrl, baseUrl) {
  if (!relativeUrl) return '';
  
  // 如果已经是绝对URL，直接返回
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  
  // 处理以//开头的URL（协议相对URL）
  if (relativeUrl.startsWith('//')) {
    const baseUrlObj = new URL(baseUrl);
    return `${baseUrlObj.protocol}${relativeUrl}`;
  }
  
  // 使用URL对象处理相对路径
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch (error) {
    console.error(`URL规范化失败: ${error.message}`);
    return relativeUrl;
  }
}

/**
 * 从元素中提取内容
 * @param {Object} $element Cheerio元素
 * @param {string} selector 选择器
 * @param {Object} $ Cheerio实例
 * @returns {string} 提取的内容
 */
function extractContent($element, selector, $) {
  if (!selector) return '';
  
  try {
    const found = $element.find(selector);
    if (found.length > 0) {
      return found.first().text().trim();
    }
  } catch (error) {
    console.error(`提取内容失败: ${error.message}`);
  }
  
  return '';
}

/**
 * 从元素中提取URL
 * @param {Object} $element Cheerio元素
 * @param {string} selector 选择器
 * @param {string} baseUrl 基础URL
 * @param {Object} $ Cheerio实例
 * @returns {string} 提取的URL
 */
function extractUrl($element, selector, baseUrl, $) {
  if (!selector) return '';
  
  try {
    const found = $element.find(selector);
    if (found.length > 0) {
      const href = found.first().attr('href');
      if (href) {
        return normalizeUrl(href, baseUrl);
      }
    }
  } catch (error) {
    console.error(`提取URL失败: ${error.message}`);
  }
  
  return '';
}

module.exports = {
  parseNewsFromHtml,
  parseNewsAutomatically,
  analyzePageStructure,
  normalizeUrl
}; 