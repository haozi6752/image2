// api/proxy.js - 由首席架构师设计的跨域与网络代理 Serverless 函数 (升级版，支持图生图)

export default async function handler(req, res) {
  // 设置 CORS 头，允许前端进行跨域访问
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 处理预检 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method Not Allowed' } });
    return;
  }

  const { baseURL, apiKey, model, prompt, n, size, quality, background, output_format, output_compression, imageB64, imagesB64 } = req.body;

  if (!baseURL || !apiKey || !prompt) {
    res.status(400).json({ error: { message: '缺少必要参数 (baseURL, apiKey 或 prompt)' } });
    return;
  }

  // 整理单图或多图列表 (兼容旧版单图 imageB64 与新版多图 imagesB64)
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
    // 兼容其他可能已经带了 generations/edits 的其他路径
    if (cleanBase.includes('/images/')) {
      requestURL = cleanBase.replace(/\/images\/(generations|edits|variations)$/, targetPath);
    } else if (!cleanBase.includes('/v1') && !cleanBase.includes('/v1/')) {
      requestURL = `${cleanBase}/v1${targetPath}`;
    } else {
      requestURL = `${cleanBase}${targetPath}`;
    }
  }

  try {
    let fetchOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const countParam = Number(n) > 0 ? Number(n) : 1;

    if (isEditMode) {
      // 图生图模式：构建 FormData (支持多张参考图，遵循 OpenAI 官方规范)
      const formData = new FormData();
      // 多张图使用 image[] 数组键名，单图使用兼容的 image 键名
      const fieldName = imagesList.length > 1 ? 'image[]' : 'image';

      imagesList.forEach((b64, idx) => {
        // 解析 Base64 数据为 Blob
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
      
      // 组装其余表单参数
      formData.append('prompt', prompt);
      formData.append('model', model);
      formData.append('n', String(countParam));
      formData.append('size', size);
      
      // 官方部分 edits 端点不支持 quality，仅在 values 有意义时传递
      if (quality) {
        formData.append('quality', quality);
      }
      if (background) {
        formData.append('background', background);
      }
      if (output_format) {
        formData.append('output_format', output_format);
      }
      if (output_compression !== undefined) {
        formData.append('output_compression', String(output_compression));
      }

      fetchOptions.body = formData;
      // 注意：使用 FormData 时，不需要手动设置 Content-Type 头，
      // Node 的 fetch 会自动添加含 boundary 标识的 multipart/form-data 头
    } else {
      // 纯文生图模式：JSON 格式
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({
        model,
        prompt,
        n: countParam,
        size,
        quality,
        ...(background ? { background } : {}),
        ...(output_format ? { output_format } : {}),
        ...(output_compression !== undefined ? { output_compression: Number(output_compression) } : {})
      });
    }

    // 调用目标 API 接口
    const response = await fetch(requestURL, fetchOptions);

    const responseStatus = response.status;
    let data = null;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      res.status(responseStatus).json(data || { 
        error: { message: `目标 API 接口返回状态码: ${responseStatus}` } 
      });
      return;
    }

    // 成功则透传结果给前端
    res.status(200).json(data);
  } catch (error) {
    console.error('Serverless proxy error:', error);
    res.status(500).json({ 
      error: { message: `Vercel 代理请求远端失败: ${error.message}` } 
    });
  }
}
