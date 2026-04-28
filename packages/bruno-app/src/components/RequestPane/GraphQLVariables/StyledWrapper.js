import styled from 'styled-components';

const StyledWrapper = styled.div`
  .graphql-variables-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 2px 0;
    gap: 4px;
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

  div.CodeMirror {
    height: calc(100vh - 220px);
  }
`;

export default StyledWrapper;
