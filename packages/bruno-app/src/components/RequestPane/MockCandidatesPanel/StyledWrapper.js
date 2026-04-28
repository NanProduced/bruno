import styled from 'styled-components';

const StyledWrapper = styled.div`
  .mock-panel {
    border-top: 1px solid ${(props) => props.theme.sidebar.border};
    background: ${(props) => props.theme.sidebar.bg};
    max-height: 300px;
    overflow-y: auto;
    font-size: 0.8125rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border-bottom: 1px solid ${(props) => props.theme.sidebar.border};
    position: sticky;
    top: 0;
    background: ${(props) => props.theme.sidebar.bg};
    z-index: 1;
  }

  .panel-title {
    font-weight: 500;
    color: ${(props) => props.theme.text};
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .regenerate-btn {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid ${(props) => props.theme.sidebar.border};
    background: transparent;
    color: ${(props) => props.theme.text};
    cursor: pointer;
    font-size: 0.75rem;

    &:hover:not(:disabled) {
      background: ${(props) => props.theme.sidebar.hover};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 3px;
    border: none;
    background: transparent;
    color: ${(props) => props.theme.text};
    cursor: pointer;

    &:hover {
      background: ${(props) => props.theme.sidebar.hover};
    }
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 8px;
    color: ${(props) => props.theme.text};
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid ${(props) => props.theme.sidebar.border};
    border-top-color: ${(props) => props.theme.colors.primary};
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-banner {
    padding: 8px;
    color: #e53e3e;
    background: rgba(229, 62, 62, 0.1);
    border-bottom: 1px solid rgba(229, 62, 62, 0.2);
    font-size: 0.75rem;
  }

  .candidates-list {
    display: flex;
    flex-direction: column;
  }

  .mock-candidate {
    border-bottom: 1px solid ${(props) => props.theme.sidebar.border};

    &:last-child {
      border-bottom: none;
    }
  }

  .candidate-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    cursor: pointer;
    user-select: none;

    &:hover {
      background: ${(props) => props.theme.sidebar.hover};
    }
  }

  .expand-icon {
    display: flex;
    align-items: center;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .candidate-name {
    flex: 1;
    color: ${(props) => props.theme.text};
    font-size: 0.8125rem;
  }

  .use-btn {
    padding: 1px 8px;
    border-radius: 3px;
    border: 1px solid ${(props) => props.theme.colors.primary};
    background: transparent;
    color: ${(props) => props.theme.colors.primary};
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 500;

    &:hover {
      background: ${(props) => props.theme.colors.primary};
      color: #fff;
    }
  }

  .candidate-body {
    padding: 0 8px 8px 24px;
  }

  .diff-view {
    border: 1px solid ${(props) => props.theme.sidebar.border};
    border-radius: 3px;
    overflow: hidden;
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .diff-content {
    overflow-x: auto;
  }

  .diff-line {
    display: flex;
    align-items: flex-start;
    min-height: 18px;
  }

  .diff-equal {
    background: transparent;
  }

  .diff-added {
    background: rgba(72, 187, 120, 0.15);
  }

  .diff-removed {
    background: rgba(245, 101, 101, 0.15);
  }

  .line-num {
    display: inline-block;
    width: 30px;
    min-width: 30px;
    text-align: right;
    padding-right: 6px;
    color: ${(props) => props.theme.colors.text.muted};
    user-select: none;
  }

  .line-prefix {
    display: inline-block;
    width: 12px;
    min-width: 12px;
    font-weight: bold;
  }

  .diff-added .line-prefix {
    color: #48bb78;
  }

  .diff-removed .line-prefix {
    color: #f56565;
  }

  .line-text {
    white-space: pre-wrap;
    word-break: break-all;
  }

  .empty-state {
    padding: 12px 8px;
    color: ${(props) => props.theme.colors.text.muted};
    text-align: center;
    font-size: 0.75rem;
  }

  .streaming-preview {
    padding: 8px;
    border-bottom: 1px solid ${(props) => props.theme.sidebar.border};
  }

  .streaming-label {
    font-size: 0.6875rem;
    font-weight: 500;
    color: ${(props) => props.theme.colors.primary};
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;

    &::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: ${(props) => props.theme.colors.primary};
      animation: blink 1s ease-in-out infinite;
    }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .streaming-text {
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    color: ${(props) => props.theme.text};
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    max-height: 120px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid ${(props) => props.theme.sidebar.border};
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.05);
  }
`;

export default StyledWrapper;
