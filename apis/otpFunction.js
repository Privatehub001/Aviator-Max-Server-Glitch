const apiKey = 'f49eeef2-55e4-11ef-8b60-0200cd936042';

const sendOtp = async (req, res) => {
    const { phoneNumber } = req.body;
    const apiUrl = `https://2factor.in/API/V1/${apiKey}/SMS/${phoneNumber}/AUTOGEN/OTP1`;
    try {
        const response = await fetch(apiUrl, {
            method: 'GET'
        });
        const data = await response.json();
        if (data.Status === 'Success') {
            res.json({ success: true, data: data });
        }
        else {
            res.json({ success: false, message: 'Failed to send OTP' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
};

const verifyOtp = async (req, res) => {
    const { phone, otp } = req.body;
    const apiUrl = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY3/${phone}/${otp}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'GET'
        });
        const data = await response.json();
        if (data.Status === 'Success') {
            res.json({ success: true, data: data });
        }
        else {
            res.json({ success: false, message: data.Details });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
};

module.exports = { sendOtp, verifyOtp };


