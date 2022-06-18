import { concat, joinSignature, keccak256, SigningKey } from "ethers/lib/utils";
import {
  DATA_POINTS_COUNT_BYTE_SIZE,
  DEFAULT_DATA_POINT_VALUE_BYTE_SIZE_BS,
  TIMESTAMP_BYTE_SIZE,
} from "../common/redstone-consts";
import { Serializable } from "../common/Serializable";
import { convertIntegerNumberToBytes } from "../common/utils";
import { DataPointBase } from "../data-point/DataPointBase";
import { SignedDataPackage } from "./SignedDataPackage";

export abstract class DataPackageBase extends Serializable {
  constructor(
    public readonly dataPoints: DataPointBase[],
    public readonly timestampMilliseconds: number
  ) {
    if (dataPoints.length === 0) {
      throw new Error("Can not create a data package with no data points");
    }
    super();
  }

  protected abstract getDefaultDataPointByteSize(): number;

  serializeToBytes(): Uint8Array {
    return concat([
      this.serializeDataPoints(),
      this.serializeTimestamp(),
      this.serializeDefaultDataPointByteSize(),
      this.serializeDataPointsCount(),
    ]);
  }

  ecdsaSign(privateKey: string): SignedDataPackage {
    // Prepare hash for signing
    const serializedDataPackage = this.serializeToBytes();
    const signableHash = keccak256(serializedDataPackage);

    // Generating a signature
    const signingKey = new SigningKey(privateKey);
    const fullSignature = signingKey.signDigest(signableHash);

    // Return a signed data package
    return new SignedDataPackage(this, fullSignature);
  }

  protected serializeDataPoints(): Uint8Array {
    return concat(this.dataPoints.map((dp) => dp.serializeToBytes()));
  }

  protected serializeTimestamp(): Uint8Array {
    return convertIntegerNumberToBytes(
      this.timestampMilliseconds,
      TIMESTAMP_BYTE_SIZE
    );
  }

  protected serializeDataPointsCount(): Uint8Array {
    return convertIntegerNumberToBytes(
      this.dataPoints.length,
      DATA_POINTS_COUNT_BYTE_SIZE
    );
  }

  protected serializeDefaultDataPointByteSize(): Uint8Array {
    return convertIntegerNumberToBytes(
      this.getDefaultDataPointByteSize(),
      DEFAULT_DATA_POINT_VALUE_BYTE_SIZE_BS
    );
  }
}