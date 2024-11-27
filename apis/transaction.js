const database = require('../database');
const storeTransaction = async (req, res) => {
  const transactionData = req.body;

  const result = await database.storeTransaction(transactionData);
  if (result.success) {
    res.status(201).json(result);
  } else {
    res.status(500).json(result);
  }
};

const getTransactions =  async (req, res) => {
  const { userId } = req.query;

  const result = await database.getTransactions(userId.slice(0,20));
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
};

const getBalance =  async (req, res) => {
  const { userId } = req.query;

  const result = await database.getUser(userId);
  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(500).json(result);
  }
};
module.exports={getTransactions,storeTransaction,getBalance};

