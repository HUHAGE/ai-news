# AI 新闻爬虫

这是一个用于爬取和展示网络上 AI 相关新闻的工具。该工具能够从配置的多个网站抓取 AI 新闻，并通过精美的网页界面展示这些内容。

## 功能特点

- **多站点爬取**：通过配置文件自定义爬取目标网站
- **简单操作界面**：一键开始爬取新闻
- **丰富信息采集**：包括标题、摘要、发布时间、作者、来源等
- **本地数据存储**：支持 JSON、CSV、TXT 等格式保存爬取结果
- **精美展示页面**：通过现代化的网页界面展示爬取的内容，支持跳转原文

## 项目结构

```
ai-news/
├── README.md             # 项目说明文档
├── config/
│   └── sites.json        # 爬取网站配置文件
├── src/
│   ├── crawler/          # 爬虫核心代码
│   │   ├── index.js      # 爬虫主程序
│   │   ├── parser.js     # 内容解析模块
│   │   └── storage.js    # 数据存储模块
│   ├── server/           # Web服务器
│   │   └── server.js     # Express服务器设置
│   ├── public/           # 静态资源文件
│   │   ├── css/          # 样式文件
│   │   ├── js/           # 客户端JavaScript
│   │   └── images/       # 图片资源
│   └── views/            # 页面模板
│       ├── index.html    # 主页(包含开始按钮)
│       └── news.html     # 新闻展示页面
├── data/                 # 爬取数据存储目录
├── package.json          # 项目依赖配置
└── .gitignore            # Git忽略文件
```

## 技术栈

- **后端**：Node.js + Express
- **爬虫**：Axios + Cheerio
- **前端**：HTML5 + CSS3 + JavaScript + Bootstrap
- **数据存储**：JSON/CSV/TXT

## 使用方法

### 1. 安装依赖

首先确保您已安装Node.js环境（v12.0.0或更高版本）。然后在项目根目录下运行：

```bash
npm install
```

这将安装所有必要的依赖包。

### 2. 配置爬取站点

默认已配置了几个AI相关新闻网站。如需自定义，请编辑 `config/sites.json` 文件，添加要爬取的网站信息：

```json
[
  {
    "name": "网站名称",
    "url": "https://example.com/ai-news",
    "selectors": {
      "container": ".news-item",
      "title": ".news-title",
      "summary": ".news-summary",
      "date": ".news-date",
      "author": ".news-author",
      "source": ".news-source",
      "link": ".news-link"
    }
  }
]
```

### 3. 启动应用

启动应用服务器：

```bash
npm start
```

或者以开发模式启动（自动重载）：

```bash
npm run dev
```

### 4. 使用应用

1. 打开浏览器访问 `http://localhost:3000`
2. 在主页可以查看当前配置的网站列表
3. 选择保存数据的格式（JSON、CSV或TXT）
4. 点击"开始获取"按钮开始爬取新闻
5. 爬取完成后，系统自动跳转到新闻展示页面
6. 在新闻展示页面可以搜索、排序和查看详情

## 数据存储

爬取的数据将以选定的格式存储在 `data/` 目录下，文件命名格式为 `news_YYYYMMDD_HHMMSS.xxx`，其中xxx是文件扩展名。

JSON数据结构示例：

```json
[
  {
    "title": "新闻标题",
    "summary": "新闻摘要",
    "date": "发布日期",
    "author": "作者",
    "source": "来源网站",
    "url": "原文链接"
  }
]
```

## 功能特性

- **搜索功能**：可以通过关键词搜索新闻标题和内容
- **排序功能**：支持按日期或标题排序
- **响应式设计**：适配桌面和移动设备
- **详情查看**：点击详情按钮查看完整新闻信息
- **外部链接**：可直接跳转到原始新闻网页

## 注意事项

- 请遵守网站的robots.txt规则，合理设置爬取频率
- 爬取的内容仅用于个人学习和研究，请勿用于商业用途
- 部分网站可能有反爬虫措施，可能需要额外配置（如User-Agent、代理等）
- 由于网站结构可能变化，selectors配置可能需要不定期更新

## 待改进事项

- 添加定时爬取功能
- 实现新闻去重机制
- 增加关键词过滤功能
- 优化移动端展示效果
- 添加用户自定义爬取规则界面
- 实现数据可视化分析模块

## 许可证

MIT 