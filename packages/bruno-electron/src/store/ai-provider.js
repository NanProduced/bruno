const Store = require('electron-store');
const { encryptStringSafe, decryptStringSafe } = require('../utils/encryption');

class AiProviderStore {
  constructor() {
    this.store = new Store({
      name: 'ai-provider',
      clearInvalidConfig: true
    });
  }

  getConfig() {
    const raw = this.store.get('config', {});
    return {
      provider: raw.provider || '',
      apiKey: raw.encryptedApiKey ? this._decryptApiKey(raw.encryptedApiKey) : '',
      baseUrl: raw.baseUrl || '',
      model: raw.model || '',
      mockCandidateCount: raw.mockCandidateCount || 3
    };
  }

  saveConfig(config) {
    const toStore = {
      provider: config.provider || '',
      encryptedApiKey: config.apiKey ? this._encryptApiKey(config.apiKey) : '',
      baseUrl: config.baseUrl || '',
      model: config.model || '',
      mockCandidateCount: config.mockCandidateCount || 3
    };
    this.store.set('config', toStore);
  }

  _encryptApiKey(apiKey) {
    const result = encryptStringSafe(apiKey);
    return result.success ? result.value : '';
  }

  _decryptApiKey(encrypted) {
    const result = decryptStringSafe(encrypted);
    return result.success ? result.value : '';
  }
}

const aiProviderStore = new AiProviderStore();

const getAiProviderConfig = () => aiProviderStore.getConfig();
const saveAiProviderConfig = (config) => aiProviderStore.saveConfig(config);

module.exports = {
  getAiProviderConfig,
  saveAiProviderConfig
};
