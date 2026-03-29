import { SlashCommandBuilder } from 'discord.js';
import { ownerMute as ownerDb } from '../db.js';
import { isSysPlus } from '../utils/permissions.js';
import { createErrorEmbed, createInfoEmbed, createSuccessEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('ownermute')
  .setDescription('Lister ou toggle les OwnerMute (SYS+ seulement)')
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à ajouter/retirer'));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  if (!isSysPlus(interaction.user.id)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Réservé SYS+')],
      ephemeral: true
    });
  }

  const guildId = interaction.guild.id;
  const user = interaction.options.getUser('user');

  if (!user) {
    const list = ownerDb.list(guildId);
    return interaction.reply({ 
      embeds: [createInfoEmbed(list.length ? list.map(id => `<@${id}>`).join('\n') : '—')], 
      ephemeral: true 
    });
  } else {
    const action = ownerDb.toggle(guildId, user.id);
    const message = action === 'ADD' 
      ? `✅ ${user} ajouté à OwnerMute`
      : `🗑️ ${user} retiré de OwnerMute`;
    
    return interaction.reply({ 
      embeds: [createSuccessEmbed(message)], 
      ephemeral: true 
    });
  }
}
