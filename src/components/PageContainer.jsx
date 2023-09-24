import React from 'react';
import styled from 'styled-components';

const PageContainer = styled.div`
  max-width: 100%;
  margin: 0 auto;
  padding: 0 1rem;

  @media (min-width: 576px) {
    max-width: 576px;
  }

  @media (min-width: 768px) {
    max-width: 768px;
  }

  @media (min-width: 992px) {
    max-width: 992px;
  }

  @media (min-width: 1204px) {
    max-width: 1204px;
  }
`;

export default PageContainer;
