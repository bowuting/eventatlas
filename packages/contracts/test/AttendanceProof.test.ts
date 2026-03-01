import { expect } from "chai";
import { ethers } from "hardhat";

describe("AttendanceProof", () => {
  it("should mint once per event per user", async () => {
    const [owner, user] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("AttendanceProof");
    const contract = await factory.deploy(owner.address);
    await contract.waitForDeployment();

    const eventId = 1001n;

    await expect(contract.mintAttendance(eventId, user.address))
      .to.emit(contract, "AttendanceMinted")
      .withArgs(user.address, eventId, 1n);

    await expect(contract.mintAttendance(eventId, user.address)).to.be.revertedWith("attendance exists");
  });

  it("should reject transfer after mint", async () => {
    const [owner, user, user2] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("AttendanceProof");
    const contract = await factory.deploy(owner.address);
    await contract.waitForDeployment();

    await contract.mintAttendance(1002n, user.address);

    await expect(contract.connect(user).transferFrom(user.address, user2.address, 1n)).to.be.revertedWith(
      "attendance proof is non-transferable"
    );
  });
});
