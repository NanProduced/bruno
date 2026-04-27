import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;

  .submit {
    margin-top: 1rem;
  }

  .section-group {
    border-radius: 0.5rem;
    border: 1px solid var(--color-gray-200);
    background-color: var(--color-gray-50);
    margin-bottom: 1.5rem;
    padding: 1rem;
  }

  .section-group:hover {
    background-color: var(--color-gray-100);
  }

  .provider-radio {
    margin-bottom: 1rem;
  }

  .provider-radio label {
    margin-right: 1.5rem;
    cursor: pointer;
  }

  .provider-radio input {
    margin-right: 0.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-gray-300);
    border-radius: 0.25rem;
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-group .input-hint {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  .api-key-input {
    position: relative;
  }

  .api-key-input input {
    padding-right: 4rem;
  }

  .toggle-visibility {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-gray-500);
    padding: 0.25rem;
  }

  .toggle-visibility:hover {
    color: var(--color-text);
  }

  .save-status {
    margin-top: 1rem;
    padding: 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }

  .save-status.success {
    background-color: var(--color-green-50);
    color: var(--color-green-700);
    border: 1px solid var(--color-green-200);
  }

  .save-status.error {
    background-color: var(--color-red-50);
    color: var(--color-red-700);
    border: 1px solid var(--color-red-200);
  }

  .mock-settings {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-gray-200);
  }

  .mock-settings .section-title {
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .mock-settings .form-row {
    display: flex;
    gap: 1rem;
  }

  .mock-settings .form-row .form-group {
    flex: 1;
  }

  .mock-settings .form-row input {
    width: 100%;
  }
`;

export default StyledWrapper;
