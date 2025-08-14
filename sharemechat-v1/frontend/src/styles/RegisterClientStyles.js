import styled from 'styled-components';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
`;

export const StyledForm = styled.form`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

export const StyledInput = styled.input`
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ced4da;
  border-radius: 5px;
  font-size: 16px;
`;

export const StyledButton = styled.button`
  width: 100%;
  padding: 10px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover {
    background-color: #218838;
  }
`;

export const StyledLinkButton = styled.button`
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  margin-top: 10px;
  font-size: 14px;
`;

export const StyledError = styled.p`
  color: red;
  margin: 10px 0;
  font-size: 14px;
`;