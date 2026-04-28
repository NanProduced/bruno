const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { ipcMain } = require('electron');
const { getAiProviderConfig } = require('../store/ai-provider');
const { jsonToBruV2 } = require('@usebruno/lang');
const {
  sanitizeName,
  generateUniqueName,
  getCollectionFormat,
  writeFile
} = require('../utils/filesystem');

const streamLLM = async (config, prompt, onChunk) => {
  const { provider, apiKey, baseUrl, model } = config;

  const streamOpenAI = async ({ apiKey, baseUrl, model, prompt, onChunk }) => {
    const axios = require('axios');
    let url;
    if (baseUrl) {
      const base = baseUrl.replace(/\/+$/, '');
      url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    } else {
      url = 'https://api.openai.com/v1/chat/completions';
    }

    const modelName = model || 'gpt-4o-mini';

    const response = await axios.post(
      url,
      {
        model: modelName,
        messages: [
          { role: 'system', content: 'You are an API request generator for Bruno. Always respond with valid JSON only, no markdown, no code fences.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 120000,
        responseType: 'stream'
      }
    );

    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              onChunk(delta, fullContent);
            }
          } catch {}
        }
      });

      response.data.on('end', () => {
        resolve(fullContent);
      });

      response.data.on('error', (err) => {
        reject(err);
      });
    });
  };

  const streamAnthropic = async ({ apiKey, baseUrl, model, prompt, onChunk }) => {
    const axios = require('axios');
    const url = baseUrl
      ? `${baseUrl.replace(/\/+$/, '')}/messages`
      : 'https://api.anthropic.com/v1/messages';

    const modelName = model || 'claude-sonnet-4-20250514';

    const response = await axios.post(
      url,
      {
        model: modelName,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 120000,
        responseType: 'stream'
      }
    );

    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullContent += parsed.delta.text;
              onChunk(parsed.delta.text, fullContent);
            }
          } catch {}
        }
      });

      response.data.on('end', () => {
        resolve(fullContent);
      });

      response.data.on('error', (err) => {
        reject(err);
      });
    });
  };

  const streamOllama = async ({ baseUrl, model, prompt, onChunk }) => {
    const axios = require('axios');
    const url = `${(baseUrl || 'http://localhost:11434').replace(/\/+$/, '')}/api/generate`;

    const modelName = model || 'llama3';

    const response = await axios.post(
      url,
      {
        model: modelName,
        prompt,
        stream: true,
        options: {
          temperature: 0.7
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
        responseType: 'stream'
      }
    );

    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.response) {
              fullContent += parsed.response;
              onChunk(parsed.response, fullContent);
            }
          } catch {}
        }
      });

      response.data.on('end', () => {
        resolve(fullContent);
      });

      response.data.on('error', (err) => {
        reject(err);
      });
    });
  };

  switch (provider) {
    case 'openai':
      if (!apiKey) throw new Error('OpenAI API key is not configured');
      return streamOpenAI({ apiKey, baseUrl, model, prompt, onChunk });
    case 'openai-compatible':
      if (!apiKey) throw new Error('API key is not configured');
      if (!baseUrl) throw new Error('Base URL is required for OpenAI Compatible provider');
      return streamOpenAI({ apiKey, baseUrl, model, prompt, onChunk });
    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic API key is not configured');
      return streamAnthropic({ apiKey, baseUrl, model, prompt, onChunk });
    case 'ollama':
      return streamOllama({ baseUrl, model, prompt, onChunk });
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

const parseLLMResponse = (rawContent) => {
  let content = rawContent.trim();
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    try {
      const jsonStr = content.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }
    } catch {}

    return null;
  }
};

const buildPrompt = ({ parsedRequest, description }) => {
  const { method, url, headers, body, auth } = parsedRequest;

  let prompt = `You are an API request generator for Bruno (an API client similar to Postman/Insomnia).

I will provide you with:
1. A parsed HTTP request
2. A description of what the request should do

Your task is to enhance the request with:
- Better request documentation (docs)
- Test assertions (tests)
- Pre-request scripts (script.req) if needed
- Post-response scripts (script.res) if needed
- Request variables (vars.req) if needed
- Response variables (vars.res) if needed

Here is the parsed request data:
- Method: ${method?.toUpperCase() || 'GET'}
- URL: ${url || ''}
`;

  if (headers && headers.length > 0) {
    prompt += `\nHeaders:\n`;
    headers.forEach((h) => {
      if (h.enabled !== false) {
        prompt += `  - ${h.name}: ${h.value}\n`;
      }
    });
  }

  if (body && body.mode !== 'none') {
    prompt += `\nBody Mode: ${body.mode}\n`;
    if (body.json) {
      prompt += `Body (JSON):\n${body.json}\n`;
    } else if (body.text) {
      prompt += `Body (Text):\n${body.text}\n`;
    } else if (body.formUrlEncoded && body.formUrlEncoded.length > 0) {
      prompt += `Form URL Encoded Body:\n`;
      body.formUrlEncoded.forEach((f) => {
        if (f.enabled !== false) {
          prompt += `  - ${f.name}: ${f.value}\n`;
        }
      });
    } else if (body.multipartForm && body.multipartForm.length > 0) {
      prompt += `Multipart Form Body:\n`;
      body.multipartForm.forEach((f) => {
        if (f.enabled !== false) {
          prompt += `  - ${f.name}: ${f.value || '[file]'}\n`;
        }
      });
    }
  }

  if (description && description.trim()) {
    prompt += `\nUser Description: ${description.trim()}\n`;
  }

  prompt += `
Return a JSON object with the following structure (only include fields that have content):
{
  "docs": "string - request documentation/description",
  "tests": "string - JavaScript test code using res object",
  "script": {
    "req": "string - pre-request JavaScript code using req object",
    "res": "string - post-response JavaScript code using res object"
  },
  "vars": {
    "req": [{"name": "string", "value": "string", "enabled": true}],
    "res": [{"name": "string", "value": "string", "enabled": true}]
  },
  "assertions": [{"name": "string", "value": "string", "enabled": true, "operator": "eq"}]
}

Important Bruno syntax rules:
1. Tests: Use res object to access response. Examples:
   - res.status for HTTP status code
   - res.body for response body (parsed JSON if content-type is json)
   - res.headers for response headers
   
2. Assertions: Define test assertions with operators: eq, ne, gt, lt, gte, lte, contains, not_contains

3. Pre-request scripts (script.req): Use bru.setVar('name', 'value') to set variables

4. Post-response scripts (script.res): Use bru.setVar('name', res.body.field) to extract response data

5. Only include fields that have meaningful content. If there are no tests, omit the "tests" field.

6. Keep it simple and practical. Don't overcomplicate.

Return ONLY valid JSON, no markdown, no code fences, no explanations.`;

  return prompt;
};

const getExistingItemsInDirectory = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath);
    return files;
  } catch {
    return [];
  }
};

const transformRequestForJsonToBru = (requestObj) => {
  let type = _.get(requestObj, 'type');
  switch (type) {
    case 'http-request':
      type = 'http';
      break;
    case 'graphql-request':
      type = 'graphql';
      break;
    case 'grpc-request':
      type = 'grpc';
      break;
    case 'ws-request':
      type = 'ws';
      break;
    default:
      type = 'http';
  }

  const sequence = _.get(requestObj, 'seq');

  const bruJson = {
    meta: {
      name: _.get(requestObj, 'name'),
      type: type,
      seq: !_.isNaN(sequence) ? Number(sequence) : 1,
      tags: _.get(requestObj, 'tags', [])
    }
  };

  if (type === 'http' || type === 'graphql') {
    bruJson.http = {
      method: String(_.get(requestObj, 'request.method') ?? '').toLowerCase(),
      url: _.get(requestObj, 'request.url'),
      auth: _.get(requestObj, 'request.auth.mode', 'none'),
      body: _.get(requestObj, 'request.body.mode', 'none')
    };
    bruJson.params = _.get(requestObj, 'request.params', []);
    bruJson.body = _.get(requestObj, 'request.body', {
      mode: 'json',
      json: '{}'
    });
  }

  if (type === 'grpc') {
    bruJson.grpc = {
      url: _.get(requestObj, 'request.url'),
      auth: _.get(requestObj, 'request.auth.mode', 'none'),
      body: _.get(requestObj, 'request.body.mode', 'grpc')
    };
    const method = _.get(requestObj, 'request.method');
    const methodType = _.get(requestObj, 'request.methodType');
    const protoPath = _.get(requestObj, 'request.protoPath');
    if (method) bruJson.grpc.method = method;
    if (methodType) bruJson.grpc.methodType = methodType;
    if (protoPath) bruJson.grpc.protoPath = protoPath;
    bruJson.body = _.get(requestObj, 'request.body', {
      mode: 'grpc',
      grpc: _.get(requestObj, 'request.body.grpc', [
        {
          name: 'message 1',
          content: '{}'
        }
      ])
    });
    bruJson.metadata = _.get(requestObj, 'request.headers', []);
  } else if (type === 'ws') {
    bruJson.ws = {
      url: _.get(requestObj, 'request.url'),
      auth: _.get(requestObj, 'request.auth.mode', 'none'),
      body: _.get(requestObj, 'request.body.mode', 'ws')
    };
    bruJson.body = _.get(requestObj, 'request.body', {
      mode: 'ws',
      ws: _.get(requestObj, 'request.body.ws', [
        {
          name: 'message 1',
          content: '{}'
        }
      ])
    });
  }

  if (type !== 'grpc') {
    bruJson.headers = _.get(requestObj, 'request.headers', []);
  }
  bruJson.auth = _.get(requestObj, 'request.auth', {});
  bruJson.script = _.get(requestObj, 'request.script', {});
  bruJson.vars = {
    req: _.get(requestObj, 'request.vars.req', []),
    res: _.get(requestObj, 'request.vars.res', [])
  };
  bruJson.assertions = _.get(requestObj, 'request.assertions', []);
  bruJson.tests = _.get(requestObj, 'request.tests', '');
  bruJson.settings = _.get(requestObj, 'settings', {});
  bruJson.docs = _.get(requestObj, 'request.docs', '');
  bruJson.examples = _.get(requestObj, 'examples', []);

  return bruJson;
};

const registerAiCreateRequestIpc = (mainWindow) => {
  const sendToRenderer = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  ipcMain.handle(
    'renderer:ai-generate-request',
    async (event, { parsedRequest, description, collectionPathname, targetDirPath }) => {
      try {
        const config = getAiProviderConfig();
        if (!config.provider) {
          return {
            success: false,
            error: 'AI provider is not configured. Please set it up in Preferences > AI.'
          };
        }

        const prompt = buildPrompt({ parsedRequest, description });

        let fullContent = '';
        await streamLLM(config, prompt, (chunk, accumulated) => {
          fullContent = accumulated;
          sendToRenderer('main:ai-generate-request-chunk', { chunk, accumulated });
        });

        const aiGenerated = parseLLMResponse(fullContent);

        const collectionFormat = getCollectionFormat(collectionPathname);

        const targetDir = targetDirPath || collectionPathname;

        const existingItems = getExistingItemsInDirectory(targetDir);
        const existingNames = existingItems.map((f) => path.basename(f, path.extname(f)));

        let requestName = 'New Request';
        if (parsedRequest.url) {
          try {
            const urlObj = new URL(parsedRequest.url);
            const pathParts = urlObj.pathname.split('/').filter((p) => p);
            if (pathParts.length > 0) {
              requestName = pathParts[pathParts.length - 1];
              requestName = requestName.replace(/-/g, ' ').replace(/_/g, ' ');
              requestName = requestName.charAt(0).toUpperCase() + requestName.slice(1);
            }
          } catch {}
        }

        if (aiGenerated?.docs) {
          const lines = aiGenerated.docs.split('\n');
          if (lines.length > 0) {
            const firstLine = lines[0].trim();
            if (firstLine && firstLine.length > 0 && firstLine.length < 50) {
              requestName = firstLine;
            }
          }
        }

        const baseName = sanitizeName(requestName);
        const uniqueName = generateUniqueName(baseName, (name) => existingNames.includes(name));
        const filename = `${uniqueName}.${collectionFormat}`;
        const filePath = path.join(targetDir, filename);

        const requestObj = {
          name: uniqueName,
          filename: filename,
          type: 'http-request',
          request: {
            method: parsedRequest.method?.toLowerCase() || 'get',
            url: parsedRequest.url || '',
            headers: parsedRequest.headers || [],
            params: parsedRequest.params || [],
            auth: parsedRequest.auth || { mode: 'inherit' },
            body: parsedRequest.body || { mode: 'none' },
            script: {
              req: aiGenerated?.script?.req || null,
              res: aiGenerated?.script?.res || null
            },
            vars: {
              req: aiGenerated?.vars?.req || [],
              res: aiGenerated?.vars?.res || []
            },
            assertions: aiGenerated?.assertions || [],
            tests: aiGenerated?.tests || null,
            docs: aiGenerated?.docs || null
          },
          settings: {
            encodeUrl: true
          }
        };

        if (parsedRequest.url && parsedRequest.url.includes('?') && (!parsedRequest.params || parsedRequest.params.length === 0)) {
          const url = require('url');
          const parsedUrl = url.parse(parsedRequest.url, true);
          if (parsedUrl.query && Object.keys(parsedUrl.query).length > 0) {
            requestObj.request.params = Object.entries(parsedUrl.query).map(([key, value]) => ({
              name: key,
              value: value,
              enabled: true,
              type: 'query'
            }));
          }
        }

        const content = stringifyRequest(requestObj, { format: collectionFormat });
        await writeFile(filePath, content);

        sendToRenderer('main:ai-generate-request-done', {
          pathname: filePath,
          name: uniqueName,
          filename: filename
        });

        return {
          success: true,
          pathname: filePath,
          name: uniqueName,
          filename: filename,
          requestObj,
          aiGenerated
        };
      } catch (error) {
        console.error('AI generate request error:', error);
        sendToRenderer('main:ai-generate-request-error', { error: error.message });
        return { success: false, error: error.message };
      }
    }
  );
};

module.exports = registerAiCreateRequestIpc;
