import React from 'react';
import { Card, theme } from 'antd';

function Container({ children }) {
  const { useToken } = theme;
  const { token } = useToken();

  return (
    <Card bordered={false} style={{ minHeight: 400 }}>
      {children}
    </Card>
  );
}

export default Container;
