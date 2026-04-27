import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';

const useAiMockGenerator = ({ onContentUpdate, originalContent }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState(-1);
  const [streamingContent, setStreamingContent] = useState('');

  const requestIdRef = useRef(null);
  const cleanupRef = useRef(null);
  const currentContentRef = useRef('');

  const resetState = useCallback(() => {
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
    setStreamingContent('');
    currentContentRef.current = '';
  }, []);

  const cancelGeneration = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (requestIdRef.current) {
      const { ipcRenderer } = window;
      if (ipcRenderer) {
        ipcRenderer.removeAllListeners(`main:ai-stream-chunk:${requestIdRef.current}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-complete:${requestIdRef.current}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-error:${requestIdRef.current}`);
      }
    }

    resetState();
  }, [resetState]);

  const parseCandidates = useCallback((content) => {
    try {
      const trimmed = content.trim();

      let jsonStr = trimmed;
      if (trimmed.startsWith('```json')) {
        jsonStr = trimmed.slice(7);
      } else if (trimmed.startsWith('```')) {
        jsonStr = trimmed.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }

      jsonStr = jsonStr.trim();

      const parsed = JSON.parse(jsonStr);

      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: nanoid(),
          content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
          index
        }));
      }

      return [{
        id: nanoid(),
        content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
        index: 0
      }];
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      return [{
        id: nanoid(),
        content: content,
        index: 0
      }];
    }
  }, []);

  const generateMock = useCallback(async (options) => {
    const { body, url, method, docs, schema, type, numCandidates = 3 } = options;

    cancelGeneration();

    setIsLoading(true);
    setError(null);
    setCandidates([]);
    setActiveCandidateIndex(-1);

    const requestId = nanoid();
    requestIdRef.current = requestId;

    try {
      const { ipcRenderer } = window;

      const hasApiKeyResult = await ipcRenderer.invoke('renderer:has-ai-api-key');

      if (!hasApiKeyResult.success || !hasApiKeyResult.hasApiKey) {
        setError('API key not configured. Please configure AI settings in Preferences.');
        setIsLoading(false);
        return;
      }

      setIsStreaming(true);
      currentContentRef.current = '';

      const handleChunk = (event, data) => {
        currentContentRef.current += data.chunk;
        setStreamingContent(currentContentRef.current);

        if (onContentUpdate) {
          onContentUpdate(currentContentRef.current, true);
        }
      };

      const handleComplete = (event, data) => {
        setIsStreaming(false);
        setIsLoading(false);

        const finalContent = data.content || currentContentRef.current;

        const parsedCandidates = parseCandidates(finalContent);
        setCandidates(parsedCandidates);

        if (parsedCandidates.length > 0) {
          setActiveCandidateIndex(0);
          if (onContentUpdate) {
            onContentUpdate(parsedCandidates[0].content, false);
          }
        }

        cleanupRef.current = null;
        ipcRenderer.removeAllListeners(`main:ai-stream-chunk:${requestId}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-complete:${requestId}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-error:${requestId}`);
      };

      const handleError = (event, data) => {
        setIsStreaming(false);
        setIsLoading(false);
        setError(data.error || 'Failed to generate mock data');

        if (originalContent !== undefined && originalContent !== null) {
          if (onContentUpdate) {
            onContentUpdate(originalContent, false);
          }
        }

        cleanupRef.current = null;
        ipcRenderer.removeAllListeners(`main:ai-stream-chunk:${requestId}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-complete:${requestId}`);
        ipcRenderer.removeAllListeners(`main:ai-stream-error:${requestId}`);
      };

      cleanupRef.current = () => {
        ipcRenderer.removeListener(`main:ai-stream-chunk:${requestId}`, handleChunk);
        ipcRenderer.removeListener(`main:ai-stream-complete:${requestId}`, handleComplete);
        ipcRenderer.removeListener(`main:ai-stream-error:${requestId}`, handleError);
      };

      ipcRenderer.on(`main:ai-stream-chunk:${requestId}`, handleChunk);
      ipcRenderer.on(`main:ai-stream-complete:${requestId}`, handleComplete);
      ipcRenderer.on(`main:ai-stream-error:${requestId}`, handleError);

      ipcRenderer.send('renderer:stream-ai-mock', {
        requestId,
        body,
        url,
        method,
        docs,
        schema,
        type,
        numCandidates
      });
    } catch (err) {
      console.error('Error generating mock:', err);
      setError(err.message || 'Failed to generate mock data');
      setIsLoading(false);
      setIsStreaming(false);

      if (originalContent !== undefined && originalContent !== null) {
        if (onContentUpdate) {
          onContentUpdate(originalContent, false);
        }
      }
    }
  }, [cancelGeneration, parseCandidates, onContentUpdate, originalContent]);

  const selectCandidate = useCallback((index) => {
    if (index >= 0 && index < candidates.length) {
      setActiveCandidateIndex(index);
      if (onContentUpdate) {
        onContentUpdate(candidates[index].content, false);
      }
    }
  }, [candidates, onContentUpdate]);

  const getActiveCandidate = useCallback(() => {
    if (activeCandidateIndex >= 0 && activeCandidateIndex < candidates.length) {
      return candidates[activeCandidateIndex];
    }
    return null;
  }, [activeCandidateIndex, candidates]);

  useEffect(() => {
    return () => {
      cancelGeneration();
    };
  }, [cancelGeneration]);

  return {
    isLoading,
    isStreaming,
    error,
    candidates,
    activeCandidateIndex,
    streamingContent,
    generateMock,
    cancelGeneration,
    selectCandidate,
    getActiveCandidate,
    hasCandidates: candidates.length > 0
  };
};

export default useAiMockGenerator;
