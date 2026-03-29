import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { sanctions } from '../db.js';
import { canUseGestion } from '../utils/permissions.js';
import { createErrorEmbed, createInfoEmbed, createEmbed } from '../utils/embed.js';

export const data = new SlashCommandBuilder()
  .setName('sanction')
  .setDescription('Voir le casier judiciaire d’un membre')
  .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true));

export async function execute(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [createErrorEmbed('Guild uniquement')],
      ephemeral: true
    });
  }

  const guildId = interaction.guild.id;

  if (!canUseGestion(guildId, interaction.member)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Cette commande est reservé au Gestion')],
      ephemeral: true
    });
  }

  const target = interaction.options.getUser('membre', true);
  const list = sanctions.getByUser(guildId, target.id);

  if (!list.length) {
    return interaction.reply({
      embeds: [createInfoEmbed('— Aucune sanction —')],
      ephemeral: true
    });
  }

  // Pagination
  const perPage = 5;
  let page = 0;
  const totalPages = Math.ceil(list.length / perPage);

  const generateEmbed = (pageIndex) => {
    const start = pageIndex * perPage;
    const end = start + perPage;
    const slice = list.slice(start, end);

    return createEmbed({
      title: `Casier Judiciaire — ${target.tag}`,
      description: slice.map(s => {
        const base = `### **Sanction ID #${s.id}** — ${s.type}\n\`👤\` Auteur <@${s.moderator_id}>\n\`🕐\` Date : <t:${Math.floor(s.created_at / 1000)}:F>`;
        const reason = s.reason ? `\n\`📝\` Raison: ${s.reason}` : '';
        const dur = s.type === 'MUTE' && s.duration_ms ? `\nDurée: ${Math.round(s.duration_ms / 60000)}m` : '';
        return base + reason + dur;
      }).join('\n\n')
    });
  };

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Secondary)
    );

  const message = await interaction.reply({
    embeds: [generateEmbed(page)],
    components: totalPages > 1 ? [row] : [],
    ephemeral: true
  });

  if (totalPages <= 1) return;

  const collector = message.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id,
    time: 60_000
  });

  collector.on('collect', i => {
    if (i.customId === 'prev') {
      page = page > 0 ? page - 1 : totalPages - 1;
    } else if (i.customId === 'next') {
      page = page + 1 < totalPages ? page + 1 : 0;
    }
    i.update({ embeds: [generateEmbed(page)], components: [row] });
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => {});
  });
}
