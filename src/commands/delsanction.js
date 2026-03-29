import { SlashCommandBuilder } from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { canUseGestion } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { clearMuteTimer } from '../services/scheduler.js';
import { dmTemplates, safeDM, ts } from '../utils/dm.js';
import { createErrorEmbed, createSuccessEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('delsanction')
  .setDescription('Supprimer une sanction précise')
  .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
  .addIntegerOption(o => o.setName('id').setDescription('ID de la sanction').setRequired(true));

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
  const id = interaction.options.getInteger('id', true);
  const gs = getGuildSettings(guildId);

  if (!gs.logs_channel_id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Configure le salon de logs avec /config logs')],
      ephemeral: true
    });
  }

  const allSanctions = sanctions.getByUser(guildId, user.id);
  const row = allSanctions.find(s => s.id === id);

  if (!row) {
    return interaction.reply({
      embeds: [createErrorEmbed('Sanction introuvable.')],
      ephemeral: true
    });
  }

  if (row.type === 'MUTE' && row.status === 'ACTIVE') {
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && gs.mute_role_id && member.roles.cache.has(gs.mute_role_id)) {
      await member.roles.remove(gs.mute_role_id).catch(() => {});
    }
    clearMuteTimer(row.id);

    await safeDM(member?.user ?? user, dmTemplates().unmuteManual({
      guild: guild.name, revokerTag: interaction.user.tag, nowTs: ts(Date.now())
    }));

    const modUser = await guild.client.users.fetch(row.moderator_id).catch(() => null);
    if (modUser) {
      await safeDM(modUser, dmTemplates().notifyModManual({
        guild: guild.name,
        memberTag: member ? member.user.tag : user.tag,
        revokerTag: interaction.user.tag,
        reason: row.reason || '—',
        humanDuration: `${Math.round((row.duration_ms || 0) / 60000)}m`,
        createdTs: ts(row.created_at),
        expiresTs: ts(row.created_at + (row.duration_ms || 0))
      }));
    }
  }

  sanctions.deleteOne(guildId, user.id, id);

  await sendLog(guild, (e) => {
    return createEmbed({
      title: '⚠ Sanction Supprimé',
      fields: [
        { name: '👤 Auteur', value: `${interaction.user}`, inline: true },
        { name: '👥 Membre', value: `<@${user.id}>`, inline: true },
        { name: '🆔 Sanction ID', value: String(id), inline: true }
      ]
    });
  }).catch(() => {});

  return interaction.reply({
    embeds: [createSuccessEmbed(`🗑️ Sanction #${id} supprimée pour ${user}.`)],
    ephemeral: true
  });
}
