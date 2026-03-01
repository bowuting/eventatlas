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
    name: "setEventTimeRange",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "startAt", type: "uint64" },
      { name: "endAt", type: "uint64" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "eventCanceled",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "eventSettled",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "configureTicketType",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "priceUsd6", type: "uint256" },
      { name: "maxSupply", type: "uint256" },
      { name: "saleStart", type: "uint64" },
      { name: "saleEnd", type: "uint64" },
      { name: "transferable", type: "bool" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "buyTicketWithNative",
    stateMutability: "payable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "maxPaymentWei", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "buyTicketWithERC20",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "ticketTypeId", type: "uint256" },
      { name: "paymentToken", type: "address" },
      { name: "maxPaymentAmount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "requestRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "cancelEvent",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "refundCanceledTicket",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "settleEvent",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "quoteNativePriceWei",
    stateMutability: "view",
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
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
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
  },
  {
    type: "event",
    name: "TicketPaid",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "eventId", type: "uint256" },
      { indexed: true, name: "ticketTypeId", type: "uint256" },
      { indexed: false, name: "paymentToken", type: "address" },
      { indexed: false, name: "paymentAmount", type: "uint256" }
    ]
  },
  {
    type: "event",
    name: "TicketRefunded",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "eventId", type: "uint256" },
      { indexed: true, name: "ticketTypeId", type: "uint256" },
      { indexed: false, name: "tokenId", type: "uint256" },
      { indexed: false, name: "paymentToken", type: "address" },
      { indexed: false, name: "paymentAmount", type: "uint256" }
    ]
  }
] as const;
