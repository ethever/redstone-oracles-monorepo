import { RedstoneOraclesState } from "redstone-oracles-smartweave-contracts";

export const mockOraclesState: RedstoneOraclesState = {
  nodes: {
    "Mock arweave address": {
      name: "mock-node",
      description: "Mock node",
      logo: "https://redstone.finance/assets/img/redstone-logo-full.svg",
      dataServiceId: "mock-data-service",
      evmAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      url: "",
      ipAddress: "mock",
      ecdsaPublicKey: "mock",
      arweavePublicKey: "mock",
    },
  },
  evolve: null,
  canEvolve: true,
  dataServices: {
    "mock-data-service": {
      name: "RedStone TWAPs demo",
      manifestTxId: "ETNFHbaIXCIXSb2mvkY6QWbfcITsFsSDd4h48PhuHYs",
      logo: "https://redstone.finance/assets/img/redstone-logo-full.svg",
      description: "Time-weighted average prices for most popular tokens",
      admin: "aw9F_2R2ogYPnM66TDsW1qtiiRflRcgZQG6OLySOSZE",
    },
  },
  contractAdmins: [],
};
