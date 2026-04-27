import React, { useMemo, useCallback } from 'react';
import get from 'lodash/get';
import {
  IconCaretDown,
  IconForms,
  IconBraces,
  IconCode,
  IconFileText,
  IconDatabase,
  IconFile,
  IconX
} from '@tabler/icons';
import MenuDropdown from 'ui/MenuDropdown';
import { useDispatch } from 'react-redux';
import { updateRequestBodyMode } from 'providers/ReduxStore/slices/collections';
import { humanizeRequestBodyMode } from 'utils/collections';
import StyledWrapper from './StyledWrapper';
import { updateRequestBody } from 'providers/ReduxStore/slices/collections/index';
import { toastError } from 'utils/common/error';
import { prettifyJsonString } from 'utils/common/index';
import xmlFormat from 'xml-formatter';
import AiMockGenerator from 'components/RequestPane/AiMockGenerator';

const DEFAULT_MODES = [
  {
    name: 'Form',
    options: [
      { id: 'multipartForm', label: 'Multipart Form', leftSection: IconForms },
      { id: 'formUrlEncoded', label: 'Form URL Encoded', leftSection: IconForms }
    ]
  },
  {
    name: 'Raw',
    options: [
      { id: 'json', label: 'JSON', leftSection: IconBraces },
      { id: 'xml', label: 'XML', leftSection: IconCode },
      { id: 'text', label: 'TEXT', leftSection: IconFileText },
      { id: 'sparql', label: 'SPARQL', leftSection: IconDatabase }
    ]
  },
  {
    name: 'Other',
    options: [
      { id: 'file', label: 'File / Binary', leftSection: IconFile },
      { id: 'none', label: 'No Body', leftSection: IconX }
    ]
  }
];

const RequestBodyMode = ({ item, collection }) => {
  const dispatch = useDispatch();
  const body = item.draft ? get(item, 'draft.request.body') : get(item, 'request.body');
  const bodyMode = body?.mode;

  const url = item.draft ? get(item, 'draft.request.url', '') : get(item, 'request.url', '');
  const method = item.draft ? get(item, 'draft.request.method', '') : get(item, 'request.method', '');
  const docs = item.draft ? get(item, 'draft.request.docs', '') : get(item, 'request.docs', '');
  const currentBodyContent = body?.json || '';

  const onModeChange = useCallback((value) => {
    dispatch(
      updateRequestBodyMode({
        itemUid: item.uid,
        collectionUid: collection.uid,
        mode: value
      })
    );
  }, [dispatch, item.uid, collection.uid]);

  const onPrettify = () => {
    if (body?.json && bodyMode === 'json') {
      try {
        const prettyBodyJson = prettifyJsonString(body.json);
        dispatch(
          updateRequestBody({
            content: prettyBodyJson,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      } catch (e) {
        toastError(new Error('Unable to prettify. Invalid JSON format.'));
      }
    } else if (body?.xml && bodyMode === 'xml') {
      try {
        const prettyBodyXML = xmlFormat(body.xml, { collapseContent: true });
        dispatch(
          updateRequestBody({
            content: prettyBodyXML,
            itemUid: item.uid,
            collectionUid: collection.uid
          })
        );
      } catch (e) {
        toastError(new Error('Unable to prettify. Invalid XML format.'));
      }
    }
  };

  const handleContentUpdate = useCallback((content, isStreaming) => {
    dispatch(
      updateRequestBody({
        content: content,
        itemUid: item.uid,
        collectionUid: collection.uid
      })
    );
  }, [dispatch, item.uid, collection.uid]);

  const menuItems = useMemo(() => {
    return DEFAULT_MODES.map((group) => ({
      ...group,
      options: group.options.map((option) => ({
        ...option,
        onClick: () => onModeChange(option.id)
      }))
    }));
  }, [onModeChange]);

  return (
    <StyledWrapper>
      <div className="inline-flex items-center cursor-pointer body-mode-selector" data-testid="request-body-mode-selector">
        <MenuDropdown
          items={menuItems}
          placement="bottom-end"
          selectedItemId={bodyMode}
          showGroupDividers={false}
          groupStyle="select"
        >
          <div className="flex items-center justify-center pl-3 py-1 select-none selected-body-mode">
            {humanizeRequestBodyMode(bodyMode)} <IconCaretDown className="caret ml-1" size={14} strokeWidth={2} />
          </div>
        </MenuDropdown>
      </div>
      {(bodyMode === 'json' || bodyMode === 'xml') && (
        <button className="ml-2" onClick={onPrettify}>
          Prettify
        </button>
      )}
      {bodyMode === 'json' && (
        <div className="ml-2">
          <AiMockGenerator
            body={currentBodyContent}
            url={url}
            method={method}
            docs={docs}
            schema={null}
            type="json"
            onContentUpdate={handleContentUpdate}
            originalContent={currentBodyContent}
            numCandidates={3}
          />
        </div>
      )}
    </StyledWrapper>
  );
};
export default RequestBodyMode;
