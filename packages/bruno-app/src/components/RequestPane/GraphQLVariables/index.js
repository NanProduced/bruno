import React, { useState } from 'react';
import get from 'lodash/get';
import { useDispatch, useSelector } from 'react-redux';
import CodeEditor from 'components/CodeEditor';
import { updateRequestGraphqlVariables } from 'providers/ReduxStore/slices/collections';
import { sendRequest, saveRequest } from 'providers/ReduxStore/slices/collections/actions';
import { useTheme } from 'providers/Theme';
import { IconWand } from '@tabler/icons';
import { startGeneration, generationSuccess, generationFailure } from 'providers/ReduxStore/slices/aiMock';
import { toastError } from 'utils/common/error';
import MockCandidatesPanel from 'components/RequestPane/MockCandidatesPanel';
import StyledWrapper from './StyledWrapper';

const GraphQLVariables = ({ variables, item, collection }) => {
  const dispatch = useDispatch();
  const [isGeneratingMock, setIsGeneratingMock] = useState(false);

  const { displayedTheme } = useTheme();
  const preferences = useSelector((state) => state.app.preferences);

  const onEdit = (value) => {
    dispatch(
      updateRequestGraphqlVariables({
        variables: value,
        itemUid: item.uid,
        collectionUid: collection.uid
      })
    );
  };

  const onRun = () => dispatch(sendRequest(item, collection.uid));
  const onSave = () => dispatch(saveRequest(item.uid, collection.uid));

  const onGenerateMock = async () => {
    if (isGeneratingMock) return;

    const method = 'POST';
    const url = item.draft ? get(item, 'draft.request.url') : get(item, 'request.url');
    const docs = item.draft ? get(item, 'draft.request.docs') : get(item, 'request.docs');
    const existingBody = variables || '';

    dispatch(startGeneration({ originalBody: existingBody }));
    setIsGeneratingMock(true);

    try {
      const { ipcRenderer } = window;
      const result = await ipcRenderer.invoke('renderer:generate-ai-mock', {
        collectionPath: collection.pathname,
        method,
        url,
        existingBody,
        docs,
        bodyType: 'graphql-variables'
      });

      if (result.success) {
        dispatch(generationSuccess({ candidates: result.candidates }));
      } else {
        dispatch(generationFailure({ error: result.error }));
        toastError(new Error(result.error));
      }
    } catch (err) {
      dispatch(generationFailure({ error: err.message }));
      toastError(new Error('Failed to generate mock data: ' + err.message));
    } finally {
      setIsGeneratingMock(false);
    }
  };

  return (
    <StyledWrapper className="flex flex-col h-full">
      <div className="graphql-variables-toolbar">
        <button
          className={`ai-mock-btn ${isGeneratingMock ? 'generating' : ''}`}
          onClick={onGenerateMock}
          disabled={isGeneratingMock}
          title="AI Generate Mock Variables"
        >
          <IconWand size={12} strokeWidth={1.5} />
          <span>{isGeneratingMock ? 'Generating...' : 'AI Mock'}</span>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <CodeEditor
          collection={collection}
          value={variables || ''}
          theme={displayedTheme}
          font={get(preferences, 'font.codeFont', 'default')}
          fontSize={get(preferences, 'font.codeFontSize')}
          onEdit={onEdit}
          mode="application/json"
          onRun={onRun}
          onSave={onSave}
          enableVariableHighlighting={true}
          showHintsFor={['variables']}
        />
      </div>
      <MockCandidatesPanel item={item} collection={collection} bodyType="graphql-variables" />
    </StyledWrapper>
  );
};

export default GraphQLVariables;
