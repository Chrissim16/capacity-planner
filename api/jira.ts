import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Jira-Base-Url');
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!ALLOWED_METHODS.includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get Jira base URL and path from headers/query
    const jiraBaseUrl = req.headers['x-jira-base-url'] as string;
    const jiraPath = req.query.path as string;

    if (!jiraBaseUrl) {
      return res.status(400).json({ error: 'Missing X-Jira-Base-Url header' });
    }

    if (!jiraPath) {
      return res.status(400).json({ error: 'Missing path query parameter' });
    }

    // Get authorization from request (Basic auth with email:token)
    const authorization = req.headers.authorization;
    if (!authorization) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Build the full Jira API URL
    const cleanBaseUrl = jiraBaseUrl.replace(/\/+$/, '');
    const cleanPath = jiraPath.startsWith('/') ? jiraPath : `/${jiraPath}`;
    const jiraUrl = `${cleanBaseUrl}${cleanPath}`;

    // Build query string from remaining query params (exclude 'path')
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

    // Forward the request to Jira
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'Authorization': authorization,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    // Include body for POST/PUT requests
    if (req.body && ['POST', 'PUT'].includes(req.method || '')) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const jiraResponse = await fetch(fullUrl, fetchOptions);

    // Get response data
    const contentType = jiraResponse.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await jiraResponse.json();
    } else {
      data = await jiraResponse.text();
    }

    // Return the response with the same status code
    return res.status(jiraResponse.status).json(data);

  } catch (error) {
    console.error('[Jira Proxy] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
