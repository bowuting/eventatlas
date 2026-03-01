import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AttendanceProof with account:", deployer.address);

  const factory = await ethers.getContractFactory("AttendanceProof");
  const attendanceProof = await factory.deploy(deployer.address);
  await attendanceProof.waitForDeployment();

  const address = await attendanceProof.getAddress();
  console.log("AttendanceProof deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
