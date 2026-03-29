import { getGuildSettings } from '../db.js';

export async function sendLog(guild, build) {
  const gs = getGuildSettings(guild.id);
  if (!gs.logs_channel_id) throw new Error('Salon de logs non configuré (/config logs)');
  const ch = guild.channels.cache.get(gs.logs_channel_id);
  if (!ch) throw new Error('Salon de logs introuvable ou inacessible');
  const embed = build();
  return ch.send({ embeds: [embed] });
}
