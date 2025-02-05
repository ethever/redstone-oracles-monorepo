import redstone from "redstone-api";
import graphProxy from "../../../utils/graph-proxy";
import axios from "axios";
import { BalancerFetcher, BalancerPoolsConfig } from "../BalancerFetcher";

const SECOND_IN_MILLISECONDS = 1000;
const url = "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2";
const timestampToBlockProviderUrl = "https://coins.llama.fi/block/ethereum/";

export class BalancerFetcherHistorical extends BalancerFetcher {
  private timestamp: number;

  constructor(name: string, config: BalancerPoolsConfig, timestamp: number) {
    super(name, config);
    this.timestamp = timestamp;
  }

  protected async calculatePrice(
    pairId: string,
    pairedTokenPrice: number
  ): Promise<any> {
    const blockNumber = await this.getBlockNumber(this.timestamp);
    const graphResults = await graphProxy.executeQuery(
      url,
      this.getGraphQuery(pairId, blockNumber)
    );

    if (graphResults.data.pool === null) {
      this.logger.error("Pool is null for specified timestamp");

      return {
        spotPrice: NaN,
        assetId: "",
        pairedTokenPrice: NaN,
        liquidity: 0,
      };
    }
    const tokens = graphResults.data.pool.tokens;
    const token0 = tokens[0];
    const token1 = tokens[1];

    const spotPrice = Number(token0.balance / token1.balance);

    const symbol = this.config.poolsConfigs[token0]
      ? token0.symbol!
      : token1.symbol!;

    return { spotPrice, assetId: symbol, pairedTokenPrice, liquidity: 0 };
  }

  async getBlockNumber(timestamp: number) {
    return (await axios.get(timestampToBlockProviderUrl + timestamp)).data
      .height;
  }

  protected async getPairedTokenPrice() {
    const pairedToken = this.config.pairedToken;
    return (
      await redstone.getHistoricalPrice(`${pairedToken}`, {
        date: new Date(this.timestamp * SECOND_IN_MILLISECONDS),
      })
    ).value;
  }

  getGraphQuery(poolId: string, blockNumber: number) {
    return `{
      pool(
        id: "${poolId}"
        block: {number: ${blockNumber}}
      ) {
        id
        tokens {
          balance
          symbol
        }
        totalLiquidity
      }
    }`;
  }
}
