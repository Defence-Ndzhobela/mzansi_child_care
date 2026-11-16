const { sendSuccess } = require("../utils/apiResponse");
const { parsePaging } = require("../utils/pagination");

// HTTP only: each handler reads the validated request and calls a service. Every route is mounted behind
// authentication and the ADMIN role check (see adminRoutes.js), and `req.user` comes from the database.
function createAdminController({ socialWorkerService, assignmentService, directoryService }) {
  return {
    me: (req, res) => sendSuccess(res, { user: req.user }),

    async dashboardStats(_req, res) {
      return sendSuccess(res, { stats: await directoryService.stats() });
    },

    async listSocialWorkers(req, res) {
      return sendSuccess(res, await socialWorkerService.list({ ...parsePaging(req.query), status: req.validated.status }));
    },
    async getSocialWorker(req, res) {
      return sendSuccess(res, { socialWorker: await socialWorkerService.get(req.validated.id) });
    },
    async createSocialWorker(req, res) {
      return sendSuccess(res, { socialWorker: await socialWorkerService.create(req.validated) }, 201);
    },
    async updateSocialWorker(req, res) {
      return sendSuccess(res, { socialWorker: await socialWorkerService.update(req.validated) });
    },
    async deleteSocialWorker(req, res) {
      return sendSuccess(res, await socialWorkerService.remove(req.validated.id));
    },

    async listAssignments(req, res) {
      const { status, socialWorkerId, childId } = req.validated;
      return sendSuccess(res, await assignmentService.list({ ...parsePaging(req.query), status, socialWorkerId, childId }));
    },
    async createAssignment(req, res) {
      return sendSuccess(res, { assignment: await assignmentService.create(req.user, req.validated) }, 201);
    },
    async reassignAssignment(req, res) {
      return sendSuccess(res, { assignment: await assignmentService.reassign(req.user, req.validated) });
    },
    async endAssignment(req, res) {
      return sendSuccess(res, { assignment: await assignmentService.end(req.user, req.validated) });
    },

    async listChildSupporters(req, res) {
      return sendSuccess(res, await directoryService.listChildSupporters(parsePaging(req.query)));
    },
    async getChildSupporter(req, res) {
      return sendSuccess(res, { childSupporter: await directoryService.getChildSupporter(req.validated.id) });
    },

    async listChildren(req, res) {
      return sendSuccess(res, await directoryService.listChildren(parsePaging(req.query)));
    },
    async getChild(req, res) {
      return sendSuccess(res, { child: await directoryService.getChild(req.validated.id) });
    },

    async listArrangements(req, res) {
      return sendSuccess(res, await directoryService.listArrangements({ ...parsePaging(req.query), status: req.validated.status }));
    },
    async getArrangement(req, res) {
      return sendSuccess(res, { arrangement: await directoryService.getArrangement(req.validated.id) });
    },

    async reports(_req, res) {
      return sendSuccess(res, { report: await directoryService.reports() });
    },
  };
}

module.exports = { createAdminController };
