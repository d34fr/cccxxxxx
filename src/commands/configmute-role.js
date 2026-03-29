import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, setMuteRole } from '../db.js';
import { canUseOwnerMuteConfig, ensureBotCanManageRole } from '../utils/permissions.js';
import { createErrorEmbed, createSuccessEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('configmute')
  .setDescription('Configurer le rôle Muted')
  .addSubcommand(sub =>
    sub.setName('role')
      .setDescription('Définir/remplacer le rôle Muted')
      .addRoleOption(o => o.setName('role').setDescription('Rôle Muted').setRequired(true))
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  const guild = interaction.guild;
  const guildId = guild.id;

  if (!canUseOwnerMuteConfig(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Réservé OwnerMute / SYS+')],
      ephemeral: true
    });
  }

  const role = interaction.options.getRole('role', true);
  const me = guild.members.me;
  const check = ensureBotCanManageRole(guild, role.id, me);

  if (!check.ok) {
    return interaction.reply({
      embeds: [createErrorEmbed(check.reason)],
      ephemeral: true
    });
  }

  setMuteRole(guildId, role.id);

  return interaction.reply({
    embeds: [createSuccessEmbed(`Rôle Muted défini sur ${role}`)],
    ephemeral: true
  });
}
