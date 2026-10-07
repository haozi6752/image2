import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发代理插件：解决在本地 npm run dev 时访问 /api/proxy 返回 404 的问题
const localProxyPlugin = () => ({
  name: 'local-api-proxy',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url === '/api/proxy' && req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const { action, baseURL, apiKey, model, prompt, size, quality, output_format, output_compression, imageB64, imagesB64 } = body;

            if (!baseURL || !apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: '缺少必要参数 (baseURL 或 apiKey)' } }));
              return;
            }

            // 处理模型列表查询
            if (action === 'models') {
              const cleanBase = baseURL.replace(/\/$/, '');
              let modelsURL = cleanBase;
              if (cleanBase.endsWith('/models')) {
                modelsURL = cleanBase;
              } else if (cleanBase.endsWith('/v1')) {
                modelsURL = `${cleanBase}/models`;
              } else if (cleanBase.includes('/images/')) {
                modelsURL = cleanBase.replace(/\/images\/.*$/, '/models');
              } else {
                modelsURL = `${cleanBase}/v1/models`;
              }

              console.log(`[Local Proxy] 获取模型列表 -> ${modelsURL}`);
              const modelRes = await fetch(modelsURL, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`
                }
              });

              const modelStatus = modelRes.status;
              const modelContentType = modelRes.headers.get('content-type') || '';
              res.statusCode = modelStatus;
              res.setHeader('Content-Type', modelContentType.includes('application/json') ? 'application/json' : 'text/plain');

              if (modelContentType.includes('application/json')) {
                const data = await modelRes.json();
                res.end(JSON.stringify(data));
              } else {
                const text = await modelRes.text();
                res.end(text);
              }
              return;
            }

            if (!prompt) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: '缺少必要参数 (prompt)' } }));
              return;
            }

            // 整理单图或多图列表 (兼容旧版单图与新版多图)
            let imagesList = [];
            if (Array.isArray(imagesB64) && imagesB64.length > 0) {
              imagesList = imagesB64.filter(Boolean);
            } else if (imageB64) {
              imagesList = [imageB64];
            }

            const isEditMode = imagesList.length > 0;
            const targetPath = isEditMode ? '/images/edits' : '/images/generations';

            // 格式化目标 API URL
            const cleanBase = baseURL.replace(/\/$/, '');
            let requestURL = cleanBase;
            if (cleanBase.endsWith(targetPath)) {
              requestURL = cleanBase;
            } else if (cleanBase.endsWith('/v1')) {
              requestURL = `${cleanBase}${targetPath}`;
            } else {
              if (cleanBase.includes('/images/')) {
                requestURL = cleanBase.replace(/\/images\/(generations|edits|variations)$/, targetPath);
              } else if (!cleanBase.includes('/v1') && !cleanBase.includes('/v1/')) {
                requestURL = `${cleanBase}/v1${targetPath}`;
              } else {
                requestURL = `${cleanBase}${targetPath}`;
              }
            }

            console.log(`[Local Proxy] 转发请求 -> ${requestURL}, 模型: ${model}, 参考图数: ${imagesList.length}`);

            let fetchOptions = {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            };

            if (isEditMode) {
              // FormData 模式：支持多张参考图上传
              const formData = new FormData();
              const fieldName = imagesList.length > 1 ? 'image[]' : 'image';

              imagesList.forEach((b64, idx) => {
                const matches = b64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                let buffer, mimeType = 'image/png';
                if (matches && matches.length === 3) {
                  mimeType = matches[1];
                  buffer = Buffer.from(matches[2], 'base64');
                } else {
                  buffer = Buffer.from(b64.split(',')[1] || b64, 'base64');
                }
                const blob = new Blob([buffer], { type: mimeType });
                formData.append(fieldName, blob, `image_${idx + 1}.png`);
              });

              formData.append('prompt', prompt);
              formData.append('model', model);
              formData.append('size', size);
              if (quality) formData.append('quality', quality);
              if (output_format) formData.append('output_format', output_format);
              if (output_compression !== undefined) formData.append('output_compression', String(output_compression));

              fetchOptions.body = formData;
            } else {
              // JSON 模式
              fetchOptions.headers['Content-Type'] = 'application/json';
              fetchOptions.body = JSON.stringify({
                model,
                prompt,
                n: 1,
                size,
                quality,
                ...(output_format ? { output_format } : {}),
                ...(output_compression !== undefined ? { output_compression: Number(output_compression) } : {})
              });
            }

            const apiResponse = await fetch(requestURL, fetchOptions);
            const status = apiResponse.status;
            const contentType = apiResponse.headers.get('content-type') || '';

            res.statusCode = status;
            res.setHeader('Content-Type', contentType.includes('application/json') ? 'application/json' : 'text/plain');

            if (contentType.includes('application/json')) {
              const data = await apiResponse.json();
              res.end(JSON.stringify(data));
            } else {
              const text = await apiResponse.text();
              res.end(text);
            }
          } catch (err) {
            console.error('[Local Proxy Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { message: `本地代理转发失败: ${err.message}` } }));
          }
        });
        return;
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), localProxyPlugin()],
})
