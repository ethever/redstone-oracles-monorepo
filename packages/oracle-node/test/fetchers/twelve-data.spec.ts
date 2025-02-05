import fetchers from "../../src/fetchers/index";
import { mockFetcherResponse } from "./_helpers";

jest.mock("axios");

describe("twelve-data fetcher", () => {
  const sut = fetchers["twelve-data"];

  beforeEach(() => {
    mockFetcherResponse("../../src/fetchers/twelve-data/example-response.json");
  });

  it("should properly fetch data", async () => {
    const result = await sut.fetchAll(["CHF", "GBP", "EUR", "JPY", "AUD"]);
    expect(result).toEqual([
      {
        symbol: "CHF",
        value: 1.0388,
      },
      {
        symbol: "GBP",
        value: 1.24895,
      },
      {
        symbol: "EUR",
        value: 1.0719,
      },
      {
        symbol: "JPY",
        value: 0.764,
      },
      {
        symbol: "AUD",
        value: 0.7207,
      },
    ]);
  });
});
