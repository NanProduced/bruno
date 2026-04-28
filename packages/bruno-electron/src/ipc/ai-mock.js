const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const axios = require('axios');
const { getAiProviderConfig, saveAiProviderConfig } = require('../store/ai-provider');
const jsyaml = require('js-yaml');

const getSpecsDir = () => path.join(app.getPath('userData'), 'specs');

const loadSpecMetadata = () => {
  const metadataPath = path.join(getSpecsDir(), 'metadata.json');
  try {
    if (fs.existsSync(metadataPath)) {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
  } catch {}
  return {};
};

const getSpecEntryForCollection = (collectionPath) => {
  return loadSpecMetadata()[collectionPath] || [];
};

const readSpecContent = (collectionPath) => {
  const entries = getSpecEntryForCollection(collectionPath);
  if (!entries.length) return null;
  const specPath = path.join(getSpecsDir(), entries[0].filename);
  if (!fs.existsSync(specPath)) return null;
  const content = fs.readFileSync(specPath, 'utf8');
  try {
    return JSON.parse(content);
  } catch {
    return jsyaml.load(content);
  }
};

const resolveRefs = (obj, root, cache = new Map()) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => resolveRefs(item, root, cache));

  if (obj.$ref && typeof obj.$ref === 'string') {
    if (cache.has(obj.$ref)) return cache.get(obj.$ref);
    const resolved = resolveRefPath(obj.$ref, root);
    if (resolved !== null) {
      cache.set(obj.$ref, {});
      const deep = resolveRefs(resolved, root, cache);
      cache.set(obj.$ref, deep);
      return deep;
    }
    return obj;
  }

  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = resolveRefs(obj[key], root, cache);
  }
  return result;
};

const resolveRefPath = (ref, root) => {
  const parts = ref.replace(/^#\/?/, '').split('/');
  let current = root;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
};

const mergeAllOf = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(mergeAllOf);

  if (schema.allOf && Array.isArray(schema.allOf)) {
    const merged = { ...schema };
    delete merged.allOf;
    for (const sub of schema.allOf) {
      const resolved = mergeAllOf(sub);
      if (resolved && typeof resolved === 'object') {
        merged.properties = { ...merged.properties, ...resolved.properties };
        merged.required = [...(merged.required || []), ...(resolved.required || [])];
        if (resolved.type && !merged.type) merged.type = resolved.type;
      }
    }
    return merged;
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    const first = schema.oneOf[0];
    if (first) {
      const resolved = mergeAllOf(first);
      return { ...schema, ...resolved, oneOf: undefined };
    }
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    const first = schema.anyOf[0];
    if (first) {
      const resolved = mergeAllOf(first);
      return { ...schema, ...resolved, anyOf: undefined };
    }
  }

  const result = {};
  for (const key of Object.keys(schema)) {
    result[key] = mergeAllOf(schema[key]);
  }
  return result;
};

const normalizeUrlPath = (urlStr) => {
  if (!urlStr) return '';
  return urlStr
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\?.*$/, '')
    .replace(/{([^}]+)}/g, ':$1')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
};

const findSchemaForRequest = (spec, method, urlPath) => {
  if (!spec || !spec.paths) return null;

  const normalizedRequestPath = normalizeUrlPath(urlPath);

  for (const [specPath, pathItem] of Object.entries(spec.paths)) {
    const normalizedSpecPath = normalizeUrlPath(specPath);

    if (normalizedSpecPath === normalizedRequestPath) {
      const op = pathItem[method.toLowerCase()];
      if (op) {
        const bodyContent = op.requestBody?.content;
        if (bodyContent) {
          const jsonContent = bodyContent['application/json'];
          if (jsonContent?.schema) {
            return jsonContent.schema;
          }
          const firstContent = Object.values(bodyContent)[0];
          if (firstContent?.schema) {
            return firstContent.schema;
          }
        }
      }
    }
  }
  return null;
};

const buildPrompt = ({ schema, existingBody, method, url, docs, candidateCount }) => {
  let prompt = `You are a mock data generator for API requests. Generate ${candidateCount} different realistic mock JSON body examples for an HTTP ${method.toUpperCase()} request to "${url}".`;

  if (schema) {
    prompt += `\n\nThe request body should conform to this JSON Schema:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
  }

  if (existingBody && existingBody.trim()) {
    prompt += `\n\nThe current body content is:\n\`\`\`json\n${existingBody}\n\`\`\`\nUse it as a structural reference but generate different realistic values.`;
  }

  if (docs && docs.trim()) {
    prompt += `\n\nAdditional context from the request documentation:\n${docs.substring(0, 1000)}`;
  }

  prompt += `\n\nIMPORTANT: Return your response as a JSON array with exactly ${candidateCount} objects. Each object should have a "name" field (a short descriptive name) and a "body" field (the mock JSON body as a string). Example format:\n[{"name": "Basic example", "body": "{\\\"key\\\": \\\"value\\\"}"}]\n\nMake the mock data realistic, diverse, and consistent with the schema. Use appropriate data types, realistic string values, and valid formats (emails, URLs, dates, etc.). Do NOT include markdown formatting or code fences. Return ONLY the JSON array.`;

  return prompt;
};

const callOpenAI = async ({ apiKey, baseUrl, model, prompt }) => {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';

  const modelName = model || 'gpt-4o-mini';

  const response = await axios.post(
    url,
    {
      model: modelName,
      messages: [
        { role: 'system', content: 'You are a mock data generator. Always respond with valid JSON only, no markdown.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 4096
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 60000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from LLM');
  return content;
};

const callAnthropic = async ({ apiKey, baseUrl, model, prompt }) => {
  const url = baseUrl
    ? `${baseUrl.replace(/\/+$/, '')}/messages`
    : 'https://api.anthropic.com/v1/messages';

  const modelName = model || 'claude-sonnet-4-20250514';

  const response = await axios.post(
    url,
    {
      model: modelName,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      timeout: 60000
    }
  );

  const content = response.data?.content?.[0]?.text;
  if (!content) throw new Error('Empty response from LLM');
  return content;
};

const callOllama = async ({ baseUrl, model, prompt }) => {
  const url = `${(baseUrl || 'http://localhost:11434').replace(/\/+$/, '')}/api/generate`;

  const modelName = model || 'llama3';

  const response = await axios.post(
    url,
    {
      model: modelName,
      prompt,
      stream: false,
      options: {
        temperature: 0.8
      }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    }
  );

  const content = response.data?.response;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
};

const callLLM = async (config, prompt, candidateCount) => {
  const { provider, apiKey, baseUrl, model } = config;

  switch (provider) {
    case 'openai':
      if (!apiKey) throw new Error('OpenAI API key is not configured');
      return callOpenAI({ apiKey, baseUrl, model, prompt });
    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic API key is not configured');
      return callAnthropic({ apiKey, baseUrl, model, prompt });
    case 'ollama':
      return callOllama({ baseUrl, model, prompt });
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
};

const parseLLMResponse = (rawContent, candidateCount) => {
  let content = rawContent.trim();
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, candidateCount).map((item, idx) => ({
        name: item.name || `Mock ${idx + 1}`,
        body: typeof item.body === 'string' ? item.body : JSON.stringify(item.body, null, 2)
      }));
    }
    return [
      {
        name: 'Generated Mock',
        body: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
      }
    ];
  } catch {
    try {
      const jsonStr = content.match(/\[[\s\S]*\]/)?.[0];
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        return parsed.slice(0, candidateCount).map((item, idx) => ({
          name: item.name || `Mock ${idx + 1}`,
          body: typeof item.body === 'string' ? item.body : JSON.stringify(item.body, null, 2)
        }));
      }
    } catch {}

    return [
      {
        name: 'Generated Mock',
        body: content
      }
    ];
  }
};

const registerAiMockIpc = (mainWindow) => {
  ipcMain.handle('renderer:get-ai-provider-config', async () => {
    try {
      const config = getAiProviderConfig();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('renderer:save-ai-provider-config', async (event, config) => {
    try {
      saveAiProviderConfig(config);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'renderer:generate-ai-mock',
    async (event, { collectionPath, method, url, existingBody, docs, bodyType }) => {
      try {
        const config = getAiProviderConfig();
        if (!config.provider) {
          return { success: false, error: 'AI provider is not configured. Please set it up in Preferences > AI.' };
        }

        let schema = null;
        if (collectionPath) {
          const spec = readSpecContent(collectionPath);
          if (spec) {
            const resolved = resolveRefs(spec, spec);
            const merged = mergeAllOf(resolved);
            schema = findSchemaForRequest(merged, method, url);
            if (schema) {
              schema = mergeAllOf(resolveRefs(schema, merged));
            }
          }
        }

        const candidateCount = config.mockCandidateCount || 3;
        const prompt = buildPrompt({ schema, existingBody, method, url, docs, candidateCount });
        const rawContent = await callLLM(config, prompt, candidateCount);
        const candidates = parseLLMResponse(rawContent, candidateCount);

        return { success: true, candidates };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle('renderer:generate-ai-mock-one-more', async (event, { collectionPath, method, url, existingBody, docs }) => {
    try {
      const config = getAiProviderConfig();
      if (!config.provider) {
        return { success: false, error: 'AI provider is not configured.' };
      }

      let schema = null;
      if (collectionPath) {
        const spec = readSpecContent(collectionPath);
        if (spec) {
          const resolved = resolveRefs(spec, spec);
          const merged = mergeAllOf(resolved);
          schema = findSchemaForRequest(merged, method, url);
          if (schema) {
            schema = mergeAllOf(resolveRefs(schema, merged));
          }
        }
      }

      const prompt = buildPrompt({ schema, existingBody, method, url, docs, candidateCount: 1 });
      const rawContent = await callLLM(config, prompt, 1);
      const candidates = parseLLMResponse(rawContent, 1);

      return { success: true, candidates };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};

module.exports = registerAiMockIpc;
