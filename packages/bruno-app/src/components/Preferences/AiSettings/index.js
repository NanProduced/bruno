import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import debounce from 'lodash/debounce';
import toast from 'react-hot-toast';
import { IconEye, IconEyeOff } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' }
];

const DEFAULT_CONFIG = {
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

const AiSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showApiKey, setShowApiKey] = useState({
    openai: false,
    anthropic: false,
    custom: false
  });

  const aiConfigSchema = Yup.object().shape({
    provider: Yup.string().oneOf(['openai', 'anthropic', 'custom']).required('Provider is required'),
    openai: Yup.object().shape({
      apiKey: Yup.string(),
      baseUrl: Yup.string().url('Must be a valid URL'),
      model: Yup.string()
    }),
    anthropic: Yup.object().shape({
      apiKey: Yup.string(),
      baseUrl: Yup.string().url('Must be a valid URL'),
      model: Yup.string()
    }),
    custom: Yup.object().shape({
      apiKey: Yup.string(),
      baseUrl: Yup.string().url('Must be a valid URL'),
      model: Yup.string()
    }),
    mockGeneration: Yup.object().shape({
      numCandidates: Yup.number()
        .min(1, 'Minimum 1 candidate')
        .max(10, 'Maximum 10 candidates')
        .integer('Must be an integer'),
      maxTokens: Yup.number()
        .min(100, 'Minimum 100 tokens')
        .max(10000, 'Maximum 10000 tokens')
        .integer('Must be an integer')
    })
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: DEFAULT_CONFIG,
    validationSchema: aiConfigSchema,
    onSubmit: async (values) => {
      try {
        const validatedValues = await aiConfigSchema.validate(values, { abortEarly: true });
        handleSave(validatedValues);
      } catch (error) {
        console.error('AI config validation error:', error.message);
      }
    }
  });

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const { ipcRenderer } = window;
      const result = await ipcRenderer.invoke('renderer:get-ai-config');

      if (result.success) {
        formik.setValues({
          ...DEFAULT_CONFIG,
          ...result.data
        });
      } else {
        toast.error('Failed to load AI configuration');
      }
    } catch (error) {
      console.error('Error loading AI config:', error);
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = useCallback(async (values) => {
    try {
      const { ipcRenderer } = window;
      const result = await ipcRenderer.invoke('renderer:save-ai-config', values);

      if (result.success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 2000);
        toast.success('AI configuration saved');
      } else {
        setSaveStatus('error');
        toast.error('Failed to save AI configuration');
      }
    } catch (error) {
      console.error('Error saving AI config:', error);
      setSaveStatus('error');
      toast.error('Failed to save AI configuration');
    }
  }, []);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const debouncedSave = useCallback(
    debounce((values) => {
      aiConfigSchema.validate(values, { abortEarly: true })
        .then((validatedValues) => {
          handleSaveRef.current(validatedValues);
        })
        .catch((error) => {
        });
    }, 500),
    [aiConfigSchema]
  );

  useEffect(() => {
    if (formik.dirty && formik.isValid && !loading) {
      debouncedSave(formik.values);
    }
    return () => {
      debouncedSave.flush();
    };
  }, [formik.values, formik.dirty, formik.isValid, loading, debouncedSave]);

  const toggleApiKeyVisibility = (provider) => {
    setShowApiKey((prev) => ({
      ...prev,
      [provider]: !prev[provider]
    }));
  };

  const getProviderConfig = () => {
    const provider = formik.values.provider;
    return formik.values[provider] || {};
  };

  if (loading) {
    return (
      <StyledWrapper>
        <div className="section-header">AI Settings</div>
        <div className="text-gray-500">Loading configuration...</div>
      </StyledWrapper>
    );
  }

  return (
    <StyledWrapper>
      <div className="section-header">AI Settings</div>
      <p className="text-gray-500 dark:text-gray-400 mb-4 text-wrap">
        Configure AI provider settings for generating mock data. Your API key is encrypted and stored locally.
      </p>

      <form onSubmit={formik.handleSubmit}>
        <div className="section-group">
          <div className="provider-radio">
            <label className="block mb-2 font-medium">AI Provider</label>
            {AI_PROVIDERS.map((provider) => (
              <label key={provider.value}>
                <input
                  type="radio"
                  name="provider"
                  value={provider.value}
                  checked={formik.values.provider === provider.value}
                  onChange={formik.handleChange}
                  className="mousetrap"
                />
                {provider.label}
              </label>
            ))}
          </div>
        </div>

        {formik.values.provider === 'openai' && (
          <div className="section-group">
            <div className="form-group">
              <label htmlFor="openai.apiKey">API Key</label>
              <div className="api-key-input">
                <input
                  type={showApiKey.openai ? 'text' : 'password'}
                  name="openai.apiKey"
                  id="openai.apiKey"
                  value={formik.values.openai.apiKey}
                  onChange={formik.handleChange}
                  placeholder="sk-..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => toggleApiKeyVisibility('openai')}
                  tabIndex="-1"
                >
                  {showApiKey.openai ? (
                    <IconEyeOff size={18} strokeWidth={1.5} />
                  ) : (
                    <IconEye size={18} strokeWidth={1.5} />
                  )}
                </button>
              </div>
              <div className="input-hint">Your OpenAI API key. Get one from https://platform.openai.com/api-keys</div>
            </div>

            <div className="form-group">
              <label htmlFor="openai.baseUrl">Base URL (Optional)</label>
              <input
                type="text"
                name="openai.baseUrl"
                id="openai.baseUrl"
                value={formik.values.openai.baseUrl}
                onChange={formik.handleChange}
                placeholder="https://api.openai.com/v1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">Default: https://api.openai.com/v1</div>
            </div>

            <div className="form-group">
              <label htmlFor="openai.model">Model</label>
              <input
                type="text"
                name="openai.model"
                id="openai.model"
                value={formik.values.openai.model}
                onChange={formik.handleChange}
                placeholder="gpt-4o"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">e.g., gpt-4o, gpt-4o-mini, gpt-4-turbo</div>
            </div>
          </div>
        )}

        {formik.values.provider === 'anthropic' && (
          <div className="section-group">
            <div className="form-group">
              <label htmlFor="anthropic.apiKey">API Key</label>
              <div className="api-key-input">
                <input
                  type={showApiKey.anthropic ? 'text' : 'password'}
                  name="anthropic.apiKey"
                  id="anthropic.apiKey"
                  value={formik.values.anthropic.apiKey}
                  onChange={formik.handleChange}
                  placeholder="sk-ant-..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => toggleApiKeyVisibility('anthropic')}
                  tabIndex="-1"
                >
                  {showApiKey.anthropic ? (
                    <IconEyeOff size={18} strokeWidth={1.5} />
                  ) : (
                    <IconEye size={18} strokeWidth={1.5} />
                  )}
                </button>
              </div>
              <div className="input-hint">Your Anthropic API key. Get one from https://console.anthropic.com/settings/keys</div>
            </div>

            <div className="form-group">
              <label htmlFor="anthropic.baseUrl">Base URL (Optional)</label>
              <input
                type="text"
                name="anthropic.baseUrl"
                id="anthropic.baseUrl"
                value={formik.values.anthropic.baseUrl}
                onChange={formik.handleChange}
                placeholder="https://api.anthropic.com"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">Default: https://api.anthropic.com</div>
            </div>

            <div className="form-group">
              <label htmlFor="anthropic.model">Model</label>
              <input
                type="text"
                name="anthropic.model"
                id="anthropic.model"
                value={formik.values.anthropic.model}
                onChange={formik.handleChange}
                placeholder="claude-3-5-sonnet-20241022"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">e.g., claude-3-5-sonnet-20241022, claude-3-opus-20240229</div>
            </div>
          </div>
        )}

        {formik.values.provider === 'custom' && (
          <div className="section-group">
            <div className="form-group">
              <label htmlFor="custom.apiKey">API Key</label>
              <div className="api-key-input">
                <input
                  type={showApiKey.custom ? 'text' : 'password'}
                  name="custom.apiKey"
                  id="custom.apiKey"
                  value={formik.values.custom.apiKey}
                  onChange={formik.handleChange}
                  placeholder="Enter your API key"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => toggleApiKeyVisibility('custom')}
                  tabIndex="-1"
                >
                  {showApiKey.custom ? (
                    <IconEyeOff size={18} strokeWidth={1.5} />
                  ) : (
                    <IconEye size={18} strokeWidth={1.5} />
                  )}
                </button>
              </div>
              <div className="input-hint">Your API key for the custom provider</div>
            </div>

            <div className="form-group">
              <label htmlFor="custom.baseUrl">Base URL</label>
              <input
                type="text"
                name="custom.baseUrl"
                id="custom.baseUrl"
                value={formik.values.custom.baseUrl}
                onChange={formik.handleChange}
                placeholder="https://your-api-endpoint.com/v1"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">The base URL for your OpenAI-compatible API endpoint</div>
            </div>

            <div className="form-group">
              <label htmlFor="custom.model">Model</label>
              <input
                type="text"
                name="custom.model"
                id="custom.model"
                value={formik.values.custom.model}
                onChange={formik.handleChange}
                placeholder="e.g., gpt-4"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">The model name to use</div>
            </div>
          </div>
        )}

        <div className="mock-settings">
          <div className="section-title">Mock Generation Settings</div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mockGeneration.numCandidates">Number of Candidates</label>
              <input
                type="number"
                name="mockGeneration.numCandidates"
                id="mockGeneration.numCandidates"
                value={formik.values.mockGeneration.numCandidates}
                onChange={formik.handleChange}
                min={1}
                max={10}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">How many mock variants to generate (1-10)</div>
            </div>

            <div className="form-group">
              <label htmlFor="mockGeneration.maxTokens">Max Tokens</label>
              <input
                type="number"
                name="mockGeneration.maxTokens"
                id="mockGeneration.maxTokens"
                value={formik.values.mockGeneration.maxTokens}
                onChange={formik.handleChange}
                min={100}
                max={10000}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <div className="input-hint">Maximum tokens per response (100-10000)</div>
            </div>
          </div>
        </div>

        {saveStatus && (
          <div className={`save-status ${saveStatus}`}>
            {saveStatus === 'success' ? 'Configuration saved successfully!' : 'Failed to save configuration'}
          </div>
        )}
      </form>
    </StyledWrapper>
  );
};

export default AiSettings;
