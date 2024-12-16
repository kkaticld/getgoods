# GetGoods - 食品配料分析工具

一个基于 AI 的食品配料分析工具，可以识别和解析食品包装上的配料表，并提供每种配料的详细信息。

## 功能特点

- 图片识别：自动识别配料表图片中的文字
- 配料解析：提取并列出所有配料
- 详细信息：提供每种配料的详细说明，包括：
  - 简介
  - 用途
  - 营养价值
  - 添加原因
  - 不添加的影响
- Markdown 支持：配料信息支持 markdown 格式，展示更加清晰
- 响应式设计：适配各种屏幕尺寸

## 技术栈

- 前端：HTML5, CSS3, JavaScript
- 后端：Node.js, Express
- AI：OpenRouter API (Gemini)
- 其他：marked (Markdown 解析)

## 安装使用

1. 克隆仓库
```bash
git clone https://github.com/yourusername/getgoods.git
cd getgoods
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
创建 .env 文件并添加：
```
OPENROUTER_API_KEY=your_api_key
```

4. 启动服务器
```bash
node server.js
```

5. 访问应用
打开浏览器访问 http://localhost:3000

## 使用说明

1. 上传图片：点击上传区域或拖拽配料表图片
2. 查看配料：系统会自动识别并列出所有配料
3. 查看详情：点击任意配料名称查看详细信息

## 注意事项

- 支持的图片格式：JPG、PNG
- 图片大小限制：10MB
- 图片要求：配料表部分要清晰可见

## License

MIT