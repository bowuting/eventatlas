import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TicketPass with account:", deployer.address);

  const factory = await ethers.getContractFactory("TicketPass");
  const ticketPass = await factory.deploy(deployer.address);
  await ticketPass.waitForDeployment();

  const address = await ticketPass.getAddress();
  console.log("TicketPass deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
