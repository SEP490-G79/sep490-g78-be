const PayOS = require("@payos/node");
const jwt = require("jsonwebtoken");
const donationService = require("./donation.service");

const payOS = new PayOS(
  process.env.PAYOS_CLIENT_ID,
  process.env.PAYOS_API_KEY,
  process.env.PAYOS_CHECKSUM_KEY
);

const orderUserMap = new Map();

const createPaymentLink = async (req) => {
  const { amount, message } = req.body;
  const authHeader = req.headers.authorization;
  const orderCode = Math.floor(Math.random() * 1000000000);
  let userId = null;

  if (authHeader?.startsWith("Bearer ")) {
    const accessToken = authHeader.split(" ")[1];
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    userId = decoded.id;
    orderUserMap.set(orderCode.toString(), userId);
  }

  const returnUrl = `${process.env.CLIENT_URL}/donation/success`;
  const cancelUrl = `${process.env.CLIENT_URL}/donation/cancel`;

  const paymentLink = await payOS.createPaymentLink({
    orderCode,
    amount,
    description: message || "Ủng hộ trang web",
    returnUrl,
    cancelUrl,
  });

  return paymentLink.checkoutUrl;
};

const handleWebhook = async (req) => {
  const { data } = req.body;
  if (!data || !data.amount) throw new Error("Invalid webhook data");

  const userId = orderUserMap.get(data.orderCode.toString()) || null;

  await donationService.saveDonation({
    donor: userId,
    amount: data.amount,
    message: data.description || "",
  });

  return true;
};

const payosService = {
  createPaymentLink,
  handleWebhook,
};

module.exports = payosService;
