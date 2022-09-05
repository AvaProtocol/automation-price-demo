import { Row, Col, Input, Select, Button, Form } from 'antd';
import { useEffect, useState } from 'react';
import _ from 'lodash';
import { v4 } from 'uuid';
import moment from 'moment-timezone';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';


import subqueryHelper from './common/subqueryHelper';
import polkadotHelper from './common/polkadotHelper';

import './App.css';

const { Option } = Select;

function App() {
  const [prices, setPrices] = useState([]);
  const [accountSelectorVisible, setAccountSelectorVisible] = useState(false);
  const [accounts, setAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [extrinsicStatus, setExtrinsicStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [priceVolatility, setPriceVolatility] = useState(null);
  const [swapForm] = Form.useForm();

  const convertToNumber = (value) => _.toNumber(_.replace(value, ',', ''));

  useEffect( () => {
    setInterval(async () => {
      let prices = await subqueryHelper.getPrices();
      prices = _.filter(prices, ({ args: { asset }}) => asset === 'mgx:ksm');
      prices = _.each(prices, (price) => price.timestamp = moment.utc(price.timestamp).format());

      const { timestamp } = prices[0];
      const api = await polkadotHelper.getPolkadotApi();
      const price = await api.query.automationPrice.assetPrices('mgx:ksm');
      if(moment(timestamp).minute() !== moment()) {
        prices.unshift({ timestamp: moment().format(), args: { value: price.toString(), asset: 'mgx:ksm' } });
      } else {
        prices[0] = { timestamp: prices[0].timestamp, args: { value: price.toString(), asset: 'mgx:ksm' } };
      }

      prices = _.slice(prices, 0, 10);
      setPrices(prices);
    }, 10000);
  }, [swapForm]);

  const priceRows = _.map(prices, (priceItem) => {
    const { timestamp, args: { asset, value } } = priceItem;
    return (
      <tr key={moment(timestamp).toString()} className="price-row">
        <th className="price-col price-first-col">{moment(timestamp).format()}</th>
        <th className="price-col">{asset}</th>
        <th className="price-col">{convertToNumber(value)}</th>
      </tr>
    )
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

  const onSubmitClicked = async (ksmAmount) => {
    setSending(true);
    const api = await polkadotHelper.getPolkadotApi();

    const direction = priceVolatility > 0 ? 0 : 1;
    console.log('priceVolatility: ', priceVolatility);
    let triggerPercentage = Math.abs(Math.floor(priceVolatility * 100));
    triggerPercentage = triggerPercentage < 1 ? 1 : triggerPercentage;
    console.log('triggerPercentage: ', triggerPercentage);

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

  const onValuesChange = (values) => {
    const ksmAmount = _.toNumber(swapForm.getFieldValue('ksmAmount'));
    const price = _.toNumber(swapForm.getFieldValue('price'));
    if (_.isNumber(price) && price > 0 && currentPrice > 0) {
      swapForm.setFieldsValue({ mgxAmount: ksmAmount * price });
      setPriceVolatility(price / currentPrice - 1);
    } else {
      swapForm.setFieldsValue({ mgxAmount: undefined});
      setPriceVolatility(null);
    }
  }
  

  let currentPrice = null;
  if (!_.isEmpty(prices)) {
    const { args: { value: currentPriceValue } } = prices[0];
    currentPrice = convertToNumber(currentPriceValue);
  }

  let volatilityElement = null;
  if (priceVolatility) {
    const volatilityText = `Sell KSM ${Math.abs((100 * priceVolatility).toFixed(2))}% ${ priceVolatility > 0 ? 'above' : 'below' } market`;
    const color = priceVolatility > 0 ? 'green' : 'red';
    volatilityElement  = (<div className='sell' style={{ color }}>{volatilityText}</div>);
    
  }

  return (
    <div className='page-wrapper'>
      <div className="main-container">
        <div className='container page-container'>
          <Row>
            <Col span={12} className='d-flex justify-content-center'>
              <div className='price-feed-container'>
                <h1>Price Feed</h1>
                <div>
                  <table>
                    <tbody>
                    {priceRows}
                    </tbody>
                  </table>
                </div>
              </div>
            </Col>
            <Col span={12} className='d-flex justify-content-center'>
              <div className='swap-container'>
                <h1>Swap</h1>
                <div className="current-price">Current price: <span className="current-price-text">1 KSM = {currentPrice || '-'} MGX</span></div>
                <Form
                  form={swapForm}
                  name="basic"
                  labelCol={{ span: 8 }}
                  wrapperCol={{ span: 16 }}
                  initialValues={{ remember: true }}
                  onFinish={onFinish}
                  autoComplete="off"
                  onValuesChange={onValuesChange}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="ksmAmount" rules={[{ required: true, message: 'Please input your ksm amount!' }]}>
                        <Input />
                      </Form.Item>
                      <div style={{ marginBottom: 20, fontWeight: 800, fontSize: 14 }}>X</div>
                      <Form.Item name="price">
                        <Input />
                      </Form.Item>
                      <div className="split-line"></div>
                      <Form.Item name="mgxAmount">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
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
                    </Col>
                  </Row>

                  { volatilityElement }

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
                      <Button htmlType="submit" className="connect-wallet-button" loading={sending}>Submit</Button>
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

export default App;
