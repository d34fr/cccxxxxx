import { SlashCommandBuilder } from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { canUseGestion } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { clearMuteTimer } from '../services/scheduler.js';
import { dmTemplates, safeDM, ts } from '../utils/dm.js';
import { createErrorEmbed, createSuccessEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('delallsanction')
  .setDescription('Supprimer toutes les sanctions d’un membre')
  .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const guildId = guild.id;

  if (!canUseGestion(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Réservé Gestion / OwnerMute / SYS+')],
      ephemeral: true
    });
  }

  const user = interaction.options.getUser('membre', true);
  const gs = getGuildSettings(guildId);

  if (!gs.logs_channel_id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Configure le salon de logs avec /config logs')],
      ephemeral: true
    });
  }

  const rows = sanctions.getByUser(guildId, user.id);

  const activeMutes = rows.filter(r => r.type === 'MUTE' && r.status === 'ACTIVE');

  if (activeMutes.length) {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && gs.mute_role_id && member.roles.cache.has(gs.mute_role_id)) {
      await member.roles.remove(gs.mute_role_id).catch(() => {});
    }

    for (const m of activeMutes) clearMuteTimer(m.id);

    await safeDM(member?.user ?? user, dmTemplates().unmuteManual({
      guild: guild.name, revokerTag: interaction.user.tag, nowTs: ts(Date.now())
    }));

    for (const m of activeMutes) {
      const modUser = await guild.client.users.fetch(m.moderator_id).catch(() => null);
      if (modUser) {
        await safeDM(modUser, dmTemplates().notifyModManual({
          guild: guild.name,
          memberTag: member ? member.user.tag : user.tag,
          revokerTag: interaction.user.tag,
          reason: m.reason || '—',
          humanDuration: `${Math.round((m.duration_ms || 0) / 60000)}m`,
          createdTs: ts(m.created_at),
          expiresTs: ts(m.created_at + (m.duration_ms || 0))
        }));
      }
    }
  }

  sanctions.deleteAllByUser(guildId, user.id);

  await sendLog(guild, (e) => {
    return createEmbed({
      title: '🔴 All Sanction Supprimé',
      fields: [
        { name: '👤 **Auteur :**', value: `${interaction.user}`, inline: true },
        { name: '👥 **Membres :**', value: `<@${user.id}>`, inline: true }
      ]
    });
  }).catch(() => {});

  return interaction.reply({
    embeds: [createSuccessEmbed(`🗑️ Toutes les sanctions supprimées pour ${user}.`)],
    ephemeral: true
  });
}
