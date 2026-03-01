// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IAttendanceProof {
    function hasAttendanceProof(uint256 eventId, address user) external view returns (bool);
}

contract ReviewAnchor is Ownable {
    struct RatingInfo {
        uint8 rating;
        bytes32 reviewHash;
        uint256 submittedAt;
    }

    address public attendanceProof;

    mapping(address minter => bool allowed) public isMinter;
    mapping(uint256 eventId => mapping(address user => bool hasRated)) public hasRated;
    mapping(uint256 eventId => mapping(address user => RatingInfo info)) public ratingInfoOf;
    mapping(uint256 eventId => uint256 totalScore) public eventTotalScore;
    mapping(uint256 eventId => uint256 totalCount) public eventRatingCount;

    event ReviewMinterUpdated(address indexed minter, bool allowed);
    event AttendanceProofUpdated(address indexed attendanceProof);
    event RatingSubmitted(address indexed user, uint256 indexed eventId, uint8 rating, bytes32 reviewHash);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "not minter");
        _;
    }

    constructor(address initialOwner, address attendanceProofAddress) {
        require(attendanceProofAddress != address(0), "attendance proof is zero");
        _transferOwnership(initialOwner);
        attendanceProof = attendanceProofAddress;
        isMinter[initialOwner] = true;

        emit ReviewMinterUpdated(initialOwner, true);
        emit AttendanceProofUpdated(attendanceProofAddress);
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        require(minter != address(0), "minter is zero");
        isMinter[minter] = allowed;
        emit ReviewMinterUpdated(minter, allowed);
    }

    function setAttendanceProof(address attendanceProofAddress) external onlyOwner {
        require(attendanceProofAddress != address(0), "attendance proof is zero");
        attendanceProof = attendanceProofAddress;
        emit AttendanceProofUpdated(attendanceProofAddress);
    }

    function submitRating(uint256 eventId, address user, uint8 rating, bytes32 reviewHash) external onlyMinter {
        require(user != address(0), "user is zero");
        require(rating >= 1 && rating <= 5, "rating out of range");
        require(!hasRated[eventId][user], "rating exists");
        require(IAttendanceProof(attendanceProof).hasAttendanceProof(eventId, user), "no attendance proof");

        hasRated[eventId][user] = true;
        ratingInfoOf[eventId][user] = RatingInfo({
            rating: rating,
            reviewHash: reviewHash,
            submittedAt: block.timestamp
        });
        eventTotalScore[eventId] += rating;
        eventRatingCount[eventId] += 1;

        emit RatingSubmitted(user, eventId, rating, reviewHash);
    }

    function getEventRatingSummary(uint256 eventId) external view returns (uint256 totalScore, uint256 count) {
        return (eventTotalScore[eventId], eventRatingCount[eventId]);
    }
}
