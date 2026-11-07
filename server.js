app.use(
"/api/notifications",
require("./routes/notifications")
);

app.use(
"/api/activity",
require("./routes/activity")
);

app.use(
"/api/leaderboard",
require("./routes/leaderboard")
);
