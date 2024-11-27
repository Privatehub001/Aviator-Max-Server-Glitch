const router = require('express').Router()
const {create_payment_link,success,failure} = require('../apis/depositapi')
const {sendOtp,verifyOtp} = require('../apis/otpFunction');
const {getData,storeData} = require('../apis/userBetsData');
const {getTransactions,storeTransaction,getBalance} = require('../apis/transaction');
const {transfer} = require('../apis/transfer');
const database = require('../database');

router.post('/create-payment-link',create_payment_link)
router.post('/success',success);
router.post('/failure',failure);
router.post('/getotp',sendOtp);
router.post('/verifyotp',verifyOtp);
router.post('/store-user-bet-data',storeData);
router.get('/get-user-bet-data',getData);
router.post('/store-transaction',storeTransaction);
router.get('/get-transaction',getTransactions);
router.get('/get-balance',getBalance);
router.post('/transfer',transfer);
router.post('/get-pending',database.getPendingTransactions);
router.post('/update-Pending',database.updateTransactionWithStatusCheck);
router.get('/get-referral-data',database.getReferralsData);

router.get('/',(req,res)=>{
    res.send('Aviator server!');
})
module.exports = router