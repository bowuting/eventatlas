import { expect } from "chai";
import { keccak256, toUtf8Bytes } from "ethers";
import { ethers } from "hardhat";

describe("ReviewAnchor", () => {
  it("should allow rating only for users with attendance proof", async () => {
    const [owner, user] = await ethers.getSigners();

    const attendanceFactory = await ethers.getContractFactory("AttendanceProof");
    const attendance = await attendanceFactory.deploy(owner.address);
    await attendance.waitForDeployment();

    const reviewFactory = await ethers.getContractFactory("ReviewAnchor");
    const review = await reviewFactory.deploy(owner.address, await attendance.getAddress());
    await review.waitForDeployment();

    const eventId = 1001n;
    const reviewHash = keccak256(toUtf8Bytes("review-1"));

    await expect(review.submitRating(eventId, user.address, 5, reviewHash)).to.be.revertedWith("no attendance proof");

    await attendance.mintAttendance(eventId, user.address);

    await expect(review.submitRating(eventId, user.address, 5, reviewHash))
      .to.emit(review, "RatingSubmitted")
      .withArgs(user.address, eventId, 5, reviewHash);

    await expect(review.submitRating(eventId, user.address, 4, reviewHash)).to.be.revertedWith("rating exists");
  });

  it("should reject out-of-range rating", async () => {
    const [owner, user] = await ethers.getSigners();

    const attendanceFactory = await ethers.getContractFactory("AttendanceProof");
    const attendance = await attendanceFactory.deploy(owner.address);
    await attendance.waitForDeployment();

    const reviewFactory = await ethers.getContractFactory("ReviewAnchor");
    const review = await reviewFactory.deploy(owner.address, await attendance.getAddress());
    await review.waitForDeployment();

    await attendance.mintAttendance(1002n, user.address);

    const reviewHash = keccak256(toUtf8Bytes("review-2"));
    await expect(review.submitRating(1002n, user.address, 0, reviewHash)).to.be.revertedWith("rating out of range");
  });
});
