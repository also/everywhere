import styled from 'styled-components';

export default styled.table`
  border: 1px solid #ccc;
  box-shadow: 3px 3px 0 0 #dfdfdf;

  & thead {
    background-color: #eee;
  }

  & th {
    text-align: left;
  }

  & td,
  & th {
    padding: 0.3em;
  }
`;
