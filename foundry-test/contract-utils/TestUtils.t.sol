pragma solidity 0.8.15;

import "forge-std/Test.sol";
import "../../contracts/LaserWallet.sol";

contract TestUtils is Test {
    LaserWallet singleton;
    address owner;

    address[] recoveryOwners;
    address[] guardians;

    function setUp() public {
        singleton = new LaserWallet();
        owner = vm.addr(1);
        recoveryOwners.push(vm.addr(2));
        recoveryOwners.push(vm.addr(3));
        guardians.push(vm.addr(4));
        guardians.push(vm.addr(5));
    }

    function testShouldSplitSig() public {
        uint256 salt = 1111;

        uint256 maxFeePerGas = 0;
        uint256 maxPriorityFeePerGas = 0;
        uint256 gasLimit = 0;
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, signedHash);

        bytes memory sig = abi.encodePacked(r, s, v);

        (bytes32 _r, bytes32 _s, uint8 _v) = singleton.splitSigs(sig, 0);

        assertEq(r, _r);
        assertEq(s, _s);
        assertEq(v, _v);
    }

    function testShouldReturnOwner() public {
        uint256 salt = 1111;

        uint256 maxFeePerGas = 0;
        uint256 maxPriorityFeePerGas = 0;
        uint256 gasLimit = 0;
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, signedHash);

        address signer = singleton.returnSigner(signedHash, r, s, v, "0x");
        assertEq(signer, owner);
    }

    function testShouldRevert() public {
        uint256 maxFeePerGas = 0;
        uint256 maxPriorityFeePerGas = 0;
        uint256 gasLimit = 0;
        bytes32 signedHash = keccak256(abi.encodePacked(maxFeePerGas, maxPriorityFeePerGas, gasLimit));
        bytes
            memory invaliSig = "0xb552b5ed3495fea1bc0613f107664cde81f4d17f51b8b9afc6bbbad3fb46ef776b650ee4b7fd7a60dd2c2816ddb83b11afbc1cae9e791506e2686de864ad27bb03";

        (bytes32 r, bytes32 s, uint8 v) = singleton.splitSigs(invaliSig, 0);

        vm.expectRevert(abi.encodeWithSignature("Utils__returnSigner__invalidSignature()"));
        singleton.returnSigner(signedHash, r, s, v, invaliSig);
    }
}
