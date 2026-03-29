import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.json');

// Structure par défaut de la base de données
const defaultDB = {
  guilds: {},
  sanctions: [],
  ownerMute: {},
  nextSanctionId: 1
};

// Charger ou créer la base de données
let db = defaultDB;
if (fs.existsSync(dbPath)) {
  try {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    // Assurer la compatibilité avec la structure
    if (!db.guilds) db.guilds = {};
    if (!db.sanctions) db.sanctions = [];
    if (!db.ownerMute) db.ownerMute = {};
    if (!db.nextSanctionId) db.nextSanctionId = Math.max(...db.sanctions.map(s => s.id), 0) + 1;
  } catch (e) {
    console.error('Erreur lors du chargement de la DB:', e);
    db = defaultDB;
  }
}

// Sauvegarder la base de données
function saveDB() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Erreur lors de la sauvegarde:', e);
  }
}

// Helpers guild_settings
export function getGuildSettings(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      logs_channel_id: null,
      gestion_role_ids: [],
      staff_role_ids: [],
      mute_role_id: null,
      sanction_channel_id: null
    };
    saveDB();
  }
  return db.guilds[guildId];
}

export function setLogsChannel(guildId, channelId) {
  const guild = getGuildSettings(guildId);
  guild.logs_channel_id = channelId;
  saveDB();
}

export function setMuteRole(guildId, roleId) {
  const guild = getGuildSettings(guildId);
  guild.mute_role_id = roleId;
  saveDB();
}

export function setGestionRoles(guildId, roleIds) {
  const guild = getGuildSettings(guildId);
  guild.gestion_role_ids = roleIds;
  saveDB();
}

export function setStaffRoles(guildId, roleIds) {
  const guild = getGuildSettings(guildId);
  guild.staff_role_ids = roleIds;
  saveDB();
}

export function setSanctionChannel(guildId, channelId) {
  const guild = getGuildSettings(guildId);
  guild.sanction_channel_id = channelId;
  saveDB();
}

// OwnerMute
export const ownerMute = {
  list: (guildId) => db.ownerMute[guildId] || [],
  toggle: (guildId, userId) => {
    if (!db.ownerMute[guildId]) db.ownerMute[guildId] = [];
    const index = db.ownerMute[guildId].indexOf(userId);
    if (index === -1) {
      db.ownerMute[guildId].push(userId);
      saveDB();
      return 'ADD';
    } else {
      db.ownerMute[guildId].splice(index, 1);
      saveDB();
      return 'REMOVE';
    }
  }
};

// Sanctions
export const sanctions = {
  createWarn: (guildId, userId, reason, moderatorId) => {
    const now = Date.now();
    const sanction = {
      id: db.nextSanctionId++,
      guild_id: guildId,
      user_id: userId,
      type: 'WARN',
      reason: reason || null,
      moderator_id: moderatorId,
      created_at: now,
      status: 'ACTIVE',
      duration_ms: null,
      revoked_by: null,
      revoked_at: null
    };
    db.sanctions.push(sanction);
    saveDB();
    return { id: sanction.id, created_at: now };
  },

  createMute: (guildId, userId, reason, moderatorId, durationMs) => {
    const now = Date.now();
    const sanction = {
      id: db.nextSanctionId++,
      guild_id: guildId,
      user_id: userId,
      type: 'MUTE',
      reason: reason || null,
      moderator_id: moderatorId,
      created_at: now,
      duration_ms: durationMs,
      status: 'ACTIVE',
      revoked_by: null,
      revoked_at: null
    };
    db.sanctions.push(sanction);
    saveDB();
    return { id: sanction.id, created_at: now };
  },

  getActiveMutesByUser: (guildId, userId) => 
    db.sanctions.filter(s => s.guild_id === guildId && s.user_id === userId && s.type === 'MUTE' && s.status === 'ACTIVE')
      .sort((a, b) => b.id - a.id),

  getLatestActiveMuteByUser: (guildId, userId) => {
    const mutes = sanctions.getActiveMutesByUser(guildId, userId);
    return mutes.length > 0 ? mutes[0] : null;
  },

  getActiveMutesByGuild: (guildId) => 
    db.sanctions.filter(s => s.guild_id === guildId && s.type === 'MUTE' && s.status === 'ACTIVE')
      .sort((a, b) => b.id - a.id),

  setRevoked: (id, revokerId) => {
    const sanction = db.sanctions.find(s => s.id === id);
    if (sanction) {
      sanction.status = 'REVOKED';
      sanction.revoked_by = revokerId;
      sanction.revoked_at = Date.now();
      saveDB();
    }
  },

  setExpired: (id) => {
    const sanction = db.sanctions.find(s => s.id === id);
    if (sanction) {
      sanction.status = 'EXPIRED';
      saveDB();
    }
  },

  deleteOne: (guildId, userId, id) => {
    const index = db.sanctions.findIndex(s => s.guild_id === guildId && s.user_id === userId && s.id === id);
    if (index !== -1) {
      db.sanctions.splice(index, 1);
      saveDB();
    }
  },

  deleteAllByUser: (guildId, userId) => {
    db.sanctions = db.sanctions.filter(s => !(s.guild_id === guildId && s.user_id === userId));
    saveDB();
  },

  getByUser: (guildId, userId) => 
    db.sanctions.filter(s => s.guild_id === guildId && s.user_id === userId)
      .sort((a, b) => b.id - a.id),

  getActiveWithExpiry: () => 
    db.sanctions.filter(s => s.type === 'MUTE' && s.status === 'ACTIVE' && s.duration_ms !== null)
};