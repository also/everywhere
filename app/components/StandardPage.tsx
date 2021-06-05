import { ReactNode } from 'react';
import styled from 'styled-components';

const StyledDiv = styled.div`
  padding: 3em;
`;

const Footer = styled.footer`
  margin: 1em;
  text-align: center;
  font-size: 0.8em;
  color: #cecece;

  & a {
    color: inherit;
  }
`;

export default function StandardPage({ children }: { children: ReactNode }) {
  return (
    <StyledDiv>
      {children}
      <Footer>
        <p>
          Map data ©{' '}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
          contributors
        </p>
      </Footer>
    </StyledDiv>
  );
}
