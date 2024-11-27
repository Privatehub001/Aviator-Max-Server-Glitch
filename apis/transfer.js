const axios = require('axios');
const qs = require('qs');
const database = require('../database')

const transfer = async (req, res) => {
  try {
    const { acc_no, ifsc_code, name, email, phone, amount, userId } = req.body;
    if (!acc_no || !ifsc_code || !name || !email || !phone || !amount || !userId) {
      return res.json({ success: false, message: 'Missing required fields' });
    }
    if(amount<1500){
      return res.json({ success: false, message: 'Minimun withdrawal amount is 1500.' });
    }
    const result = await database.getUser(userId);
    if (result.user && result.user.balance >= amount) {
      await database.withdrawBalanceSub(userId, parseFloat(amount));
      const rsp = await database.holdBalanceAdd(userId, amount);
      const transactionData = { user_id: userId, transaction_Id: "TX" + Date.now(), deposit: "-", withdraw: amount,
      balance: rsp.newBalance,ifsc_code:ifsc_code,account:acc_no,status:'pending'};
      await database.storeTransaction(transactionData);
      res.json({ success: true, message: 'Payout initiated successfully' });
    }
    else {
      res.json({ success: false, message: 'Insufficient Balance', data: "error" });
    }
  } catch (error) {
    console.log(`Error in transfer: ${error.message}`);
    res.json({ message: `Error in transfer: ${error.message}` });
  }
};




module.exports = {
  transfer,
};