import { Router } from "express";
import { register, login, becomeCreator } from "../controllers/auth.controller.js";
import { getChannels, getHistory, getPortfolio, getWatchlist, toggleWatchlist, search, getLeaderboards, getNotifications } from "../controllers/market.controller.js";
import { ipo, getCreatorChannel } from "../controllers/ipo.controller.js";
import { trade } from "../controllers/trade.controller.js";

const router = Router();

// Auth
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/become-creator", becomeCreator);

// Market
router.get("/market/channels", getChannels);
router.get("/market/leaderboards", getLeaderboards);
router.get("/market/search", search);
router.get("/market/history/:channelId", getHistory);
router.get("/market/portfolio", getPortfolio);
router.get("/market/watchlist", getWatchlist);
router.post("/market/watchlist/toggle", toggleWatchlist);

// Creator & Actions
router.post("/ipo", ipo);
router.get("/creator/my-channel", getCreatorChannel);
router.post("/trade", trade);
router.get("/notifications", getNotifications);


// Admin
import { adminOnly } from "../middleware/auth.js";
import { approveChannel, togglePauseChannel, deleteChannel, getUsers, getTrades, getPendingChannels } from "../controllers/admin.controller.js";

router.get("/admin/channels/pending", adminOnly, getPendingChannels);
router.post("/admin/channels/:id/approve", adminOnly, approveChannel);
router.post("/admin/channels/:id/pause", adminOnly, togglePauseChannel);
router.delete("/admin/channels/:id", adminOnly, deleteChannel);
router.get("/admin/users", adminOnly, getUsers);
router.get("/admin/trades", adminOnly, getTrades);

export default router;
