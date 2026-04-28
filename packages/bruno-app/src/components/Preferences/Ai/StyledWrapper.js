import styled from 'styled-components';

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;

  color: ${(props) => props.theme.text};

  form.bruno-form {
    label {
      font-size: 0.8125rem;
    }
  }

  select {
    appearance: auto;
  }
`;

export default StyledWrapper;
