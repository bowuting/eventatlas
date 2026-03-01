import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TicketPass with account:", deployer.address);

  const factory = await ethers.getContractFactory("TicketPass");
  const ticketPass = await factory.deploy(deployer.address);
  await ticketPass.waitForDeployment();

  const address = await ticketPass.getAddress();
  console.log("TicketPass deployed to:", address);

  const platformTreasury = process.env.PLATFORM_TREASURY;
  if (platformTreasury) {
    const tx = await ticketPass.setPlatformTreasury(platformTreasury);
    await tx.wait();
    console.log("Configured platform treasury:", platformTreasury);
  }

  const avaxUsdPriceFeed = process.env.AVAX_USD_PRICE_FEED;
  if (avaxUsdPriceFeed) {
    const tx = await ticketPass.setAvaxUsdPriceFeed(avaxUsdPriceFeed);
    await tx.wait();
    console.log("Configured AVAX/USD price feed:", avaxUsdPriceFeed);
  }

  const attendanceProof = process.env.ATTENDANCE_PROOF_ADDRESS;
  if (attendanceProof) {
    const tx = await ticketPass.setAttendanceProofAddress(attendanceProof);
    await tx.wait();
    console.log("Configured attendance proof address:", attendanceProof);
  }

  const usdt = process.env.USDT_ADDRESS;
  if (usdt) {
    const tx = await ticketPass.setStableToken(usdt, true);
    await tx.wait();
    console.log("Enabled USDT token:", usdt);
  }

  const usdc = process.env.USDC_ADDRESS;
  if (usdc) {
    const tx = await ticketPass.setStableToken(usdc, true);
    await tx.wait();
    console.log("Enabled USDC token:", usdc);
  }

  const maxPriceAgeSeconds = process.env.MAX_PRICE_AGE_SECONDS;
  if (maxPriceAgeSeconds) {
    const tx = await ticketPass.setMaxPriceAge(BigInt(maxPriceAgeSeconds));
    await tx.wait();
    console.log("Configured max price age:", maxPriceAgeSeconds, "seconds");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
