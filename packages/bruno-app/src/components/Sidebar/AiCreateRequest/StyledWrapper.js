import styled from 'styled-components';

const StyledWrapper = styled.div`
  .curl-command {
    min-height: 120px;
    resize: vertical;
  }

  .description {
    min-height: 80px;
    resize: vertical;
  }

  .preview-section {
    background-color: ${(props) => props.theme.body.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 0.75rem;
    font-family: 'Fira Code', monospace;
    font-size: 0.8rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .preview-section pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .stream-preview {
    background-color: ${(props) => props.theme.body.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.base};
    padding: 0.75rem;
    min-height: 80px;
    max-height: 200px;
    overflow-y: auto;
    font-family: 'Fira Code', monospace;
    font-size: 0.8rem;
  }

  .collection-dropdown {
    max-height: 300px;
    overflow-y: auto;
  }

  .loading-dots {
    animation: blink 1.4s infinite both;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }

  @keyframes blink {
    0%, 80%, 100% { opacity: 0; }
    40% { opacity: 1; }
  }
`;

export default StyledWrapper;
