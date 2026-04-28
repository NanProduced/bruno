import React, { useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash/debounce';
import { useFormik } from 'formik';
import { useDispatch } from 'react-redux';
import { getAiProviderConfig, saveAiProviderConfig } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';

const PROVIDERS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'ollama', label: 'Ollama (Local)' }
];

const PROVIDER_MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  ollama: ['llama3', 'mistral', 'codellama', 'qwen2']
};

const Ai = () => {
  const dispatch = useDispatch();
  const initialLoadDone = useRef(false);

  const formik = useFormik({
    initialValues: {
      provider: '',
      apiKey: '',
      baseUrl: '',
      model: '',
      mockCandidateCount: 3
    },
    onSubmit: async (values) => {
      handleSave(values);
    }
  });

  useEffect(() => {
    dispatch(getAiProviderConfig()).then((result) => {
      if (result?.success && result.config) {
        formik.setValues(
          {
            provider: result.config.provider || '',
            apiKey: result.config.apiKey || '',
            baseUrl: result.config.baseUrl || '',
            model: result.config.model || '',
            mockCandidateCount: result.config.mockCandidateCount || 3
          },
          false
        );
      }
      initialLoadDone.current = true;
    });
  }, []);

  const handleSave = useCallback((values) => {
    dispatch(saveAiProviderConfig(values))
      .then((result) => {
        if (result?.success) {
          toast.success('AI provider settings saved');
        } else {
          toast.error(result?.error || 'Failed to save AI provider settings');
        }
      })
      .catch((err) => toast.error('Failed to save AI provider settings'));
  }, [dispatch]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const debouncedSave = useCallback(
    debounce((values) => {
      handleSaveRef.current(values);
    }, 500),
    []
  );

  useEffect(() => {
    if (initialLoadDone.current && formik.dirty) {
      debouncedSave(formik.values);
    }
    return () => {
      debouncedSave.flush();
    };
  }, [formik.values, formik.dirty, debouncedSave]);

  const currentProvider = formik.values.provider;
  const availableModels = PROVIDER_MODELS[currentProvider] || [];
  const isOllama = currentProvider === 'ollama';

  return (
    <StyledWrapper className="w-full">
      <div className="section-header">AI Provider</div>
      <p className="text-muted text-xs mt-1 mb-4">
        Configure an AI provider to generate mock request body data. API keys are encrypted and stored locally — they are never written to .bru files.
      </p>
      <form className="bruno-form" onSubmit={formik.handleSubmit}>
        <div className="flex flex-col mt-2">
          <label className="block select-none" htmlFor="provider">Provider</label>
          <select
            id="provider"
            name="provider"
            className="block textbox mt-2 w-48"
            onChange={(e) => {
              formik.setFieldValue('provider', e.target.value);
              formik.setFieldValue('model', '');
              formik.setFieldValue('apiKey', '');
              formik.setFieldValue('baseUrl', '');
            }}
            value={formik.values.provider}
          >
            <option value="">Select a provider</option>
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        {!isOllama && currentProvider && (
          <div className="flex flex-col mt-4">
            <label className="block select-none" htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              name="apiKey"
              type="password"
              className="block textbox mt-2 w-full max-w-md"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={formik.handleChange}
              value={formik.values.apiKey}
              placeholder={`Enter your ${PROVIDERS.find((p) => p.id === currentProvider)?.label} API key`}
            />
          </div>
        )}

        <div className="flex flex-col mt-4">
          <label className="block select-none" htmlFor="baseUrl">
            Base URL {isOllama ? '' : '(Optional — override default endpoint)'}
          </label>
          <input
            id="baseUrl"
            name="baseUrl"
            type="text"
            className="block textbox mt-2 w-full max-w-md"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={formik.handleChange}
            value={formik.values.baseUrl}
            placeholder={
              isOllama
                ? 'http://localhost:11434'
                : currentProvider === 'openai'
                  ? 'https://api.openai.com/v1'
                  : currentProvider === 'anthropic'
                    ? 'https://api.anthropic.com'
                    : ''
            }
          />
        </div>

        <div className="flex flex-col mt-4">
          <label className="block select-none" htmlFor="model">Model</label>
          {availableModels.length > 0 ? (
            <select
              id="model"
              name="model"
              className="block textbox mt-2 w-48"
              onChange={formik.handleChange}
              value={formik.values.model}
            >
              <option value="">Default</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              id="model"
              name="model"
              type="text"
              className="block textbox mt-2 w-48"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={formik.handleChange}
              value={formik.values.model}
              placeholder="e.g. gpt-4o-mini"
            />
          )}
        </div>

        <div className="flex flex-col mt-4">
          <label className="block select-none" htmlFor="mockCandidateCount">
            Mock Candidates Count
          </label>
          <p className="text-muted text-xs mt-1">Number of mock body variants generated per request (1-10)</p>
          <input
            id="mockCandidateCount"
            name="mockCandidateCount"
            type="number"
            min="1"
            max="10"
            className="block textbox mt-2 w-16"
            onChange={formik.handleChange}
            value={formik.values.mockCandidateCount}
          />
        </div>
      </form>
    </StyledWrapper>
  );
};

export default Ai;
