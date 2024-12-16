document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('menuUpload');
    const previewSection = document.getElementById('preview');
    const ingredientsList = document.getElementById('dishList');
    const loadingElement = document.querySelector('.loading');
    const loadingText = loadingElement.querySelector('p');

    // 处理文件上传
    uploadInput.addEventListener('change', handleFileUpload);

    // 处理拖拽上传
    const uploadLabel = document.querySelector('.upload-label');
    uploadLabel.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadLabel.style.borderColor = '#4a90e2';
        uploadLabel.style.backgroundColor = '#f8f9fa';
    });

    uploadLabel.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadLabel.style.borderColor = '#ddd';
        uploadLabel.style.backgroundColor = 'transparent';
    });

    uploadLabel.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadLabel.style.borderColor = '#ddd';
        uploadLabel.style.backgroundColor = 'transparent';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            uploadInput.files = files;
            handleFileUpload({ target: uploadInput });
        }
    });

    function updateLoadingStatus(message) {
        loadingText.textContent = message;
    }

    function showError(message) {
        ingredientsList.innerHTML = `
            <div class="error-message" style="color: #dc3545; padding: 1rem; text-align: center; width: 100%;">
                <p>😕 ${message}</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">请重试或尝试上传其他图片</p>
            </div>
        `;
    }

    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 计算新的尺寸，确保图片不会太大
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 1024;
                    
                    if (width > height && width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 绘制压缩后的图片
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 转换为base64，使用较高的质量
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    resolve(dataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showError('请上传图片文件（支持JPG、PNG等格式）');
            return;
        }

        // 检查文件大小
        if (file.size > 10 * 1024 * 1024) {
            showError('图片大小不能超过10MB');
            return;
        }

        try {
            // 压缩并显示预览
            const compressedImage = await compressImage(file);
            previewSection.innerHTML = `<img src="${compressedImage}" alt="预览图">`;
            analyzeIngredients(compressedImage);
        } catch (error) {
            console.error('Image processing error:', error);
            showError('图片处理失败，请重试');
        }
    }

    async function analyzeIngredients(imageData) {
        // 显示加载动画
        loadingElement.style.display = 'block';
        ingredientsList.innerHTML = '';
        updateLoadingStatus('正在分析配料表...');

        try {
            // 使用MCP工具分析配料表
            updateLoadingStatus('正在识别配料...');
            const response = await fetch('/mcp/menu-analysis/analyze_menu_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image_data: imageData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '配料表分析失败');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            updateLoadingStatus('正在生成配料列表...');
            // 解析返回的JSON字符串
            const result = JSON.parse(data.result);
            displayResults(result);
        } catch (error) {
            console.error('Error:', error);
            showError(error.message || '配料表分析失败，请重试');
        } finally {
            loadingElement.style.display = 'none';
        }
    }

    async function getIngredientInfo(ingredient) {
        try {
            const response = await fetch('/mcp/menu-analysis/get_ingredient_info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ingredient: ingredient
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '获取配料信息失败');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            return data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
function displayResults(result) {
    if (!result || !result.ingredients || result.ingredients.length === 0) {
        showError('未能识别出任何配料，请确保图片清晰可读');
        return;
    }

    ingredientsList.innerHTML = `
        <div class="ingredients-container">
            <h2>识别出的配料：</h2>
            <ul>
                ${result.ingredients.map(ingredient => `
                    <li>
                        <span class="ingredient-name" data-ingredient="${ingredient}">${ingredient}</span>
                        <div class="ingredient-info" style="display: none;">
                            <div class="info-loading">正在获取配料信息...</div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    // 为每个配料名称添加点击事件
    document.querySelectorAll('.ingredient-name').forEach(element => {
        element.addEventListener('click', async (e) => {
            const ingredient = e.target.dataset.ingredient;
            const infoDiv = e.target.nextElementSibling;
            
            // 如果当前信息已显示，则隐藏
            if (infoDiv.style.display !== 'none') {
                infoDiv.style.display = 'none';
                return;
            }

            // 显示信息区域
            infoDiv.style.display = 'block';

            try {
                // 获取配料信息
                const response = await getIngredientInfo(ingredient);
                if (response.error) {
                    throw new Error(response.error);
                }
                infoDiv.innerHTML = response.html;
            } catch (error) {
                infoDiv.innerHTML = `
                    <div class="info-error">
                        <p>获取配料信息失败：${error.message}</p>
                        <p>请稍后重试</p>
                    </div>
                `;
            }
        });
    });
}
});