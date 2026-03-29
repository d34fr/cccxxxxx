import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { createEmbed, createWarningEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher l\'aide du bot de modération');

const commandCategories = {
  moderation: {
    emoji: '🛡️',
    title: 'Modération',
    commands: [
      {
        name: '/warn',
        description: 'Avertir un membre avec une raison personnalisée',
        permissions: 'Staff'
      },
      {
        name: '/mute',
        description: 'Mute un membre avec un menu de raisons prédéfinies',
        permissions: 'Staff'
      },
      {
        name: '/unmute',
        description: 'Démuter un membre',
        permissions: 'Staff'
      },
      {
        name: '/unmuteall',
        description: 'Démuter tous les membres du serveur',
        permissions: 'Gestion / OwnerMute / SYS+'
      }
    ]
  },
  sanctions: {
    emoji: '📋',
    title: 'Casier Judiciaire',
    commands: [
      {
        name: '/sanction',
        description: 'Consulter le casier judiciaire d\'un membre',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/delsanction',
        description: 'Supprimer une sanction par son ID',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/delallsanction',
        description: 'Supprimer toutes les sanctions d\'un membre',
        permissions: 'Gestion / OwnerMute / SYS+'
      }
    ]
  },
  configuration: {
    emoji: '⚙️',
    title: 'Configuration',
    commands: [
      {
        name: '/config logs',
        description: 'Définir le salon des logs de modération',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/configmute role',
        description: 'Définir le rôle Muted',
        permissions: 'OwnerMute / SYS+'
      },
      {
        name: '/channelsanction',
        description: 'Définir le salon des sanctions',
        permissions: 'Gestion / OwnerMute / SYS+'
      }
    ]
  }
};

const generateSelectMenu = () => {
  return new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('📚 Sélectionne une catégorie...')
        .addOptions(
          Object.entries(commandCategories).map(([key, cat]) => ({
            label: cat.title,
            value: key,
            emoji: cat.emoji,
            description: `${cat.commands.length} commande${cat.commands.length > 1 ? 's' : ''}`
          }))
        )
    );
};

const generateCategoryEmbed = (categoryKey) => {
  const category = commandCategories[categoryKey];

  const fields = category.commands.map(cmd => ({
    name: `${cmd.name}`,
    value: `${cmd.description}\n\`Permissions: ${cmd.permissions}\``,
    inline: false
  }));

  return createEmbed({
    title: `${category.emoji} ${category.title}`,
    fields: fields,
    color: '#2f3136'
  });
};

export async function execute(interaction) {
  const initialMessage = await interaction.reply({
    embeds: [createEmbed({
      title: '📚 Aide — Bot de Modération',
      description: 'Sélectionne une catégorie ci-dessous pour voir les commandes disponibles.',
      fields: [
        {
          name: '🛡️ Modération',
          value: '4 commandes',
          inline: true
        },
        {
          name: '📋 Casier Judiciaire',
          value: '3 commandes',
          inline: true
        },
        {
          name: '⚙️ Configuration',
          value: '3 commandes',
          inline: true
        }
      ],
      color: '#2f3136'
    })],
    components: [generateSelectMenu()],
    fetchReply: true
  });

  const collector = initialMessage.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300_000
  });

  collector.on('collect', async i => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        embeds: [createWarningEmbed('Tu ne peux pas utiliser ce menu.')],
        ephemeral: true
      });
    }

    const selectedCategory = i.values[0];

    await i.update({
      embeds: [generateCategoryEmbed(selectedCategory)],
      components: [generateSelectMenu()]
    });
  });

  collector.on('end', () => {
    initialMessage.edit({ components: [] }).catch(() => {});
  });
}
