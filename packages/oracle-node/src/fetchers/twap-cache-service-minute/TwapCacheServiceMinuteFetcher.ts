import axios from "axios";
import {
  deserializeSignedPackage,
  recoverSignerAddress,
} from "redstone-protocol";
import { RedstoneTypes } from "redstone-utils";
import Decimal from "decimal.js";
import {
  MultiRequestFetcher,
  RequestIdToResponse,
} from "../MultiRequestFetcher";
import {
  clearDataPackageFromLocalCacheOlderThan,
  getDataPackageFromLocalCacheAsResponse,
  storeDataPackagesInLocalCache,
} from "../../db/local-db/twap-cache";
import { config } from "../../config";

type CacheServiceResponsePromise =
  PromiseSettledResult<RedstoneTypes.DataPackageFromCacheResponse>;

const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;

export class TwapCacheServiceMinuteFetcher extends MultiRequestFetcher {
  constructor(private readonly dataServiceId: string) {
    super(`twap-cache-service-minute-${dataServiceId}`);
  }

  override async makeRequest(
    id: string
  ): Promise<CacheServiceResponsePromise[]> {
    const { dataFeedId, minutesOffset } =
      TwapCacheServiceMinuteFetcher.parseTwapAssetId(id);
    const roundedTimestamp =
      TwapCacheServiceMinuteFetcher.roundTimestampToMinute(Date.now());
    const promises: Promise<RedstoneTypes.DataPackageFromCacheResponse>[] = [];
    for (let offset = 0; offset < minutesOffset; offset++) {
      const timestampForHistoricalRequest =
        roundedTimestamp - offset * ONE_MINUTE_IN_MILLISECONDS;
      const promise = this.requestDataPackageLazily(
        timestampForHistoricalRequest,
        dataFeedId
      );
      promises.push(promise);
    }
    return await Promise.allSettled(promises);
  }

  private async requestDataPackageLazily(
    timestampForHistoricalRequest: number,
    dataFeedId: string
  ) {
    const dataPackageFromLocalCache = getDataPackageFromLocalCacheAsResponse(
      timestampForHistoricalRequest,
      dataFeedId
    );
    if (dataPackageFromLocalCache) {
      return dataPackageFromLocalCache;
    }
    const url = `${config.historicalDataPackagesUrl}/${this.dataServiceId}/${timestampForHistoricalRequest}`;
    const dataPackageResponse =
      await axios.get<RedstoneTypes.DataPackageFromCacheResponse>(url);
    return dataPackageResponse.data;
  }

  override extractPrice(
    twapDataFeedId: string,
    responses: RequestIdToResponse<CacheServiceResponsePromise[]>
  ): number | undefined {
    const twapResponses = responses[twapDataFeedId];
    const { dataFeedId } =
      TwapCacheServiceMinuteFetcher.parseTwapAssetId(twapDataFeedId);

    const dataPackagesToCalculateTwap: RedstoneTypes.DataPackageFromCache[] =
      [];
    for (const response of twapResponses) {
      const dataPackageFromThisNode =
        TwapCacheServiceMinuteFetcher.getDataPackageFromThisNode(
          response,
          dataFeedId
        );
      if (dataPackageFromThisNode) {
        dataPackagesToCalculateTwap.push(dataPackageFromThisNode);
      }
    }
    TwapCacheServiceMinuteFetcher.validateSignatures(
      dataPackagesToCalculateTwap
    );
    storeDataPackagesInLocalCache(dataPackagesToCalculateTwap);
    clearDataPackageFromLocalCacheOlderThan();
    return TwapCacheServiceMinuteFetcher.getTwapValue(
      dataPackagesToCalculateTwap
    );
  }

  private static parseTwapAssetId(twapDataFeedId: string): {
    dataFeedId: string;
    minutesOffset: number;
  } {
    const chunks = twapDataFeedId.split("-");
    return {
      dataFeedId: chunks[0],
      minutesOffset: Number(chunks[chunks.length - 1]),
    };
  }

  private static roundTimestampToMinute = (timestamp: number): number => {
    return (
      Math.floor(timestamp / ONE_MINUTE_IN_MILLISECONDS) *
      ONE_MINUTE_IN_MILLISECONDS
    );
  };

  private static getDataPackageFromThisNode(
    response: CacheServiceResponsePromise,
    dataFeedId: string
  ): RedstoneTypes.DataPackageFromCache | undefined {
    const dataPackagesResponse =
      response.status === "fulfilled" ? response.value : undefined;
    if (dataPackagesResponse) {
      const dataPackages = dataPackagesResponse[dataFeedId];
      if (dataPackages?.length > 0) {
        return dataPackages.find(
          (dataPackage) => dataPackage.signerAddress === config.ethereumAddress
        );
      }
    }
  }

  private static validateSignatures(
    dataPackages: RedstoneTypes.DataPackageFromCache[]
  ) {
    for (const dataPackageObject of dataPackages) {
      const { signature, dataPackage } =
        deserializeSignedPackage(dataPackageObject);
      const singerAddress = recoverSignerAddress({
        signature,
        dataPackage,
      });

      if (singerAddress !== config.ethereumAddress) {
        throw new Error(
          "This node is doesn't signed package used to calculate TWAP"
        );
      }
    }
  }

  private static getTwapValue(
    dataPackages: RedstoneTypes.DataPackageFromCache[]
  ): number {
    const sortedDataPackages =
      TwapCacheServiceMinuteFetcher.getSortedValidPricesByTimestamp(
        dataPackages
      );

    if (sortedDataPackages.length === 0) {
      throw new Error("Cannot calculate TWAP, no data packages");
    }

    if (sortedDataPackages.length < 2) {
      const theOnlyValue = sortedDataPackages[0].dataPoints[0].value;
      return new Decimal(theOnlyValue).toNumber();
    } else {
      const totalIntervalLengthInMilliseconds =
        sortedDataPackages[0].timestampMilliseconds -
        sortedDataPackages[sortedDataPackages.length - 1].timestampMilliseconds;

      let twapValue = new Decimal(0);
      for (
        let intervalIndex = 0;
        intervalIndex < sortedDataPackages.length - 1;
        intervalIndex++
      ) {
        const partTwapValue =
          TwapCacheServiceMinuteFetcher.calculatePartTwapValue(
            sortedDataPackages,
            intervalIndex,
            totalIntervalLengthInMilliseconds
          );
        twapValue = twapValue.add(partTwapValue);
      }

      return twapValue.toNumber();
    }
  }

  private static getSortedValidPricesByTimestamp(
    dataPackages: RedstoneTypes.DataPackageFromCache[]
  ): RedstoneTypes.DataPackageFromCache[] {
    const validDataPackages = dataPackages.filter((dataPackage) => {
      const dataPointValue = dataPackage.dataPoints[0].value;
      const isNan = new Decimal(dataPointValue).isNaN();
      return !isNan;
    });

    validDataPackages.sort(
      (leftDataPackage, rightDataPackage) =>
        leftDataPackage.timestampMilliseconds -
        rightDataPackage.timestampMilliseconds
    );
    return validDataPackages;
  }

  private static calculatePartTwapValue(
    sortedDataPackages: RedstoneTypes.DataPackageFromCache[],
    intervalIndex: number,
    totalIntervalLengthInMilliseconds: number
  ): Decimal {
    const startPrice = sortedDataPackages[intervalIndex];
    const endPrice = sortedDataPackages[intervalIndex + 1];
    const intervalLengthInMilliseconds =
      startPrice.timestampMilliseconds - endPrice.timestampMilliseconds;
    const intervalWeight =
      intervalLengthInMilliseconds / totalIntervalLengthInMilliseconds;
    const startPriceValue = new Decimal(startPrice.dataPoints[0].value);
    const endPriceValue = new Decimal(endPrice.dataPoints[0].value);
    const intervalAverageValue = startPriceValue.add(endPriceValue).div(2);
    return intervalAverageValue.mul(intervalWeight);
  }
}
