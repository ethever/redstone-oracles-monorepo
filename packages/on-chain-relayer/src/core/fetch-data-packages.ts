import {
  DataPackagesRequestParams,
  DataPackagesResponse,
  requestDataPackages,
  ValuesForDataFeeds,
} from "redstone-sdk";
import { RelayerConfig } from "../types";
import { config } from "../config";

const MILLISECONDS_IN_ONE_MINUTE = 60 * 1000;

export async function fetchDataPackages(
  config: RelayerConfig,
  uniqueSignersThreshold: number,
  valuesFromContract: ValuesForDataFeeds,
  isHistorical: boolean = false
) {
  const { dataServiceId, dataFeeds, cacheServiceUrls } = config;

  const requestParams: DataPackagesRequestParams = {
    dataServiceId,
    uniqueSignersCount: uniqueSignersThreshold,
    dataFeeds,
    valuesToCompare: valuesFromContract,
    urls: cacheServiceUrls
  };

  return isHistorical
    ? await requestHistoricalDataPackages(requestParams)
    : await requestDataPackages(requestParams);
}

const requestHistoricalDataPackages = (
  requestParams: DataPackagesRequestParams
): Promise<DataPackagesResponse> => {
  const { fallbackOffsetInMinutes, historicalPackagesGateways } = config();

  if (!!fallbackOffsetInMinutes && !!historicalPackagesGateways) {
    return requestDataPackages({
      ...requestParams,
      historicalTimestamp: calculateOlderPackagesTimestamp(
        fallbackOffsetInMinutes
      ),
      urls: historicalPackagesGateways,
    });
  }

  throw (
    `Historical packages fetcher for fallback deviation check is not properly configured: ` +
    `offset=${fallbackOffsetInMinutes} min., gateway=${JSON.stringify(historicalPackagesGateways)}`
  );
};

const calculateOlderPackagesTimestamp = (
  deviationCheckOffsetInMinutes: number
) => {
  if (deviationCheckOffsetInMinutes > 0) {
    // We round the timestamp to full minutes for being compatible with
    // oracle-nodes, which usually work with rounded 10s and 60s intervals
    return (
      Math.round(
        Date.now() / MILLISECONDS_IN_ONE_MINUTE - deviationCheckOffsetInMinutes
      ) * MILLISECONDS_IN_ONE_MINUTE
    );
  }
};
