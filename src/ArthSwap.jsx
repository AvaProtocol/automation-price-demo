import React, {
  useState, useEffect, useCallback, useRef, useLayoutEffect,
} from 'react';
import _ from 'lodash';
import {
  Row, Col, Input, Button, Form, Modal, Radio, Space, message, Layout, Table,
} from 'antd';

import moment from 'moment';
import PageContainer from './components/PageContainer';
import Container from './components/Container';
import Swap from './components/Swap';
import AutomationTime from './components/AutomationTime';
import AutomationPrice from './components/AutomationPrice';
import { MOMENT_FORMAT } from './config';
import WalletConnectMetamask from './components/WalletConnectMetamask';
import WalletConnectPolkadotjs from './components/WalletConnectPolkadotjs';
import PriceControl from './components/PriceControl';
import useSubscribePriceRegistry from './components/useSubscribePriceRegistry';
import TaskList from './components/TaskList';
import NetworkSelect from './components/NetworkSelect';

const { Column } = Table;

const {
  Header, Footer, Sider, Content,
} = Layout;

const PRICE_START = 80;
const PRICE_INCREMENT = 20;

/**
 * Wait for all promises to succeed, otherwise throw an exception.
 * @param {*} promises
 * @returns promise
 */
export const waitPromises = (promises) => new Promise((resolve, reject) => {
  Promise.all(promises).then(resolve).catch(reject);
});

function ArthSwapApp() {
  // App states
  const [priceArray, setPriceArray] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(PRICE_START);

  useEffect(() => {
    // Initialize the wallet provider. This code will run once after the component has rendered for the first time
    async function asyncInit() {
      try {
        console.log('Page compoents are mounted.');
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    asyncInit(); // Call the async function inside useEffect
    return () => {
      // Cleanup code here (if needed)
    };
  }, []); // The empty dependency array [] ensures that this effect runs only once, similar to componentDidMount

  useEffect(() => {
    console.log('useEffect.priceArray: ', priceArray);
  }, [priceArray]);

  useEffect(() => {
    console.log('useEffect.currentPrice: ', currentPrice);
  }, [currentPrice]);

  const updateAssetPrice = async (price) => {
    const symbols = ['WRSTR', 'USDT'];
    // Do not insert the same price.
    if (price.eq(priceArray[priceArray.length - 1]?.price)) {
      return;
    }
    const retrievedTimestamp = moment();
    const priceItem = {
      timestamp: retrievedTimestamp,
      symbols,
      price,
    };
    const newPriceArray = [...priceArray];
    newPriceArray.push(priceItem);
    setPriceArray(newPriceArray);
  };

  useSubscribePriceRegistry(updateAssetPrice);

  const onFinish = (values) => {
    console.log('values: ', values);
  };

  const onValuesChange = () => {};

  const volatilityElement = null;

  const headerStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    width: '100%',
    backgroundColor: '#fff',
    lineHeight: '2rem',
    minHeight: '6rem',
  };

  const contentStyle = {
    minHeight: 120,
    lineHeight: '2rem',
  };

  const formattedPriceArray = _.map(priceArray, (item, index) => {
    const formattedTimestamp = item.timestamp.format(MOMENT_FORMAT);
    return {
      key: `${index}-${formattedTimestamp}`,
      timestamp: formattedTimestamp,
      symbols: _.join(item.symbols, '-'),
      price: item.price.toString(),
    };
  });

  /**
   * Main functions
   */
  return (
    <Space direction="vertical" style={{ width: '100%', paddingTop: '1rem', paddingBottom: '1rem' }} size={[0, 48]}>
      <Layout>
        <Header style={headerStyle}>
          <PageContainer style={{ height: '100%' }}>
            <Row>
              <Col span={10}>
                <WalletConnectPolkadotjs />
              </Col>
              <Col span={10}>
                <WalletConnectMetamask />
              </Col>
              <Col span={4}>
                <NetworkSelect />
              </Col>
            </Row>
          </PageContainer>
        </Header>
        <Content style={contentStyle}>
          <PageContainer style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
            <Row justify="start" gutter={[32, 32]}>
              <Col span={12}>
                <Container>
                  <Space direction="vertical">
                    <h2>Control Panel</h2>
                    <h3>Price Update</h3>
                    <PriceControl priceArray={priceArray} setPriceArray={setPriceArray} currentPrice={currentPrice} setCurrentPrice={setCurrentPrice} step={PRICE_INCREMENT} />

                    <h3>Swap Options</h3>
                    <Space size="middle">
                      <Swap />
                      <AutomationTime />
                      <AutomationPrice />
                    </Space>
                    {/* <Form
                      form={swapForm}
                      name="basic"
                      labelCol={{ span: 6 }}
                      wrapperCol={{ span: 18 }}
                      initialValues={{ remember: true }}
                      onFinish={onFinish}
                      autoComplete="off"
                      onValuesChange={onValuesChange}
                      labelAlign="left"
                    >
                      <Row>
                        <Col span={24}>
                          <Form.Item label="Stop">
                            <Row>
                              <Col span={10}>
                                <Form.Item name="price" rules={[{ required: true, message: 'Please input price!' }]} noStyle>
                                  <Input />
                                </Form.Item>
                              </Col>
                              <Col span={14}>
                                <span style={{ paddingLeft: 12, lineHeight: '32px' }} />
                                { volatilityElement }
                              </Col>
                            </Row>
                          </Form.Item>
                          <Form.Item label="Amount">
                            <Row>
                              <Col span={10}>
                                <Form.Item name="mgxAmount" rules={[{ required: true, message: 'Please enter a MGX amount' }]}>
                                  <Input />
                                </Form.Item>
                              </Col>
                              <Col span={14}><span style={{ paddingLeft: 12, lineHeight: '32px' }} /></Col>
                            </Row>
                          </Form.Item>
                          <Form.Item label="Expected Output:">
                            <Row>
                              <Col span={16} />
                            </Row>
                          </Form.Item>

                        </Col>
                      </Row>

                      <div className="important">
                        <p className="title">Important:</p>
                        <p>Turing will trigger the transaction for inclusion after the price threshold has been met;</p>
                        we cannot guarantee the price received.
                      </div>

                      <div className="d-flex justify-content-center">
                          <dl>
                            <div>
                              <dt>Wallet</dt>
                              <dd>{wallet?.address}</dd>
                            </div>
                            <div>
                              <dt>Balance</dt>
                              <dd>{wallet?.balance} {network.symbol}</dd>
                            </div>
                            <div>
                              <dt>Smart Contract</dt>
                              <dd>{ROUTER_ADDRESS} (ArthSwap Router)</dd>
                            </div>
                            <div>
                              <dt>Method</dt>
                              <dd>swapExactETHForTokens (Market Buy)</dd>
                            </div>
                            <div>
                              <dt>Amount</dt>
                              <dd>0.01 ${network.symbol}</dd>
                            </div>
                            <div>
                              <dt>Estimated Amount</dt>
                              <dd>100 ARTH</dd>
                            </div>
                            <br />
                            <div>
                              <dt>Status</dt>
                              <dd>{swapStatus}</dd>
                            </div>
                            {receiptSwap?.blockNumber && (
                            <div>
                              <dt>Mined Block Height</dt>
                              <dd>{receiptSwap?.blockNumber}</dd>
                            </div>
                            )}
                            {receiptSwap?.hash && (
                            <div>
                              <dt>Transaction Hash</dt>
                              <dd>{receiptSwap?.hash}</dd>
                            </div>
                            )}
                          </dl>
                        </Modal>
                      </div>
                    </Form> */}
                  </Space>
                </Container>
              </Col>
              <Col span={12}>
                <Container>
                  <h2>ArthSwap Price Feed</h2>
                  <span>Current Price: {currentPrice}</span>
                  <div>
                    <Table dataSource={_.reverse(formattedPriceArray)} scroll={{ y: 240 }} pagination={false}>
                      <Column title="Timestamp" dataIndex="timestamp" key="timestamp" />
                      <Column title="Symbols" dataIndex="symbols" key="symbols" />
                      <Column title="Price" dataIndex="price" key="price" />
                    </Table>
                  </div>
                </Container>
              </Col>
              <Col span={24}>
                <Container>
                  <h2>Tasks</h2>
                  <TaskList />
                </Container>
              </Col>
            </Row>
          </PageContainer>
        </Content>
      </Layout>

    </Space>
  );
}

export default ArthSwapApp;
