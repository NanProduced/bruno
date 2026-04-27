import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .ai-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--color-gray-300);
    background-color: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      background-color: var(--color-gray-100);
      border-color: var(--color-gray-400);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.loading {
      opacity: 0.8;
    }
  }

  .candidate-selector {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    border: 1px solid var(--color-gray-300);
    background-color: var(--color-bg);
  }

  .candidate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.75rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    border-radius: 0.125rem;
    border: none;
    background-color: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.15s ease;

    &:hover {
      background-color: var(--color-gray-100);
    }

    &.active {
      background-color: var(--color-primary);
      color: white;
    }
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background-color: var(--color-red-50);
    color: var(--color-red-700);
    font-size: 0.75rem;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .error-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .retry-btn {
      margin-left: 0.5rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.125rem;
      border: 1px solid var(--color-red-300);
      background-color: white;
      color: var(--color-red-700);
      font-size: 0.7rem;
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        background-color: var(--color-red-50);
      }
    }
  }

  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background-color: var(--color-blue-50);
    color: var(--color-blue-700);
    font-size: 0.75rem;

    .pulse {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background-color: var(--color-blue-500);
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.5;
        transform: scale(0.8);
      }
    }
  }

  .config-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    background-color: var(--color-yellow-50);
    color: var(--color-yellow-700);
    font-size: 0.75rem;

    .configure-link {
      color: var(--color-primary);
      text-decoration: underline;
      cursor: pointer;

      &:hover {
        color: var(--color-primary-dark);
      }
    }
  }
`;

export default StyledWrapper;
