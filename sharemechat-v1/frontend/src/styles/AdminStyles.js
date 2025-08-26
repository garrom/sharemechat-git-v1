import styled from 'styled-components';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  padding: 20px;
`;

export const StyledTable = styled.table`
  width: 100%;
  max-width: 800px;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-collapse: collapse;
  margin-top: 20px;

  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
  }

  th {
    background-color: #f8f9fa;
    font-weight: bold;
  }

  tr:hover {
    background-color: #f1f3f5;
  }
`;

export const StyledButton = styled.button`
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 14px;
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
  font-size: 14px;
`;

export const StyledError = styled.p`
  color: red;
  margin: 10px 0;
  font-size: 14px;
`;

export const StyledInput = styled.input`
  width: 100%;
  max-width: 200px;
  padding: 8px;
  margin: 0 5px;
  border: 1px solid #ced4da;
  border-radius: 5px;
  font-size: 14px;
`;

export const StyledSelect = styled.select`
  width: 100%;
  max-width: 200px;
  padding: 8px;
  margin: 0 5px;
  border: 1px solid #ced4da;
  border-radius: 5px;
  font-size: 14px;
`;