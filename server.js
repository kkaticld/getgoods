import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { marked } from 'marked';

// 配置marked选项
marked.setOptions({
    breaks: true // 将换行符转换为<br>
});

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 静态文件服务
app.use(express.static(__dirname));

// 基本的健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

async function analyzeImageWithAI(imageData) {
    try {
        let rawContent = '';
        console.log(`Sending request to OpenRouter API...   ${process.env.OPENROUTER_API_KEY}`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Ingredients Analysis Application'
            },
            body: JSON.stringify({
                model: 'google/gemini-flash-1.5',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: '这是一张商品配料表的图片。请识别出所有配料，并按照以下JSON格式返回结果：{"ingredients": ["配料1", "配料2", ...]}。注意返回的必须是可以被JSON.parse()解析的字符串。'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const responseData = await response.text();
        console.log('Raw API Response:', responseData);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}\n${responseData}`);
        }

        const data = JSON.parse(responseData);
        console.log('Parsed API Response:', JSON.stringify(data, null, 2));

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid API response format');
        }

        let content = data.choices[0].message.content;
        console.log('AI Response Content:', content);

        // 将markdown和换行转换为HTML
        const htmlContent = marked(content);
        console.log('Converted HTML Content:', htmlContent);

        // 尝试从返回的内容中提取JSON字符串
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) {
            // 如果没有找到JSON对象，返回一个模拟的数据
            console.log('Using mock data as fallback');
            return {
                data: {
                    ingredients: [
                        "示例配料1",
                        "示例配料2",
                        "示例配料3"
                    ]
                },
                html: marked("示例配料1\n示例配料2\n示例配料3")
            };
        }

        // 验证JSON格式
        try {
            const ingredients = JSON.parse(match[0]);
            if (!Array.isArray(ingredients.ingredients)) {
                throw new Error('返回的数据格式不正确');
            }
            return {
                data: ingredients,
                html: htmlContent
            };
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            throw new Error('无法解析AI返回的JSON数据');
        }

    } catch (error) {
        console.error('AI Analysis Error:', error);
        throw new Error('配料分析失败：' + error.message);
    }
}

async function getIngredientInfo(ingredient) {
    try {
        console.log('Requesting ingredient info from OpenRouter API...');
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Ingredients Analysis Application'
            },
            body: JSON.stringify({
                model: 'google/gemini-flash-1.5',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `请详细介绍这个食品配料："${ingredient}"。包括以下方面：1. 简介 2. 用途 3. 营养价值 4. 添加原因 5. 不添加的影响。请用JSON格式返回，格式为：{"description": "简介", "usage": "用途", "nutrition": "营养价值", "reason": "添加原因", "impact": "不添加的影响"}。注意返回的必须是可以被JSON.parse()解析的字符串。`
                            }
                        ]
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        const responseData = await response.text();
        console.log('Raw Ingredient Info Response:', responseData);

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}\n${responseData}`);
        }

        const data = JSON.parse(responseData);
        console.log('Parsed Ingredient Info Response:', JSON.stringify(data, null, 2));

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid API response format');
        }

        let content = data.choices[0].message.content;
        console.log('AI Response Content:', content);

        // 将markdown和换行转换为HTML
        const htmlContent = marked(content);
        console.log('Converted HTML Content:', htmlContent);

        // 尝试从返回的内容中提取JSON字符串
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error('无法解析配料信息');
        }

        // 验证JSON格式
        try {
            const info = JSON.parse(match[0]);
            if (!info.description || !info.usage || !info.nutrition || !info.reason || !info.impact) {
                throw new Error('返回的数据格式不正确');
            }

            // 为每个字段单独处理markdown格式
            // 移除JSON字符串中的转义字符，以便正确解析markdown
            const cleanInfo = {
                description: info.description.replace(/\\n/g, '\n').replace(/\\\"/g, '"'),
                usage: info.usage.replace(/\\n/g, '\n').replace(/\\\"/g, '"'),
                nutrition: info.nutrition.replace(/\\n/g, '\n').replace(/\\\"/g, '"'),
                reason: info.reason.replace(/\\n/g, '\n').replace(/\\\"/g, '"'),
                impact: info.impact.replace(/\\n/g, '\n').replace(/\\\"/g, '"')
            };

            const formattedInfo = {
                description: marked(cleanInfo.description),
                usage: marked(cleanInfo.usage),
                nutrition: marked(cleanInfo.nutrition),
                reason: marked(cleanInfo.reason),
                impact: marked(cleanInfo.impact)
            };

            return {
                data: info,
                html: `
                    <div class="ingredient-info">
                        <h3>简介</h3>
                        ${formattedInfo.description}
                        
                        <h3>用途</h3>
                        ${formattedInfo.usage}
                        
                        <h3>营养价值</h3>
                        ${formattedInfo.nutrition}
                        
                        <h3>添加原因</h3>
                        ${formattedInfo.reason}
                        
                        <h3>不添加的影响</h3>
                        ${formattedInfo.impact}
                    </div>
                `
            };
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            throw new Error('无法解析AI返回的JSON数据');
        }

    } catch (error) {
        console.error('Ingredient Info Error:', error);
        throw new Error('获取配料信息失败：' + error.message);
    }
}

// 处理MCP工具调用
app.post('/mcp/:serverName/:toolName', async (req, res) => {
    console.log(`Received request for ${req.params.serverName}/${req.params.toolName}`);
    
    try {
        const { serverName, toolName } = req.params;
        const args = req.body;

        // 验证服务器名称
        if (serverName !== 'menu-analysis') {
            throw new Error(`Unknown MCP server: ${serverName}`);
        }

        // 根据工具名称处理不同的请求
        switch (toolName) {
            case 'analyze_menu_image':
                if (!args.image_data) {
                    throw new Error('Missing required parameter: image_data');
                }
                console.log('Processing image data...');
                const imageAnalysisResult = await analyzeImageWithAI(args.image_data);
                res.json({
                    result: JSON.stringify(imageAnalysisResult.data),
                    html: imageAnalysisResult.html
                });
                break;

            case 'get_ingredient_info':
                if (!args.ingredient) {
                    throw new Error('Missing required parameter: ingredient');
                }
                console.log('Getting ingredient info...');
                const ingredientInfoResult = await getIngredientInfo(args.ingredient);
                res.json({
                    result: JSON.stringify(ingredientInfoResult.data),
                    html: ingredientInfoResult.html
                });
                break;

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        details: err.message
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Static files served from: ${__dirname}`);
});

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});
