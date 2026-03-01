import { attendanceProofAbi, reviewAnchorAbi, ticketPassAbi } from "@eventatlas/shared";
import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { env } from "../config/env.js";

export type ConfigureTicketInput = {
  eventId: number;
  ticketTypeId: number;
  priceWei: string;
  supply: number;
  saleStart: string;
  saleEnd: string;
  transferable: boolean;
};

class ChainService {
  private provider = new JsonRpcProvider(env.AVAX_RPC_URL, env.AVAX_CHAIN_ID);

  private getTicketPassAddress() {
    if (!env.TICKET_PASS_ADDRESS) {
      throw new Error("TICKET_PASS_ADDRESS is missing");
    }
    return env.TICKET_PASS_ADDRESS;
  }

  private getAttendanceProofAddress() {
    if (!env.ATTENDANCE_PROOF_ADDRESS) {
      throw new Error("ATTENDANCE_PROOF_ADDRESS is missing");
    }
    return env.ATTENDANCE_PROOF_ADDRESS;
  }

  private getReviewAnchorAddress() {
    if (!env.REVIEW_ANCHOR_ADDRESS) {
      throw new Error("REVIEW_ANCHOR_ADDRESS is missing");
    }
    return env.REVIEW_ANCHOR_ADDRESS;
  }

  private getSigner() {
    if (!env.DEPLOYER_PRIVATE_KEY) {
      throw new Error("DEPLOYER_PRIVATE_KEY is missing");
    }
    return new Wallet(env.DEPLOYER_PRIVATE_KEY, this.provider);
  }

  private getTicketPassWriteContract() {
    const signer = this.getSigner();
    return new Contract(this.getTicketPassAddress(), ticketPassAbi, signer);
  }

  private getTicketPassReadContract() {
    return new Contract(this.getTicketPassAddress(), ticketPassAbi, this.provider);
  }

  private getAttendanceWriteContract() {
    const signer = this.getSigner();
    return new Contract(this.getAttendanceProofAddress(), attendanceProofAbi, signer);
  }

  private getAttendanceReadContract() {
    return new Contract(this.getAttendanceProofAddress(), attendanceProofAbi, this.provider);
  }

  private getReviewWriteContract() {
    const signer = this.getSigner();
    return new Contract(this.getReviewAnchorAddress(), reviewAnchorAbi, signer);
  }

  private getReviewReadContract() {
    return new Contract(this.getReviewAnchorAddress(), reviewAnchorAbi, this.provider);
  }

  async registerEvent(eventId: number, organizerWallet: string, startAt: string, endAt: string) {
    const contract = this.getTicketPassWriteContract();
    const tx = await contract.registerEvent(eventId, organizerWallet);
    const receipt = await tx.wait();

    const timeTx = await contract.setEventTimeRange(
      BigInt(eventId),
      BigInt(Math.floor(new Date(startAt).getTime() / 1000)),
      BigInt(Math.floor(new Date(endAt).getTime() / 1000))
    );
    const timeReceipt = await timeTx.wait();

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      setTimeTxHash: timeTx.hash,
      setTimeBlockNumber: timeReceipt?.blockNumber
    };
  }

  async configureTicketType(input: ConfigureTicketInput) {
    const contract = this.getTicketPassWriteContract();

    const tx = await contract.configureTicketType(
      BigInt(input.eventId),
      BigInt(input.ticketTypeId),
      BigInt(input.priceWei),
      BigInt(input.supply),
      BigInt(Math.floor(new Date(input.saleStart).getTime() / 1000)),
      BigInt(Math.floor(new Date(input.saleEnd).getTime() / 1000)),
      input.transferable
    );

    const receipt = await tx.wait();
    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber
    };
  }

  async hasValidTicket(eventId: number, userWallet: string) {
    const contract = this.getTicketPassReadContract();
    return Boolean(await contract.hasValidTicket(BigInt(eventId), userWallet));
  }

  async parseTicketMintFromTx(txHash: string) {
    const contract = this.getTicketPassReadContract();
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("transaction not found");
    }

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "TicketMinted") {
          return {
            user: String(parsed.args.user).toLowerCase(),
            eventId: parsed.args.eventId.toString(),
            ticketTypeId: parsed.args.ticketTypeId.toString(),
            tokenId: parsed.args.tokenId.toString()
          };
        }
      } catch {
        // skip unrelated logs
      }
    }

    throw new Error("TicketMinted event not found in tx receipt");
  }

  async parseTicketRefundFromTx(txHash: string) {
    const contract = this.getTicketPassReadContract();
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("transaction not found");
    }

    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "TicketRefunded") {
          return {
            user: String(parsed.args.user).toLowerCase(),
            eventId: parsed.args.eventId.toString(),
            ticketTypeId: parsed.args.ticketTypeId.toString(),
            tokenId: parsed.args.tokenId.toString()
          };
        }
      } catch {
        // skip unrelated logs
      }
    }

    throw new Error("TicketRefunded event not found in tx receipt");
  }

  async isEventCanceled(eventId: number) {
    const contract = this.getTicketPassReadContract();
    return Boolean(await contract.eventCanceled(BigInt(eventId)));
  }

  async isEventSettled(eventId: number) {
    const contract = this.getTicketPassReadContract();
    return Boolean(await contract.eventSettled(BigInt(eventId)));
  }

  async settleEvent(eventId: number) {
    const contract = this.getTicketPassWriteContract();
    const tx = await contract.settleEvent(BigInt(eventId));
    const receipt = await tx.wait();

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber
    };
  }

  async hasAttendanceProof(eventId: number, userWallet: string) {
    const contract = this.getAttendanceReadContract();
    return Boolean(await contract.hasAttendanceProof(BigInt(eventId), userWallet));
  }

  async mintAttendance(eventId: number, userWallet: string) {
    const contract = this.getAttendanceWriteContract();
    const tx = await contract.mintAttendance(BigInt(eventId), userWallet);
    const receipt = await tx.wait();

    let tokenId: string | undefined;

    if (receipt) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === "AttendanceMinted") {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // skip unrelated logs
        }
      }
    }

    if (!tokenId) {
      throw new Error("AttendanceMinted event not found in tx receipt");
    }

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      tokenId
    };
  }

  async hasRated(eventId: number, userWallet: string) {
    const contract = this.getReviewReadContract();
    return Boolean(await contract.hasRated(BigInt(eventId), userWallet));
  }

  async submitRating(eventId: number, userWallet: string, rating: number, reviewHash: string) {
    const contract = this.getReviewWriteContract();
    const tx = await contract.submitRating(BigInt(eventId), userWallet, rating, reviewHash);
    const receipt = await tx.wait();

    return {
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber
    };
  }
}

export const chainService = new ChainService();
