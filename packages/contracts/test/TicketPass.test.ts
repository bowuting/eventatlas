import { expect } from "chai";
import { ethers } from "hardhat";

async function increaseTime(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

describe("TicketPass", () => {
  async function deployBase() {
    const [owner, organizer, user, user2] = await ethers.getSigners();
    const ticketFactory = await ethers.getContractFactory("TicketPass");
    const contract = await ticketFactory.deploy(owner.address);
    await contract.waitForDeployment();

    const aggregatorFactory = await ethers.getContractFactory("MockV3Aggregator");
    const priceFeed = await aggregatorFactory.deploy(30_00_000000n); // $30.00 (8 decimals)
    await priceFeed.waitForDeployment();
    await contract.setAvaxUsdPriceFeed(await priceFeed.getAddress());

    const usdcFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await usdcFactory.deploy();
    await usdc.waitForDeployment();
    await contract.setStableToken(await usdc.getAddress(), true);

    return { owner, organizer, user, user2, contract, usdc };
  }

  it("should allow AVAX purchase with USD quote and user refund before cutoff", async () => {
    const { organizer, user, contract } = await deployBase();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const eventId = 1001n;
    const ticketTypeId = 1n;
    const eventStart = BigInt(now + 24 * 3600);
    const eventEnd = BigInt(now + 26 * 3600);

    await contract.registerEvent(eventId, organizer.address);
    await contract.connect(organizer).setEventTimeRange(eventId, eventStart, eventEnd);
    await contract
      .connect(organizer)
      .configureTicketType(eventId, ticketTypeId, 3_00_0000n, 100n, BigInt(now - 10), BigInt(now + 3600), false);

    const quote = await contract.quoteNativePriceWei(eventId, ticketTypeId);
    await expect(contract.connect(user).buyTicketWithNative(eventId, ticketTypeId, quote, { value: quote }))
      .to.emit(contract, "TicketMinted")
      .withArgs(user.address, eventId, ticketTypeId, 1n);

    await expect(contract.connect(user).requestRefund(1n))
      .to.emit(contract, "TicketRefunded")
      .withArgs(user.address, eventId, ticketTypeId, 1n, ethers.ZeroAddress, quote);

    expect(await contract.hasValidTicket(eventId, user.address)).to.equal(false);
  });

  it("should reject refund after transfer", async () => {
    const { organizer, user, user2, contract } = await deployBase();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const eventId = 1002n;
    const ticketTypeId = 1n;
    const eventStart = BigInt(now + 24 * 3600);
    const eventEnd = BigInt(now + 26 * 3600);

    await contract.registerEvent(eventId, organizer.address);
    await contract.connect(organizer).setEventTimeRange(eventId, eventStart, eventEnd);
    await contract
      .connect(organizer)
      .configureTicketType(eventId, ticketTypeId, 10_00_0000n, 100n, BigInt(now - 10), BigInt(now + 3600), true);

    const quote = await contract.quoteNativePriceWei(eventId, ticketTypeId);
    await contract.connect(user).buyTicketWithNative(eventId, ticketTypeId, quote, { value: quote });
    await contract.connect(user).transferFrom(user.address, user2.address, 1n);

    await expect(contract.connect(user2).requestRefund(1n)).to.be.revertedWithCustomError(
      contract,
      "RefundNotAllowedAfterTransfer"
    );
  });

  it("should settle event and directly pay 5% platform / 95% organizer after event end", async () => {
    const { owner, organizer, user, user2, contract, usdc } = await deployBase();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const eventId = 1003n;
    const eventStart = BigInt(now + 2 * 3600);
    const eventEnd = BigInt(now + 3 * 3600);

    await contract.registerEvent(eventId, organizer.address);
    await contract.connect(organizer).setEventTimeRange(eventId, eventStart, eventEnd);

    // ticket 1: AVAX
    await contract
      .connect(organizer)
      .configureTicketType(eventId, 1n, 3_00_0000n, 100n, BigInt(now - 10), BigInt(now + 3600), false);

    // ticket 2: USDC
    await contract
      .connect(organizer)
      .configureTicketType(eventId, 2n, 12_50_0000n, 100n, BigInt(now - 10), BigInt(now + 3600), false);

    const nativeQuote = await contract.quoteNativePriceWei(eventId, 1n);
    await contract.connect(user).buyTicketWithNative(eventId, 1n, nativeQuote, { value: nativeQuote });

    await usdc.mint(user.address, 12_50_0000n);
    await usdc.connect(user).approve(await contract.getAddress(), 12_50_0000n);
    await contract.connect(user).buyTicketWithERC20(eventId, 2n, await usdc.getAddress(), 12_50_0000n);

    await contract.connect(owner).setPlatformTreasury(user2.address);

    const treasuryNativeBefore = await ethers.provider.getBalance(user2.address);
    const organizerNativeBefore = await ethers.provider.getBalance(organizer.address);
    const treasuryUsdcBefore = await usdc.balanceOf(user2.address);
    const organizerUsdcBefore = await usdc.balanceOf(organizer.address);

    await increaseTime(4 * 3600);
    await contract.connect(owner).settleEvent(eventId);

    const platformNative = (nativeQuote * 500n) / 10_000n;
    const organizerNative = nativeQuote - platformNative;
    const platformUsdc = (12_50_0000n * 500n) / 10_000n;
    const organizerUsdc = 12_50_0000n - platformUsdc;

    expect(await ethers.provider.getBalance(user2.address)).to.equal(treasuryNativeBefore + platformNative);
    expect(await ethers.provider.getBalance(organizer.address)).to.equal(organizerNativeBefore + organizerNative);
    expect(await usdc.balanceOf(user2.address)).to.equal(treasuryUsdcBefore + platformUsdc);
    expect(await usdc.balanceOf(organizer.address)).to.equal(organizerUsdcBefore + organizerUsdc);
  });

  it("should allow organizer to trigger full refund after event canceled", async () => {
    const { organizer, user, user2, contract } = await deployBase();
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;

    const eventId = 1004n;
    const ticketTypeId = 1n;
    const eventStart = BigInt(now + 24 * 3600);
    const eventEnd = BigInt(now + 26 * 3600);

    await contract.registerEvent(eventId, organizer.address);
    await contract.connect(organizer).setEventTimeRange(eventId, eventStart, eventEnd);
    await contract
      .connect(organizer)
      .configureTicketType(eventId, ticketTypeId, 8_00_0000n, 100n, BigInt(now - 10), BigInt(now + 3600), true);

    const quote = await contract.quoteNativePriceWei(eventId, ticketTypeId);
    await contract.connect(user).buyTicketWithNative(eventId, ticketTypeId, quote, { value: quote });
    await contract.connect(user).transferFrom(user.address, user2.address, 1n);

    await contract.connect(organizer).cancelEvent(eventId);

    await expect(contract.connect(organizer).refundCanceledTicket(1n))
      .to.emit(contract, "TicketRefunded")
      .withArgs(user2.address, eventId, ticketTypeId, 1n, ethers.ZeroAddress, quote);
  });
});
