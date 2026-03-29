import { sanctions } from '../db.js';
import { sendLog } from '../utils/logs.js';
import { dmTemplates, safeDM, humanizeMs, ts } from '../utils/dm.js';
import { createEmbed } from '../utils/embed.js';

const timers = new Map(); // sanctionId -> timeout

export function scheduleMuteExpiry(client, sanction) {
  const expiresAt = sanction.created_at + (sanction.duration_ms || 0);
  const delay = Math.max(0, expiresAt - Date.now());
  clearMuteTimer(sanction.id);
  const t = setTimeout(async () => {
    try {
      await expireMute(client, sanction.id);
    } catch (e) {
      console.error('Expire error', e);
    } finally {
      timers.delete(sanction.id);
    }
  }, delay);
  timers.set(sanction.id, t);
}

export function clearMuteTimer(id) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
}

export async function expireMute(client, sanctionId) {
  // Load latest sanction
  const row = client.db.prepare(`SELECT * FROM sanctions WHERE id=?`).get(sanctionId);
  if (!row || row.status !== 'ACTIVE' || row.type !== 'MUTE') return;
  const guild = await client.guilds.fetch(row.guild_id).catch(() => null);
  if (!guild) return;
  const member = await guild.members.fetch(row.user_id).catch(() => null);

  // Remove muted role if present
  const gs = client.getGuildSettings(row.guild_id);
  if (member && gs.mute_role_id) {
    const role = guild.roles.cache.get(gs.mute_role_id);
    if (role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role.id).catch(() => {});
    }
  }

  // Mark expired
  sanctions.setExpired(sanctionId);

  // DMs
  const templates = dmTemplates();
  if (member) {
    await safeDM(member.user, templates.unmuteAuto({ guild: guild.name, nowTs: ts(Date.now()) }));
  }
  // Notify original moderator
  const modUser = await client.users.fetch(row.moderator_id).catch(() => null);
  if (modUser) {
    const humanDuration = humanizeMs(row.duration_ms || 0);
    await safeDM(modUser, templates.notifyModAuto({
      guild: guild.name,
      memberTag: member ? member.user.tag : row.user_id,
      reason: row.reason || '—',
      humanDuration,
      createdTs: ts(row.created_at),
      expiresTs: ts(row.created_at + (row.duration_ms || 0))
    }));
  }

  // Logs
  await sendLog(guild, (e) => {
    return createEmbed({
      title: '🔇 Unmute Automatique',
      color: '#00FF00',
      fields: [
        { name: '👥 Membre', value: `<@${row.user_id}>`, inline: true },
        { name: '👤 Par', value: 'Système (expiration)', inline: true },
        { name: '📝 Raison initiale', value: row.reason || '—', inline: false },
        { name: '🆔 Sanction ID', value: String(row.id), inline: true },
      ]
    });
  }).catch(() => {});
}

export async function bootstrapSchedulers(client) {
  const actives = sanctions.getActiveWithExpiry();
  for (const s of actives) {
    const expiresAt = s.created_at + (s.duration_ms || 0);
    if (expiresAt <= Date.now()) {
      await expireMute(client, s.id);
    } else {
      scheduleMuteExpiry(client, s);
    }
  }
  // Cleanup: remove muted role if no active mute
  for (const guild of client.guilds.cache.values()) {
    const gs = client.getGuildSettings(guild.id);
    if (!gs.mute_role_id) continue;
    const role = guild.roles.cache.get(gs.mute_role_id);
    if (!role) continue;
    try {
      const members = await guild.members.fetch();
      for (const m of members.values()) {
        if (m.roles.cache.has(role.id)) {
          const active = sanctions.getActiveMutesByUser(guild.id, m.id);
          if (!active || active.length === 0) {
            await m.roles.remove(role.id).catch(() => {});
            await sendLog(guild, (e) => {
              return createEmbed({
                title: 'CLEANUP — Rôle Muted retiré',
                fields: [{ name:'Membre', value:`<@${m.id}>` }]
              });
            }).catch(() => {});
          }
        }
      }
    } catch {}
  }
}
