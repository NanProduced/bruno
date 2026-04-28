import styled from 'styled-components';

const Wrapper = styled.div`
  font-size: ${(props) => props.theme.font.size.base};
  white-space: nowrap;

  .body-mode-selector {
    background: transparent;
    border-radius: 3px;

    .selected-body-mode {
      color: ${(props) => props.theme.primary.text};
    }
  }

  .caret {
    color: rgb(140, 140, 140);
    fill: rgb(140, 140, 140);
  }

  .ai-mock-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid transparent;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15));
    color: ${(props) => props.theme.colors.primary};
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(59, 130, 246, 0.25));
      border-color: ${(props) => props.theme.colors.primary};
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.generating {
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
`;

export default Wrapper;
