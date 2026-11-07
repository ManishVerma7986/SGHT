
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract SHGTToken is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public constant MAX_SUPPLY = 50_000_000 * 10 ** 18;

    constructor(address admin, address minter)
        ERC20("SHGT Token", "SHGT")
    {
        require(admin != address(0), "Invalid admin address");
        require(minter != address(0), "Invalid minter address");
        require(admin != minter, "Admin and minter must differ");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
    {
        require(
            amount <= MAX_SUPPLY - totalSupply(),
            "SHGT: Maximum supply exceeded"
            );

        _mint(to, amount);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}
