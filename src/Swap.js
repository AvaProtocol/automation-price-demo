import { Row, Col, Input, Button, Form } from 'antd';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { v4 } from 'uuid';
import moment from 'moment-timezone';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';

import subqueryHelper from './common/subqueryHelper';
import polkadotHelper from './common/polkadotHelper';

import './App.css';

// const { Option } = Select;

function Swap() {
  const [prices, setPrices] = useState([]);
  const [accountSelectorVisible, setAccountSelectorVisible] = useState(false);
  const [accounts, setAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [extrinsicStatus, setExtrinsicStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [priceVolatility, setPriceVolatility] = useState(null);
  const [swapForm] = Form.useForm();
  const [basePrice, setBasePrice] = useState(undefined);
  const [currentPrice, setCurrentPrice] = useState(undefined);
  const [expectedOutput, setExpectedOutput] = useState(undefined);

  const convertToNumber = (value) => _.toNumber(_.replace(value, ',', ''));


  // The retrieved mangata timestamps are UTC so we specify UTC here
  const formatDatetime= (value) => moment.utc(value).format("MM-DD HH:mm:ss Z");

  useEffect(() => {

    const fetchPrices = async () => {
      console.log("fetchprices");
      let prices = await subqueryHelper.getPrices();
      prices = _.filter(prices, ({ args: { asset }}) => asset === 'mgx:ksm');

      const formattedRows = _.map(prices, (price) => ({ asset: price.args.asset, value: price.args.value,timestamp :formatDatetime(price.timestamp)}));
      setPrices(_.slice(formattedRows, 0, 10));

      const api = await polkadotHelper.getPolkadotApi();
      const respCurrentPrice = await api.query.automationPrice.assetPrices('mgx:ksm');
      setCurrentPrice({ timestamp:  moment().format("MM-DD HH:mm:ss Z"), value: respCurrentPrice.toString(), asset: 'mgx:ksm' });

      const respBasePrice = await api.query.automationPrice.assetBaselinePrices('mgx:ksm');
      setBasePrice(respBasePrice.unwrap().toNumber());
    };

    fetchPrices();  // Run the function without waiting for setInterval
    swapForm.setFieldsValue({mgxAmount: 10000});  // Auto-fill in mgxAmount for demo purpose

    const interval = setInterval(fetchPrices, 8000);

    // Clear the timer when the component unmounts to prevent it leaving errors and leaking memory:
    return () => {
      clearInterval(interval);
    };

  }, [swapForm]);

  const priceRows = _.map(prices, (priceItem, index) => {
    const { timestamp, asset, value } = priceItem;
    return (
      <tr key={index} className="price-row">
        <th className="price-col price-first-col">{timestamp}</th>
        <th className="price-col">{asset}</th>
        <th className="price-col">{convertToNumber(value)}</th>
      </tr>
    );
  });

  const onAccountSelected = (account) => {
    console.log('onAccountSelected, account: ', account);
    setSelectedAccount(account);
    setAccountSelectorVisible(false);
  }

  const accountRows = _.map(accounts, (account) => {
    const { address, meta: { name } } = account;
    return <div key={address} className='account-row' onClick={() => onAccountSelected(account)}>{name}</div>;
  });

  const onConnectWalletClicked = async () => {
    setAccountSelectorVisible(true);
    await web3Enable('Automation price demo');
    const allAccounts = await web3Accounts({ accountType: 'sr25519', ss58Format: 51 });
    setAccounts(allAccounts);
  }

  const getTriggerPercentage = () => {
    const direction = priceVolatility > 0 ? 0 : 1;
    let triggerPercentage = Math.ceil(Math.abs(priceVolatility * 100));
    return { direction, triggerPercentage };
  }

  const onSubmitClicked = async (ksmAmount) => {
    setSending(true);
    const api = await polkadotHelper.getPolkadotApi();
    const { direction, triggerPercentage }  = getTriggerPercentage();

    const extrinsic = api.tx.automationPrice.scheduleTransferTask(v4(), 'mgx:ksm', direction, triggerPercentage, '68HXCiRMPD19obaN1Cnr93pHKRvdnfEHxJHYjV6enJNkdQTk', ksmAmount * 10000000000);
    console.log('selectedAccount.address: ', selectedAccount.address);
    const { signer } = await web3FromAddress(selectedAccount.address);
    // console.log('sender: ', sender);
    const unsub = await extrinsic.signAndSend(selectedAccount.address, { signer } , ({ status }) => {
      console.log('status.type: ', status.type);
      if (status.isFinalized || status.isInBlock) {
        setExtrinsicStatus(`Status: ${status.type}, blockNumber: ${ status.isFinalized ? status.asFinalized : status.asInBlock}`);
      } else {
        setExtrinsicStatus(`Status: ${status.type}`);
      }
      if (status.isFinalized) {
        unsub();
        setSending(false);
      }
    });
  }

  const onFinish = (values) => {
    console.log('values: ', values);
    onSubmitClicked(_.toNumber(values.ksmAmount));
  }

  const onValuesChange = () => {
    const price = _.toNumber(swapForm.getFieldValue('price'));
    const mgxAmount = _.toNumber(swapForm.getFieldValue('mgxAmount'));

    if (_.isNumber(price) && price > 0 && basePrice > 0) {
      setExpectedOutput(mgxAmount / price);
      swapForm.setFieldsValue({ ksmAmount: mgxAmount / price });
      setPriceVolatility(price / basePrice - 1);
    } else {
      setPriceVolatility(null);
    }
  }

  let volatilityElement = null;

  if (priceVolatility) {
    const { direction, triggerPercentage }  = getTriggerPercentage();
    const volatilityText = `${triggerPercentage}% ${ direction === 0 ? 'above' : 'below' } market price`;
    const color = priceVolatility > 0 ? 'green' : 'red';
    volatilityElement  = (<span style={{ color, paddingLeft:12 }}>{volatilityText}</span>);
  }

  return (
    <div className='page-wrapper'>
      <div className="main-container">
        <div className='container page-container'>
          <Row>
            <Col span={12}>
              <div className='price-feed-container'>
                <h1>Price Feed: MGX / KSM</h1>
                <div>
                  <table>
                    <thead>
                    <tr className="price-row" style={{ color: '#95098B'}}>
                      <th className="price-col price-first-col">timestamp</th>
                      <th className="price-col">asset</th>
                      <th className="price-col">value</th>
                    </tr>
                    </thead>
                    <tbody>
                    {priceRows}
                    </tbody>
                  </table>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className='swap-container'>
                <h1>Swap Options</h1>
                <div style={{paddingTop:12, paddingBottom:24}}>
                <div className="current-price">Base price: <span className="current-price-text">{basePrice || '-'} KSM:MGX</span></div>
                <div className="current-price">Current price: <span className="current-price-text">{currentPrice && currentPrice.value || '-'} KSM:MGX</span></div>
                </div>
                <Form
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
                    <Col span={24} >
                      <Form.Item label="Stop" >
                        <Row>
                          <Col span={10}>
                          <Form.Item name="price" rules={[{ required: true, message: 'Please input price!' }]} noStyle>
                          <Input />
                        </Form.Item>
                          </Col>
                          <Col span={14}><span style={{paddingLeft:12, lineHeight:'32px'}}> MGX</span>{ volatilityElement }</Col>
                        </Row>
                      </Form.Item>
                      <Form.Item label="Amount" >
                        <Row>
                          <Col span={10}>
                          <Form.Item name="mgxAmount" rules={[{ required: true, message: 'Please enter a MGX amount' }]}>
                          <Input />
                          </Form.Item>
                          </Col>
                          <Col span={14}><span style={{paddingLeft:12, lineHeight:'32px'}}> MGX</span></Col>
                        </Row>
                      </Form.Item>
                      {/* <div style={{ marginBottom: 20, fontWeight: 800, fontSize: 14, textAlign: 'right' }}>X</div> */}
                      <Form.Item label="Expected Output:" >
                        <Row>
                          <Col span={16}>
                          <span style={{paddingLeft:12}}>{_.isNaN(expectedOutput)? "-" : expectedOutput} KSM</span>
                          </Col>
                        </Row>
                      </Form.Item>
                      
                    </Col>
                    {/* <Col span={24}>
                      <div style={{ marginBottom: 169 }}>
                        <Select className="token-select" defaultValue="ksm">
                          <Option value="ksm">KSM</Option>
                        </Select>
                      </div>
                      <div>
                        <Select className="token-select" defaultValue="mgx">
                          <Option value="mgx">MGX</Option>
                        </Select>
                      </div>
                    </Col> */}
                  </Row>
                  
                  <div className='important'>
                    <p className="title">Important:</p>
                    <p>Turing will trigger the transaction for inclusion after the price threshold has been met;</p>
                    we cannot guarantee the price received.
                  </div>


                  { !selectedAccount && (
                    <div className='d-flex justify-content-center'>
                      <Button className="connect-wallet-button" onClick={onConnectWalletClicked}>Connect Wallet</Button>
                    </div>
                  )}
                  
                  { selectedAccount && <div className='selected-account'>Selected Account: <span style={{ color: '#95098B', fontWeight: '800', marginLeft: 5, 
  cursor: 'pointer' }} onClick={onConnectWalletClicked}>{selectedAccount.meta.name}</span></div> }

                  { !_.isEmpty(extrinsicStatus) && <div className='extrinsic-status'><div>{extrinsicStatus}</div></div> }
                  
                  { selectedAccount && (
                    <div className='d-flex justify-content-center'>
                      <Button htmlType="submit" className="connect-wallet-button" loading={sending}>Buy KSM</Button>
                    </div>
                  )}
                </Form>
              </div>
            </Col>
          </Row>
        </div>
      </div>
      { accountSelectorVisible && (
        <div className="modal-background">
          <div className="modal-window">
            <h1 className="account-title">Select Account</h1>
            {accountRows}
          </div>
        </div>
      )}
    </div>
  );
}

export default Swap;
