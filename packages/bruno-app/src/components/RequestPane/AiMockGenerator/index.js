import React, { useCallback, useEffect } from 'react';
import { IconWand, IconLoader2, IconAlertTriangle, IconSettings } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';
import useAiMockGenerator from 'hooks/useAiMockGenerator';
import { useDispatch } from 'react-redux';
import { updateActivePreferencesTab } from 'providers/ReduxStore/slices/app';
import toast from 'react-hot-toast';

const AiMockGenerator = ({
  body,
  url,
  method,
  docs,
  schema,
  type = 'json',
  onContentUpdate,
  originalContent,
  numCandidates = 3
}) => {
  const dispatch = useDispatch();

  const {
    isLoading,
    isStreaming,
    error,
    candidates,
    activeCandidateIndex,
    generateMock,
    cancelGeneration,
    selectCandidate,
    hasCandidates
  } = useAiMockGenerator({
    onContentUpdate,
    originalContent
  });

  const handleGenerate = useCallback(() => {
    if (isLoading || isStreaming) {
      cancelGeneration();
      return;
    }

    generateMock({
      body,
      url,
      method,
      docs,
      schema,
      type,
      numCandidates
    });
  }, [
    isLoading,
    isStreaming,
    generateMock,
    cancelGeneration,
    body,
    url,
    method,
    docs,
    schema,
    type,
    numCandidates
  ]);

  const handleOpenPreferences = useCallback(() => {
    dispatch(updateActivePreferencesTab({ tab: 'ai' }));
    toast('Please configure your AI provider settings');
  }, [dispatch]);

  const handleRetry = useCallback(() => {
    generateMock({
      body,
      url,
      method,
      docs,
      schema,
      type,
      numCandidates
    });
  }, [generateMock, body, url, method, docs, schema, type, numCandidates]);

  const buttonLabel = () => {
    if (isStreaming) {
      return 'Generating...';
    }
    if (isLoading) {
      return 'Loading...';
    }
    return 'AI Mock';
  };

  return (
    <StyledWrapper>
      <button
        type="button"
        className={`ai-button ${isLoading || isStreaming ? 'loading' : ''}`}
        onClick={handleGenerate}
        disabled={false}
      >
        {isLoading || isStreaming ? (
          <IconLoader2 className="animate-spin" size={14} strokeWidth={1.5} />
        ) : (
          <IconWand size={14} strokeWidth={1.5} />
        )}
        <span>{buttonLabel()}</span>
      </button>

      {isStreaming && (
        <div className="streaming-indicator">
          <span className="pulse" />
          <span>Streaming...</span>
        </div>
      )}

      {hasCandidates && !isStreaming && (
        <div className="candidate-selector">
          {candidates.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              className={`candidate-btn ${activeCandidateIndex === index ? 'active' : ''}`}
              onClick={() => selectCandidate(index)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="error-message">
          <IconAlertTriangle size={14} strokeWidth={1.5} />
          <span className="error-text">{error}</span>
          {error.includes('API key') || error.includes('configured') ? (
            <button
              type="button"
              className="retry-btn"
              onClick={handleOpenPreferences}
            >
              <IconSettings size={12} strokeWidth={1.5} />
              Configure
            </button>
          ) : (
            <button
              type="button"
              className="retry-btn"
              onClick={handleRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </StyledWrapper>
  );
};

export default AiMockGenerator;
