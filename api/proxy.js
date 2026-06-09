// api/proxy.js - 由首席架构师设计的跨域与网络代理 Serverless 函数

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

  const { baseURL, apiKey, model, prompt, size, quality } = req.body;

  if (!baseURL || !apiKey || !prompt) {
    res.status(400).json({ error: { message: '缺少必要参数 (baseURL, apiKey 或 prompt)' } });
    return;
  }

  // 格式化目标 API URL
  const cleanBase = baseURL.replace(/\/$/, '');
  let requestURL = cleanBase;
  if (cleanBase.endsWith('/images/generations')) {
    requestURL = cleanBase;
  } else if (cleanBase.endsWith('/v1')) {
    requestURL = `${cleanBase}/images/generations`;
  } else {
    if (!cleanBase.includes('/v1') && !cleanBase.includes('/v1/')) {
      requestURL = `${cleanBase}/v1/images/generations`;
    } else {
      requestURL = `${cleanBase}/images/generations`;
    }
  }

  try {
    // 使用 Node 18+ 原生 fetch 进行接口转发
    const response = await fetch(requestURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality
      })
    });

    const responseStatus = response.status;
    let data = null;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    }

    if (!response.ok) {
      res.status(responseStatus).json(data || { 
        error: { message: `目标接口返回非正常状态码: ${responseStatus}` } 
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
