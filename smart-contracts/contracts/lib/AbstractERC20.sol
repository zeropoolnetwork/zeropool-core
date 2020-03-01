pragma solidity >=0.6.0;

import "./IERC20.sol";

library AbstractERC20 {

    function abstractReceive(IERC20 token, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            require(msg.value == amount);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, address(this));
            token.transferFrom(msg.sender, address(this), amount);
            uint256 cmp_amount = abstractBalanceOf(token, address(this)) - balance;
            require(cmp_amount != 0);
            return cmp_amount;
        }
    }

    function abstractTransfer(IERC20 token, address to, uint256 amount) internal returns(uint256) {
        if (token == IERC20(0)) {
            payable(to).transfer(amount);
            return amount;
        } else {
            uint256 balance = abstractBalanceOf(token, address(this));
            token.transfer(to, amount);
            uint256 cmp_amount = balance - abstractBalanceOf(token, address(this));
            require(cmp_amount != 0);
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