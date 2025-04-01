// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FractionalNFT is ERC721URIStorage {
    uint256 public tokenId;
    address public fractionalToken;

    enum RiskTier { Low, Medium, High } // Maps to 0,1,2 internally

    struct LoanMetadata {
        uint256 loan_number;
        RiskTier risk_tier;
        uint256 principal;
        uint256 interest;
        string term;
        string school;
    }

    mapping(uint256 => LoanMetadata) public metadata;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function mintAndFractionalize(
        address to,
        string memory uri,
        uint256 totalFractions,
        uint256 loan_number,
        uint8 risk_tier, // Must be 0, 1, or 2
        uint256 principal,
        uint256 interest,
        string memory term,
        string memory school
    ) public {
        require(risk_tier <= uint8(RiskTier.High), "Invalid risk tier");

        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);

        metadata[tokenId] = LoanMetadata({
            loan_number: loan_number,
            risk_tier: RiskTier(risk_tier),
            principal: principal,
            interest: interest,
            term: term,
            school: school
        });

        FractionalToken ft = new FractionalToken("FractionToken", "FRACT", totalFractions, to);
        fractionalToken = address(ft);

        tokenId++;
    }

    function getMetadata(uint256 id) external view returns (
        uint256 loan_number,
        RiskTier risk_tier,
        uint256 principal,
        uint256 interest,
        string memory term,
        string memory school
    ) {
        LoanMetadata memory data = metadata[id];
        return (
            data.loan_number,
            data.risk_tier,
            data.principal,
            data.interest,
            data.term,
            data.school
        );
    }
}

contract FractionalToken is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address owner
    ) ERC20(name, symbol) {
        _mint(owner, totalSupply);
    }
}
