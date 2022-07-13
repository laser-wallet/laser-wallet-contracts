pragma solidity 0.8.15;

import "forge-std/Test.sol";
import "../../contracts/LaserWallet.sol";

contract TestSingleton is Test {
    LaserWallet singleton;

    function setUp() public {
        singleton = new LaserWallet();
    }

    function testCannotInit() public {
        address[] memory guardians = new address[](1);
        guardians[0] = msg.sender;

        vm.expectRevert(abi.encodeWithSignature("Owner__initOwner__walletInitialized()"));
        singleton.init(address(0), guardians, guardians, 0, 0, 0, address(0), "0x");
    }

    function testCorrectSingletonOwnerAddress() public {
        address owner = singleton.owner();
        assertEq(owner, address(singleton));
    }

    function testCorrectVersion() public {
        string memory version = singleton.VERSION();
        assertEq(version, "1.0.0");
    }

    function testCorrectNonce() public {
        uint256 nonce = singleton.nonce();
        assertEq(nonce, 0);
    }
}
