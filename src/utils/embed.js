import { EmbedBuilder } from 'discord.js';
import { DEFAULT_EMBED } from '../config.js';

export function createEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || DEFAULT_EMBED.color)
    .setFooter(DEFAULT_EMBED.footer);

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.timestamp !== false) embed.setTimestamp(options.timestamp || new Date());
  if (options.image) embed.setImage(options.image);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);

  return embed;
}

export function createErrorEmbed(description) {
  return createEmbed({
    color: '#FF0000',
    title: '❌ Erreur',
    description
  });
}

export function createSuccessEmbed(description) {
  return createEmbed({
    color: '#00FF00',
    title: '✅ Succès',
    description
  });
}

export function createWarningEmbed(description) {
  return createEmbed({
    color: '#FFA500',
    title: '⚠️ Attention',
    description
  });
}

export function createInfoEmbed(description) {
  return createEmbed({
    color: DEFAULT_EMBED.color,
    title: 'ℹ️ Information',
    description
  });
}