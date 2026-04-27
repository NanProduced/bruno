const { ipcMain } = require('electron');
const { getAiConfig, saveAiConfig, clearAiConfig, hasApiKey, defaultAiConfig } = require('../store/ai-config');

const registerAiIpc = (mainWindow) => {
  ipcMain.handle('renderer:get-ai-config', async () => {
    try {
      const config = getAiConfig();
      return {
        success: true,
        data: {
          ...config,
          openai: {
            ...config.openai,
            apiKey: config.openai.apiKey ? '********' : ''
          },
          anthropic: {
            ...config.anthropic,
            apiKey: config.anthropic.apiKey ? '********' : ''
          },
          custom: {
            ...config.custom,
            apiKey: config.custom.apiKey ? '********' : ''
          }
        }
      };
    } catch (error) {
      console.error('Error getting AI config:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('renderer:save-ai-config', async (event, config) => {
    try {
      const currentConfig = getAiConfig();

      const newConfig = {
        ...currentConfig,
        ...config
      };

      if (config.openai) {
        if (config.openai.apiKey === '********') {
          newConfig.openai.apiKey = currentConfig.openai.apiKey;
        }
        newConfig.openai = { ...currentConfig.openai, ...config.openai };
      }

      if (config.anthropic) {
        if (config.anthropic.apiKey === '********') {
          newConfig.anthropic.apiKey = currentConfig.anthropic.apiKey;
        }
        newConfig.anthropic = { ...currentConfig.anthropic, ...config.anthropic };
      }

      if (config.custom) {
        if (config.custom.apiKey === '********') {
          newConfig.custom.apiKey = currentConfig.custom.apiKey;
        }
        newConfig.custom = { ...currentConfig.custom, ...config.custom };
      }

      saveAiConfig(newConfig);

      return {
        success: true
      };
    } catch (error) {
      console.error('Error saving AI config:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('renderer:clear-ai-config', async () => {
    try {
      clearAiConfig();
      return {
        success: true
      };
    } catch (error) {
      console.error('Error clearing AI config:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('renderer:has-ai-api-key', async () => {
    try {
      return {
        success: true,
        hasApiKey: hasApiKey()
      };
    } catch (error) {
      console.error('Error checking AI API key:', error);
      return {
        success: false,
        error: error.message,
        hasApiKey: false
      };
    }
  });

  ipcMain.handle('renderer:generate-ai-mock', async (event, options) => {
    try {
      const config = getAiConfig();
      const { body, url, method, docs, schema, type, numCandidates } = options;

      if (!config.provider) {
        return {
          success: false,
          error: 'AI provider not configured. Please configure AI settings in Preferences.'
        };
      }

      const providerConfig = config[config.provider];

      if (!providerConfig?.apiKey) {
        return {
          success: false,
          error: 'API key not configured. Please configure API key in Preferences.'
        };
      }

      const baseUrl = providerConfig.baseUrl || getDefaultBaseUrl(config.provider);
      const model = providerConfig.model || getDefaultModel(config.provider);

      const prompt = buildMockPrompt({
        body,
        url,
        method,
        docs,
        schema,
        type,
        numCandidates: numCandidates || config.mockGeneration?.numCandidates || 1
      });

      const response = await callAiApi({
        provider: config.provider,
        apiKey: providerConfig.apiKey,
        baseUrl,
        model,
        prompt,
        maxTokens: config.mockGeneration?.maxTokens || 2000
      });

      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Error generating AI mock:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate mock data'
      };
    }
  });

  ipcMain.on('renderer:stream-ai-mock', async (event, options) => {
    const requestId = options.requestId;

    try {
      const config = getAiConfig();
      const { body, url, method, docs, schema, type, numCandidates } = options;

      if (!config.provider) {
        mainWindow.webContents.send(`main:ai-stream-error:${requestId}`, {
          error: 'AI provider not configured. Please configure AI settings in Preferences.'
        });
        return;
      }

      const providerConfig = config[config.provider];

      if (!providerConfig?.apiKey) {
        mainWindow.webContents.send(`main:ai-stream-error:${requestId}`, {
          error: 'API key not configured. Please configure API key in Preferences.'
        });
        return;
      }

      const baseUrl = providerConfig.baseUrl || getDefaultBaseUrl(config.provider);
      const model = providerConfig.model || getDefaultModel(config.provider);

      const prompt = buildMockPrompt({
        body,
        url,
        method,
        docs,
        schema,
        type,
        numCandidates: numCandidates || config.mockGeneration?.numCandidates || 1
      });

      await streamAiApi({
        provider: config.provider,
        apiKey: providerConfig.apiKey,
        baseUrl,
        model,
        prompt,
        maxTokens: config.mockGeneration?.maxTokens || 2000,
        onChunk: (chunk) => {
          mainWindow.webContents.send(`main:ai-stream-chunk:${requestId}`, {
            chunk
          });
        },
        onComplete: (fullText) => {
          mainWindow.webContents.send(`main:ai-stream-complete:${requestId}`, {
            content: fullText
          });
        },
        onError: (error) => {
          mainWindow.webContents.send(`main:ai-stream-error:${requestId}`, {
            error: error.message || 'Stream error'
          });
        }
      });
    } catch (error) {
      console.error('Error streaming AI mock:', error);
      mainWindow.webContents.send(`main:ai-stream-error:${requestId}`, {
        error: error.message || 'Failed to stream mock data'
      });
    }
  });
};

function getDefaultBaseUrl(provider) {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    default:
      return '';
  }
}

function getDefaultModel(provider) {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      return '';
  }
}

function buildMockPrompt({ body, url, method, docs, schema, type, numCandidates }) {
  const isJson = type === 'json';
  const isGraphQL = type === 'graphql';

  let contextInfo = '';

  if (url) {
    contextInfo += `Request URL: ${url}\n`;
  }
  if (method) {
    contextInfo += `HTTP Method: ${method}\n`;
  }

  if (schema) {
    contextInfo += `\nSchema:\n${schema}\n`;
  }

  if (body) {
    contextInfo += `\nCurrent Body:\n${body}\n`;
  }

  if (docs) {
    contextInfo += `\nDocumentation:\n${docs}\n`;
  }

  if (isGraphQL) {
    return `Generate realistic mock data for a GraphQL request.

${contextInfo}

Please generate ${numCandidates} different realistic mock response(s). 

Important requirements:
1. The mock data must be valid JSON
2. Use realistic values (e.g., actual names, dates, numbers that make sense)
3. Follow the schema structure if provided
4. Each candidate should be distinct but still realistic
5. Do not include any markdown formatting or code block markers - just return raw JSON

Return the result as a JSON array with ${numCandidates} elements. Each element should be a complete mock response object.`;
  }

  return `Generate realistic mock data for a JSON request body or response.

${contextInfo}

Please generate ${numCandidates} different realistic mock JSON body/response(s).

Important requirements:
1. The mock data must be valid JSON
2. Use realistic values (e.g., actual names, dates, numbers that make sense for the context)
3. Follow the schema structure if provided
4. If there's an existing body, use it as a reference but make the mock data more complete and realistic
5. Each candidate should be distinct but still realistic
6. Do not include any markdown formatting or code block markers - just return raw JSON

Return the result as a JSON array with ${numCandidates} elements. Each element should be a complete mock JSON object.`;
}

async function callAiApi({ provider, apiKey, baseUrl, model, prompt, maxTokens }) {
  const axios = require('axios');

  let response;

  if (provider === 'openai' || (provider === 'custom' && baseUrl.includes('openai'))) {
    const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

    response = await axios.post(
      `${endpoint}/chat/completions`,
      {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices[0].message.content;
  } else if (provider === 'anthropic') {
    response = await axios.post(
      `${baseUrl}/v1/messages`,
      {
        model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        system: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    return response.data.content[0].text;
  } else if (provider === 'custom') {
    const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

    response = await axios.post(
      `${endpoint}/chat/completions`,
      {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

async function streamAiApi({ provider, apiKey, baseUrl, model, prompt, maxTokens, onChunk, onComplete, onError }) {
  const axios = require('axios');

  let fullText = '';

  try {
    if (provider === 'openai' || (provider === 'custom' && baseUrl.includes('openai'))) {
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete(fullText);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
            }
          }
        }
      }

      onComplete(fullText);
    } else if (provider === 'anthropic') {
      const response = await axios.post(
        `${baseUrl}/v1/messages`,
        {
          model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          system: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.',
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text || '';
                if (content) {
                  fullText += content;
                  onChunk(content);
                }
              } else if (parsed.type === 'message_stop') {
                onComplete(fullText);
                return;
              }
            } catch (e) {
            }
          }
        }
      }

      onComplete(fullText);
    } else if (provider === 'custom') {
      const endpoint = baseUrl.endsWith('/v1') ? baseUrl : `${baseUrl}/v1`;

      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates realistic mock data for API testing. Always return valid JSON without any markdown formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          stream: true
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: 'stream'
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onComplete(fullText);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(content);
              }
            } catch (e) {
            }
          }
        }
      }

      onComplete(fullText);
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  } catch (error) {
    onError(error);
  }
}

module.exports = registerAiIpc;
