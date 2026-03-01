// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract AttendanceProof is ERC721, Ownable {
    struct AttendanceInfo {
        uint256 eventId;
        uint256 checkedInAt;
    }

    uint256 private _nextTokenId = 1;

    mapping(address minter => bool allowed) public isMinter;
    mapping(uint256 eventId => mapping(address user => bool hasProof)) public hasAttendance;
    mapping(uint256 tokenId => AttendanceInfo info) public attendanceInfoOf;

    event AttendanceMinterUpdated(address indexed minter, bool allowed);
    event AttendanceMinted(address indexed user, uint256 indexed eventId, uint256 tokenId);

    modifier onlyMinter() {
        require(isMinter[msg.sender], "not minter");
        _;
    }

    constructor(address initialOwner) ERC721("EventAtlas Attendance Proof", "EAAP") {
        _transferOwnership(initialOwner);
        isMinter[initialOwner] = true;
        emit AttendanceMinterUpdated(initialOwner, true);
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        require(minter != address(0), "minter is zero");
        isMinter[minter] = allowed;
        emit AttendanceMinterUpdated(minter, allowed);
    }

    function mintAttendance(uint256 eventId, address to) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0), "recipient is zero");
        require(!hasAttendance[eventId][to], "attendance exists");

        tokenId = _nextTokenId++;
        hasAttendance[eventId][to] = true;
        attendanceInfoOf[tokenId] = AttendanceInfo({ eventId: eventId, checkedInAt: block.timestamp });

        _safeMint(to, tokenId);
        emit AttendanceMinted(to, eventId, tokenId);
    }

    function hasAttendanceProof(uint256 eventId, address user) external view returns (bool) {
        return hasAttendance[eventId][user];
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override {
        // Attendance proof is non-transferable once minted.
        if (from != address(0) && to != address(0)) {
            revert("attendance proof is non-transferable");
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
