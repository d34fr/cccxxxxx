import { SlashCommandBuilder } from 'discord.js';
import { sanctions, getGuildSettings } from '../db.js';
import { canUseStaffCommands } from '../utils/permissions.js';
import { sendLog } from '../utils/logs.js';
import { safeDM, dmTemplates, ts } from '../utils/dm.js';
import { createErrorEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Avertir un membre')
  .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
  .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const guildId = guild.id;

  // ➜ Salon de sanctions obligatoire
  const gs = getGuildSettings(guildId);
  const sanctionChannel = gs.sanction_channel_id ? guild.channels.cache.get(gs.sanction_channel_id) : null;
  if (sanctionChannel && interaction.channelId !== sanctionChannel.id) {
    return interaction.reply({
      embeds: [createErrorEmbed(`Utilise cette commande dans ${sanctionChannel}.`)],
      ephemeral: true
    });
  }

  // ➜ “Staff” = voit le salon (ou OwnerMute/SYS+)
  if (!canUseStaffCommands(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Accès refusé')],
      ephemeral: true
    });
  }

  const target = interaction.options.getMember('membre', true);
  const reason = interaction.options.getString('raison', true);

  if (!gs.logs_channel_id) {
    return interaction.reply({
      embeds: [createErrorEmbed('Configure le salon de logs avec /config logs')],
      ephemeral: true
    });
  }

  const { id, created_at } = sanctions.createWarn(guildId, target.id, reason, interaction.user.id);

  await safeDM(target.user, dmTemplates().warn({
    guild: guild.name,
    reason,
    moderatorTag: interaction.user.tag,
    nowTs: ts(created_at)
  }));

  await sendLog(guild, (e) => {
    return createEmbed({
      title: '⚠ Warn',
      color: '#FFA500',
      fields: [
        { name: '👤 Auteur', value: `${interaction.user}`, inline: true },
        { name: '👥 Cible', value: `${target}`, inline: true },
        { name: '📝 Raison', value: reason || '—', inline: false },
        { name: '🆔 Sanction ID', value: String(id), inline: true },
      ],
      timestamp: new Date(created_at)
    });
  }).catch(() => {});

  return interaction.reply({
    embeds: [createEmbed({
      description: `### ⚠ Membre Warn\n👤 **Auteur :** ${interaction.user}\n👥 **Cible :** ${target}\n📝 **Raison :** ${reason}\n🆔 **Sanction ID :** \`${id}\``
    })],
    ephemeral: false
  });
}
