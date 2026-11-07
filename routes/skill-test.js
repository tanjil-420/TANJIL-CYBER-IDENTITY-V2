const express = require("express");
const { pool } = require("../config/database");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const router = express.Router();

const WEB_TASKS = [
  { title: "Build a responsive personal portfolio", brief: "Create a polished one-page portfolio using HTML, CSS and JavaScript. Include a menu for Home, About, Skills, Projects and Contact; a hero with name/title and profile image; skill chips; project cards; and a visible contact action.", deliverable: "A working project URL or repository link, plus a short note explaining your layout and responsive behavior.", criteria: ["Desktop and mobile layouts", "Home/About/Skills/Projects/Contact navigation", "Hero, profile image, skills and project cards", "Consistent typography, spacing and colors", "Working contact action and mobile layout"], demo: "portfolio" },
  { title: "Create a validated contact form", brief: "Build a contact form with name, email, subject and message fields. Add client-side validation, clear error states and a success state without refreshing the page.", deliverable: "A working demo or source repository and a short explanation of the validation rules.", criteria: ["Required-field checks", "Email format validation", "Helpful inline feedback", "Keyboard-friendly labels and focus states"] },
  { title: "Code a mini task manager", brief: "Create a small task manager where users can add, complete, filter and delete tasks. Save tasks in localStorage so they remain after refresh.", deliverable: "A working URL or repository with screenshots and a short note about data storage.", criteria: ["Add and delete tasks", "Complete/uncomplete state", "All / active / completed filters", "Data persists after reload"] },
  { title: "Build a data dashboard", brief: "Create a dashboard that reads structured JSON data and displays useful summary cards and a clear chart or comparison. Handle loading and empty states.", deliverable: "A live demo or repository and the sample JSON/data source used.", criteria: ["At least three summary metrics", "Clear chart or data visualization", "Responsive layout", "Loading or empty-state handling"] },
  { title: "Add a theme and settings system", brief: "Add dark/light mode, a compact settings panel and persistent theme preference to a small website. Keep contrast readable in both themes.", deliverable: "A working link or repository and a short explanation of how the theme preference is saved.", criteria: ["Dark and light themes", "Theme preference persists", "Readable contrast", "No layout break when switching themes"] },
  { title: "Create a multi-page mini website", brief: "Build a small website with at least three connected pages, consistent navigation and one interactive feature. Include a clear mobile menu.", deliverable: "A deployed website or repository, with page names and the interactive feature listed.", criteria: ["At least three pages", "Consistent design system", "Working navigation and mobile menu", "One useful interactive feature"] },
  { title: "Final capstone: launch your own web product", brief: "Combine your best work into a finished mini product: a useful landing page, working core interaction, responsive design and a short README. Treat it as a portfolio-ready project.", deliverable: "A live deployment or repository, README and a 2-5 sentence product walkthrough.", criteria: ["Clear product purpose", "Core feature works", "Responsive and polished UI", "README explains setup and features", "No obvious broken links or console errors"] }
];

const SKILL_TASKS = [
  { title: "Make a skill showcase", brief: "Create a small original sample that demonstrates your selected skill. Choose a clear audience and explain the problem or goal your work addresses.", deliverable: "A project, media or document link plus a short walkthrough.", criteria: ["The chosen skill is clearly demonstrated", "A specific purpose or audience", "Your own work or clearly credited assets", "Clean presentation"] },
  { title: "Recreate a reference", brief: "Choose a suitable reference example in your skill area and create your own interpretation. Do not copy protected work; use it to study structure, technique or style.", deliverable: "Your result, the reference link and three differences in your interpretation.", criteria: ["Reference is identified", "Your own interpretation is clear", "At least three intentional decisions", "Result is presented clearly"] },
  { title: "Improve an existing work", brief: "Choose one older or rough piece of work. Improve at least three things and explain why each change makes the result better.", deliverable: "Before/after evidence and a short change log.", criteria: ["Before/after evidence", "Three meaningful improvements", "Reasoning is explained", "Final result is more usable or polished"] },
  { title: "Solve a practical brief", brief: "Imagine a real client or community member needs something made using your selected skill. Create a small solution that answers their brief.", deliverable: "The finished solution and a short client-style explanation.", criteria: ["Brief is clear", "Solution addresses the need", "Important details are included", "Evidence of the finished work"] },
  { title: "Teach one useful technique", brief: "Create a beginner-friendly guide showing how to do one useful thing in your selected skill. Use steps, examples and simple language.", deliverable: "A short guide, slide deck, screen recording or tutorial link.", criteria: ["Steps are in order", "Example is included", "Explanation is understandable", "Result can be repeated by a beginner"] },
  { title: "Quality check and feedback", brief: "Create a checklist of at least six quality checks for your skill. Apply it to your work and identify what you would improve next.", deliverable: "The checklist and your completed self-review.", criteria: ["Six actionable checks", "Checklist applied to real work", "Weak points identified", "Next improvements listed"] },
  { title: "Final capstone showcase", brief: "Create one polished, portfolio-ready project that combines the strongest parts of your selected skill. Show your process and what you learned.", deliverable: "Final project link or evidence, a short walkthrough and a learning reflection.", criteria: ["Complete final work", "Clear presentation", "Process or evidence included", "Honest learning reflection"] }
];


const EXTRA_TASKS = {
  video: [
    ["Create a 15-second clean edit", "Edit a short vertical video with a clear opening, clean cuts, rhythm and a strong ending.", "A video link and export settings.", ["9:16 framing", "Clean cuts", "Rhythm supports the story", "No accidental black frames"]],
    ["Build a transition sequence", "Create a short sequence using at least three intentional transitions that support the motion or story.", "Final clip and a list of transitions used.", ["Three distinct transitions", "Consistent motion", "No visible glitches", "Timing feels intentional"]],
    ["Practice color correction", "Correct exposure and white balance on two clips, then apply a consistent creative grade.", "Original/graded comparison and settings note.", ["Balanced exposure", "Correct white balance", "Consistent grade", "Details remain visible"]],
    ["Clean and mix audio", "Edit a clip with voice or dialogue. Reduce distracting noise, balance music and voice, and avoid clipping.", "Final clip and a note describing audio processing.", ["Voice is clear", "Music is balanced", "No clipping", "Smooth audio start/end"]],
    ["Create titles and captions", "Build a reusable title style and add synchronized captions to a short video.", "Video link and a still showing title/caption design.", ["Readable typography", "Safe margins", "Consistent animation", "Captions synchronized"]],
    ["Export for two platforms", "Prepare the same edit for vertical and horizontal viewing. Reframe subjects and choose suitable settings.", "Both export links plus resolution/FPS/codec settings.", ["Two aspect ratios", "Subject stays framed", "No stretched footage", "Settings documented"]],
    ["Final capstone: creator showcase", "Produce a polished 30–60 second showcase combining pacing, transitions, color, audio and text.", "Final video, project screenshot and editing breakdown.", ["Strong story structure", "Consistent visual style", "Clean audio/export", "Editing choices explained"]]
  ],
  graphic: [
    ["Design a personal identity card", "Create a digital identity card for a fictional creator or brand with a clear type hierarchy and palette.", "PNG/JPG/PDF preview and color/font choices.", ["Clear hierarchy", "Consistent palette", "Readable typography", "Balanced spacing"]],
    ["Create a social post", "Design a 1080×1080 social post announcing a product, event or channel. Keep the message readable on a phone.", "Exported design and a short audience/message note.", ["Strong focal point", "Mobile readability", "Good contrast", "Correct export size"]],
    ["Build a mini brand kit", "Create a logo direction, colors, heading/body typography and three usage rules for a small brand.", "One-page brand sheet or PDF.", ["Logo concept", "Color palette", "Typography pairing", "Usage rules"]],
    ["Design an event poster", "Make a poster with title, date, venue, call to action and supporting visual elements.", "Poster export and layout explanation.", ["All details included", "Strong hierarchy", "Balanced composition", "Sharp export"]],
    ["Create a carousel set", "Design a four-slide educational carousel teaching one beginner concept.", "Four sequential slides and a caption.", ["Consistent slide system", "One idea per slide", "Readable type", "Clear opening/closing"]],
    ["Redesign a weak interface", "Choose a confusing interface and create a cleaner visual redesign. Explain three improvements.", "Before/after images and three improvement notes.", ["Clearer hierarchy", "Improved spacing", "Accessible contrast", "Improvements explained"]],
    ["Final capstone: campaign kit", "Create a coordinated identity sheet, social post, event poster and carousel for one brand.", "Portfolio board or folder link with all assets.", ["Four coordinated assets", "Consistent branding", "Production-ready exports", "Creative rationale"]]
  ],
  marketing: [
    ["Define your target audience", "Choose a product/page and describe its ideal audience, needs, pain points and useful message.", "One-page audience profile and sample message.", ["Specific audience", "Needs and pain points", "Clear value proposition", "Message matches audience"]],
    ["Build a seven-post content plan", "Plan seven posts with a goal, hook, format, caption idea and call to action for each.", "A content calendar/table with seven posts.", ["Seven distinct ideas", "Clear goals", "Varied formats", "Useful CTAs"]],
    ["Write three campaign creatives", "Write awareness, consideration and conversion ad copies for one offer. Keep claims honest.", "Three headlines, body copies and CTAs.", ["Three funnel stages", "Clear benefits", "Honest claims", "Distinct CTAs"]],
    ["Plan a landing page", "Wireframe a landing page with hero, benefits, proof, FAQ and a single clear action.", "Wireframe/mockup and conversion-path explanation.", ["Single clear goal", "Logical order", "Trust section", "Repeated CTA"]],
    ["Read sample analytics", "Study sample reach, clicks, saves and conversions. Identify what worked and recommend two changes.", "Short report with a table/chart and recommendations.", ["Metrics interpreted", "Evidence-based observations", "Two practical actions", "No unsupported claims"]],
    ["Design a three-day launch", "Plan pre-launch, launch-day and follow-up content with channels, timing and goals.", "Campaign calendar and sample post.", ["Three clear phases", "Schedule included", "Consistent message", "Success metric defined"]],
    ["Final capstone: campaign portfolio", "Present an audience profile, content plan, three ads, landing page wireframe and measurement plan.", "One document or portfolio link with the full campaign.", ["All five components", "Consistent strategy", "Measurable goal", "Clear presentation"]]
  ],
  art: [
    ["Create a shape and value study", "Draw a simple subject using basic shapes and light/mid/dark values.", "Image export and light-source note.", ["Clear silhouette", "Three value groups", "Consistent lighting", "Clean canvas"]],
    ["Practice line and form", "Create line-weight and form studies: boxes, spheres, cylinders and one built object.", "A labeled study sheet.", ["Varied line weight", "Forms read in 3D", "Consistent perspective", "Studies labeled"]],
    ["Design a character concept", "Create a character with silhouette, personality, palette and two expression/pose variations.", "Character sheet and concept description.", ["Recognizable silhouette", "Consistent design", "Color palette", "Two variations"]],
    ["Create a background scene", "Illustrate an environment with foreground, middle ground and background for depth.", "Scene export and depth-layer note.", ["Three depth layers", "Clear focal point", "Coherent lighting", "Balanced composition"]],
    ["Make a polished icon set", "Design six icons for one app/theme using a consistent visual language.", "Six-icon sheet and source file if available.", ["Six related icons", "Consistent style", "Readable small", "Aligned grid"]],
    ["Create a finished illustration", "Take one concept through sketch, clean line, color and final polish.", "Final image and two process stages.", ["Process visible", "Strong focal point", "Consistent palette", "Finished details"]],
    ["Final capstone: art collection", "Create a cohesive three-piece collection with shared theme, palette and artist statement.", "Three final works and artist statement.", ["Three related pieces", "Cohesive language", "Complete finish", "Statement included"]]
  ],
  software: [
    ["Map a repetitive workflow", "Choose a repetitive task and map its inputs, steps, decisions and outputs. Identify safe automation points.", "Flowchart or written workflow and proposal.", ["Inputs/outputs listed", "Steps ordered", "Decision points shown", "Safe boundary identified"]],
    ["Write a small utility script", "Create a script for renaming files, formatting text or validating a list. Include error handling.", "Source code and sample input/output.", ["Useful task", "Readable code", "Invalid input handled", "Example included"]],
    ["Consume a public API", "Build a small program/page that fetches public API data and handles loading and errors.", "Repository/demo and API source link.", ["API request works", "Useful data displayed", "Loading/error states", "No secret keys exposed"]],
    ["Build a data validator", "Create a validator for structured data. Reject invalid entries and explain why.", "Code link with valid and invalid test cases.", ["Rules explicit", "Valid entries accepted", "Invalid entries rejected", "Helpful errors"]],
    ["Automate a file or text task", "Automate a workflow with at least two steps and include a dry-run preview.", "Script/workflow link and demonstration.", ["Two or more steps", "Dry-run mode", "Safe file handling", "Usage instructions"]],
    ["Document a small system", "Document architecture, setup, inputs, outputs, dependencies and common errors.", "README/system note with a simple flow diagram.", ["Setup instructions", "Dependencies listed", "Flow explained", "Troubleshooting"]],
    ["Final capstone: useful automation", "Build a useful automation/tool, test it with three cases and document limitations and safe usage.", "Repository, demo and README.", ["Working tool", "Three test cases", "Error handling", "Limits documented"]]
  ],
  photography: [
    ["Composition practice", "Create three photos using different compositions such as rule of thirds, leading lines and framing.", "Three images and a short note naming each technique.", ["Three compositions", "Clear subject", "Intentional framing", "Sharp focus"]],
    ["Light and exposure study", "Photograph the same subject in three lighting situations and compare exposure and mood.", "Three-photo comparison and settings note.", ["Three lighting conditions", "Exposure controlled", "Highlights/shadows considered", "Comparison explained"]],
    ["Portrait or product session", "Create a small portrait or product set with a clear background and consistent lighting.", "A set of three final images.", ["Subject is clear", "Clean background", "Consistent light", "Details in focus"]],
    ["Edit with consistency", "Edit a set of photos with a consistent color and tone without destroying detail.", "Before/after pair and final set.", ["Consistent tone", "Natural color", "Details retained", "Edits are not excessive"]],
    ["Tell a visual story", "Create a five-image sequence that communicates a simple beginning, middle and end.", "Five images in viewing order and a title.", ["Five connected frames", "Clear story", "Consistent look", "Strong ending"]],
    ["Build a mini photo portfolio", "Select and arrange your strongest work into a small portfolio with captions and categories.", "Portfolio link or PDF.", ["Curated selection", "Useful captions", "Consistent presentation", "Contact/identity info"]],
    ["Final capstone: photo essay", "Create a cohesive photo essay around one theme with an introduction and short reflection.", "Six to eight photos and a written reflection.", ["Cohesive theme", "Strong sequence", "Technical quality", "Reflection included"]]
  ],
  gaming: [
    ["Build a performance setup guide", "Document your game settings, device/performance setup and why each setting suits your play style. Do not use cheats or exploits.", "Screenshots and a short settings guide.", ["Settings documented", "Reasoning included", "Fair-play approach", "Readable screenshots"]],
    ["Create a practice routine", "Design a 30-minute practice routine for one skill such as aim, movement, map awareness or teamwork.", "Routine with time blocks and a progress measure.", ["Clear time blocks", "One focus per drill", "Progress metric", "Repeatable plan"]],
    ["Write a beginner strategy guide", "Teach a beginner one useful game strategy, including when it works and when it does not.", "Guide or short video with examples.", ["Steps are clear", "Examples included", "Limitations explained", "Beginner friendly"]],
    ["Create a highlight edit", "Produce a short highlight clip with clean cuts, readable context and fair representation of the gameplay.", "Video link and editing settings.", ["Clear highlight", "Context preserved", "Clean editing", "No misleading edits"]],
    ["Analyze a match", "Review one match and identify three decisions that helped or hurt performance. Suggest alternatives.", "Match notes or annotated clip.", ["Three decisions identified", "Evidence provided", "Alternatives suggested", "Respectful analysis"]],
    ["Plan a community mini event", "Create a fair mini-tournament or community challenge with rules, schedule and scoring.", "Event poster/rules/schedule.", ["Clear rules", "Fair scoring", "Schedule", "Participation instructions"]],
    ["Final capstone: player showcase", "Present your play style, best fair-play clips, training routine and lessons learned.", "Portfolio/video and short reflection.", ["Skill is demonstrated", "Practice plan shown", "Fair play", "Learning reflection"]]
  ],
  music: [
    ["Plan a short recording", "Plan an original 30–60 second vocal or instrumental recording. Choose a mood, structure and recording setup.", "Recording plan and a short sample.", ["Clear mood", "Simple structure", "Setup documented", "Original or properly licensed material"]],
    ["Record a clean take", "Record a short original performance and focus on distance, levels and a quiet recording environment.", "Raw take and setup notes.", ["No clipping", "Clear signal", "Consistent level", "Setup explained"]],
    ["Clean the audio", "Edit a recording to reduce noise and remove distracting pauses without damaging the performance.", "Before/after audio sample.", ["Noise reduced", "No obvious artifacts", "Performance preserved", "Smooth edits"]],
    ["Balance a simple mix", "Balance voice/instrument, backing track and effects so the main performance remains clear.", "Final mix and a note of track levels/effects.", ["Main part is clear", "Balanced levels", "No clipping", "Effects are controlled"]],
    ["Create cover art", "Design a square cover image for your original audio project with readable title and artist text.", "Cover artwork and color/font choices.", ["Square format", "Readable text", "Visual matches mood", "Sharp export"]],
    ["Prepare a release package", "Prepare title, credits, description and a short promo post for your recording. Credit any licensed material.", "Release info and promo graphic/text.", ["Accurate credits", "Clear description", "Promo CTA", "Rights respected"]],
    ["Final capstone: original showcase", "Present a finished original recording with a clean mix, cover art and short process note.", "Audio link, cover image and production notes.", ["Complete original work", "Clean mix", "Cover artwork", "Process note"]]
  ],

  content: [
    ["Choose a niche and audience", "Choose a content niche and describe the audience, what they need and the unique angle you can bring.", "A one-page niche and audience brief.", ["Specific niche", "Clear audience", "Useful audience need", "Distinct angle"]],
    ["Create three content pillars", "Define three repeatable content pillars and list two post ideas under each pillar.", "A content pillar sheet with six post ideas.", ["Three clear pillars", "Six useful ideas", "Audience relevance", "Consistent direction"]],
    ["Write a short-form script", "Write a 30–60 second script with a strong hook, useful middle and clear ending.", "Script plus intended platform and audience.", ["Strong opening hook", "One clear idea", "Good pacing", "Clear ending"]],
    ["Produce a short piece", "Record or create one short original piece based on your script. Use original or properly licensed assets.", "A video/audio/post link and asset credits.", ["Script followed", "Clear audio/visuals", "Rights respected", "Finished export"]],
    ["Package the content", "Create a title, thumbnail/cover and caption that accurately represent the content.", "Final content with thumbnail/cover and caption.", ["Accurate title", "Readable cover", "Useful caption", "Consistent identity"]],
    ["Plan publishing and measurement", "Make a one-week publishing calendar and choose two meaningful metrics to track.", "Publishing calendar and metric plan.", ["Schedule is realistic", "Platform format considered", "Two useful metrics", "Review date defined"]],
    ["Final capstone: creator portfolio", "Present a mini creator portfolio with your niche, content pillars and at least three finished pieces.", "Portfolio link and a short reflection.", ["Clear creator identity", "Three completed pieces", "Consistent style", "Learning reflection"]]
  ],
  animation3d: [
    ["Model a simple 3D prop", "Create a clean 3D model of a simple everyday object. Focus on proportion and readable silhouette.", "Viewport screenshots and a render.", ["Recognizable silhouette", "Clean geometry", "Useful proportions", "Screenshots included"]],
    ["Add materials and color", "Create a small material palette and apply it consistently to your model.", "Material preview and final model render.", ["Materials distinguish surfaces", "Consistent palette", "No obvious texture errors", "Lighting shows form"]],
    ["Set up a three-point light", "Light your object with key, fill and rim/back light. Compare the result with a basic light setup.", "Two renders and a lighting explanation.", ["Key/fill/rim used", "Clear subject", "No clipped highlights", "Comparison explained"]],
    ["Animate a simple action", "Create a short looping animation such as a turntable, bounce or moving object. Keep the motion readable.", "Short video/GIF preview and settings.", ["Motion is clear", "Timing is consistent", "Loop is clean", "Preview supplied"]],
    ["Compose a small scene", "Create a scene with foreground, subject and background elements. Use camera framing to guide attention.", "Final render and scene screenshot.", ["Clear focal point", "Depth layers", "Camera framing", "Balanced composition"]],
    ["Optimize and document", "Reduce unnecessary geometry or render cost and document the project structure and export settings.", "Optimized project screenshots and notes.", ["Optimization shown", "No visible damage", "Project organized", "Settings documented"]],
    ["Final capstone: 3D showcase", "Create a polished 3D scene or short animation that combines modeling, materials, lighting and composition.", "Final render/animation and process screenshots.", ["Complete scene", "Consistent materials", "Strong lighting", "Process shown"]]
  ],
  uiux: [
    ["Define a user problem", "Choose an app/service and describe one user problem, its audience and the desired outcome.", "Problem statement and user journey.", ["Specific user", "Clear problem", "Desired outcome", "Journey steps"]],
    ["Map the user flow", "Create a flow from entry point to task completion. Include at least one decision or error state.", "User flow diagram.", ["Start/end shown", "Steps in order", "Decision state", "Error/empty state"]],
    ["Create low-fidelity wireframes", "Wireframe three key screens before adding visual styling.", "Three screen wireframes.", ["Three screens", "Clear hierarchy", "Consistent structure", "Core task supported"]],
    ["Build a small design system", "Define colors, typography, spacing and reusable button/input components.", "One-page design system sheet.", ["Color tokens", "Type scale", "Spacing scale", "Reusable components"]],
    ["Design polished screens", "Turn your wireframes into polished screens with accessible contrast and clear feedback states.", "Three high-fidelity screens.", ["Consistent components", "Accessible contrast", "Clear feedback", "Responsive thinking"]],
    ["Run a mini usability test", "Ask two people to try a simple task on your prototype. Record friction and make two improvements.", "Test notes and before/after improvements.", ["Task defined", "Two testers", "Friction recorded", "Two improvements"]],
    ["Final capstone: UX case study", "Present problem, user flow, wireframes, final screens and usability learnings in one case study.", "Portfolio case study link/PDF.", ["Problem explained", "Process included", "Final design shown", "Testing learnings"]]
  ]
};

function tasksForSkill(skill) {
  const value = String(skill || "").toLowerCase();
  let key = "";
  if (/web|front.?end|html|css|javascript|programming/.test(value)) return WEB_TASKS;
  if (/video|editing/.test(value)) key = "video";
  else if (/ui.?ux|user interface/.test(value)) key = "uiux";
  else if (/graphic|design/.test(value)) key = "graphic";
  else if (/marketing/.test(value)) key = "marketing";
  else if (/digital art|illustration|drawing/.test(value)) key = "art";
  else if (/software|automation|coding/.test(value)) key = "software";
  else if (/photo/.test(value)) key = "photography";
  else if (/gaming|game/.test(value)) key = "gaming";
  else if (/music|audio|vocal/.test(value)) key = "music";
  else if (/3d|animation/.test(value)) key = "animation3d";
  else if (/content|creator/.test(value)) key = "content";
  if (!key) return SKILL_TASKS;
  return EXTRA_TASKS[key].map(([title, brief, deliverable, criteria]) => ({ title, brief, deliverable, criteria }));
}

function rankPath() {
  return [
    { title: "BEGINNER", detail: "Starting rank for every member", mode: "automatic" },
    { title: "SKILL EXPLORER", detail: "1 approved event task", mode: "automatic" },
    { title: "SKILL BUILDER", detail: "3 approved event tasks", mode: "automatic" },
    { title: "VERIFIED CREATOR", detail: "All 7 event tasks approved", mode: "automatic" },
    { title: "COMMUNITY MENTOR", detail: "Selected by the Platform Owner", mode: "manual" },
    { title: "MODERATOR", detail: "Trusted community safety role", mode: "manual" },
    { title: "OPERATOR", detail: "Limited operational responsibilities", mode: "manual" },
    { title: "PLATFORM OWNER", detail: "Owner identity only; permissions remain separately controlled", mode: "owner" }
  ];
}

router.use(requireAuth);

router.get("/me", async (req, res, next) => {
  try {
    const profileResult = await pool.query("SELECT skills FROM profiles WHERE user_id = $1", [req.user.id]);
    const skills = Array.isArray(profileResult.rows[0]?.skills) ? profileResult.rows[0].skills : [];
    const enrollmentResult = await pool.query("SELECT * FROM skill_test_enrollments WHERE user_id = $1", [req.user.id]);
    if (!enrollmentResult.rows.length) {
      return res.json({ success: true, enrolled: false, skills, suggestedSkill: skills[0] || "", rankPath: rankPath() });
    }
    const enrollment = enrollmentResult.rows[0];
    await pool.query("UPDATE skill_test_tasks SET status = 'available' WHERE enrollment_id = $1 AND status = 'locked' AND available_at <= NOW()", [enrollment.id]);
    const result = await pool.query(
      `SELECT id, day_number, task_data, status, submission_text, submission_url, reviewer_note, submitted_at, reviewed_at, available_at
       FROM skill_test_tasks WHERE enrollment_id = $1 ORDER BY day_number`, [enrollment.id]
    );
    const tasks = result.rows.map(row => {
      const due = new Date(row.available_at).getTime() <= Date.now();
      return { id: row.id, ...(row.task_data || {}), status: row.status === "locked" && due ? "available" : row.status,
        availableAt: row.available_at, submissionText: row.submission_text || "", submissionUrl: row.submission_url || "",
        reviewerNote: row.reviewer_note || "", submittedAt: row.submitted_at, reviewedAt: row.reviewed_at };
    });
    const approvedCount = tasks.filter(task => task.status === "approved").length;
    const milestone = approvedCount >= 7 ? "VERIFIED CREATOR" : approvedCount >= 3 ? "SKILL BUILDER" : approvedCount >= 1 ? "SKILL EXPLORER" : "BEGINNER";
    res.json({ success: true, enrolled: true, enrollment: { id: enrollment.id, skill: enrollment.skill_name, startedAt: enrollment.started_at,
      completedAt: enrollment.completed_at, status: enrollment.status, rankTitle: enrollment.rank_title || milestone }, tasks, approvedCount, rankPath: rankPath() });
  } catch (error) { next(error); }
});

router.post("/start", async (req, res, next) => {
  const requested = String(req.body.skill || "").trim().slice(0, 60).toLowerCase();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const profile = await client.query("SELECT skills FROM profiles WHERE user_id = $1 FOR UPDATE", [req.user.id]);
    if (!profile.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Create your profile before starting the Skill Test." }); }
    const skills = Array.isArray(profile.rows[0].skills) ? profile.rows[0].skills : [];
    if (!skills.length) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Add at least one skill in Edit Profile before starting." }); }
    const skill = skills.find(item => String(item).toLowerCase() === requested) || skills[0];
    const existing = await client.query("SELECT id FROM skill_test_enrollments WHERE user_id = $1", [req.user.id]);
    if (existing.rows.length) { await client.query("ROLLBACK"); return res.status(409).json({ error: "You have already started your 7-Day Skill Test. Continue your existing event." }); }
    const enrollment = await client.query(
      "INSERT INTO skill_test_enrollments (user_id, skill_name) VALUES ($1, $2) RETURNING id, started_at", [req.user.id, skill]
    );
    const list = tasksForSkill(skill);
    for (let index = 0; index < 7; index++) {
      const task = { day: index + 1, ...list[index] };
      await client.query(
        `INSERT INTO skill_test_tasks (enrollment_id, day_number, task_data, status, available_at)
         VALUES ($1, $2, $3::jsonb, $4, NOW() + ($5 * INTERVAL '1 day'))`,
        [enrollment.rows[0].id, index + 1, JSON.stringify(task), index === 0 ? "available" : "locked", index]
      );
    }
    await client.query("COMMIT");
    res.status(201).json({ success: true, message: "Your 7-Day Skill Test has started.", startedAt: enrollment.rows[0].started_at, skill });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); if (error.code === "23505") return res.status(409).json({ error: "You have already joined this event." }); next(error); }
  finally { client.release(); }
});

router.post("/tasks/:day/submit", async (req, res, next) => {
  const day = Number(req.params.day);
  const submissionText = typeof req.body.submissionText === "string" ? req.body.submissionText.trim().slice(0, 2500) : "";
  let submissionUrl = typeof req.body.submissionUrl === "string" ? req.body.submissionUrl.trim() : "";
  if (!Number.isInteger(day) || day < 1 || day > 7) return res.status(400).json({ error: "Invalid task day." });
  if (submissionUrl) {
    try { const url = new URL(submissionUrl); if (url.protocol !== "https:") throw new Error(); submissionUrl = url.href; }
    catch { return res.status(400).json({ error: "Use a valid HTTPS link for your work." }); }
  }
  if (!submissionText && !submissionUrl) return res.status(400).json({ error: "Add a description or a project link before submitting." });
  try {
    const result = await pool.query(
      `UPDATE skill_test_tasks t SET submission_text = $1, submission_url = NULLIF($2, ''), status = 'submitted',
          submitted_at = NOW(), reviewed_at = NULL, reviewer_note = NULL
       FROM skill_test_enrollments e
       WHERE t.enrollment_id = e.id AND e.user_id = $3 AND t.day_number = $4
         AND e.status = 'active' AND t.available_at <= NOW() AND t.status IN ('available', 'revision')
       RETURNING t.id, t.day_number, t.status, t.submitted_at`, [submissionText, submissionUrl, req.user.id, day]
    );
    if (!result.rows.length) return res.status(409).json({ error: "This task is locked, already submitted, or your event is complete." });
    res.json({ success: true, message: "Task submitted for review.", task: result.rows[0] });
  } catch (error) { next(error); }
});

router.get("/admin/submissions", requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.day_number, t.task_data, t.submission_text, t.submission_url, t.submitted_at,
              e.skill_name, u.username
       FROM skill_test_tasks t JOIN skill_test_enrollments e ON e.id = t.enrollment_id
       JOIN users u ON u.id = e.user_id WHERE t.status = 'submitted' ORDER BY t.submitted_at ASC LIMIT 100`
    );
    res.json({ success: true, submissions: result.rows });
  } catch (error) { next(error); }
});

router.patch("/admin/submissions/:id", requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  const status = req.body.status;
  const note = typeof req.body.reviewerNote === "string" ? req.body.reviewerNote.trim().slice(0, 800) : "";
  if (!Number.isSafeInteger(id) || id <= 0 || !["approved", "revision"].includes(status)) return res.status(400).json({ error: "Invalid review action." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const update = await client.query(
      "UPDATE skill_test_tasks SET status = $1, reviewer_note = $2, reviewed_at = NOW() WHERE id = $3 AND status = 'submitted' RETURNING enrollment_id",
      [status, note, id]
    );
    if (!update.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Submission not found or already reviewed." }); }
    const enrollmentId = update.rows[0].enrollment_id;
    const count = await client.query("SELECT COUNT(*)::int AS approved FROM skill_test_tasks WHERE enrollment_id = $1 AND status = 'approved'", [enrollmentId]);
    const rank = count.rows[0].approved >= 7 ? "VERIFIED CREATOR" : count.rows[0].approved >= 3 ? "SKILL BUILDER" : count.rows[0].approved >= 1 ? "SKILL EXPLORER" : "BEGINNER";
    await client.query(
      `UPDATE profiles SET rank_title = $1, updated_at = NOW()
       WHERE user_id = (SELECT user_id FROM skill_test_enrollments WHERE id = $2)
         AND rank_title IN ('BEGINNER', 'SKILL EXPLORER', 'SKILL BUILDER', 'VERIFIED CREATOR')`,
      [rank, enrollmentId]
    );
    if (count.rows[0].approved >= 1) {
      await client.query(
        `INSERT INTO user_achievements (user_id, achievement_key, title, description)
         SELECT user_id, 'first-project', 'First Project', 'Earned for completing your first reviewed skill task.'
         FROM skill_test_enrollments WHERE id = $1
         ON CONFLICT (user_id, achievement_key) DO NOTHING`,
        [enrollmentId]
      );
    }
    if (count.rows[0].approved === 7) {
      await client.query("UPDATE skill_test_enrollments SET status = 'completed', completed_at = COALESCE(completed_at, NOW()), rank_title = 'SKILL GRADUATE' WHERE id = $1", [enrollmentId]);
      await client.query(
        `INSERT INTO user_achievements (user_id, achievement_key, title, description)
         SELECT user_id, 'skill-graduate', 'Skill Graduate', 'All seven reviewed skill tasks were approved.'
         FROM skill_test_enrollments WHERE id = $1
         ON CONFLICT (user_id, achievement_key) DO NOTHING`,
        [enrollmentId]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true, status, approvedCount: count.rows[0].approved, completed: count.rows[0].approved === 7, rankTitle: rank });
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); next(error); }
  finally { client.release(); }
});

router.get("/rank-path", (req, res) => res.json({ success: true, ranks: rankPath() }));
module.exports = router;
