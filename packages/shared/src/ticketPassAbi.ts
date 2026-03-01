export const ticketPassAbi = [
  {
    type: "function",
    name: "registerEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "organizer", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "configureTicketType",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "maxSupply", type: "uint256" },
      { name: "saleStart", type: "uint64" },
      { name: "saleEnd", type: "uint64" },
      { name: "transferable", type: "bool" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "buyTicket",
    stateMutability: "payable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "hasValidTicket",
    stateMutability: "view",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "user", type: "address" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "event",
    name: "TicketMinted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "eventId", type: "uint256" },
      { indexed: true, name: "ticketTypeId", type: "uint256" },
      { indexed: false, name: "tokenId", type: "uint256" }
    ]
  }
] as const;
