const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Jira-Base-Url');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!ALLOWED_METHODS.includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const jiraBaseUrl = req.headers['x-jira-base-url'];
    const jiraPath = req.query.path;

    if (!jiraBaseUrl) {
      return res.status(400).json({ error: 'Missing X-Jira-Base-Url header' });
    }
    if (!jiraPath) {
      return res.status(400).json({ error: 'Missing path query parameter' });
    }

    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const cleanBaseUrl = jiraBaseUrl.replace(/\/+$/, '');
    const cleanPath = jiraPath.startsWith('/') ? jiraPath : `/${jiraPath}`;
    const jiraUrl = `${cleanBaseUrl}${cleanPath}`;

    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'path' && value) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v));
        } else {
          queryParams.append(key, value);
        }
      }
    }
    const queryString = queryParams.toString();
    const fullUrl = queryString ? `${jiraUrl}?${queryString}` : jiraUrl;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': authorization,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (req.body && ['POST', 'PUT'].includes(req.method || '')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const jiraResponse = await fetch(fullUrl, fetchOptions);

    const contentType = jiraResponse.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await jiraResponse.json();
    } else {
      data = await jiraResponse.text();
    }

    return res.status(jiraResponse.status).json(data);

  } catch (error) {
    console.error('[Jira Proxy] Error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
