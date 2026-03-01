export const reviewAnchorAbi = [
  {
    type: "function",
    name: "submitRating",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "user", type: "address" },
      { name: "rating", type: "uint8" },
      { name: "reviewHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "hasRated",
    stateMutability: "view",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "user", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "RatingSubmitted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "eventId", type: "uint256" },
      { indexed: false, name: "rating", type: "uint8" },
      { indexed: false, name: "reviewHash", type: "bytes32" }
    ]
  }
] as const;
