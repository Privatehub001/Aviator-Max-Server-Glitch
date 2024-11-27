const crypto = require('crypto');
const jsSHA = require('jssha');
const database = require('../database')
const path = require('path')
// const apiEndpoint = "https://test.payu.in/_payment";
// const merchantKey = "gtKFFx";
// const salt = "4R38IvwiV57FwVpsgOvTXBdLE4tHUXFW";
const apiEndpoint = "https://secure.payu.in/_payment";
const merchantKey = "2W6t7T";
const salt = "tMxgxMaBKuhiMQaxs4W6XIt2EhxjLoQL";

 const success = async (req, res) => {
      const data = req.body;
      const hashString = `${salt}|${data.status}|||||||||||${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${merchantKey}`;
      const hash = crypto.createHash('sha512').update(hashString).digest('hex');
      if (hash === data.hash) {
          const result = await database.updatebalance(data.firstname, data.txnid, data.amount);
          await database.transferCommission(result.userId,data.amount);
          const transactionData ={ user_id:data.firstname,transaction_Id:data.txnid,deposit: data.amount,withdraw: "-",balance: result.newBalance,ifsc_code:"",account:"",status:"success"};
          await database.storeTransaction(transactionData);
          res.sendFile(path.join(__dirname, 'public', 'success.html'));
      } else {
          // await database.updatebalance(data.firstname, data.txnid, data.amount);
          // res.send('Payment successful and verified');
          res.sendFile(path.join(__dirname, 'public', 'failure.html'));
      }
  };
  
  const failure =  async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'failure.html'));
  };
  
  const create_payment_link = (req, res) => {
      const { userId, amount, email, phone } = req.body;
      const txnId = "TXN" + Date.now();
      const hash = generateHash(txnId, amount, userId, email);
      res.json({
          apiEndpoint,
          key: merchantKey,
          txnid: txnId,
          amount,
          productinfo: 'deposit',
          firstname: userId,
          email,
          phone,
          surl: "https://seal-app-ugskj.ondigitalocean.app/success",
          furl: "https://seal-app-ugskj.ondigitalocean.app/failure",
          hash
      });
  };
  
  function generateHash(txnId, amount, userId, email) {
      const hashString = `${merchantKey}|${txnId}|${amount.toString()}|deposit|${userId}|${email}|||||||||||${salt}`;
      const shaObj = new jsSHA('SHA-512', 'TEXT');
      shaObj.update(hashString);
      return shaObj.getHash('HEX');
  }
  
  module.exports ={success,failure,create_payment_link};