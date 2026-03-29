import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher toutes les commandes disponibles');

const commandCategories = {
  configuration: {
    emoji: '⚙️',
    title: 'Configuration',
    commands: [
      {
        name: '/config logs',
        description: 'Définir le salon où les logs de modération seront envoyés',
        usage: '/config logs #salon-logs',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/configmute role',
        description: 'Définir ou remplacer le rôle Muted utilisé pour les sanctions',
        usage: '/configmute role @Muted',
        permissions: 'OwnerMute / SYS+'
      },
      {
        name: '/channelsanction',
        description: 'Définir le salon des sanctions (visible uniquement par le staff)',
        usage: '/channelsanction #sanctions',
        permissions: 'Gestion / OwnerMute / SYS+'
      }
    ]
  },
  roles: {
    emoji: '👥',
    title: 'Gestion des Rôles',
    commands: [
      {
        name: '/gestion add',
        description: 'Ajouter un rôle au groupe Gestion',
        usage: '/gestion add @Modérateur',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/gestion remove',
        description: 'Retirer un rôle du groupe Gestion',
        usage: '/gestion remove @Modérateur',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/gestion list',
        description: 'Lister tous les rôles Gestion configurés',
        usage: '/gestion list',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/ownermute',
        description: 'Lister ou ajouter/retirer un utilisateur du groupe OwnerMute',
        usage: '/ownermute [@utilisateur]',
        permissions: 'SYS+'
      }
    ]
  },
  moderation: {
    emoji: '🛡️',
    title: 'Modération',
    commands: [
      {
        name: '/warn',
        description: 'Avertir un membre avec une raison personnalisée',
        usage: '/warn @membre raison',
        permissions: 'Staff (voir salon sanctions)'
      },
      {
        name: '/mute',
        description: 'Mute un membre avec un menu de raisons prédéfinies et durées automatiques',
        usage: '/mute @membre',
        permissions: 'Staff (voir salon sanctions)'
      },
      {
        name: '/unmute',
        description: 'Démuter manuellement un membre avant la fin de sa sanction',
        usage: '/unmute @membre',
        permissions: 'Staff (voir salon sanctions)'
      },
      {
        name: '/unmuteall',
        description: 'Démuter tous les membres du serveur (global)',
        usage: '/unmuteall',
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
        description: 'Consulter le casier judiciaire complet d\'un membre',
        usage: '/sanction @membre',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/delsanction',
        description: 'Supprimer une sanction spécifique par son ID',
        usage: '/delsanction @membre id',
        permissions: 'Gestion / OwnerMute / SYS+'
      },
      {
        name: '/delallsanction',
        description: 'Supprimer toutes les sanctions d\'un membre',
        usage: '/delallsanction @membre',
        permissions: 'Gestion / OwnerMute / SYS+'
      }
    ]
  },
  info: {
    emoji: 'ℹ️',
    title: 'Informations',
    commands: [
      {
        name: '/help',
        description: 'Afficher ce menu d\'aide avec toutes les commandes',
        usage: '/help',
        permissions: 'Tous'
      }
    ]
  }
};

export async function execute(interaction) {
  const categories = Object.keys(commandCategories);
  let currentPage = 0;

  const generatePageEmbed = (pageIndex) => {
    const categoryKey = categories[pageIndex];
    const category = commandCategories[categoryKey];

    const fields = category.commands.map(cmd => ({
      name: `${category.emoji} ${cmd.name}`,
      value: `**Description :** ${cmd.description}\n**Usage :** \`${cmd.usage}\`\n**Permissions :** ${cmd.permissions}`,
      inline: false
    }));

    return createEmbed({
      title: `${category.emoji} ${category.title}`,
      description: `Liste des commandes disponibles dans cette catégorie\n\n**Page ${pageIndex + 1}/${categories.length}**`,
      fields: fields,
      color: '#2f3136'
    });
  };

  const generateButtons = (currentIndex) => {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_first')
          .setEmoji('⏮️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId('help_prev')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentIndex === 0),
        new ButtonBuilder()
          .setCustomId('help_home')
          .setEmoji('🏠')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('help_next')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentIndex === categories.length - 1),
        new ButtonBuilder()
          .setCustomId('help_last')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentIndex === categories.length - 1)
      );
  };

  const generateHomeEmbed = () => {
    const categoriesText = Object.entries(commandCategories).map(([key, cat]) =>
      `${cat.emoji} **${cat.title}** — ${cat.commands.length} commande${cat.commands.length > 1 ? 's' : ''}`
    ).join('\n');

    return createEmbed({
      title: '📚 Menu d\'Aide — Discord Mod Bot',
      description: `Bienvenue dans le système d'aide du bot de modération.\n\nUtilise les boutons ci-dessous pour naviguer entre les différentes catégories.\n\n**Catégories disponibles :**\n${categoriesText}\n\n**Hiérarchie des permissions :**\n\`SYS+\` → \`OwnerMute\` → \`Gestion\` → \`Staff\` → \`Membres\``,
      fields: [
        {
          name: '💡 Astuce',
          value: 'Les commandes de modération (/warn, /mute, /unmute) ne fonctionnent que dans le salon de sanctions configuré.',
          inline: false
        }
      ],
      color: '#2f3136'
    });
  };

  const message = await interaction.reply({
    embeds: [generateHomeEmbed()],
    components: [generateButtons(currentPage)],
    ephemeral: true,
    fetchReply: true
  });

  const collector = message.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 300_000 // 5 minutes
  });

  collector.on('collect', async i => {
    if (i.customId === 'help_first') {
      currentPage = 0;
    } else if (i.customId === 'help_prev') {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId === 'help_home') {
      await i.update({
        embeds: [generateHomeEmbed()],
        components: [generateButtons(currentPage)]
      });
      return;
    } else if (i.customId === 'help_next') {
      currentPage = Math.min(categories.length - 1, currentPage + 1);
    } else if (i.customId === 'help_last') {
      currentPage = categories.length - 1;
    }

    await i.update({
      embeds: [generatePageEmbed(currentPage)],
      components: [generateButtons(currentPage)]
    });
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => {});
  });
}
