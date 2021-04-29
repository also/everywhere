import styled from 'styled-components';

export default styled.ul`
  column-width: 200px;
  margin: 0;
  padding: 0;
  list-style-type: none;
  li {
    margin-bottom: 0.3em;
  }

  & a {
    color: #116aa9;
    // https://crbug.com/439820
    outline: none;
  }
`;
