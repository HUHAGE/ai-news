/**
 * 爬虫测试脚本
 * 用于测试自动爬取功能
 */

const crawler = require('./crawler');

console.log('开始测试自动爬取功能...');

// 启动爬虫
async function testCrawler() {
  try {
    const results = await crawler.crawlAll();
    
    console.log('======================================');
    console.log(`爬取完成，共获取 ${results.length} 条新闻`);
    
    if (results.length > 0) {
      console.log('前5条新闻内容预览:');
      results.slice(0, 5).forEach((item, index) => {
        console.log(`\n[${index + 1}] ${item.title}`);
        console.log(`链接: ${item.url}`);
        console.log(`摘要: ${item.summary?.substring(0, 100)}...`);
        console.log(`日期: ${item.date}`);
        console.log(`作者: ${item.author}`);
        console.log(`来源: ${item.source}`);
      });
    }
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testCrawler(); 