import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import get from 'lodash/get';
import { IconX, IconRefresh, IconChevronRight, IconChevronDown } from '@tabler/icons';
import { updateRequestBody, updateRequestGraphqlVariables } from 'providers/ReduxStore/slices/collections';
import { dismissPanel, addCandidate, generationFailure, appendStreamChunk, generationSuccess } from 'providers/ReduxStore/slices/aiMock';
import { prettifyJsonString } from 'utils/common/index';
import { toastError } from 'utils/common/error';
import StyledWrapper from './StyledWrapper';

const DiffView = ({ original, modified }) => {
  const diffLines = useMemo(() => {
    const origLines = (original || '').split('\n');
    const modLines = (modified || '').split('\n');
    const maxLen = Math.max(origLines.length, modLines.length);
    const lines = [];

    for (let i = 0; i < maxLen; i++) {
      const o = origLines[i] !== undefined ? origLines[i] : '';
      const m = modLines[i] !== undefined ? modLines[i] : '';
      if (o === m) {
        lines.push({ type: 'equal', original: o, modified: m });
      } else {
        if (o) lines.push({ type: 'removed', original: o, modified: '' });
        if (m) lines.push({ type: 'added', original: '', modified: m });
      }
    }
    return lines;
  }, [original, modified]);

  return (
    <div className="diff-view">
      <div className="diff-content">
        {diffLines.map((line, idx) => (
          <div key={idx} className={`diff-line diff-${line.type}`}>
            <span className="line-num">{idx + 1}</span>
            <span className="line-prefix">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            <span className="line-text">{line.type === 'removed' ? line.original : line.modified}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const MockCandidateItem = ({ candidate, index, originalBody, onSelect }) => {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="mock-candidate">
      <div className="candidate-header" onClick={() => setExpanded(!expanded)}>
        <span className="expand-icon">
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span className="candidate-name">{candidate.name || `Mock ${index + 1}`}</span>
        <button
          className="use-btn"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(candidate.body);
          }}
        >
          Use
        </button>
      </div>
      {expanded && (
        <div className="candidate-body">
          <DiffView original={originalBody} modified={candidate.body} />
        </div>
      )}
    </div>
  );
};

const MockCandidatesPanel = ({ item, collection, bodyType }) => {
  const dispatch = useDispatch();
  const { isGenerating, candidates, error, showPanel, originalBody, streamingText } = useSelector((state) => state.aiMock);

  useEffect(() => {
    const { ipcRenderer } = window;

    const unsubChunk = ipcRenderer.on('main:ai-mock-chunk', (data) => {
      dispatch(appendStreamChunk({ chunk: data.chunk, accumulated: data.accumulated }));
    });

    const unsubDone = ipcRenderer.on('main:ai-mock-done', (data) => {
      dispatch(generationSuccess({ candidates: data.candidates }));
    });

    const unsubError = ipcRenderer.on('main:ai-mock-error', (data) => {
      dispatch(generationFailure({ error: data.error }));
    });

    return () => {
      unsubChunk();
      unsubDone();
      unsubError();
    };
  }, [dispatch]);

  const handleSelect = useCallback((body) => {
    try {
      let content = body;
      if (bodyType === 'json' || bodyType === 'graphql-variables') {
        try {
          content = prettifyJsonString(body);
        } catch {}
      }

      if (bodyType === 'graphql-variables') {
        dispatch(
          updateRequestGraphqlVariables({
            variables: content,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      } else {
        dispatch(
          updateRequestBody({
            content,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      }
      dispatch(dismissPanel());
    } catch (e) {
      toastError(new Error('Failed to apply mock body'));
    }
  }, [dispatch, bodyType, item.uid, collection.uid]);

  const handleRegenerateOne = useCallback(async () => {
    try {
      const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
      const method = item.draft ? get(item, 'draft.request.method') : get(item, 'request.method');
      const url = item.draft ? get(item, 'draft.request.url') : get(item, 'request.url');
      const docs = item.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');

      let existingBody = '';
      let graphqlQuery = '';
      let graphqlSchemaText = '';
      if (bodyType === 'graphql-variables') {
        existingBody = body?.graphql?.variables || '';
        graphqlQuery = body?.graphql?.query || '';
      } else {
        existingBody = body?.json || body?.text || body?.xml || '';
      }

      const { ipcRenderer } = window;
      const result = await ipcRenderer.invoke('renderer:generate-ai-mock-one-more', {
        collectionPath: collection.pathname,
        method,
        url,
        existingBody,
        docs,
        bodyType,
        graphqlQuery,
        graphqlSchemaText
      });

      if (result.success) {
        dispatch(addCandidate({ candidates: result.candidates }));
      } else {
        dispatch(generationFailure({ error: result.error }));
      }
    } catch (err) {
      dispatch(generationFailure({ error: err.message }));
    }
  }, [dispatch, item, collection, bodyType]);

  const handleClose = useCallback(() => {
    dispatch(dismissPanel());
  }, [dispatch]);

  if (!showPanel) return null;

  return (
    <StyledWrapper>
      <div className="mock-panel">
        <div className="panel-header">
          <span className="panel-title">✨ AI Mock Candidates</span>
          <div className="panel-actions">
            <button className="regenerate-btn" onClick={handleRegenerateOne} disabled={isGenerating} title="Generate one more candidate">
              <IconRefresh size={14} />
              <span>One more</span>
            </button>
            <button className="close-btn" onClick={handleClose}>
              <IconX size={14} />
            </button>
          </div>
        </div>

        {isGenerating && streamingText && (
          <div className="streaming-preview">
            <div className="streaming-label">Generating...</div>
            <pre className="streaming-text">{streamingText}</pre>
          </div>
        )}

        {isGenerating && !streamingText && (
          <div className="loading-indicator">
            <div className="spinner" />
            <span>Connecting to AI provider...</span>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <span>{error}</span>
          </div>
        )}

        <div className="candidates-list">
          {candidates.map((candidate, index) => (
            <MockCandidateItem
              key={index}
              candidate={candidate}
              index={index}
              originalBody={originalBody}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {candidates.length === 0 && !isGenerating && !error && (
          <div className="empty-state">No candidates generated yet</div>
        )}
      </div>
    </StyledWrapper>
  );
};

export default MockCandidatesPanel;
