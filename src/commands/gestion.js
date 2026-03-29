import { SlashCommandBuilder } from 'discord.js';
import { getGuildSettings, setGestionRoles } from '../db.js';
import { canUseGestion } from '../utils/permissions.js';
import { createErrorEmbed, createSuccessEmbed, createInfoEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('gestion')
  .setDescription('Gérer les rôles Gestion')
  .addSubcommand(sub => 
    sub.setName('add').setDescription('Ajouter un rôle Gestion')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
  )
  .addSubcommand(sub => 
    sub.setName('remove').setDescription('Retirer un rôle Gestion')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true))
  )
  .addSubcommand(sub => 
    sub.setName('list').setDescription('Lister les rôles Gestion')
  );

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Cette commande ne peut être utilisée qu\'en serveur.')],
      ephemeral: true
    });
  }

  const guildId = interaction.guild.id;

  if (!canUseGestion(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Tu n\'as pas la permission d\'utiliser cette commande.')],
      ephemeral: true
    });
  }

  const gs = getGuildSettings(guildId);
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const role = interaction.options.getRole('role', true);
    const set = new Set(gs.gestion_role_ids);
    set.add(role.id);
    setGestionRoles(guildId, [...set]);

    return interaction.reply({
      embeds: [createSuccessEmbed(`Le rôle ${role} a été ajouté aux rôles **Gestion**.`)],
      ephemeral: true
    });

  } else if (sub === 'remove') {
    const role = interaction.options.getRole('role', true);
    const arr = gs.gestion_role_ids.filter(id => id !== role.id);
    setGestionRoles(guildId, arr);

    return interaction.reply({
      embeds: [createSuccessEmbed(`Le rôle ${role} a été retiré des rôles **Gestion**.`)],
      ephemeral: true
    });

  } else {
    return interaction.reply({
      embeds: [createInfoEmbed(
        gs.gestion_role_ids.length > 0
          ? gs.gestion_role_ids.map(id => `<@&${id}>`).join(', ')
          : '—'
      )],
      ephemeral: true
    });
  }
}
