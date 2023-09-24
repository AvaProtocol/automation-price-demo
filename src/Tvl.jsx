import {
  Row, Col, Input, Select, Button, Form,
} from 'antd';
import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { v4 } from 'uuid';
import moment from 'moment-timezone';
import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';

import subqueryHelper from './common/subqueryHelper';
import polkadotHelper from './common/polkadotHelper';

import './Tvl.css';

const { Option } = Select;

const assets = [
  { name: 'MFAM', key: 'moonwell-apollo-tvl' },
];

function Tvl() {
  const [prices, setPrices] = useState([]);
  const [accountSelectorVisible, setAccountSelectorVisible] = useState(false);
  const [accounts, setAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [extrinsicStatus, setExtrinsicStatus] = useState(null);
  const [sending, setSending] = useState(false);
  const [swapForm] = Form.useForm();

  const convertToNumber = (value) => _.toNumber(_.replace(value, new RegExp(',', 'g'), ''));

  useEffect(() => {
    setInterval(async () => {
      const allPrices = await subqueryHelper.getPrices();

      let formattedPrices = [];
      _.each(allPrices, (price) => {
        const foundAsset = _.find(assets, (assetItem) => {
          const { asset } = price.args;
          return assetItem.key === asset;
        });
        if (!foundAsset) {
          return;
        }
        const { timestamp, args: { asset, value } } = price;
        formattedPrices.push({
          timestamp,
          asset,
          value,
          name: foundAsset.name,
        });
      });

      _.each(formattedPrices, (item) => item.timestamp = moment.utc(item.timestamp).format());

      // const { timestamp } = prices[0];
      // const { name, key } = assets[0];
      // const api = await polkadotHelper.getPolkadotApi();
      // const price = await api.query.automationPrice.assetPrices(key);
      // if(moment(timestamp).minute() !== moment()) {
      //   prices.unshift({ timestamp: moment().format(), value: price.toString(), asset: key, name });
      // } else {
      //   prices[0] = { timestamp: prices[0].timestamp, value: price.toString(), asset: key, name };
      // }

      formattedPrices = _.slice(formattedPrices, 0, 10);
      // console.log('formattedPrices: ', formattedPrices);
      setPrices(formattedPrices);

      swapForm.setFieldValue('currentTvl', assets[0].name);
    }, 10000);
  }, [swapForm]);

  const priceRows = _.map(prices, (priceItem) => {
    const { timestamp, value, name } = priceItem;
    return (
      <tr key={moment(timestamp).toString()} className="price-row">
        <th className="price-col price-first-col">{moment(timestamp).format()}</th>
        <th className="price-col">{name}</th>
        <th className="price-col">
          $
          {(convertToNumber(value) / 10 ** 6).toFixed(1)}
          MM
        </th>
      </tr>
    );
  });

  const onAccountSelected = (account) => {
    console.log('onAccountSelected, account: ', account);
    setSelectedAccount(account);
    setAccountSelectorVisible(false);
  };

  const accountRows = _.map(accounts, (account) => {
    const { address, meta: { name } } = account;
    return <div key={address} className="account-row" onClick={() => onAccountSelected(account)}>{name}</div>;
  });

  const onConnectWalletClicked = async () => {
    setAccountSelectorVisible(true);
    await web3Enable('Automation price demo');
    const allAccounts = await web3Accounts({ accountType: 'sr25519', ss58Format: 51 });
    setAccounts(allAccounts);
  };

  const onSubmitClicked = async (tvl) => {
    setSending(true);
    const api = await polkadotHelper.getPolkadotApi();

    const processedTvl = tvl * 10 ** 6;
    const direction = processedTvl > currentPrice ? 0 : 1;

    let triggerPercentage = Math.abs(1 - processedTvl / currentPrice);
    triggerPercentage = triggerPercentage < 1 ? 1 : triggerPercentage;
    console.log('triggerPercentage: ', triggerPercentage);

    const extrinsic = api.tx.automationPrice.scheduleTransferTask(v4(), 'mgx:ksm', direction, triggerPercentage, '68HXCiRMPD19obaN1Cnr93pHKRvdnfEHxJHYjV6enJNkdQTk', 1 * 10000000000);
    console.log('selectedAccount.address: ', selectedAccount.address);
    const { signer } = await web3FromAddress(selectedAccount.address);
    // console.log('sender: ', sender);
    const unsub = await extrinsic.signAndSend(selectedAccount.address, { signer }, ({ status }) => {
      console.log('status.type: ', status.type);
      if (status.isFinalized || status.isInBlock) {
        setExtrinsicStatus(`Status: ${status.type}, blockNumber: ${status.isFinalized ? status.asFinalized : status.asInBlock}`);
      } else {
        setExtrinsicStatus(`Status: ${status.type}`);
      }
      if (status.isFinalized) {
        unsub();
        setSending(false);
      }
    });
  };

  const onFinish = (values) => {
    console.log('values: ', values);
    const { tvl } = values;
    onSubmitClicked(_.toNumber(tvl));
  };

  let currentPrice = null;
  if (!_.isEmpty(prices)) {
    const { value: currentPriceValue } = prices[0];
    currentPrice = convertToNumber(currentPriceValue);
  }

  // let volatilityElement = null;
  // if (priceVolatility) {
  //   const volatilityText = `Sell KSM ${Math.abs((100 * priceVolatility).toFixed(2))}% ${ priceVolatility > 0 ? 'above' : 'below' } market`;
  //   const color = priceVolatility > 0 ? 'green' : 'red';
  //   volatilityElement  = (<div className='sell' style={{ color }}>{volatilityText}</div>);

  // }

  const optionStr = currentPrice ? `${assets[0].name} Current TVL: $${(currentPrice / 10 ** 6).toFixed(1)}MM` : null;

  return (
    <div className="page-wrapper">
      <div className="main-container">
        <div className="container page-container">
          <Row>
            <Col span={12} className="d-flex justify-content-center">
              <div className="price-feed-container">
                <h2>TVL Feed</h2>
                <div>
                  <table>
                    <tbody>
                      {priceRows}
                    </tbody>
                  </table>
                </div>
              </div>
            </Col>
            <Col span={12} className="d-flex justify-content-center">
              <div className="swap-container">
                <h1 style={{ marginBottom: 30 }}>Liquidate</h2>
                <Form
                  form={swapForm}
                  name="basic"
                  labelCol={{ span: 8 }}
                  wrapperCol={{ span: 16 }}
                  initialValues={{ currentTvl: '', direction: 'greater' }}
                  onFinish={onFinish}
                  autoComplete="off"
                >

                  <Form.Item name="currentTvl">
                    <Select className="token-select">
                      { currentPrice && <Option value={assets[0].name}>{optionStr}</Option>}
                    </Select>
                  </Form.Item>

                  <Form.Item name="direction">
                    <Select className="direction-select">
                      <Option value="greater">&gt;</Option>
                      <Option value="less">&lt;</Option>
                    </Select>
                  </Form.Item>

                  <div className="price-wrapper">
                    <div className="price-column">
                      <Form.Item name="tvl">
                        <Input />
                      </Form.Item>
                    </div>
                    <div className="price-text">
                      MM
                    </div>
                  </div>

                  { !selectedAccount && (
                    <div className="d-flex justify-content-center">
                      <Button className="connect-wallet-button" onClick={onConnectWalletClicked}>Connect Wallet</Button>
                    </div>
                  )}

                  { selectedAccount && (
                  <div className="selected-account">
                    Selected Account:
                    <span
                      style={{
                        color: '#95098B',
                        fontWeight: '800',
                        marginLeft: 5,
                        cursor: 'pointer',
                      }}
                      onClick={onConnectWalletClicked}
                    >
                      {selectedAccount.meta.name}
                    </span>
                  </div>
                  ) }

                  { !_.isEmpty(extrinsicStatus) && <div className="extrinsic-status"><div>{extrinsicStatus}</div></div> }

                  { selectedAccount && (
                    <div className="d-flex justify-content-center">
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
            <h1 className="account-title">Select Account</h2>
            {accountRows}
          </div>
        </div>
      )}
    </div>
  );
}

export default Tvl;
