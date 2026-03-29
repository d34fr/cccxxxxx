import { SlashCommandBuilder } from 'discord.js';
import { canUseGestion } from '../utils/permissions.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('channelsanction')
  .setDescription('Définir le salon des sanctions (ceux qui le voient = STAFF pour /mute)')
  .addChannelOption(o => o.setName('channel').setDescription('Salon de sanctions').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Commande serveur uniquement')],
      ephemeral: true
    });
  }
  const guildId = interaction.guild.id;

  if (!canUseGestion(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Accès refusé')],
      ephemeral: true
    });
  }

  const ch = interaction.options.getChannel('channel', true);

  const { setSanctionChannel } = await import('../db.js');
  try {
    setSanctionChannel(guildId, ch.id);
  } catch (e) {}

  return interaction.reply({
    embeds: [createSuccessEmbed(`• Salon : ${ch}\n• Règle /mute : **utilisable uniquement ici**\n• Détection staff : **toute personne qui voit ce salon**`)],
    ephemeral: true
  });
}
