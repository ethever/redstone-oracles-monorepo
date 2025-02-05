import { Signer, Wallet } from "ethers";
import {
  computeAddress,
  joinSignature,
  keccak256,
  recoverPublicKey,
  SigningKey,
  toUtf8Bytes,
  verifyMessage,
} from "ethers/lib/utils";

export class UniversalSigner {
  static getDigestForData(data: any) {
    const message = JSON.stringify(data);
    const digest = keccak256(toUtf8Bytes(message));
    return digest;
  }

  static signStringifiableData(data: any, privateKey: string): string {
    const digest = UniversalSigner.getDigestForData(data);
    const signingKey = new SigningKey(privateKey);
    const fullSignature = signingKey.signDigest(digest);
    return joinSignature(fullSignature);
  }

  static recoverSigner(data: any, signature: string) {
    const digest = UniversalSigner.getDigestForData(data);
    const publicKey = recoverPublicKey(digest, signature);
    return computeAddress(publicKey);
  }

  static signWithEthereumHashMessage(
    signerOrWallet: Signer | Wallet,
    message: string
  ): Promise<string> {
    return signerOrWallet.signMessage(message);
  }

  static recoverAddressFromEthereumHashMessage(
    message: string,
    signature: string
  ): string {
    return verifyMessage(message, signature);
  }
}
