// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IAttendanceProof {
    function hasAttendanceProof(uint256 eventId, address user) external view returns (bool);
}

contract TicketPass is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PLATFORM_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant REFUND_LOCK_BEFORE_START = 2 hours;

    struct TicketType {
        uint256 priceUsd6;
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
        address buyer;
        address paymentToken; // address(0) => AVAX
        uint256 paymentAmount;
        bool transferred;
        bool refunded;
    }

    uint256 private _nextTokenId = 1;
    uint256 public maxPriceAge = 1 hours;
    address public avaxUsdPriceFeed;
    address public attendanceProofAddress;
    address public platformTreasury;

    mapping(uint256 eventId => bool exists) public eventExists;
    mapping(uint256 eventId => address organizer) public eventOrganizer;
    mapping(uint256 eventId => uint64 startAt) public eventStartAt;
    mapping(uint256 eventId => uint64 endAt) public eventEndAt;
    mapping(uint256 eventId => bool canceled) public eventCanceled;
    mapping(uint256 eventId => bool settled) public eventSettled;
    mapping(address token => bool enabled) public acceptedStableTokens;
    mapping(address token => bool listed) private _stableTokenListed;
    address[] private _stableTokens;

    mapping(uint256 eventId => mapping(uint256 ticketTypeId => TicketType ticketType)) public ticketTypes;
    mapping(uint256 eventId => mapping(uint256 ticketTypeId => mapping(address user => bool bought))) public hasBought;
    mapping(uint256 tokenId => TicketInfo info) public ticketInfoOf;
    mapping(uint256 eventId => mapping(address user => uint256 balance)) private _eventTicketBalance;

    mapping(uint256 eventId => uint256 amount) public eventNativeBalance;
    mapping(uint256 eventId => mapping(address token => uint256 amount)) public eventTokenBalance;

    event EventRegistered(uint256 indexed eventId, address indexed organizer, uint64 startAt, uint64 endAt);
    event EventTimeRangeUpdated(uint256 indexed eventId, uint64 startAt, uint64 endAt);
    event EventCanceled(uint256 indexed eventId, address indexed operator);
    event EventSettled(
        uint256 indexed eventId,
        address indexed organizer,
        uint256 nativeGross,
        uint256 nativePlatformFee,
        uint256 nativeOrganizerAmount
    );
    event EventTokenSettled(
        uint256 indexed eventId,
        address indexed organizer,
        address indexed token,
        uint256 gross,
        uint256 platformFee,
        uint256 organizerAmount
    );
    event TicketTypeConfigured(
        uint256 indexed eventId,
        uint256 indexed ticketTypeId,
        uint256 priceUsd6,
        uint256 maxSupply,
        uint64 saleStart,
        uint64 saleEnd,
        bool transferable
    );
    event TicketMinted(address indexed user, uint256 indexed eventId, uint256 indexed ticketTypeId, uint256 tokenId);
    event TicketPaid(
        address indexed user,
        uint256 indexed eventId,
        uint256 indexed ticketTypeId,
        address paymentToken,
        uint256 paymentAmount
    );
    event TicketRefunded(
        address indexed user,
        uint256 indexed eventId,
        uint256 indexed ticketTypeId,
        uint256 tokenId,
        address paymentToken,
        uint256 paymentAmount
    );
    event AvaxUsdPriceFeedUpdated(address indexed feed);
    event StableTokenUpdated(address indexed token, bool enabled);
    event AttendanceProofUpdated(address indexed attendanceProof);
    event PlatformTreasuryUpdated(address indexed treasury);
    event MaxPriceAgeUpdated(uint256 maxPriceAge);

    error EventNotFound(uint256 eventId);
    error UnauthorizedOrganizer(address sender);
    error InvalidEventTimeRange(uint64 startAt, uint64 endAt);
    error EventAlreadyCanceled(uint256 eventId);
    error EventAlreadySettled(uint256 eventId);
    error EventIsCanceled(uint256 eventId);
    error EventNotEnded(uint256 eventId, uint64 endAt);
    error TicketTypeNotFound(uint256 eventId, uint256 ticketTypeId);
    error SaleNotStarted(uint64 saleStart);
    error SaleEnded(uint64 saleEnd);
    error SoldOut(uint256 maxSupply);
    error InvalidPayment(uint256 expected, uint256 actual);
    error DuplicatePurchase(address user);
    error UnsupportedPaymentToken(address token);
    error PriceFeedNotConfigured();
    error InvalidOraclePrice(int256 price);
    error StaleOraclePrice(uint256 updatedAt, uint256 maxPriceAge);
    error SlippageExceeded(uint256 expected, uint256 maxAllowed);
    error RefundWindowClosed(uint64 cutoffAt);
    error NotTicketOwner(address user, uint256 tokenId);
    error RefundNotAllowedAfterTransfer(uint256 tokenId);
    error AlreadyRefunded(uint256 tokenId);
    error AlreadyCheckedIn(address user, uint256 eventId);
    error EventNotCanceled(uint256 eventId);

    constructor(address initialOwner) ERC721("EventAtlas Ticket Pass", "EATP") {
        require(initialOwner != address(0), "owner is zero");
        _transferOwnership(initialOwner);
        platformTreasury = initialOwner;
    }

    modifier onlyOwnerOrOrganizer(uint256 eventId) {
        if (msg.sender != owner() && msg.sender != eventOrganizer[eventId]) {
            revert UnauthorizedOrganizer(msg.sender);
        }
        _;
    }

    function registerEvent(uint256 eventId, address organizer) external onlyOwner {
        _registerEvent(eventId, organizer, 0, 0);
    }

    function registerEvent(uint256 eventId, address organizer, uint64 startAt, uint64 endAt) external onlyOwner {
        _registerEvent(eventId, organizer, startAt, endAt);
    }

    function setEventTimeRange(uint256 eventId, uint64 startAt, uint64 endAt) external onlyOwnerOrOrganizer(eventId) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        if (endAt <= startAt) revert InvalidEventTimeRange(startAt, endAt);

        eventStartAt[eventId] = startAt;
        eventEndAt[eventId] = endAt;
        emit EventTimeRangeUpdated(eventId, startAt, endAt);
    }

    function cancelEvent(uint256 eventId) external onlyOwnerOrOrganizer(eventId) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        if (eventSettled[eventId]) revert EventAlreadySettled(eventId);
        if (eventCanceled[eventId]) revert EventAlreadyCanceled(eventId);

        eventCanceled[eventId] = true;
        emit EventCanceled(eventId, msg.sender);
    }

    function setAvaxUsdPriceFeed(address feed) external onlyOwner {
        require(feed != address(0), "feed is zero");
        avaxUsdPriceFeed = feed;
        emit AvaxUsdPriceFeedUpdated(feed);
    }

    function setAttendanceProofAddress(address attendanceProof) external onlyOwner {
        attendanceProofAddress = attendanceProof;
        emit AttendanceProofUpdated(attendanceProof);
    }

    function setPlatformTreasury(address treasury) external onlyOwner {
        require(treasury != address(0), "treasury is zero");
        platformTreasury = treasury;
        emit PlatformTreasuryUpdated(treasury);
    }

    function setStableToken(address token, bool enabled) external onlyOwner {
        require(token != address(0), "token is zero");
        acceptedStableTokens[token] = enabled;
        if (enabled && !_stableTokenListed[token]) {
            _stableTokenListed[token] = true;
            _stableTokens.push(token);
        }
        emit StableTokenUpdated(token, enabled);
    }

    function setMaxPriceAge(uint256 nextMaxPriceAge) external onlyOwner {
        require(nextMaxPriceAge > 0, "maxPriceAge must be > 0");
        maxPriceAge = nextMaxPriceAge;
        emit MaxPriceAgeUpdated(nextMaxPriceAge);
    }

    function configureTicketType(
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 priceUsd6,
        uint256 maxSupply,
        uint64 saleStart,
        uint64 saleEnd,
        bool transferable
    ) external onlyOwnerOrOrganizer(eventId) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        require(priceUsd6 > 0, "priceUsd6 must be > 0");
        require(maxSupply > 0, "maxSupply must be > 0");
        require(saleEnd > saleStart, "invalid sale window");

        TicketType storage ticketType = ticketTypes[eventId][ticketTypeId];
        require(ticketType.sold <= maxSupply, "maxSupply < sold");

        ticketType.priceUsd6 = priceUsd6;
        ticketType.maxSupply = maxSupply;
        ticketType.saleStart = saleStart;
        ticketType.saleEnd = saleEnd;
        ticketType.transferable = transferable;
        ticketType.exists = true;

        emit TicketTypeConfigured(eventId, ticketTypeId, priceUsd6, maxSupply, saleStart, saleEnd, transferable);
    }

    function buyTicket(uint256 eventId, uint256 ticketTypeId) external payable nonReentrant returns (uint256 tokenId) {
        return _buyWithNative(eventId, ticketTypeId, msg.value);
    }

    function buyTicketWithNative(
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 maxPaymentWei
    ) external payable nonReentrant returns (uint256 tokenId) {
        return _buyWithNative(eventId, ticketTypeId, maxPaymentWei);
    }

    function buyTicketWithERC20(
        uint256 eventId,
        uint256 ticketTypeId,
        address paymentToken,
        uint256 maxPaymentAmount
    ) external nonReentrant returns (uint256 tokenId) {
        if (!acceptedStableTokens[paymentToken]) revert UnsupportedPaymentToken(paymentToken);

        TicketType storage ticketType = _validatePurchase(eventId, ticketTypeId, msg.sender);
        uint256 expected = ticketType.priceUsd6;
        if (expected > maxPaymentAmount) revert SlippageExceeded(expected, maxPaymentAmount);

        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), expected);
        eventTokenBalance[eventId][paymentToken] += expected;

        tokenId = _mintTicket(eventId, ticketTypeId, msg.sender, paymentToken, expected, ticketType);
        emit TicketPaid(msg.sender, eventId, ticketTypeId, paymentToken, expected);
    }

    function requestRefund(uint256 tokenId) external nonReentrant {
        address holder = ownerOf(tokenId);
        if (holder != msg.sender) revert NotTicketOwner(msg.sender, tokenId);

        TicketInfo storage info = ticketInfoOf[tokenId];
        uint256 eventId = info.eventId;
        if (eventCanceled[eventId]) revert EventIsCanceled(eventId);
        if (eventSettled[eventId]) revert EventAlreadySettled(eventId);
        if (info.transferred) revert RefundNotAllowedAfterTransfer(tokenId);
        if (info.refunded) revert AlreadyRefunded(tokenId);

        uint64 cutoffAt = _refundCutoffAt(eventId);
        if (cutoffAt == 0 || block.timestamp >= cutoffAt) {
            revert RefundWindowClosed(cutoffAt);
        }
        if (_hasAttendanceProof(eventId, holder)) {
            revert AlreadyCheckedIn(holder, eventId);
        }

        _executeRefund(tokenId, holder, info);
    }

    function refundCanceledTicket(uint256 tokenId) external nonReentrant {
        address holder = ownerOf(tokenId);
        TicketInfo storage info = ticketInfoOf[tokenId];
        uint256 eventId = info.eventId;
        if (msg.sender != owner() && msg.sender != eventOrganizer[eventId]) {
            revert UnauthorizedOrganizer(msg.sender);
        }
        if (!eventCanceled[eventId]) revert EventNotCanceled(eventId);
        if (info.refunded) revert AlreadyRefunded(tokenId);

        _executeRefund(tokenId, holder, info);
    }

    function refundCanceledTickets(uint256[] calldata tokenIds) external nonReentrant {
        uint256 len = tokenIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 tokenId = tokenIds[i];
            address holder = ownerOf(tokenId);
            TicketInfo storage info = ticketInfoOf[tokenId];
            uint256 eventId = info.eventId;

            if (msg.sender != owner() && msg.sender != eventOrganizer[eventId]) {
                revert UnauthorizedOrganizer(msg.sender);
            }
            if (!eventCanceled[eventId]) revert EventNotCanceled(eventId);
            if (info.refunded) revert AlreadyRefunded(tokenId);

            _executeRefund(tokenId, holder, info);
        }
    }

    function settleEvent(uint256 eventId) external nonReentrant {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        if (eventCanceled[eventId]) revert EventIsCanceled(eventId);
        if (eventSettled[eventId]) revert EventAlreadySettled(eventId);

        uint64 endAt = eventEndAt[eventId];
        if (endAt == 0 || block.timestamp <= endAt) {
            revert EventNotEnded(eventId, endAt);
        }

        eventSettled[eventId] = true;
        address organizer = eventOrganizer[eventId];

        uint256 nativeGross = eventNativeBalance[eventId];
        uint256 nativePlatformFee = 0;
        uint256 nativeOrganizerAmount = 0;
        if (nativeGross > 0) {
            eventNativeBalance[eventId] = 0;
            nativePlatformFee = (nativeGross * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
            nativeOrganizerAmount = nativeGross - nativePlatformFee;
            if (nativePlatformFee > 0) {
                (bool feeOk, ) = payable(platformTreasury).call{ value: nativePlatformFee }("");
                require(feeOk, "platform native payout failed");
            }
            if (nativeOrganizerAmount > 0) {
                (bool organizerOk, ) = payable(organizer).call{ value: nativeOrganizerAmount }("");
                require(organizerOk, "organizer native payout failed");
            }
        }

        emit EventSettled(eventId, organizer, nativeGross, nativePlatformFee, nativeOrganizerAmount);

        uint256 stableLen = _stableTokens.length;
        for (uint256 i = 0; i < stableLen; i++) {
            address token = _stableTokens[i];
            uint256 gross = eventTokenBalance[eventId][token];
            if (gross == 0) {
                continue;
            }
            eventTokenBalance[eventId][token] = 0;

            uint256 platformFee = (gross * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
            uint256 organizerAmount = gross - platformFee;

            if (platformFee > 0) {
                IERC20(token).safeTransfer(platformTreasury, platformFee);
            }
            if (organizerAmount > 0) {
                IERC20(token).safeTransfer(organizer, organizerAmount);
            }

            emit EventTokenSettled(eventId, organizer, token, gross, platformFee, organizerAmount);
        }
    }

    function getStableTokens() external view returns (address[] memory) {
        return _stableTokens;
    }

    function refundCutoffAt(uint256 eventId) external view returns (uint64) {
        return _refundCutoffAt(eventId);
    }

    function quoteNativePriceWei(uint256 eventId, uint256 ticketTypeId) public view returns (uint256) {
        TicketType storage ticketType = ticketTypes[eventId][ticketTypeId];
        if (!ticketType.exists) revert TicketTypeNotFound(eventId, ticketTypeId);
        if (avaxUsdPriceFeed == address(0)) revert PriceFeedNotConfigured();

        (, int256 answer, , uint256 updatedAt, ) = AggregatorV3Interface(avaxUsdPriceFeed).latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice(answer);
        if (block.timestamp > updatedAt + maxPriceAge) revert StaleOraclePrice(updatedAt, maxPriceAge);

        // usd6 -> wei: usd6 * 1e20 / price(8 decimals)
        uint256 price = uint256(answer);
        return (ticketType.priceUsd6 * 1e20 + price - 1) / price;
    }

    function eventTicketBalanceOf(uint256 eventId, address user) external view returns (uint256) {
        return _eventTicketBalance[eventId][user];
    }

    function hasValidTicket(uint256 eventId, address user) external view returns (bool) {
        return _eventTicketBalance[eventId][user] > 0;
    }

    function _buyWithNative(
        uint256 eventId,
        uint256 ticketTypeId,
        uint256 maxPaymentWei
    ) internal returns (uint256 tokenId) {
        TicketType storage ticketType = _validatePurchase(eventId, ticketTypeId, msg.sender);
        uint256 expected = quoteNativePriceWei(eventId, ticketTypeId);

        if (expected > maxPaymentWei) revert SlippageExceeded(expected, maxPaymentWei);
        if (msg.value < expected) revert InvalidPayment(expected, msg.value);

        eventNativeBalance[eventId] += expected;
        tokenId = _mintTicket(eventId, ticketTypeId, msg.sender, address(0), expected, ticketType);
        emit TicketPaid(msg.sender, eventId, ticketTypeId, address(0), expected);

        uint256 refund = msg.value - expected;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{ value: refund }("");
            require(ok, "refund failed");
        }
    }

    function _validatePurchase(
        uint256 eventId,
        uint256 ticketTypeId,
        address user
    ) internal view returns (TicketType storage ticketType) {
        if (!eventExists[eventId]) revert EventNotFound(eventId);
        if (eventCanceled[eventId]) revert EventIsCanceled(eventId);
        if (eventSettled[eventId]) revert EventAlreadySettled(eventId);

        ticketType = ticketTypes[eventId][ticketTypeId];
        if (!ticketType.exists) revert TicketTypeNotFound(eventId, ticketTypeId);
        if (block.timestamp < ticketType.saleStart) revert SaleNotStarted(ticketType.saleStart);
        if (block.timestamp > ticketType.saleEnd) revert SaleEnded(ticketType.saleEnd);
        if (ticketType.sold >= ticketType.maxSupply) revert SoldOut(ticketType.maxSupply);
        if (hasBought[eventId][ticketTypeId][user]) revert DuplicatePurchase(user);
    }

    function _mintTicket(
        uint256 eventId,
        uint256 ticketTypeId,
        address buyer,
        address paymentToken,
        uint256 paymentAmount,
        TicketType storage ticketType
    ) internal returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        ticketType.sold += 1;
        hasBought[eventId][ticketTypeId][buyer] = true;
        ticketInfoOf[tokenId] = TicketInfo({
            eventId: eventId,
            ticketTypeId: ticketTypeId,
            buyer: buyer,
            paymentToken: paymentToken,
            paymentAmount: paymentAmount,
            transferred: false,
            refunded: false
        });

        _safeMint(buyer, tokenId);
        emit TicketMinted(buyer, eventId, ticketTypeId, tokenId);
    }

    function _executeRefund(uint256 tokenId, address recipient, TicketInfo storage info) internal {
        uint256 eventId = info.eventId;
        uint256 ticketTypeId = info.ticketTypeId;
        uint256 amount = info.paymentAmount;
        address paymentToken = info.paymentToken;

        info.refunded = true;
        hasBought[eventId][ticketTypeId][info.buyer] = false;
        if (ticketTypes[eventId][ticketTypeId].sold > 0) {
            ticketTypes[eventId][ticketTypeId].sold -= 1;
        }

        // Refund must burn ticket first.
        _burn(tokenId);

        if (paymentToken == address(0)) {
            eventNativeBalance[eventId] -= amount;
            (bool ok, ) = payable(recipient).call{ value: amount }("");
            require(ok, "native refund failed");
        } else {
            eventTokenBalance[eventId][paymentToken] -= amount;
            IERC20(paymentToken).safeTransfer(recipient, amount);
        }

        emit TicketRefunded(recipient, eventId, ticketTypeId, tokenId, paymentToken, amount);
    }

    function _registerEvent(uint256 eventId, address organizer, uint64 startAt, uint64 endAt) internal {
        require(organizer != address(0), "organizer is zero");
        require(!eventExists[eventId], "event exists");
        if (startAt != 0 || endAt != 0) {
            if (endAt <= startAt) revert InvalidEventTimeRange(startAt, endAt);
        }

        eventExists[eventId] = true;
        eventOrganizer[eventId] = organizer;
        eventStartAt[eventId] = startAt;
        eventEndAt[eventId] = endAt;

        emit EventRegistered(eventId, organizer, startAt, endAt);
    }

    function _refundCutoffAt(uint256 eventId) internal view returns (uint64) {
        uint64 startAt = eventStartAt[eventId];
        if (startAt <= REFUND_LOCK_BEFORE_START) {
            return 0;
        }
        return startAt - uint64(REFUND_LOCK_BEFORE_START);
    }

    function _hasAttendanceProof(uint256 eventId, address user) internal view returns (bool) {
        if (attendanceProofAddress == address(0)) {
            return false;
        }
        return IAttendanceProof(attendanceProofAddress).hasAttendanceProof(eventId, user);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        TicketInfo storage info = ticketInfoOf[firstTokenId];

        if (from != address(0) && to != address(0)) {
            TicketType memory ticketType = ticketTypes[info.eventId][info.ticketTypeId];
            require(ticketType.transferable, "ticket is non-transferable");
            info.transferred = true;
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
