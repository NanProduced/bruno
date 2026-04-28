import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import {
  IconCaretDown,
  IconSparkles,
  IconLoader2,
  IconCheck,
  IconAlertCircle
} from '@tabler/icons';
import Modal from 'components/Modal';
import Portal from 'components/Portal';
import StyledWrapper from './StyledWrapper';
import { getRequestFromCurlCommand } from 'utils/curl';
import { insertTaskIntoQueue } from 'providers/ReduxStore/slices/app';
import { uuid } from 'utils/common';
import Button from 'ui/Button';
import Dropdown from 'components/Dropdown';

const AiCreateRequest = ({ onClose }) => {
  const dispatch = useDispatch();
  const { collections } = useSelector((state) => state.collections);
  const [selectedCollectionUid, setSelectedCollectionUid] = useState(null);
  const [selectedFolderUid, setSelectedFolderUid] = useState(null);
  const [parsedRequest, setParsedRequest] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [generatedResult, setGeneratedResult] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const dropdownTippyRef = useRef();
  const folderDropdownTippyRef = useRef();

  const selectedCollection = collections.find((c) => c.uid === selectedCollectionUid);

  useEffect(() => {
    if (collections.length > 0 && !selectedCollectionUid) {
      setSelectedCollectionUid(collections[0].uid);
    }
  }, [collections, selectedCollectionUid]);

  const formik = useFormik({
    initialValues: {
      curlCommand: '',
      description: ''
    },
    validationSchema: Yup.object({
      curlCommand: Yup.string()
        .trim()
        .min(1, 'must be at least 1 character')
        .required('curl command is required')
        .test({
          name: 'curlCommand',
          message: 'Invalid cURL Command',
          test: (value) => {
            if (!value) return false;
            return getRequestFromCurlCommand(value) !== null;
          }
        }),
      description: Yup.string()
        .trim()
    }),
    onSubmit: (values) => {
      handleGenerateRequest(values);
    }
  });

  const handleCurlCommandChange = useCallback((e) => {
    formik.handleChange(e);
    const value = e.target.value;
    if (value && value.trim()) {
      try {
        const request = getRequestFromCurlCommand(value);
        if (request) {
          setParsedRequest(request);
          setPreviewError(null);
        } else {
          setParsedRequest(null);
          setPreviewError('Unable to parse cURL command');
        }
      } catch (err) {
        setParsedRequest(null);
        setPreviewError(err.message || 'Error parsing cURL command');
      }
    } else {
      setParsedRequest(null);
      setPreviewError(null);
    }
  }, [formik]);

  const handlePaste = useCallback(
    (event) => {
      const clipboardData = event.clipboardData || window.clipboardData;
      const pastedData = clipboardData.getData('Text');
      const curlCommandRegex = /^\s*curl\s/i;
      if (curlCommandRegex.test(pastedData)) {
        formik.setFieldValue('curlCommand', pastedData);
        try {
          const request = getRequestFromCurlCommand(pastedData);
          if (request) {
            setParsedRequest(request);
            setPreviewError(null);
          } else {
            setParsedRequest(null);
            setPreviewError('Unable to parse cURL command');
          }
        } catch (err) {
          setParsedRequest(null);
          setPreviewError(err.message || 'Error parsing cURL command');
        }
        event.preventDefault();
      }
    },
    [formik]
  );

  const handleGenerateRequest = async (values) => {
    if (!selectedCollectionUid) {
      toast.error('Please select a collection');
      return;
    }

    if (!parsedRequest) {
      toast.error('Please provide a valid cURL command');
      return;
    }

    const targetDirPath = selectedFolderUid
      ? folders.find((f) => f.uid === selectedFolderUid)?.pathname
      : null;

    setIsGenerating(true);
    setStreamContent('');
    setGeneratedResult(null);

    try {
      const { ipcRenderer } = window;

      const removeListeners = () => {
        ipcRenderer.on('main:ai-generate-request-chunk', () => {});
        ipcRenderer.on('main:ai-generate-request-done', () => {});
        ipcRenderer.on('main:ai-generate-request-error', () => {});
      };

      const chunkUnsubscribe = ipcRenderer.on('main:ai-generate-request-chunk', (data) => {
        setStreamContent(data.accumulated);
      });

      const doneUnsubscribe = ipcRenderer.on('main:ai-generate-request-done', (data) => {
        setGeneratedResult(data);
      });

      const errorUnsubscribe = ipcRenderer.on('main:ai-generate-request-error', (data) => {
        toast.error(data.error || 'Failed to generate request');
        setIsGenerating(false);
        removeListeners();
      });

      const result = await ipcRenderer.invoke('renderer:ai-generate-request', {
        parsedRequest,
        description: values.description,
        collectionPathname: selectedCollection.pathname,
        targetDirPath: targetDirPath
      });

      chunkUnsubscribe();
      doneUnsubscribe();
      errorUnsubscribe();

      if (result.success) {
        toast.success(`Request "${result.name}" created successfully!`);

        dispatch(
          insertTaskIntoQueue({
            uid: uuid(),
            type: 'OPEN_REQUEST',
            collectionUid: selectedCollectionUid,
            itemPathname: result.pathname
          })
        );

        onClose();
      } else {
        toast.error(result.error || 'Failed to generate request');
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred while generating request');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPreview = () => {
    if (!parsedRequest) return '';

    let preview = '';
    preview += `Method: ${parsedRequest.method?.toUpperCase() || 'GET'}\n`;
    preview += `URL: ${parsedRequest.url || ''}\n`;

    if (parsedRequest.headers && parsedRequest.headers.length > 0) {
      preview += '\nHeaders:\n';
      parsedRequest.headers.forEach((h) => {
        if (h.enabled !== false) {
          preview += `  ${h.name}: ${h.value}\n`;
        }
      });
    }

    if (parsedRequest.body && parsedRequest.body.mode !== 'none') {
      preview += `\nBody Mode: ${parsedRequest.body.mode}\n`;
      if (parsedRequest.body.json) {
        preview += `Body (JSON):\n${parsedRequest.body.json}\n`;
      } else if (parsedRequest.body.text) {
        preview += `Body (Text):\n${parsedRequest.body.text}\n`;
      }
    }

    return preview;
  };

  const getFoldersInCollection = (collection) => {
    if (!collection || !collection.items) return [];

    const folders = [];
    const traverse = (items) => {
      items.forEach((item) => {
        if (item.type === 'folder') {
          folders.push(item);
          if (item.items && item.items.length > 0) {
            traverse(item.items);
          }
        }
      });
    };
    traverse(collection.items);
    return folders;
  };

  const folders = selectedCollection ? getFoldersInCollection(selectedCollection) : [];

  const CollectionIcon = React.forwardRef((props, ref) => (
    <div ref={ref} className="flex items-center justify-end cursor-pointer select-none">
      <span className="truncate max-w-[200px]">
        {selectedCollection?.name || 'Select Collection'}
      </span>
      <IconCaretDown className="caret ml-1 mr-1" size={14} strokeWidth={2} />
    </div>
  ));

  const FolderIcon = React.forwardRef((props, ref) => (
    <div ref={ref} className="flex items-center justify-end cursor-pointer select-none">
      <span className="truncate max-w-[200px]">
        {selectedFolderUid
          ? folders.find((f) => f.uid === selectedFolderUid)?.name || 'Root'
          : 'Root (Collection)'}
      </span>
      <IconCaretDown className="caret ml-1 mr-1" size={14} strokeWidth={2} />
    </div>
  ));

  return (
    <Portal>
      <StyledWrapper>
        <Modal
          size="lg"
          title="AI Create Request"
          hideFooter
          handleCancel={onClose}
        >
          <form
            className="bruno-form"
            onSubmit={formik.handleSubmit}
          >
            <div className="mt-2">
              <label className="block font-medium mb-1">
                Target Collection
              </label>
              <Dropdown
                className="collection-dropdown"
                onCreate={(ref) => (dropdownTippyRef.current = ref)}
                icon={<CollectionIcon />}
                placement="bottom-start"
              >
                {collections.map((collection) => (
                  <div
                    key={collection.uid}
                    className="dropdown-item"
                    onClick={() => {
                      dropdownTippyRef.current?.hide?.();
                      setSelectedCollectionUid(collection.uid);
                      setSelectedFolderUid(null);
                    }}
                  >
                    {collection.name}
                  </div>
                ))}
              </Dropdown>
            </div>

            {folders.length > 0 && (
              <div className="mt-4">
                <label className="block font-medium mb-1">
                  Target Folder (Optional)
                </label>
                <Dropdown
                  className="collection-dropdown"
                  onCreate={(ref) => (folderDropdownTippyRef.current = ref)}
                  icon={<FolderIcon />}
                  placement="bottom-start"
                >
                  <div
                    className="dropdown-item"
                    onClick={() => {
                      folderDropdownTippyRef.current?.hide?.();
                      setSelectedFolderUid(null);
                    }}
                  >
                    Root (Collection)
                  </div>
                  {folders.map((folder) => (
                    <div
                      key={folder.uid}
                      className="dropdown-item"
                      onClick={() => {
                        folderDropdownTippyRef.current?.hide?.();
                        setSelectedFolderUid(folder.uid);
                      }}
                    >
                      {folder.name}
                    </div>
                  ))}
                </Dropdown>
              </div>
            )}

            <div className="mt-4">
              <label className="block font-medium mb-1">
                cURL Command
                <span className="text-red-500 ml-1">*</span>
              </label>
              <textarea
                name="curlCommand"
                placeholder="Paste your cURL command here... (e.g., curl -X GET https://api.example.com/users)"
                className="block textbox w-full curl-command"
                value={formik.values.curlCommand}
                onChange={handleCurlCommandChange}
                onPaste={handlePaste}
              />
              {formik.touched.curlCommand && formik.errors.curlCommand ? (
                <div className="text-red-500 text-sm mt-1">{formik.errors.curlCommand}</div>
              ) : null}
            </div>

            {parsedRequest && (
              <div className="mt-4">
                <label className="block font-medium mb-1">
                  <IconCheck size={14} className="inline text-green-500 mr-1" />
                  Parsed Request Preview
                </label>
                <div className="preview-section">
                  <pre>{formatPreview()}</pre>
                </div>
              </div>
            )}

            {previewError && (
              <div className="mt-4">
                <div className="flex items-center text-red-500">
                  <IconAlertCircle size={14} className="mr-1" />
                  <span className="text-sm">{previewError}</span>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block font-medium mb-1">
                Description (Optional)
              </label>
              <textarea
                name="description"
                placeholder="Describe what this request should do, what tests to add, what variables to extract, etc."
                className="block textbox w-full description"
                value={formik.values.description}
                onChange={formik.handleChange}
              />
              <p className="text-xs text-gray-500 mt-1">
                Example: "Add tests to check status code is 200, extract the user ID from response, add auth headers"
              </p>
            </div>

            {isGenerating && streamContent && (
              <div className="mt-4">
                <label className="block font-medium mb-1 flex items-center">
                  <IconSparkles size={14} className="mr-1 text-yellow-500" />
                  AI is generating...
                  <span className="loading-dots ml-1">.</span>
                  <span className="loading-dots">.</span>
                  <span className="loading-dots">.</span>
                </label>
                <div className="stream-preview">
                  <pre>{streamContent}</pre>
                </div>
              </div>
            )}

            <div className="flex justify-end items-center mt-8 bruno-modal-footer">
              <Button
                type="button"
                color="secondary"
                variant="ghost"
                onClick={onClose}
                className="mr-2"
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating || !parsedRequest || !selectedCollectionUid}
                className="flex items-center"
              >
                {isGenerating ? (
                  <>
                    <IconLoader2 size={14} className="animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <IconSparkles size={14} className="mr-2" />
                    Generate Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      </StyledWrapper>
    </Portal>
  );
};

export default AiCreateRequest;
