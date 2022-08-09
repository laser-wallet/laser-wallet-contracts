// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

import "../interfaces/IERC165.sol";
import "../interfaces/ILaserFactory.sol";
import "../interfaces/ILaserWallet.sol";

/**
 * @title LaserFactory
 *
 * @notice Factory that creates new Laser proxies, and has helper methods.
 */
contract LaserFactory is ILaserFactory {
    address public immutable singleton;

    address public immutable laserRegistry;

    address public immutable laserMasterGuard;

    /// @param _singleton Master copy of the proxy.
    constructor(
        address _singleton,
        address _laserRegistry,
        address _laserMasterGuard
    ) {
        // Laser Wallet contract: bytes4(keccak256("I_AM_LASER"))
        if (!IERC165(_singleton).supportsInterface(0xae029e0b)) revert LaserFactory__constructor__invalidSingleton();
        singleton = _singleton;
        laserRegistry = _laserRegistry;
        laserMasterGuard = _laserMasterGuard;
    }

    function deployProxyAndRefund(
        address owner,
        uint256 maxFeePerGas,
        uint256 maxPriorityFeePerGas,
        uint256 gasLimit,
        address relayer,
        address smartSocialRecoveryModule,
        address laserVault,
        bytes memory smartSocialRecoveryInitData,
        uint256 saltNumber,
        bytes memory ownerSignature
    ) external returns (LaserProxy proxy) {
        {
            bytes32 salt = getSalt(owner, smartSocialRecoveryModule, smartSocialRecoveryInitData, saltNumber);
            proxy = createProxyWithCreate2(salt);

            ILaserWallet(address(proxy)).init(
                owner,
                maxFeePerGas,
                maxPriorityFeePerGas,
                gasLimit,
                relayer,
                smartSocialRecoveryModule,
                laserMasterGuard,
                laserVault,
                laserRegistry,
                smartSocialRecoveryInitData,
                ownerSignature
            );

            emit ProxyCreation(address(proxy));
        }
    }

    ///@dev Precomputes the address of a proxy that is created through 'create2'.
    function preComputeAddress(
        address owner,
        address laserModule,
        bytes calldata laserModuleData,
        uint256 saltNumber
    ) external view returns (address) {
        bytes memory creationCode = proxyCreationCode();
        bytes memory data = abi.encodePacked(creationCode, uint256(uint160(singleton)));

        bytes32 salt = getSalt(owner, laserModule, laserModuleData, saltNumber);
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(data)));

        return address(uint160(uint256(hash)));
    }

    ///@dev Allows to retrieve the runtime code of a deployed Proxy. This can be used to check that the expected Proxy was deployed.
    function proxyRuntimeCode() external pure returns (bytes memory) {
        return type(LaserProxy).runtimeCode;
    }

    ///@dev Allows to retrieve the creation code used for the Proxy deployment. With this it is easily possible to calculate predicted address.
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(LaserProxy).creationCode;
    }

    ///@dev Allows to create new proxy contact using CREATE2 but it doesn't run the initializer.
    ///This method is only meant as an utility to be called from other methods.
    function createProxyWithCreate2(bytes32 salt) internal returns (LaserProxy proxy) {
        bytes memory deploymentData = abi.encodePacked(type(LaserProxy).creationCode, uint256(uint160(singleton)));
        assembly {
            proxy := create2(0x0, add(0x20, deploymentData), mload(deploymentData), salt)
        }
        //@todo change the custom error name.
        if (address(proxy) == address(0)) revert LaserFactory__create2Failed();
    }

    /**
     * @dev Generates the salt for deployment.
     */
    function getSalt(
        address owner,
        address laserModule,
        bytes memory laserModuleData,
        uint256 saltNumber
    ) internal pure returns (bytes32 salt) {
        salt = keccak256(abi.encodePacked(owner, laserModule, laserModuleData, saltNumber));
    }
}
