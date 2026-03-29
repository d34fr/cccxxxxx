// src/commands/unmuteall.js
import { SlashCommandBuilder } from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { getTier } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { safeDM, dmTemplates, ts } from '../utils/dm.js';
import { clearMuteTimer } from '../services/scheduler.js';
import { createErrorEmbed, createSuccessEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('unmuteall')
  .setDescription('Démuter tout le monde (global) — Gestion / OwnerMute / SYS+');

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const guildId = guild.id;
  const actorTier = getTier(guildId, interaction.member);

  if (!['SYS+','OWNERMUTE','GESTION'].includes(actorTier)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Réservé Gestion / OwnerMute / SYS+')],
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const gs = getGuildSettings(guildId);
  if (!gs.mute_role_id) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Configure le rôle Muted avec /configmute role')]
    });
  }

  // Rôle Muted
  const role = guild.roles.cache.get(gs.mute_role_id);
  if (!role) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Rôle Muted introuvable.')]
    });
  }

  // Sanctions MUTE actives (toute la guilde)
  const actives = sanctions.getActiveMutesByGuild
    ? sanctions.getActiveMutesByGuild(guildId)
    : []; // fallback si version ancienne

  // Retirer le rôle Muted à tous ceux qui l’ont
  let removedCount = 0;
  try {
    const members = await guild.members.fetch();
    for (const [, m] of members) {
      if (m.roles.cache.has(role.id)) {
        await m.roles.remove(role.id).catch(() => {});
        removedCount++;
      }
    }
  } catch {}

  // Révoquer toutes les sanctions + DMs
  for (const s of actives) {
    sanctions.setRevoked(s.id, interaction.user.id);
    clearMuteTimer(s.id);

    // DM au membre
    const targetUser = await interaction.client.users.fetch(s.user_id).catch(() => null);
    if (targetUser) {
      await safeDM(targetUser, dmTemplates().unmuteManual({
        guild: guild.name,
        revokerTag: interaction.user.tag,
        nowTs: ts(Date.now())
      }));
    }

    // DM au modérateur d’origine
    const modUser = await interaction.client.users.fetch(s.moderator_id).catch(() => null);
    if (modUser) {
      await safeDM(modUser, dmTemplates().notifyModManual({
        guild: guild.name,
        memberTag: targetUser ? targetUser.tag : `<@${s.user_id}>`,
        revokerTag: interaction.user.tag,
        reason: s.reason || '—',
        humanDuration: s.duration_ms ? `${Math.round(s.duration_ms / 60000)}m` : '—',
        createdTs: ts(s.created_at),
        expiresTs: ts(s.created_at + (s.duration_ms || 0))
      }));
    }
  }

  // Logs
  await sendLog(guild, (e) => {
    return createEmbed({
      title: '🔴 UNMUTE ALL (GLOBAL)',
      fields: [
        { name: '👤 Par', value: `${interaction.user}`, inline: true },
        { name: '📝 Sanctions révoquées', value: String(actives.length), inline: true },
        { name: '🔇 Rôles Muted retirés', value: String(removedCount), inline: true }
      ]
    });
  }).catch(() => {});

  return interaction.editReply({
    embeds: [createSuccessEmbed(`🔓 **Unmute global OK.** ${removedCount} rôles retirés, ${actives.length} sanctions révoquées.`)]
  });
}
