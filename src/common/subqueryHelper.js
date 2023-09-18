const SUBQUERY_URL = 'https://api.subquery.network/sq/OAK-Foundation/turing-staging-subql';

class SubqueryHelper {
  static query = async (data) => {
    const response = await fetch(
      SUBQUERY_URL,
      {
        method: 'POST',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
    const result = await response.json();
    return result;
  };

  static getPrices = async () => {
    const queryObj = {
      query: 'query { extrinsics( orderBy:TIMESTAMP_DESC filter:{ method: { in: ["assetPriceUpdate" ]} }) { nodes { timestamp args } } }',
      variables: null,
    };
    const { data: { extrinsics: { nodes } } } = await this.query(queryObj);
    return nodes;
  };
}

export default new SubqueryHelper();
