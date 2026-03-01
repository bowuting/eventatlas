// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TicketPass is ERC721, Ownable, ReentrancyGuard {
    struct TicketType {
        uint256 price;
        uint256 maxSupply;
        uint256 sold;
        uint64 saleStart;
        uint64 saleEnd;
        bool transferable;
        bool exists;
    }

    struct TicketInfo {
        uint256 eventId;
        uint256 ticketTypeId;
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 eventId => bool exists) public eventExists;
    mapping(uint256 eventId => address organizer) public eventOrganizer;
    mapping(uint256 eventId => mapping(uint256 ticketTypeId => TicketType ticketType)) public ticketTypes;
    mapping(uint256 eventId => mapping(uint256 ticketTypeId => mapping(address user => bool bought))) public hasBought;
    mapping(uint256 tokenId => TicketInfo info) public ticketInfoOf;
    mapping(uint256 eventId => mapping(address user => uint256 balance)) private _eventTicketBalance;

    event EventRegistered(uint256 indexed eventId, address indexed organizer);
    event TicketTypeConfigured(
        uint256 indexed eventId,
        uint256 indexed ticketTypeId,
        uint256 price,
        uint256 maxSupply,
        uint64 saleStart,
        uint64 saleEnd,
        bool transferable
    );
    event TicketMinted(address indexed user, uint256 indexed eventId, uint256 indexed ticketTypeId, uint256 tokenId);

    error EventNotFound(uint256 eventId);
    error UnauthorizedOrganizer(address sender);
    error TicketTypeNotFound(uint256 eventId, uint256 ticketTypeId);
    error SaleNotStarted(uint64 saleStart);
    error SaleEnded(uint64 saleEnd);
    error SoldOut(uint256 maxSupply);
    error InvalidPayment(uint256 expected, uint256 actual);
    error DuplicatePurchase(address user);

    constructor(address initialOwner) ERC721("EventAtlas Ticket Pass", "EATP") {
        _transferOwnership(initialOwner);
    }

    modifier onlyOwnerOrOrganizer(uint256 eventId) {
        if (msg.sender != owner() && msg.sender != eventOrganizer[eventId]) {
            revert UnauthorizedOrganizer(msg.sender);
        }
        _;
    }

    function registerEvent(uint256 eventId, address organizer) external onlyOwner {
        require(organizer != address(0), "organizer is zero");
        require(!eventExists[eventId], "event exists");

        eventExists[eventId] = true;
        eventOrganizer[eventId] = organizer;

        emit EventRegistered(eventId, organizer);
    }

    function configureTicketType(
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 price,
        uint256 maxSupply,
        uint64 saleStart,
        uint64 saleEnd,
        bool transferable
    ) external onlyOwnerOrOrganizer(eventId) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        require(maxSupply > 0, "maxSupply must be > 0");
        require(saleEnd > saleStart, "invalid sale window");

        TicketType storage ticketType = ticketTypes[eventId][ticketTypeId];
        require(ticketType.sold <= maxSupply, "maxSupply < sold");

        ticketType.price = price;
        ticketType.maxSupply = maxSupply;
        ticketType.saleStart = saleStart;
        ticketType.saleEnd = saleEnd;
        ticketType.transferable = transferable;
        ticketType.exists = true;

        emit TicketTypeConfigured(eventId, ticketTypeId, price, maxSupply, saleStart, saleEnd, transferable);
    }

    function buyTicket(uint256 eventId, uint256 ticketTypeId) external payable nonReentrant returns (uint256 tokenId) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);

        TicketType storage ticketType = ticketTypes[eventId][ticketTypeId];
        if (!ticketType.exists) revert TicketTypeNotFound(eventId, ticketTypeId);
        if (block.timestamp < ticketType.saleStart) revert SaleNotStarted(ticketType.saleStart);
        if (block.timestamp > ticketType.saleEnd) revert SaleEnded(ticketType.saleEnd);
        if (ticketType.sold >= ticketType.maxSupply) revert SoldOut(ticketType.maxSupply);
        if (hasBought[eventId][ticketTypeId][msg.sender]) revert DuplicatePurchase(msg.sender);
        if (msg.value != ticketType.price) revert InvalidPayment(ticketType.price, msg.value);

        tokenId = _nextTokenId++;
        ticketType.sold += 1;
        hasBought[eventId][ticketTypeId][msg.sender] = true;
        ticketInfoOf[tokenId] = TicketInfo({ eventId: eventId, ticketTypeId: ticketTypeId });

        _safeMint(msg.sender, tokenId);
        emit TicketMinted(msg.sender, eventId, ticketTypeId, tokenId);
    }

    function withdraw(address payable recipient) external onlyOwner {
        require(recipient != address(0), "recipient is zero");
        recipient.transfer(address(this).balance);
    }

    function eventTicketBalanceOf(uint256 eventId, address user) external view returns (uint256) {
        return _eventTicketBalance[eventId][user];
    }

    function hasValidTicket(uint256 eventId, address user) external view returns (bool) {
        return _eventTicketBalance[eventId][user] > 0;
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        TicketInfo memory info = ticketInfoOf[firstTokenId];

        if (from != address(0) && to != address(0)) {
            TicketType memory ticketType = ticketTypes[info.eventId][info.ticketTypeId];
            require(ticketType.transferable, "ticket is non-transferable");
        }

        if (from != to) {
            if (from != address(0)) {
                _eventTicketBalance[info.eventId][from] -= 1;
            }
            if (to != address(0)) {
                _eventTicketBalance[info.eventId][to] += 1;
            }
        }

        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
