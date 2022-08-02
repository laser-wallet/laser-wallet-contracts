// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.15;

contract LaserRegistry {
    address private constant pointer = address(0x1);

    address public laser;

    uint256 moduleCount;

    mapping(address => address) private approvedModules;

    mapping(address => address) private approvedSingletons;

    modifier onlyLaser() {
        require(msg.sender == laser, "Only Laser");

        _;
    }

    constructor(address _laser) {
        laser = _laser;
    }

    function approveSingleton(address singleton) external onlyLaser {
        approvedSingletons[singleton] = approvedSingletons[pointer];
        approvedSingletons[singleton] = singleton;
    }

    function approveModule(address module) external onlyLaser {
        approvedModules[module] = approvedModules[pointer];
        approvedModules[pointer] = module;

        unchecked {
            ++moduleCount;
        }
    }

    function removeModule(address prevModule, address module) external onlyLaser {
        require(approvedModules[module] != address(0), "Module not found");
        require(module != pointer, "incorrect");

        require(approvedModules[prevModule] == module, "incorrect prev module");

        approvedModules[prevModule] = approvedModules[module];
        approvedModules[module] = address(0);

        unchecked {
            --moduleCount;
        }
    }

    function isSingleton(address singleton) external view returns (bool) {
        return approvedSingletons[singleton] != address(0) && singleton != pointer;
    }

    function isModule(address module) external view returns (bool) {
        return approvedModules[module] != address(0) && module != pointer;
    }

    function getModules() public view returns (address[] memory) {
        address[] memory modulesArray = new address[](moduleCount);
        address currentModule = approvedModules[pointer];

        uint256 index;
        while (currentModule != pointer) {
            modulesArray[index] = currentModule;
            currentModule = approvedModules[currentModule];
            unchecked {
                ++index;
            }
        }
        return modulesArray;
    }
}
