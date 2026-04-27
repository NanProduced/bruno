const Store = require('electron-store');
const { encryptString, decryptString, decryptStringSafe } = require('../utils/encryption');

const AI_CONFIG_STORE_NAME = 'ai-config';

const defaultAiConfig = {
  provider: 'openai',
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },
  anthropic: {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022'
  },
  custom: {
    apiKey: '',
    baseUrl: '',
    model: ''
  },
  mockGeneration: {
    numCandidates: 3,
    maxTokens: 2000
  }
};

class AiConfigStore {
  constructor() {
    this.store = new Store({
      name: AI_CONFIG_STORE_NAME,
      clearInvalidConfig: true
    });
  }

  getAiConfig() {
    const config = this.store.get('config', {});
    const result = { ...defaultAiConfig, ...config };

    if (result.openai?.apiKey) {
      const decrypted = decryptStringSafe(result.openai.apiKey);
      result.openai.apiKey = decrypted.success ? decrypted.value : '';
    }

    if (result.anthropic?.apiKey) {
      const decrypted = decryptStringSafe(result.anthropic.apiKey);
      result.anthropic.apiKey = decrypted.success ? decrypted.value : '';
    }

    if (result.custom?.apiKey) {
      const decrypted = decryptStringSafe(result.custom.apiKey);
      result.custom.apiKey = decrypted.success ? decrypted.value : '';
    }

    return result;
  }

  saveAiConfig(newConfig) {
    const configToSave = { ...newConfig };

    if (configToSave.openai?.apiKey) {
      configToSave.openai.apiKey = encryptString(configToSave.openai.apiKey);
    }

    if (configToSave.anthropic?.apiKey) {
      configToSave.anthropic.apiKey = encryptString(configToSave.anthropic.apiKey);
    }

    if (configToSave.custom?.apiKey) {
      configToSave.custom.apiKey = encryptString(configToSave.custom.apiKey);
    }

    this.store.set('config', configToSave);
  }

  clearAiConfig() {
    this.store.set('config', {});
  }

  hasApiKey() {
    const config = this.getAiConfig();
    const provider = config.provider;

    if (provider === 'openai') {
      return !!config.openai?.apiKey;
    } else if (provider === 'anthropic') {
      return !!config.anthropic?.apiKey;
    } else if (provider === 'custom') {
      return !!config.custom?.apiKey;
    }

    return false;
  }
}

const aiConfigStore = new AiConfigStore();

const getAiConfig = () => {
  return aiConfigStore.getAiConfig();
};

const saveAiConfig = (config) => {
  return aiConfigStore.saveAiConfig(config);
};

const clearAiConfig = () => {
  return aiConfigStore.clearAiConfig();
};

const hasApiKey = () => {
  return aiConfigStore.hasApiKey();
};

module.exports = {
  getAiConfig,
  saveAiConfig,
  clearAiConfig,
  hasApiKey,
  defaultAiConfig
};
