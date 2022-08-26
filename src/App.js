import './App.css';
import { Row, Col } from 'antd';
import { useEffect } from 'react';
import { ApiPromise, WsProvider } from '@polkadot/api';


const OAK_WS_ENDPOINT = 'wss://rpc.turing-staging.oak.tech'

function App() {
  const getPolkadotApi = async () => {
    const wsProvider = new WsProvider(OAK_WS_ENDPOINT);
    const polkadotApi = await ApiPromise.create({
      provider: wsProvider,
      rpc: {
        automationTime: {
          generateTaskId: {
            description: 'Getting task ID given account ID and provided ID',
            params: [
              {
                name: 'accountId',
                type: 'AccountId',
              },
              {
                name: 'providedId',
                type: 'Text',
              },
            ],
            type: 'Hash',
          },
        },
      },
    });
    return polkadotApi;
  }

  useEffect( () => {
    const getPrice = async () => {
      const polkadotApi = await getPolkadotApi();
      const price = await polkadotApi.query.automationPrice.assetPrices('mgx:ksm');
      console.log('price: ', price.toString());
    }
    getPrice();
  }, []);

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
