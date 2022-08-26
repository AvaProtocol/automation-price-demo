import './App.css';
import { Row, Col } from 'antd';

function App() {
  return (
    <div className='container page-container'>
      <Row>
        <Col span={12} className='d-flex justify-content-center'><div className='price-feed-container'><h1>Price Feed</h1></div></Col>
        <Col span={12} className='d-flex justify-content-center'><div className='swap-container'><h1>Swap</h1></div></Col>
      </Row>
    </div>
  );
}

export default App;
