pragma solidity >=0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";


//
// using UniversalERC20 for IERC20;
//
library AbstractERC20 {

    using SafeMath for uint256;

    function abstractReceive(IERC20 token, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            require(from == msg.sender && msg.value == amount, 720);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, address(this));
            token.transferFrom(from, address(this), amount);
            uint256 cmp_amount = abstractBalanceOf(token, address(this)).sub(balance);
            require(cmp_amount != 0, 700);
            return cmp_amount;
        }
    }


    function abstractTransfer(IERC20 token, address to, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            payable(to).transfer(amount);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, this);
            token.transfer(to, amount);
            uint256 cmp_amount = balance.sub(abstractBalanceOf(token, this));
            require(cmp_amount != 0, 700);
            return cmp_amount;
        }
    }

    function abstractBalanceOf(IERC20 token, address who) internal view returns (uint256) {
        if (token == IERC20(0)) {
            return who.balance;
        } else {
            return token.balanceOf(who);
        }
    }
}