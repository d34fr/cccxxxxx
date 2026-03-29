import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, setLogsChannel } from '../db.js';
import { canUseGestion } from '../utils/permissions.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configuration du bot (logs/staff/gestion)')
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('Définir le salon de logs')
      .addChannelOption(opt => opt.setName('channel').setDescription('Salon de logs').setRequired(true))
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Commande en guild uniquement')],
      ephemeral: true
    });
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === 'logs') {
    if (!canUseGestion(guildId, interaction.member)) {
      return interaction.reply({
        embeds: [createErrorEmbed('Accès refusé')],
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel('channel', true);
    setLogsChannel(guildId, channel.id);

    return interaction.reply({
      embeds: [createSuccessEmbed(`Salon de logs défini sur ${channel}`)],
      ephemeral: true
    });
  }
}
