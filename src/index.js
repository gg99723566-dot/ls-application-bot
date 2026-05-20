require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits
} = require("discord.js");

const PORT = Number(process.env.PORT || 3000);
const WEBSITE_ORIGIN = process.env.WEBSITE_ORIGIN || "https://lossantosmognolia.web.app";
const APPLICATION_CHANNEL_ID = process.env.APPLICATION_CHANNEL_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";
const ACCEPTED_ROLE_ID = process.env.ACCEPTED_ROLE_ID || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");

const roleConfig = {
  admin: splitIds(process.env.ADMIN_ROLE_IDS),
  adminUsers: splitIds(process.env.ADMIN_USER_IDS),
  staff: splitIds(process.env.STAFF_ROLE_IDS || STAFF_ROLE_ID),
  policeChief: splitIds(process.env.POLICE_CHIEF_ROLE_IDS),
  medicChief: splitIds(process.env.MEDIC_CHIEF_ROLE_IDS),
  police: splitIds(process.env.POLICE_ROLE_IDS),
  medic: splitIds(process.env.MEDIC_ROLE_IDS)
};

const app = express();
app.use(cors({ origin: [WEBSITE_ORIGIN, "http://localhost:5000", "http://127.0.0.1:5000"] }));
app.use(express.json({ limit: "1mb" }));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const statusLabels = {
  accept: "Accepted",
  deny: "Denied",
  accept_reason: "Accepted with reason",
  deny_reason: "Denied with reason"
};

function splitIds(value){
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function short(value, max = 1024){
  const text = String(value || "Бөглөөгүй");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function hasAnyRole(memberRoles, expectedRoles){
  return expectedRoles.some(roleId => memberRoles.includes(roleId));
}

function accessForMember(member, user){
  const roles = member ? [...member.roles.cache.keys()] : [];
  const isOwner = member && member.guild.ownerId === user.id;
  const isAdminUser = roleConfig.adminUsers.includes(user.id);
  const isAdmin = isOwner ||
    isAdminUser ||
    Boolean(member && member.permissions.has(PermissionFlagsBits.Administrator)) ||
    hasAnyRole(roles, roleConfig.admin);
  const isStaff = isAdmin || hasAnyRole(roles, roleConfig.staff);
  const isPoliceChief = isAdmin || hasAnyRole(roles, roleConfig.policeChief);
  const isMedicChief = isAdmin || hasAnyRole(roles, roleConfig.medicChief);
  const isPolice = isPoliceChief || hasAnyRole(roles, roleConfig.police);
  const isMedic = isMedicChief || hasAnyRole(roles, roleConfig.medic);

  return {
    roles,
    groups:{
      admin:isAdmin,
      staff:isStaff,
      policeChief:isPoliceChief,
      medicChief:isMedicChief,
      police:isPolice,
      medic:isMedic,
      member:Boolean(member)
    },
    permissions:{
      viewAdmin:isAdmin,
      viewStaff:isAdmin || isStaff,
      viewPolice:isAdmin || isPoliceChief || isPolice,
      managePolice:isAdmin || isPoliceChief,
      viewMedic:isAdmin || isMedicChief || isMedic,
      manageMedic:isAdmin || isMedicChief,
      viewApplications:isAdmin || isStaff || isPoliceChief || isMedicChief,
      viewRosters:isAdmin || isPoliceChief || isMedicChief || isPolice || isMedic,
      viewPublic:true
    }
  };
}

async function userFromBearer(request){
  const header = request.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if(!token) return null;

  const response = await fetch("https://discord.com/api/users/@me", {
    headers:{ Authorization:`Bearer ${token}` }
  });
  if(!response.ok) return null;
  return response.json();
}

function normalizeApplication(body){
  const questions = Array.isArray(body.questions) ? body.questions : [];
  return {
    id: body.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    roleKey: body.roleKey || "default",
    category: body.category || "Цагдаагийн хэлтэс",
    position: body.position || "",
    applicant: {
      discordId: body.discordId || "",
      discord: body.discord || "",
      name: body.name || "",
      phone: body.phone || "",
      email: body.email || "",
      gameName: body.idName || "",
      availability: body.availability || ""
    },
    questions
  };
}

function applicationEmbed(application, status){
  const color = status === "Accepted"
    ? 0x22c55e
    : status === "Denied"
      ? 0xef4444
      : 0x2ecc71;

  const titleName = application.applicant.discord || application.applicant.gameName || application.applicant.name || "Applicant";
  const embed = new EmbedBuilder()
    .setTitle(`${titleName}'s Police Application Submitted`)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: status ? `LS Mongolia Applications • ${status}` : "LS Mongolia Applications" });

  application.questions.slice(0, 12).forEach((item, index) => {
    embed.addFields({
      name: short(`${index + 1}. ${item.question}`, 256),
      value: short(item.answer),
      inline: false
    });
  });

  embed.addFields(
    {
      name: "Мэдээлэл",
      value: short([
        `Ангилал: ${application.category}`,
        `Албан тушаал: ${application.position || "Бөглөөгүй"}`,
        `Овог нэр: ${application.applicant.name || "Бөглөөгүй"}`,
        `Discord: ${application.applicant.discord || "Бөглөөгүй"}`,
        `Утас: ${application.applicant.phone || "Бөглөөгүй"}`,
        `Имэйл: ${application.applicant.email || "Бөглөөгүй"}`,
        `Ажиллах цаг: ${application.applicant.availability || "Бөглөөгүй"}`,
        `Тоглоом доторх нэр: ${application.applicant.gameName || "Бөглөөгүй"}`
      ].join("\n")),
      inline: false
    },
    {
      name: "\u200b",
      value: short([
        "**Submission stats**",
        `ApplicationId: ${application.id}`,
        `UserId: ${application.applicant.discordId || "Website login"}`,
        `Username: ${application.applicant.discord || "Бөглөөгүй"}`,
        `Submitted: ${new Date().toLocaleString("mn-MN")}`
      ].join("\n")),
      inline: false
    }
  );

  return embed;
}

function actionRows(applicationId, disabled = false){
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lsapp:accept:${applicationId}`).setLabel("Accept").setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lsapp:deny:${applicationId}`).setLabel("Deny").setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lsapp:accept_reason:${applicationId}`).setLabel("Accept with reason").setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lsapp:deny_reason:${applicationId}`).setLabel("Deny with reason").setStyle(ButtonStyle.Danger).setDisabled(disabled)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lsapp:history:${applicationId}`).setLabel("History").setStyle(ButtonStyle.Primary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`lsapp:ticket:${applicationId}`).setLabel("Open ticket with user").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    )
  ];
}

function canReview(member){
  if(!member) return false;
  if(member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return STAFF_ROLE_ID ? member.roles.cache.has(STAFF_ROLE_ID) : true;
}

const applications = new Map();

function ensureDataDir(){
  fs.mkdirSync(DATA_DIR, { recursive:true });
}

function loadApplicationsFromDisk(){
  try{
    ensureDataDir();
    if(!fs.existsSync(APPLICATIONS_FILE)) return;
    const items = JSON.parse(fs.readFileSync(APPLICATIONS_FILE, "utf8"));
    if(Array.isArray(items)){
      items.forEach(item => {
        if(item && item.id) applications.set(item.id, item);
      });
    }
    console.log(`Loaded ${applications.size} applications from disk`);
  }catch(error){
    console.error("Could not load applications:", error);
  }
}

function saveApplicationsToDisk(){
  ensureDataDir();
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify([...applications.values()], null, 2));
}

function saveApplication(application){
  applications.set(application.id, application);
  saveApplicationsToDisk();
}

function applicationListForAccess(access){
  return [...applications.values()].filter(item => {
    if(access.groups.admin || access.groups.staff) return true;
    if(access.permissions.managePolice && item.roleKey === "police") return true;
    if(access.permissions.manageMedic && item.roleKey === "medic") return true;
    return false;
  }).map(item => ({
    id:item.id,
    roleKey:item.roleKey,
    category:item.category,
    position:item.position,
    status:item.status || "Pending",
    reviewedBy:item.reviewedBy || "",
    applicant:item.applicant,
    submittedAt:item.submittedAt || "",
    reviewedAt:item.reviewedAt || "",
    submittedMessage:item.messageId && item.channelId
      ? `https://discord.com/channels/${GUILD_ID}/${item.channelId}/${item.messageId}`
      : ""
  }));
}

app.get("/health", (request, response) => {
  response.json({ ok: true, botReady: client.isReady() });
});

app.get("/me", async (request, response) => {
  try{
    if(!client.isReady()) return response.status(503).json({ error: "Bot is not ready" });
    if(!GUILD_ID) return response.status(500).json({ error: "DISCORD_GUILD_ID is missing" });

    const user = await userFromBearer(request);
    if(!user) return response.status(401).json({ error: "Discord login required" });

    const guild = await client.guilds.fetch(GUILD_ID);
    let member = null;
    try{
      member = await guild.members.fetch(user.id);
    }catch(error){
      member = null;
    }

    const access = accessForMember(member, user);
    response.json({
      ok:true,
      user:{
        id:user.id,
        username:user.username,
        displayName:user.global_name || user.username,
        avatar:user.avatar
      },
      ...access
    });
  }catch(error){
    console.error("/me failed:", error);
    response.status(500).json({ error: "Could not verify Discord roles" });
  }
});

app.get("/applications", async (request, response) => {
  try{
    const user = await userFromBearer(request);
    if(!user) return response.status(401).json({ error: "Discord login required" });
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(user.id);
    const access = accessForMember(member, user);

    if(!access.permissions.viewApplications){
      return response.status(403).json({ error: "No application access" });
    }

    response.json({ ok:true, items:applicationListForAccess(access) });
  }catch(error){
    console.error("/applications failed:", error);
    response.status(500).json({ error: "Could not load applications" });
  }
});

app.post("/applications", async (request, response) => {
  try{
    if(!client.isReady()) return response.status(503).json({ error: "Bot is not ready" });
    if(!APPLICATION_CHANNEL_ID) return response.status(500).json({ error: "APPLICATION_CHANNEL_ID is missing" });

    const application = normalizeApplication(request.body || {});
    const channel = await client.channels.fetch(APPLICATION_CHANNEL_ID);
    if(!channel || !channel.isTextBased()) return response.status(500).json({ error: "Application channel is invalid" });

    const message = await channel.send({
      content: "Police Application Application Submitted",
      embeds: [applicationEmbed(application)],
      components: actionRows(application.id)
    });

    saveApplication({
      ...application,
      submittedAt:new Date().toISOString(),
      status:"Pending",
      messageId: message.id,
      channelId: message.channelId
    });

    response.status(201).json({ ok: true, applicationId: application.id, messageUrl: message.url });
  }catch(error){
    console.error("/applications submit failed:", error);
    response.status(500).json({ error: error.message || "Could not submit application" });
  }
});
client.once("ready", () => {
  loadApplicationsFromDisk();
  console.log(`LS Mongolia application bot online as ${client.user.tag}`);
});

app.listen(PORT, () => {
  console.log(`LS Mongolia application API listening on port ${PORT}`);
});

const discordToken = String(process.env.DISCORD_TOKEN || "")
  .trim()
  .replace(/^Bot\s+/i, "");

if(!discordToken){
  console.error("DISCORD_TOKEN is missing. Add it in Render Environment variables.");
  process.exit(1);
}

client.login(discordToken).catch(error => {
  console.error("Discord bot login failed:", error);
  process.exit(1);
});
