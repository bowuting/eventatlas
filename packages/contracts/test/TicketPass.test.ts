import { expect } from "chai";
import { ethers } from "hardhat";

describe("TicketPass", () => {
  it("should allow organizer config and user purchase", async () => {
    const [owner, organizer, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("TicketPass");
    const contract = await factory.deploy(owner.address);
    await contract.waitForDeployment();

    const eventId = 1001n;
    const ticketTypeId = 1n;
    const now = Math.floor(Date.now() / 1000);
    const price = ethers.parseEther("0.1");

    await contract.registerEvent(eventId, organizer.address);

    await contract
      .connect(organizer)
      .configureTicketType(eventId, ticketTypeId, price, 100n, BigInt(now - 10), BigInt(now + 3600), false);

    await expect(contract.connect(user).buyTicket(eventId, ticketTypeId, { value: price }))
      .to.emit(contract, "TicketMinted")
      .withArgs(user.address, eventId, ticketTypeId, 1n);

    expect(await contract.hasValidTicket(eventId, user.address)).to.equal(true);
  });
});
