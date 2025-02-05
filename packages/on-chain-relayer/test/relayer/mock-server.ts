import { setupServer } from "msw/node";
import { rest } from "msw";
import { getDataPackagesResponse } from "../helpers";

const handlers = [
  rest.get(
    "http://mock-cache-service/data-packages/latest/redstone-main-demo",
    async (req, res, ctx) => {
      return res(ctx.json(getDataPackagesResponse()));
    }
  ),
];

export const server = setupServer(...handlers);
