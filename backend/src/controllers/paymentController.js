const { sendSuccess } = require("../utils/apiResponse");

function createPaymentController({ paymentService }) {
  return {
    async list(req, res) {
      const payments = await paymentService.listPayments(req.user);
      return sendSuccess(res, { payments });
    },

    async record(req, res) {
      const payment = await paymentService.recordPayment(req.user, req.validated);
      return sendSuccess(res, { payment }, 201);
    },

    async addEvidence(req, res) {
      const payment = await paymentService.addEvidence(req.user, req.validated);
      return sendSuccess(res, { payment }, 201);
    },

    async respond(req, res) {
      const payment = await paymentService.respondToPayment(req.user, req.validated);
      return sendSuccess(res, { payment });
    },

    async dashboardSummary(req, res) {
      const summary = await paymentService.getDashboardSummary(req.user, req.validated);
      return sendSuccess(res, { summary });
    },
  };
}

module.exports = { createPaymentController };
