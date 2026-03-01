export const attendanceProofAbi = [
  {
    type: "function",
    name: "mintAttendance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "to", type: "address" }
    ],
    outputs: [{ name: "tokenId", type: "uint256" }]
  },
  {
    type: "function",
    name: "hasAttendanceProof",
    stateMutability: "view",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "user", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "AttendanceMinted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "eventId", type: "uint256" },
      { indexed: false, name: "tokenId", type: "uint256" }
    ]
  }
] as const;
