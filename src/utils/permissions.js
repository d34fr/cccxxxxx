// src/utils/permissions.js
import { PermissionFlagsBits } from 'discord.js';
import { getGuildSettings, ownerMute } from '../db.js';
import { BOT_OWNERS } from '../config.js';

// SYS+ via .env BOT_OWNERS=123,456
export function isSysPlus(userId) {
  return BOT_OWNERS.includes(userId);
}

export function isOwnerMute(guildId, userId) {
  try { return ownerMute.list(guildId).includes(userId); }
  catch { return false; }
}

export function canUseOwnerMuteConfig(guildId, member) {
  return isSysPlus(member.id) || isOwnerMute(guildId, member.id);
}

// ➜ Gestion reste par rôle (ou super-pouvoirs)
export function canUseGestion(guildId, member) {
  const gs = getGuildSettings(guildId);
  if (isSysPlus(member.id) || isOwnerMute(guildId, member.id)) return true;
  return member.roles.cache.some(r => gs.gestion_role_ids?.includes(r.id));
}

// ➜ STAFF = voit le salon de sanctions (ou super-pouvoirs)
export function canUseStaffCommands(guildId, member) {
  if (isSysPlus(member.id) || isOwnerMute(guildId, member.id)) return true;
  const gs = getGuildSettings(guildId);
  const ch = gs.sanction_channel_id
    ? member.guild.channels.cache.get(gs.sanction_channel_id)
    : null;
  if (!ch) return false;
  try {
    return ch.permissionsFor(member).has(PermissionFlagsBits.ViewChannel);
  } catch {
    return false;
  }
}

// Donne une “catégorie” utile aux vérifs staff vs staff
export function getTier(guildId, member) {
  if (isSysPlus(member.id)) return 'SYS+';
  if (isOwnerMute(guildId, member.id)) return 'OWNERMUTE';
  const gs = getGuildSettings(guildId);
  if (member.roles.cache.some(r => gs.gestion_role_ids?.includes(r.id))) return 'GESTION';
  const ch = gs.sanction_channel_id
    ? member.guild.channels.cache.get(gs.sanction_channel_id)
    : null;
  if (ch && ch.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel)) return 'STAFF';
  return 'MEMBER';
}

export function isHigherRole(actor, target) {
  if (actor.id === target.id) return false;
  const a = actor.roles.highest?.position ?? 0;
  const b = target.roles.highest?.position ?? 0;
  return a > b;
}

export function ensureBotCanManageRole(guild, roleId, me) {
  const role = guild.roles.cache.get(roleId);
  if (!role) return { ok:false, reason:'Rôle introuvable.' };
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { ok:false, reason:'Il me manque la permission **Gérer les rôles**.' };
  }
  if (me.roles.highest.position <= role.position) {
    return { ok:false, reason:'Mon rôle est sous le rôle Muted.' };
  }
  return { ok:true };
}
