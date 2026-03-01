import { config as loadEnv } from "dotenv";
import { ethers } from "hardhat";

loadEnv({ path: "../../.env" });
loadEnv();

async function main() {
  const attendanceProofAddress = process.env.ATTENDANCE_PROOF_ADDRESS;
  if (!attendanceProofAddress) {
    throw new Error("ATTENDANCE_PROOF_ADDRESS is missing in env");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReviewAnchor with account:", deployer.address);
  console.log("Using AttendanceProof:", attendanceProofAddress);

  const factory = await ethers.getContractFactory("ReviewAnchor");
  const reviewAnchor = await factory.deploy(deployer.address, attendanceProofAddress);
  await reviewAnchor.waitForDeployment();

  const address = await reviewAnchor.getAddress();
  console.log("ReviewAnchor deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
